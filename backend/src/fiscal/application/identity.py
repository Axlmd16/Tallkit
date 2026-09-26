"""Asignación de identidad fiscal de ensayo y antecedentes de numeración externa.

La asignación es atómica e idempotente por preparación: bloquea el ámbito, avanza su
contador e inserta la identidad en una sola transacción, de modo que un fallo no deja
un contador adelantado sin documento. La emisión productiva se rechaza en aplicación
aunque el perfil esté completo; registrar antecedentes externos no consume secuencias.
"""

import secrets
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from django.db import transaction

from fiscal.domain.access_key import (
    ENVIRONMENT_TEST,
    FACTURA,
    SEQUENTIAL_MAX,
    build_access_key,
    format_sequential,
)
from fiscal.domain.states import PreparationState
from fiscal.models import (
    FiscalDocumentIdentity,
    FiscalNumberingAntecedent,
    FiscalNumberingScope,
    FiscalPreparation,
)
from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from shared.transactions import retryable_transaction


class IdentityError(Exception):
    pass


class IdentityPreparationError(IdentityError):
    pass


class ProductionEmissionDisabledError(IdentityError):
    pass


class SequenceExhaustedError(IdentityError):
    pass


@dataclass(frozen=True)
class IdentityResult:
    identity_id: int
    access_key: str
    sequential: str
    replayed: bool


def _permission(preparation: FiscalPreparation) -> str:
    scope = "comercial" if preparation.commercial_sale_id is not None else "artesanal"
    return f"fiscal.{scope}.preparar"


def assign_test_identity(*, actor: User, preparation_id: UUID) -> IdentityResult:
    """Asigna (o recupera) la identidad de ensayo de una preparación preparada."""
    with retryable_transaction():
        preparation = (
            FiscalPreparation.objects.select_for_update().filter(pk=preparation_id).first()
        )
        if preparation is None:
            raise IdentityPreparationError("Preparación fiscal no encontrada.")
        require_permission(actor=actor, permission=_permission(preparation))

        existing = FiscalDocumentIdentity.objects.filter(preparation=preparation).first()
        if existing is not None:
            return IdentityResult(
                identity_id=existing.pk,
                access_key=existing.access_key,
                sequential=format_sequential(existing.sequential),
                replayed=True,
            )

        if preparation.state != PreparationState.PREPARED:
            raise IdentityPreparationError("Solo una preparación preparada puede numerarse.")

        snapshot = preparation.snapshot or {}
        issuer = snapshot.get("issuer", {})
        environment = issuer.get("environment")
        if environment != ENVIRONMENT_TEST:
            raise ProductionEmissionDisabledError(
                "La emisión en producción no está habilitada en esta entrega."
            )
        ruc = issuer["ruc"]
        establishment = issuer["establishment_code"]
        emission_point = issuer["emission_point_code"]
        reference_date = date.fromisoformat(snapshot["reference_date"])
        scope_key = {
            "fiscal_entity_id": preparation.fiscal_entity_id,
            "document_type": FACTURA,
            "establishment_code": establishment,
            "emission_point_code": emission_point,
            "environment": environment,
        }
        FiscalNumberingScope.objects.get_or_create(**scope_key)
        scope = FiscalNumberingScope.objects.select_for_update().get(**scope_key)

        next_sequential = scope.last_sequential + 1
        if next_sequential > SEQUENTIAL_MAX:
            raise SequenceExhaustedError("El ámbito fiscal agotó su secuencia; no reinicia.")
        numeric_code = f"{secrets.randbelow(10**8):08d}"
        access_key = build_access_key(
            emission_date=reference_date,
            doc_type=FACTURA,
            ruc=ruc,
            environment=environment,
            establishment=establishment,
            emission_point=emission_point,
            sequential=format_sequential(next_sequential),
            numeric_code=numeric_code,
        )
        identity = FiscalDocumentIdentity.objects.create(
            preparation=preparation,
            numbering_scope=scope,
            document_type=FACTURA,
            environment=environment,
            ruc=ruc,
            sequential=next_sequential,
            numeric_code=numeric_code,
            emission_date=reference_date,
            access_key=access_key,
            created_by=actor,
        )
        scope.last_sequential = next_sequential
        scope.save(update_fields=["last_sequential", "updated_at"])
        record_audit_event(
            actor=actor,
            action="fiscal.test_identity_assigned",
            target_type="fiscal_document_identity",
            target_id=str(identity.pk),
            result=AuditResult.SUCCESS,
            operation_id=preparation.pk,
        )
        return IdentityResult(
            identity_id=identity.pk,
            access_key=access_key,
            sequential=format_sequential(next_sequential),
            replayed=False,
        )


def record_numbering_antecedent(
    *,
    actor: User,
    entity_id: int,
    document_type: str,
    establishment_code: str,
    emission_point_code: str,
    environment: str,
    last_declared_number: int,
    declared_on: date,
    source: str,
) -> FiscalNumberingAntecedent:
    """Registra numeración externa sin avanzar contadores ni habilitar emisión."""
    require_permission(actor=actor, permission="parametros.gestionar")
    if document_type not in ("01", "04"):
        raise IdentityError("Tipo de comprobante no soportado.")
    if environment not in ("1", "2"):
        raise IdentityError("Ambiente inválido.")
    if isinstance(last_declared_number, bool) or not isinstance(last_declared_number, int):
        raise IdentityError("El último número declarado debe ser un entero.")
    if not 1 <= last_declared_number <= SEQUENTIAL_MAX:
        raise IdentityError("El último número declarado está fuera de rango.")
    if type(declared_on) is not date:
        raise IdentityError("La fecha declarada es inválida.")
    if not isinstance(source, str) or not 1 <= len(source.strip()) <= 500:
        raise IdentityError("Debe documentar la procedencia del antecedente.")
    with transaction.atomic():
        antecedent = FiscalNumberingAntecedent.objects.create(
            fiscal_entity_id=entity_id,
            document_type=document_type,
            establishment_code=establishment_code,
            emission_point_code=emission_point_code,
            environment=environment,
            last_declared_number=last_declared_number,
            declared_on=declared_on,
            source=source.strip(),
            recorded_by=actor,
        )
        record_audit_event(
            actor=actor,
            action="fiscal.numbering_antecedent_recorded",
            target_type="fiscal_numbering_antecedent",
            target_id=str(antecedent.pk),
            result=AuditResult.SUCCESS,
        )
        return antecedent
