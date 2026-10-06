"""Ajustes de retenciones recibidas por entidad fiscal.

Cada entidad decide si registra retenciones y a partir de qué porcentaje del total
se advierte un importe inusual. No dependen del régimen ni de ninguna condición
tributaria, no participan en el estado del perfil ni en la instantánea fiscal, y sin
un registro explícito rigen los valores por defecto.
"""

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from workshop_configuration.application.entity_warehouse import (
    FiscalEntityNotFoundError,
    StaleRecordError,
)
from workshop_configuration.application.preparation_settings import (
    _command,
    _expected,
    _lock_entity,
)
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import FiscalEntity, ReceivedWithholdingSetting

DEFAULT_REGISTRATION_ENABLED = True
DEFAULT_WARNING_PERCENTAGE = Decimal("20.00")
_UNSET: Any = object()
_CENTS = Decimal("0.01")


@dataclass(frozen=True)
class WithholdingSettings:
    entity_id: int | None
    version: int
    registration_enabled: bool
    warning_percentage: Decimal | None


def _from_row(entity_id: int | None, row: ReceivedWithholdingSetting | None) -> WithholdingSettings:
    if row is None:
        return WithholdingSettings(
            entity_id, 0, DEFAULT_REGISTRATION_ENABLED, DEFAULT_WARNING_PERCENTAGE
        )
    return WithholdingSettings(
        entity_id, row.version, row.registration_enabled, row.warning_percentage
    )


def settings_for_entity(*, entity_id: int) -> WithholdingSettings:
    """Lectura interna sin autorización."""
    row = ReceivedWithholdingSetting.objects.filter(fiscal_entity_id=entity_id).first()
    return _from_row(entity_id, row)


def withholding_settings(entity_type: str) -> WithholdingSettings:
    """Lectura para ventas y taller por tipo de entidad; el consumidor ya autorizó."""
    entity = FiscalEntity.objects.filter(entity_type=entity_type).first()
    if entity is None:
        return _from_row(None, None)
    return settings_for_entity(entity_id=entity.pk)


def _percentage(value: Any) -> Decimal | None:
    if value is None:
        return None
    message = "El porcentaje debe ser mayor que 0, hasta 100 y con máximo dos decimales."
    if isinstance(value, bool | float) or not isinstance(value, str | int | Decimal):
        raise ConfigurationValidationError(message, errors={"warning_percentage": [message]})
    try:
        number = Decimal(str(value).strip())
    except InvalidOperation:
        raise ConfigurationValidationError(
            message, errors={"warning_percentage": [message]}
        ) from None
    exponent = number.as_tuple().exponent
    if (
        not number.is_finite()
        or not isinstance(exponent, int)
        or exponent < -2
        or number <= 0
        or number > 100
    ):
        raise ConfigurationValidationError(message, errors={"warning_percentage": [message]})
    return number.quantize(_CENTS)


def _payload(row: ReceivedWithholdingSetting) -> dict[str, Any]:
    return {
        "version": row.version,
        "registration_enabled": row.registration_enabled,
        "warning_percentage": (
            None if row.warning_percentage is None else f"{row.warning_percentage:.2f}"
        ),
    }


def set_withholding_settings(
    *,
    actor: User,
    entity_id: int,
    expected_version: int,
    idempotency_key: str,
    registration_enabled: Any = _UNSET,
    warning_percentage: Any = _UNSET,
) -> dict[str, Any]:
    require_permission(actor=actor, permission="parametros.gestionar")
    expected = _expected(expected_version)
    changes: dict[str, Any] = {}
    if registration_enabled is not _UNSET:
        if not isinstance(registration_enabled, bool):
            raise ConfigurationValidationError("Indique si la entidad registra retenciones.")
        changes["registration_enabled"] = registration_enabled
    if warning_percentage is not _UNSET:
        changes["warning_percentage"] = _percentage(warning_percentage)
    if not changes:
        raise ConfigurationValidationError("Indique el ajuste de retenciones que desea cambiar.")

    def work() -> dict[str, Any]:
        entity = _lock_entity(entity_id)
        row = (
            ReceivedWithholdingSetting.objects.select_for_update()
            .filter(fiscal_entity=entity)
            .first()
        )
        if (row.version if row else 0) != expected:
            raise StaleRecordError("Los ajustes de retenciones cambiaron; vuelva a consultarlos.")
        if row is None:
            row = ReceivedWithholdingSetting.objects.create(
                fiscal_entity=entity,
                registration_enabled=changes.get(
                    "registration_enabled", DEFAULT_REGISTRATION_ENABLED
                ),
                warning_percentage=changes.get("warning_percentage", DEFAULT_WARNING_PERCENTAGE),
                updated_by=actor,
            )
        else:
            for field, value in changes.items():
                setattr(row, field, value)
            row.version += 1
            row.updated_by = actor
            row.save(update_fields=[*changes, "version", "updated_by", "updated_at"])
        result = _payload(row)
        record_audit_event(
            actor=actor,
            action="fiscal.withholding_settings_saved",
            target_type="received_withholding_setting",
            target_id=str(row.pk),
            result=AuditResult.SUCCESS,
            metadata={"changed_fields": sorted(changes)},
        )
        return result

    return _command(
        actor=actor,
        action="fiscal.withholding_settings_saved",
        idempotency_key=idempotency_key,
        fingerprint_input={
            "entity_id": entity_id,
            "expected": expected,
            **{
                key: (str(value) if isinstance(value, Decimal) else value)
                for key, value in changes.items()
            },
        },
        work=work,
    )


def get_withholding_settings(*, actor: User, entity_id: int) -> WithholdingSettings:
    require_permission(actor=actor, permission="parametros.gestionar")
    if not FiscalEntity.objects.filter(pk=entity_id).exists():
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
    return settings_for_entity(entity_id=entity_id)


__all__ = [
    "WithholdingSettings",
    "get_withholding_settings",
    "set_withholding_settings",
    "settings_for_entity",
    "withholding_settings",
]
