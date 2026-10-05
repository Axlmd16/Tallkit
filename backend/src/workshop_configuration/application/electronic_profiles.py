"""Revisiones de perfil electrónico sin alterar configuración interna ni firmar."""

from dataclasses import asdict
from datetime import date
from typing import Any

from django.db import IntegrityError, transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from shared.command_values import canonical_fingerprint, validate_idempotency_key
from workshop_configuration.application.entity_warehouse import (
    FiscalEntityNotFoundError,
    StaleRecordError,
)
from workshop_configuration.application.initialization import IdempotencyConflictError
from workshop_configuration.domain.electronic_profile import (
    TAX_REGIME,
    closed_options,
    condition_payload,
    parse_certificate_metadata,
    parse_profile_conditions,
    regime_legend,
)
from workshop_configuration.domain.validation import ConfigurationValidationError
from workshop_configuration.models import (
    ConfigurationCommand,
    ElectronicProfileRevision,
    FiscalEntity,
)

# Formato de las condiciones de toda revisión nueva; el formato 1 (texto libre) es historia.
CURRENT_CONDITIONS_FORMAT = 2
ACTION = "workshop_configuration.electronic_profile_saved"


def _json_value(value: Any) -> Any:
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _json_value(v) for k, v in value.items()}
    return value


def _validate(payload: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None]:
    if not isinstance(payload, dict) or payload.keys() - {"conditions", "certificate"}:
        raise ConfigurationValidationError("Campos de perfil no admitidos.")
    parsed_conditions = parse_profile_conditions(payload.get("conditions", {}))
    parsed = {key: condition_payload(condition) for key, condition in parsed_conditions.items()}
    certificate = payload.get("certificate")
    if certificate is not None:
        certificate = _json_value(asdict(parse_certificate_metadata(certificate)))
    return parsed, certificate


def describe_profile(profile: ElectronicProfileRevision | None) -> dict[str, Any]:
    """Datos derivados de una revisión; sin perfil se describe el formato vigente."""
    if profile is None:
        return {
            "conditions_format": CURRENT_CONDITIONS_FORMAT,
            "regime_legend": None,
            "options": closed_options(),
        }
    legend = None
    if profile.conditions_format == CURRENT_CONDITIONS_FORMAT:
        legend = regime_legend(profile.conditions.get(TAX_REGIME, {}).get("value"))
    return {
        "conditions_format": profile.conditions_format,
        "regime_legend": legend,
        "options": closed_options(),
    }


def get_profile(*, actor: User, entity_id: int) -> ElectronicProfileRevision | None:
    require_permission(actor=actor, permission="parametros.gestionar")
    if not FiscalEntity.objects.filter(pk=entity_id).exists():
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
    return (
        ElectronicProfileRevision.objects.filter(fiscal_entity_id=entity_id)
        .order_by("-revision")
        .first()
    )


def save_profile(
    *,
    actor: User,
    entity_id: int,
    expected_revision: int,
    idempotency_key: str,
    payload: dict[str, Any],
) -> ElectronicProfileRevision:
    require_permission(actor=actor, permission="parametros.gestionar")
    key = validate_idempotency_key(idempotency_key)
    # Validar antes de huellas, recibos o auditoría: no conservar secretos rechazados.
    conditions, certificate = _validate(payload)
    if (
        isinstance(expected_revision, bool)
        or not isinstance(expected_revision, int)
        or expected_revision < 0
    ):
        raise ConfigurationValidationError("La revisión esperada debe ser un entero no negativo.")
    fingerprint = canonical_fingerprint(
        {"entity_id": entity_id, "expected_revision": expected_revision, "payload": payload}
    )
    with transaction.atomic():
        # Recibo antes de entidad; el savepoint permite recuperar carreras por clave.
        try:
            with transaction.atomic():
                receipt = ConfigurationCommand.objects.create(
                    actor=actor,
                    action=ACTION,
                    idempotency_key=key,
                    input_fingerprint=fingerprint,
                    response_status=201,
                    result={},
                )
        except IntegrityError:
            receipt = ConfigurationCommand.objects.get(
                actor=actor, action=ACTION, idempotency_key=key
            )
            if receipt.input_fingerprint != fingerprint:
                raise IdempotencyConflictError("La clave corresponde a otra entrada.") from None
            return ElectronicProfileRevision.objects.get(pk=receipt.result["revision_id"])
        entity = FiscalEntity.objects.select_for_update().filter(pk=entity_id).first()
        if entity is None:
            raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
        previous = (
            ElectronicProfileRevision.objects.filter(fiscal_entity=entity)
            .order_by("-revision")
            .first()
        )
        revision = previous.revision if previous else 0
        if expected_revision != revision:
            raise StaleRecordError("La revisión del perfil cambió; vuelva a consultarla.")
        result = ElectronicProfileRevision.objects.create(
            fiscal_entity=entity,
            revision=revision + 1,
            conditions=conditions,
            conditions_format=CURRENT_CONDITIONS_FORMAT,
            certificate=certificate,
            created_by=actor,
        )
        receipt.result = {"revision_id": result.pk}
        receipt.save(update_fields=["result"])
        record_audit_event(
            actor=actor,
            action=ACTION,
            target_type="electronic_profile",
            target_id=str(result.pk),
            result=AuditResult.SUCCESS,
            metadata={"revision": result.revision, "entity_id": entity.pk},
        )
        return result
