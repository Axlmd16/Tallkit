"""Formas de pago habilitadas y valores predeterminados de la preparación fiscal.

Las formas visibles provienen del catálogo oficial; en V1 solo ``01`` y ``20`` son
habilitables (DP-003, RF-ACC-014) y se asocian a efectivo y transferencia. Sin un
registro explícito del Administrador aplica la política: ambas habilitadas y ``01``
predeterminada. El punto efectivo es el designado o, si no hay designación válida, el
único punto activo de la entidad.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import Any, TypeVar

from django.db import IntegrityError, transaction
from django.utils import timezone

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from shared.command_values import canonical_fingerprint, validate_idempotency_key
from workshop_configuration.application.entity_warehouse import (
    FiscalEntityNotFoundError,
    StaleRecordError,
)
from workshop_configuration.application.initialization import IdempotencyConflictError
from workshop_configuration.application.official_catalog import (
    SELECTABLE_PAYMENT_VERSION,
    is_current,
    list_entries,
)
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import (
    ConfigurationCommand,
    FiscalEmissionPoint,
    FiscalEntity,
    FiscalPaymentFormSetting,
    FiscalPreparationDefaults,
)

V1_ENABLEABLE_PAYMENT_FORMS = {"01": "EFECTIVO", "20": "TRANSFERENCIA"}
POLICY_DEFAULT_PAYMENT_CODE = "01"
_UNSET: Any = object()
T = TypeVar("T")


@dataclass(frozen=True)
class PaymentFormOption:
    code: str
    description: str
    display_name: str
    catalog_version: str
    source_document: str
    source_version: str
    source_url: str
    downloaded_on: date
    valid_from: date | None
    valid_to: date | None
    is_current: bool
    enableable: bool
    enabled: bool
    is_default: bool
    internal_method: str | None
    version: int


@dataclass(frozen=True)
class EffectiveDefaults:
    entity_id: int
    version: int
    designated_point_id: int | None
    point_id: int | None
    point_issue: str | None
    payment_code: str | None
    payment_issue: str | None
    enabled_payment_codes: tuple[str, ...]


def _defaults_row(entity_id: int) -> FiscalPreparationDefaults | None:
    return FiscalPreparationDefaults.objects.filter(fiscal_entity_id=entity_id).first()


def _default_payment_code(row: FiscalPreparationDefaults | None) -> str:
    return (row.default_payment_code if row else None) or POLICY_DEFAULT_PAYMENT_CODE


def payment_form_options(*, entity_id: int, on: date) -> tuple[PaymentFormOption, ...]:
    """Lectura interna del catálogo con habilitación efectiva; el consumidor autoriza."""
    settings_by_code = {
        row.code: row for row in FiscalPaymentFormSetting.objects.filter(fiscal_entity_id=entity_id)
    }
    default_code = _default_payment_code(_defaults_row(entity_id))
    options: list[PaymentFormOption] = []
    for entry in list_entries(kind="PAYMENT_FORM", version=SELECTABLE_PAYMENT_VERSION):
        setting = settings_by_code.get(entry.code)
        enableable = entry.code in V1_ENABLEABLE_PAYMENT_FORMS
        current = is_current(entry, on)
        enabled = enableable and current and (setting.enabled if setting else True)
        options.append(
            PaymentFormOption(
                code=entry.code,
                description=entry.description,
                display_name=entry.display_name,
                catalog_version=entry.catalog_version,
                source_document=entry.source_document,
                source_version=entry.source_version,
                source_url=entry.source_url,
                downloaded_on=entry.downloaded_on,
                valid_from=entry.valid_from,
                valid_to=entry.valid_to,
                is_current=current,
                enableable=enableable,
                enabled=enabled,
                is_default=enabled and entry.code == default_code,
                internal_method=V1_ENABLEABLE_PAYMENT_FORMS.get(entry.code),
                version=setting.version if setting else 0,
            )
        )
    return tuple(options)


def _active_points(entity_id: int) -> list[FiscalEmissionPoint]:
    return list(
        FiscalEmissionPoint.objects.filter(
            establishment__fiscal_entity_id=entity_id,
            is_active=True,
            establishment__is_active=True,
        ).order_by("establishment__code", "code", "id")
    )


def effective_defaults(*, entity_id: int, on: date) -> EffectiveDefaults:
    """Lectura interna; la preparación la invoca bajo el bloqueo de la entidad."""
    row = _defaults_row(entity_id)
    active = _active_points(entity_id)
    designated = row.default_point_id if row else None
    point_id: int | None = None
    point_issue: str | None = None
    if designated is not None and any(point.pk == designated for point in active):
        point_id = designated
    elif len(active) == 1:
        point_id = active[0].pk
    elif not active:
        point_issue = "point_missing"
    else:
        point_issue = "default_point_required"
    enabled = tuple(
        option.code for option in payment_form_options(entity_id=entity_id, on=on) if option.enabled
    )
    default_code = _default_payment_code(row)
    payment_code = default_code if default_code in enabled else None
    payment_issue = None
    if not enabled:
        payment_issue = "payment_forms_missing"
    elif payment_code is None:
        payment_issue = "default_payment_form_required"
    return EffectiveDefaults(
        entity_id=entity_id,
        version=row.version if row else 0,
        designated_point_id=designated,
        point_id=point_id,
        point_issue=point_issue,
        payment_code=payment_code,
        payment_issue=payment_issue,
        enabled_payment_codes=enabled,
    )


def _command(
    *,
    actor: User,
    action: str,
    idempotency_key: str,
    fingerprint_input: dict[str, Any],
    work: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    key = validate_idempotency_key(idempotency_key)
    fingerprint = canonical_fingerprint(fingerprint_input)
    with transaction.atomic():
        try:
            with transaction.atomic():
                receipt = ConfigurationCommand.objects.create(
                    actor=actor,
                    action=action,
                    idempotency_key=key,
                    input_fingerprint=fingerprint,
                    response_status=200,
                    result={},
                )
        except IntegrityError:
            receipt = ConfigurationCommand.objects.get(
                actor=actor, action=action, idempotency_key=key
            )
            if receipt.input_fingerprint != fingerprint:
                raise IdempotencyConflictError("La clave corresponde a otra entrada.") from None
            return dict(receipt.result)
        result = work()
        receipt.result = result
        receipt.save(update_fields=["result"])
        return result


def _lock_entity(entity_id: int) -> FiscalEntity:
    entity = FiscalEntity.objects.select_for_update().filter(pk=entity_id).first()
    if entity is None:
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
    return entity


def _expected(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ConfigurationValidationError("La versión esperada debe ser un entero no negativo.")
    return int(value)


def set_payment_form_enabled(
    *,
    actor: User,
    entity_id: int,
    code: str,
    enabled: bool,
    expected_version: int,
    idempotency_key: str,
) -> dict[str, Any]:
    require_permission(actor=actor, permission="parametros.gestionar")
    expected = _expected(expected_version)
    if not isinstance(enabled, bool):
        raise ConfigurationValidationError("Indique si la forma de pago queda habilitada.")

    def work() -> dict[str, Any]:
        entity = _lock_entity(entity_id)
        if code not in V1_ENABLEABLE_PAYMENT_FORMS:
            raise ConfigurationValidationError(
                "payment_form_not_enableable_v1: habilitar esta forma requiere una decisión "
                "que la incorpore a cobros, caja, cierres y conciliación."
            )
        row = (
            FiscalPaymentFormSetting.objects.select_for_update()
            .filter(fiscal_entity=entity, code=code)
            .first()
        )
        if (row.version if row else 0) != expected:
            raise StaleRecordError("La forma de pago cambió; vuelva a consultarla.")
        defaults = (
            FiscalPreparationDefaults.objects.select_for_update()
            .filter(fiscal_entity=entity)
            .first()
        )
        if not enabled and code == _default_payment_code(defaults):
            raise ConfigurationValidationError(
                "Primero designe otra forma de pago predeterminada habilitada."
            )
        if row is None:
            row = FiscalPaymentFormSetting.objects.create(
                fiscal_entity=entity, code=code, enabled=enabled, updated_by=actor
            )
        else:
            row.enabled = enabled
            row.version += 1
            row.updated_by = actor
            row.save(update_fields=["enabled", "version", "updated_by", "updated_at"])
        record_audit_event(
            actor=actor,
            action="fiscal.payment_form_setting_saved",
            target_type="fiscal_payment_form_setting",
            target_id=str(row.pk),
            result=AuditResult.SUCCESS,
            metadata={"entity_id": entity.pk, "code": code, "enabled": enabled},
        )
        return {"code": code, "enabled": enabled, "version": row.version}

    return _command(
        actor=actor,
        action="fiscal.payment_form_setting_saved",
        idempotency_key=idempotency_key,
        fingerprint_input={
            "entity_id": entity_id,
            "code": code,
            "enabled": enabled,
            "expected_version": expected,
        },
        work=work,
    )


def set_preparation_defaults(
    *,
    actor: User,
    entity_id: int,
    expected_version: int,
    idempotency_key: str,
    default_point_id: Any = _UNSET,
    default_payment_code: Any = _UNSET,
) -> dict[str, Any]:
    require_permission(actor=actor, permission="parametros.gestionar")
    expected = _expected(expected_version)
    changes: dict[str, Any] = {}
    if default_point_id is not _UNSET:
        changes["default_point_id"] = default_point_id
    if default_payment_code is not _UNSET:
        changes["default_payment_code"] = default_payment_code
    if not changes:
        raise ConfigurationValidationError("Indique el punto o la forma de pago predeterminados.")

    def work() -> dict[str, Any]:
        entity = _lock_entity(entity_id)
        row = (
            FiscalPreparationDefaults.objects.select_for_update()
            .filter(fiscal_entity=entity)
            .first()
        )
        if (row.version if row else 0) != expected:
            raise StaleRecordError("Los valores predeterminados cambiaron; vuelva a consultarlos.")
        point: FiscalEmissionPoint | None = row.default_point if row else None
        payment = row.default_payment_code if row else None
        if "default_point_id" in changes:
            point_id = changes["default_point_id"]
            point = None
            if point_id is not None:
                point = (
                    FiscalEmissionPoint.objects.select_related("establishment")
                    .filter(pk=point_id, establishment__fiscal_entity=entity)
                    .first()
                )
                if point is None:
                    raise ConfigurationValidationError(
                        "El punto de emisión no pertenece a esta entidad fiscal."
                    )
                if not point.is_active or not point.establishment.is_active:
                    raise ConfigurationValidationError(
                        "Solo un punto activo puede ser predeterminado."
                    )
        if "default_payment_code" in changes:
            payment = changes["default_payment_code"]
            enabled = {
                option.code
                for option in payment_form_options(entity_id=entity.pk, on=timezone.localdate())
                if option.enabled
            }
            if payment not in enabled:
                raise ConfigurationValidationError(
                    "La forma de pago predeterminada debe estar habilitada."
                )
        if row is None:
            row = FiscalPreparationDefaults.objects.create(
                fiscal_entity=entity,
                default_point=point,
                default_payment_code=payment,
                updated_by=actor,
            )
        else:
            row.default_point = point
            row.default_payment_code = payment
            row.version += 1
            row.updated_by = actor
            row.save(
                update_fields=[
                    "default_point",
                    "default_payment_code",
                    "version",
                    "updated_by",
                    "updated_at",
                ]
            )
        record_audit_event(
            actor=actor,
            action="fiscal.preparation_defaults_saved",
            target_type="fiscal_preparation_defaults",
            target_id=str(row.pk),
            result=AuditResult.SUCCESS,
            metadata={
                "entity_id": entity.pk,
                "default_point_id": row.default_point_id,
                "default_payment_code": row.default_payment_code,
            },
        )
        return {
            "version": row.version,
            "default_point_id": row.default_point_id,
            "default_payment_code": row.default_payment_code,
        }

    return _command(
        actor=actor,
        action="fiscal.preparation_defaults_saved",
        idempotency_key=idempotency_key,
        fingerprint_input={"entity_id": entity_id, "expected": expected, **changes},
        work=work,
    )


def _require_entity(actor: User, entity_id: int) -> None:
    require_permission(actor=actor, permission="parametros.gestionar")
    if not FiscalEntity.objects.filter(pk=entity_id).exists():
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")


def get_payment_forms(*, actor: User, entity_id: int) -> tuple[PaymentFormOption, ...]:
    _require_entity(actor, entity_id)
    return payment_form_options(entity_id=entity_id, on=timezone.localdate())


def get_preparation_defaults(*, actor: User, entity_id: int) -> EffectiveDefaults:
    _require_entity(actor, entity_id)
    return effective_defaults(entity_id=entity_id, on=timezone.localdate())
