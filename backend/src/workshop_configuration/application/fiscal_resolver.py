"""Contrato fiscal de lectura; no modifica la resolución de operaciones internas."""

from dataclasses import dataclass
from datetime import date

from django.db import transaction

from identity.application.authorization import require_permission
from identity.models import User
from workshop_configuration.application.electronic_profiles import CONDITIONS
from workshop_configuration.application.entity_warehouse import FiscalEntityNotFoundError
from workshop_configuration.domain.electronic_profile import (
    DeclaredCertificate,
    DeclaredCondition,
    parse_certificate_metadata,
    parse_condition,
)
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import (
    ElectronicProfileRevision,
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

    @property
    def ready_for_preparation(self) -> bool:
        return not self.preparation_issues


def read_issuer_ruc(entity_id: int) -> str:
    """Lectura pública ligera del RUC del emisor para colaboración interna del archivo."""
    ruc = FiscalEntity.objects.filter(pk=entity_id).values_list("ruc", flat=True).first()
    if ruc is None:
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
    return ruc


def resolve_fiscal_configuration(
    *, actor: User, entity_id: int, point_id: int | None, environment: str, on: date
) -> FiscalConfiguration:
    """Autoriza por emisor y lee bajo su bloqueo.

    El comando que prepara debe envolver esta llamada en su transacción exterior,
    después de bloquear recibo, origen y preparación, para conservar D6 hasta guardar.
    El resultado únicamente evalúa configuración: receptor/importes se validan aparte.
    """
    entity = FiscalEntity.objects.filter(pk=entity_id).first()
    if entity is None:
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
    scope = "comercial" if entity.entity_type == "COMERCIAL" else "artesanal"
    require_permission(actor=actor, permission=f"fiscal.{scope}.preparar")
    if environment not in ("1", "2") or type(on) is not date:
        raise ConfigurationValidationError("Ambiente o fecha fiscal inválidos.")
    with transaction.atomic():
        entity = FiscalEntity.objects.select_for_update().get(pk=entity_id)
        profile = (
            ElectronicProfileRevision.objects.filter(fiscal_entity=entity)
            .order_by("-revision")
            .first()
        )
        issues: list[str] = []
        emission_issues: list[str] = []
        if environment == "2":
            issues.append("production_disabled")
        if not (entity.address or "").strip():
            issues.append("matrix_address")
        conditions: tuple[tuple[str, DeclaredCondition], ...] = ()
        certificate = None
        if profile is None:
            issues.append("profile")
        else:
            conditions = tuple(
                (key, parse_condition(profile.conditions.get(key, {"status": "UNKNOWN"})))
                for key in sorted(CONDITIONS)
            )
            for key, condition in conditions:
                if not condition.is_resolved:
                    issues.append(f"conditions.{key}.unknown")
                elif condition.starts_on is not None and on < condition.starts_on:
                    issues.append(f"conditions.{key}.future")
                elif condition.ends_on is not None and on > condition.ends_on:
                    issues.append(f"conditions.{key}.expired")
            if profile.certificate is not None:
                certificate = parse_certificate_metadata(profile.certificate)
        if certificate is None:
            emission_issues.append("certificate_missing")
        elif certificate.status_on(on) != "DECLARED_CURRENT":
            emission_issues.append(f"certificate_{certificate.status_on(on).lower()}")
        emission_issues.append("emission_not_implemented")
        point = (
            FiscalEmissionPoint.objects.filter(
                pk=point_id, establishment__fiscal_entity=entity
            ).first()
            if point_id is not None
            else None
        )
        establishment = None
        if point is None:
            issues.append("point")
        else:
            # Todas las escrituras de configuración serializan primero sobre entidad.
            establishment = FiscalEstablishment.objects.get(pk=point.establishment_id)
            if not point.is_active or not establishment.is_active:
                issues.append("point_inactive")
            if not establishment.address.strip():
                issues.append("establishment_address")
        return FiscalConfiguration(
            entity_id=entity.pk,
            entity_type=entity.entity_type,
            entity_version=entity.version,
            ruc=entity.ruc,
            legal_name=entity.legal_name,
            matrix_address=entity.address or "",
            profile_revision=profile.revision if profile else None,
            conditions=conditions,
            certificate=certificate,
            environment=environment,
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
        )
