"""Servicio de inicialización del taller: alta atómica de entidades, bodega y series."""

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from django.db import transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from workshop_configuration.domain.validation import (
    ConfigurationValidationError,
    DocumentType,
    FiscalEntityType,
    validate_legal_name,
    validate_ruc,
)
from workshop_configuration.models import (
    ConfigurationCommand,
    DocumentSeries,
    FiscalEntity,
    NumberingScope,
    Warehouse,
    WorkshopConfiguration,
)


class WorkshopInitializationError(Exception):
    pass


class IdempotencyConflictError(WorkshopInitializationError):
    pass


class WorkshopAlreadyInitializedError(WorkshopInitializationError):
    pass


@dataclass(frozen=True)
class InitializationResult:
    installation_id: int
    commercial_entity_id: int
    artisanal_entity_id: int
    warehouse_id: int
    series_ids: tuple[int, ...]


_ACTION = "workshop_configuration.initialize"

# Cuatro series aprobadas: COM-ING, COM-PRO, COM-VEN, ART-SER
_SERIES_SPEC = [
    (FiscalEntityType.COMERCIAL, DocumentType.INGRESO, "COM-ING"),
    (FiscalEntityType.COMERCIAL, DocumentType.PROFORMA, "COM-PRO"),
    (FiscalEntityType.COMERCIAL, DocumentType.VENTA, "COM-VEN"),
    (FiscalEntityType.ARTESANAL, DocumentType.SERVICIO, "ART-SER"),
]


def _canonical_fingerprint(data: dict[str, Any]) -> str:
    """SHA-256 del JSON canónico (llaves ordenadas, sin espacios)."""
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _result_from_command(result_payload: dict[str, Any]) -> InitializationResult:
    return InitializationResult(
        installation_id=result_payload["installation_id"],
        commercial_entity_id=result_payload["commercial_entity_id"],
        artisanal_entity_id=result_payload["artisanal_entity_id"],
        warehouse_id=result_payload["warehouse_id"],
        series_ids=tuple(result_payload["series_ids"]),
    )


def initialize_workshop(
    *,
    actor: User,
    commercial_ruc: str,
    commercial_legal_name: str,
    artisanal_ruc: str,
    artisanal_legal_name: str,
    warehouse_name: str,
    idempotency_key: str,
    request_id: UUID | None = None,
) -> InitializationResult:
    """Alta atómica del taller: dos entidades, bodega y cuatro series.

    - Idempotente: misma clave y misma huella devuelve el resultado previo.
    - Si ya inicializado con distintos datos: WorkshopAlreadyInitializedError.
    - Si clave usada con distinta huella: IdempotencyConflictError.
    - Si validación falla: ConfigurationValidationError (sin escrituras).
    - Rollback total en caso de fallo intermedio.
    """
    require_permission(
        actor=actor,
        permission="entidades_fiscales.editar",
        request_id=request_id,
        denial_action=_ACTION,
        target_type="workshop_configuration",
        target_id="installation",
    )
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action=_ACTION,
        target_type="workshop_configuration",
        target_id="installation",
    )

    # Validar entradas antes de abrir cualquier transacción
    commercial_ruc_v = validate_ruc(commercial_ruc)
    commercial_legal_name_v = validate_legal_name(commercial_legal_name)
    artisanal_ruc_v = validate_ruc(artisanal_ruc)
    artisanal_legal_name_v = validate_legal_name(artisanal_legal_name)
    warehouse_name_v = validate_legal_name(warehouse_name)  # mismas reglas: no vacío, ≤ 200

    if commercial_ruc_v == artisanal_ruc_v:
        raise ConfigurationValidationError(
            "Los RUC de las dos entidades no pueden ser iguales.",
            errors={"artisanal_ruc": ["Debe ser diferente al RUC comercial."]},
        )

    input_payload: dict[str, Any] = {
        "commercial_ruc": commercial_ruc_v,
        "commercial_legal_name": commercial_legal_name_v,
        "artisanal_ruc": artisanal_ruc_v,
        "artisanal_legal_name": artisanal_legal_name_v,
        "warehouse_name": warehouse_name_v,
    }
    fingerprint = _canonical_fingerprint(input_payload)

    with transaction.atomic():
        # Bloquear el singleton de instalación para serializar inicializaciones concurrentes
        installation = WorkshopConfiguration.objects.select_for_update().get(pk=1)

        # Comprobar idempotencia primero (se aplica antes que la verificación de estado)
        existing_cmd = (
            ConfigurationCommand.objects.filter(
                actor=actor,
                action=_ACTION,
                idempotency_key=idempotency_key,
            )
            .first()
        )
        if existing_cmd is not None:
            if existing_cmd.input_fingerprint != fingerprint:
                raise IdempotencyConflictError(
                    "La clave de idempotencia fue usada con entradas distintas."
                )
            return _result_from_command(existing_cmd.result)

        # Si ya está inicializada con datos distintos → conflicto
        if installation.is_initialized:
            raise WorkshopAlreadyInitializedError(
                "El taller ya fue inicializado con una configuración diferente."
            )

        # Crear entidades fiscales
        commercial_entity = FiscalEntity.objects.create(
            entity_type=FiscalEntityType.COMERCIAL,
            ruc=commercial_ruc_v,
            legal_name=commercial_legal_name_v,
        )
        artisanal_entity = FiscalEntity.objects.create(
            entity_type=FiscalEntityType.ARTESANAL,
            ruc=artisanal_ruc_v,
            legal_name=artisanal_legal_name_v,
        )

        # Crear bodega única
        warehouse = Warehouse.objects.create(
            pk=1,
            name=warehouse_name_v,
        )

        # Crear ámbitos y series según la especificación aprobada
        entity_map = {
            FiscalEntityType.COMERCIAL: commercial_entity,
            FiscalEntityType.ARTESANAL: artisanal_entity,
        }
        series_ids: list[int] = []
        for entity_type, doc_type, series_code in _SERIES_SPEC:
            scope = NumberingScope.objects.create(
                fiscal_entity=entity_map[entity_type],
                document_type=doc_type,
            )
            series = DocumentSeries.objects.create(
                numbering_scope=scope,
                code=series_code,
                is_active=True,
                last_number=0,
            )
            series_ids.append(series.pk)

        # Marcar instalación como completada
        installation.is_initialized = True
        installation.initialized_at = datetime.now(tz=timezone.utc)
        installation.version += 1
        installation.save(update_fields=["is_initialized", "initialized_at", "version"])

        result_payload: dict[str, Any] = {
            "installation_id": installation.pk,
            "commercial_entity_id": commercial_entity.pk,
            "artisanal_entity_id": artisanal_entity.pk,
            "warehouse_id": warehouse.pk,
            "series_ids": series_ids,
        }

        # Registrar el comando idempotente
        ConfigurationCommand.objects.create(
            actor=actor,
            action=_ACTION,
            idempotency_key=idempotency_key,
            input_fingerprint=fingerprint,
            response_status=200,
            result=result_payload,
        )

        # Auditoría atómica dentro de la misma transacción
        record_audit_event(
            actor=actor,
            action=_ACTION,
            target_type="workshop_configuration",
            target_id=str(installation.pk),
            result=AuditResult.SUCCESS,
            request_id=request_id,
            metadata={
                "changed_fields": [
                    "is_initialized",
                    "initialized_at",
                    "commercial_entity",
                    "artisanal_entity",
                    "warehouse",
                    "numbering_scopes",
                    "document_series",
                ]
            },
        )

        return InitializationResult(
            installation_id=installation.pk,
            commercial_entity_id=commercial_entity.pk,
            artisanal_entity_id=artisanal_entity.pk,
            warehouse_id=warehouse.pk,
            series_ids=tuple(series_ids),
        )
