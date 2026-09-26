"""Altas de series y desactivación prospectiva; nunca reasigna códigos fiscales."""

import re
from typing import Any

from django.db import transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from workshop_configuration.application.entity_warehouse import (
    FiscalEntityNotFoundError,
    StaleRecordError,
)
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import FiscalEmissionPoint, FiscalEntity, FiscalEstablishment


def list_establishments(*, actor: User, entity_id: int) -> tuple[FiscalEstablishment, ...]:
    require_permission(actor=actor, permission="parametros.gestionar")
    if not FiscalEntity.objects.filter(pk=entity_id).exists():
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
    return tuple(
        FiscalEstablishment.objects.filter(fiscal_entity_id=entity_id)
        .prefetch_related("emission_points")
        .order_by("code", "id")
    )


def _code(value: Any) -> str:
    if not isinstance(value, str) or re.fullmatch(r"[0-9]{3}", value) is None or value == "000":
        raise ConfigurationValidationError(
            "El código requiere tres dígitos ASCII y no puede ser 000."
        )
    return value


def _audit(actor: User, target: FiscalEstablishment | FiscalEmissionPoint, action: str) -> None:
    record_audit_event(
        actor=actor,
        action=action,
        target_type=target._meta.label_lower,
        target_id=str(target.pk),
        result=AuditResult.SUCCESS,
        metadata={"version": target.version},
    )


def create_establishment(
    *, actor: User, entity_id: int, code: str, address: str
) -> FiscalEstablishment:
    require_permission(actor=actor, permission="parametros.gestionar")
    code = _code(code)
    if not isinstance(address, str) or not 1 <= len(address.strip()) <= 300:
        raise ConfigurationValidationError("Ingrese una dirección de entre 1 y 300 caracteres.")
    with transaction.atomic():
        entity = FiscalEntity.objects.select_for_update().filter(pk=entity_id).first()
        if entity is None:
            raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
        if FiscalEstablishment.objects.filter(fiscal_entity=entity, code=code).exists():
            raise ConfigurationValidationError("El establecimiento ya existe para este emisor.")
        result = FiscalEstablishment.objects.create(
            fiscal_entity=entity, code=code, address=address.strip()
        )
        _audit(actor, result, "fiscal.establishment_created")
        return result


def _lock_establishment(establishment_id: int) -> FiscalEstablishment:
    ref = FiscalEstablishment.objects.filter(pk=establishment_id).values("fiscal_entity_id").first()
    if ref is None:
        raise ConfigurationValidationError("Establecimiento no encontrado.")
    FiscalEntity.objects.select_for_update().get(pk=ref["fiscal_entity_id"])
    return FiscalEstablishment.objects.select_for_update().get(pk=establishment_id)


def create_point(*, actor: User, establishment_id: int, code: str) -> FiscalEmissionPoint:
    require_permission(actor=actor, permission="parametros.gestionar")
    code = _code(code)
    with transaction.atomic():
        establishment = _lock_establishment(establishment_id)
        if not establishment.is_active:
            raise ConfigurationValidationError("El establecimiento está desactivado.")
        if FiscalEmissionPoint.objects.filter(establishment=establishment, code=code).exists():
            raise ConfigurationValidationError("El punto ya existe en este establecimiento.")
        result = FiscalEmissionPoint.objects.create(establishment=establishment, code=code)
        _audit(actor, result, "fiscal.emission_point_created")
        return result


def set_establishment_active(
    *, actor: User, establishment_id: int, expected_version: int, active: bool
) -> FiscalEstablishment:
    require_permission(actor=actor, permission="parametros.gestionar")
    if (
        not isinstance(active, bool)
        or isinstance(expected_version, bool)
        or not isinstance(expected_version, int)
    ):
        raise ConfigurationValidationError("Estado o versión inválidos.")
    with transaction.atomic():
        establishment = _lock_establishment(establishment_id)
        if establishment.version != expected_version:
            raise StaleRecordError("La versión del establecimiento cambió.")
        if establishment.is_active != active:
            establishment.is_active = active
            establishment.version += 1
            establishment.save(update_fields=["is_active", "version"])
            _audit(actor, establishment, "fiscal.establishment_updated")
        return establishment


def set_point_active(
    *, actor: User, point_id: int, expected_version: int, active: bool
) -> FiscalEmissionPoint:
    require_permission(actor=actor, permission="parametros.gestionar")
    if (
        not isinstance(active, bool)
        or isinstance(expected_version, bool)
        or not isinstance(expected_version, int)
    ):
        raise ConfigurationValidationError("Estado o versión inválidos.")
    with transaction.atomic():
        ref = FiscalEmissionPoint.objects.filter(pk=point_id).values("establishment_id").first()
        if ref is None:
            raise ConfigurationValidationError("Punto de emisión no encontrado.")
        establishment = _lock_establishment(ref["establishment_id"])
        point = FiscalEmissionPoint.objects.select_for_update().get(pk=point_id)
        if point.version != expected_version:
            raise StaleRecordError("La versión del punto cambió.")
        if active and not establishment.is_active:
            raise ConfigurationValidationError("El establecimiento está desactivado.")
        if point.is_active != active:
            point.is_active = active
            point.version += 1
            point.save(update_fields=["is_active", "version"])
            _audit(actor, point, "fiscal.emission_point_updated")
        return point
