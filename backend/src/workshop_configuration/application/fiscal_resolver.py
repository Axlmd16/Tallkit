"""Contrato fiscal de lectura; no modifica la resolución de operaciones internas."""

from dataclasses import dataclass
from datetime import date

from django.db import transaction

from identity.application.authorization import require_permission
from identity.models import User
from workshop_configuration.application.electronic_status import (
    ENVIRONMENT_TEST,
    evaluate_electronic_status,
)
from workshop_configuration.application.entity_warehouse import FiscalEntityNotFoundError
from workshop_configuration.domain.electronic_profile import (
    DeclaredCertificate,
    DeclaredCondition,
)
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import (
    FiscalEmissionPoint,
    FiscalEntity,
    FiscalEstablishment,
)


@dataclass(frozen=True)
class FiscalConfiguration:
    entity_id: int
    entity_type: str
    entity_version: int
    ruc: str
    legal_name: str
    matrix_address: str
    profile_revision: int | None
    conditions: tuple[tuple[str, DeclaredCondition], ...]
    certificate: DeclaredCertificate | None
    environment: str
    establishment_id: int | None
    establishment_code: str | None
    establishment_address: str | None
    establishment_version: int | None
    point_id: int | None
    point_code: str | None
    point_version: int | None
    evaluated_on: date
    preparation_issues: tuple[str, ...]
    future_emission_issues: tuple[str, ...]
    defaults_version: int = 0
    enabled_payment_codes: tuple[str, ...] = ()
    default_payment_code: str | None = None
    tax_mapping_ids: tuple[int, ...] = ()

    @property
    def ready_for_preparation(self) -> bool:
        return not self.preparation_issues


def read_issuer_ruc(entity_id: int) -> str:
    """Lectura pública ligera del RUC del emisor para colaboración interna del archivo."""
    ruc = FiscalEntity.objects.filter(pk=entity_id).values_list("ruc", flat=True).first()
    if ruc is None:
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
    return ruc


def read_issuer(entity_id: int) -> tuple[str, str]:
    """RUC y razón social vigentes del emisor para mostrar el resumen de preparación."""
    row = FiscalEntity.objects.filter(pk=entity_id).values_list("ruc", "legal_name").first()
    if row is None:
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
    return row[0], row[1]


def resolve_fiscal_configuration(*, actor: User, entity_id: int, on: date) -> FiscalConfiguration:
    """Autoriza por emisor y resuelve bajo su bloqueo la configuración centralizada.

    El comando que prepara debe envolver esta llamada en su transacción exterior,
    después de bloquear recibo, origen y preparación, para conservar D6 hasta guardar.
    El ambiente es siempre de pruebas y el punto es el predeterminado efectivo; ninguno
    se recibe del cliente.
    """
    entity = FiscalEntity.objects.filter(pk=entity_id).first()
    if entity is None:
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
    scope = "comercial" if entity.entity_type == "COMERCIAL" else "artesanal"
    require_permission(actor=actor, permission=f"fiscal.{scope}.preparar")
    if type(on) is not date:
        raise ConfigurationValidationError("Fecha fiscal inválida.")
    with transaction.atomic():
        entity = FiscalEntity.objects.select_for_update().get(pk=entity_id)
        status = evaluate_electronic_status(entity_id=entity.pk, on=on)
        issues = [f"{cause.code}" for cause in status.causes]
        emission_issues = [warning.code for warning in status.warnings]
        emission_issues.append("emission_not_implemented")
        point = (
            FiscalEmissionPoint.objects.select_related("establishment")
            .filter(pk=status.defaults.point_id)
            .first()
            if status.defaults.point_id is not None
            else None
        )
        establishment: FiscalEstablishment | None = point.establishment if point else None
        return FiscalConfiguration(
            entity_id=entity.pk,
            entity_type=entity.entity_type,
            entity_version=entity.version,
            ruc=entity.ruc,
            legal_name=entity.legal_name,
            matrix_address=entity.address or "",
            profile_revision=status.profile_revision,
            conditions=status.conditions,
            certificate=status.certificate,
            environment=ENVIRONMENT_TEST,
            establishment_id=establishment.pk if establishment else None,
            establishment_code=establishment.code if establishment else None,
            establishment_address=establishment.address if establishment else None,
            establishment_version=establishment.version if establishment else None,
            point_id=point.pk if point else None,
            point_code=point.code if point else None,
            point_version=point.version if point else None,
            evaluated_on=on,
            preparation_issues=tuple(issues),
            future_emission_issues=tuple(emission_issues),
            defaults_version=status.defaults.version,
            enabled_payment_codes=status.defaults.enabled_payment_codes,
            default_payment_code=status.defaults.payment_code,
            tax_mapping_ids=status.tax_mapping_ids,
        )
