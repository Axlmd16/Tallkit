"""Servicios de consulta y actualización de entidades fiscales y bodega.

Trazabilidad: spec Requirements "Dos entidades fiscales obligatorias y diferenciadas",
"Historia de los datos fiscales", "Bodega única de V1".
"""

from uuid import UUID

from django.db import transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from workshop_configuration.domain.validation import (
    ConfigurationValidationError,
    validate_legal_name,
    validate_ruc,
)
from workshop_configuration.models import FiscalEntity, Warehouse


class EntityWarehouseError(Exception):
    pass


class FiscalEntityNotFoundError(EntityWarehouseError):
    pass


class WarehouseNotFoundError(EntityWarehouseError):
    pass


class StaleRecordError(EntityWarehouseError):
    pass


class FiscalEntityTypeImmutableError(EntityWarehouseError):
    pass


# ---------------------------------------------------------------------------
# Consultas de entidades fiscales
# ---------------------------------------------------------------------------


def list_fiscal_entities(
    *,
    actor: User,
    request_id: UUID | None = None,
) -> list[FiscalEntity]:
    """Devuelve las dos entidades fiscales (ordenadas por tipo)."""
    require_permission(
        actor=actor,
        permission="entidades_fiscales.ver",
        request_id=request_id,
        denial_action="workshop_configuration.fiscal_entity_list_denied",
        target_type="fiscal_entity",
        target_id="list",
    )
    return list(FiscalEntity.objects.order_by("entity_type", "id"))


def get_fiscal_entity(
    *,
    actor: User,
    entity_id: int,
    request_id: UUID | None = None,
) -> FiscalEntity:
    """Obtiene una entidad fiscal por PK."""
    require_permission(
        actor=actor,
        permission="entidades_fiscales.ver",
        request_id=request_id,
        denial_action="workshop_configuration.fiscal_entity_get_denied",
        target_type="fiscal_entity",
        target_id=str(entity_id),
    )
    entity = FiscalEntity.objects.filter(pk=entity_id).first()
    if entity is None:
        raise FiscalEntityNotFoundError(f"Entidad fiscal {entity_id} no encontrada.")
    return entity


# ---------------------------------------------------------------------------
# Actualización de entidades fiscales
# ---------------------------------------------------------------------------


def update_fiscal_entity(
    *,
    actor: User,
    entity_id: int,
    expected_version: int,
    request_id: UUID | None = None,
    # Campos opcionales: solo los que se envíen se actualizan
    legal_name: str | None = None,
    ruc: str | None = None,
    trade_name: str | None = None,
    address: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    entity_type: str | None = None,
) -> FiscalEntity:
    """Actualiza datos de una entidad fiscal con control de versión optimista.

    - El tipo fiscal es inmutable (FiscalEntityTypeImmutableError).
    - El RUC actualizado no puede ser igual al de la otra entidad.
    - Una versión obsoleta lanza StaleRecordError.
    - No existe operación de borrado.
    """
    require_permission(
        actor=actor,
        permission="entidades_fiscales.editar",
        request_id=request_id,
        denial_action="workshop_configuration.fiscal_entity_updated",
        target_type="fiscal_entity",
        target_id=str(entity_id),
    )

    # El tipo es inmutable: rechazar antes de abrir transacción
    if entity_type is not None:
        record_audit_event(
            actor=actor,
            action="workshop_configuration.fiscal_entity_update_rejected",
            target_type="fiscal_entity",
            target_id=str(entity_id),
            result=AuditResult.FAILURE,
            reason="entity_type_immutable",
            request_id=request_id,
        )
        raise FiscalEntityTypeImmutableError(
            "El tipo de entidad fiscal no puede modificarse después de la creación."
        )

    # Validar entradas antes de abrir transacción
    legal_name_v: str | None = None
    ruc_v: str | None = None
    if legal_name is not None:
        legal_name_v = validate_legal_name(legal_name)
    if ruc is not None:
        ruc_v = validate_ruc(ruc)

    try:
        with transaction.atomic():
            entity = FiscalEntity.objects.select_for_update().filter(pk=entity_id).first()
            if entity is None:
                raise FiscalEntityNotFoundError(f"Entidad fiscal {entity_id} no encontrada.")

            if entity.version != expected_version:
                raise StaleRecordError(
                    f"Versión obsoleta para la entidad {entity_id}: "
                    f"esperada {expected_version}, actual {entity.version}."
                )

            # Validar que el RUC no coincida con la otra entidad
            if ruc_v is not None and ruc_v != entity.ruc:
                other_exists = (
                    FiscalEntity.objects.exclude(pk=entity_id).filter(ruc=ruc_v).exists()
                )
                if other_exists:
                    raise ConfigurationValidationError(
                        "El RUC ya pertenece a la otra entidad fiscal.",
                        errors={"ruc": ["Cada entidad debe tener un RUC único."]},
                    )

            changed_fields: list[str] = []
            if legal_name_v is not None and entity.legal_name != legal_name_v:
                entity.legal_name = legal_name_v
                changed_fields.append("legal_name")
            if ruc_v is not None and entity.ruc != ruc_v:
                entity.ruc = ruc_v
                changed_fields.append("ruc")
            if trade_name is not None:
                normalized_trade = trade_name.strip() or None
                if entity.trade_name != normalized_trade:
                    entity.trade_name = normalized_trade
                    changed_fields.append("trade_name")
            if address is not None:
                normalized_address = address.strip() or None
                if entity.address != normalized_address:
                    entity.address = normalized_address
                    changed_fields.append("address")
            if phone is not None:
                normalized_phone = phone.strip() or None
                if entity.phone != normalized_phone:
                    entity.phone = normalized_phone
                    changed_fields.append("phone")
            if email is not None:
                normalized_email = email.strip() or None
                if entity.email != normalized_email:
                    entity.email = normalized_email
                    changed_fields.append("email")

            if not changed_fields:
                return entity

            entity.version += 1
            entity.save()

            record_audit_event(
                actor=actor,
                action="workshop_configuration.fiscal_entity_updated",
                target_type="fiscal_entity",
                target_id=str(entity.pk),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": changed_fields},
            )
            return entity

    except StaleRecordError:
        record_audit_event(
            actor=actor,
            action="workshop_configuration.fiscal_entity_update_rejected",
            target_type="fiscal_entity",
            target_id=str(entity_id),
            result=AuditResult.FAILURE,
            reason="stale_record",
            request_id=request_id,
        )
        raise


# ---------------------------------------------------------------------------
# Consulta y actualización de bodega
# ---------------------------------------------------------------------------


def get_warehouse(
    *,
    actor: User,
    request_id: UUID | None = None,
) -> Warehouse:
    """Obtiene la bodega única del sistema."""
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.warehouse_get_denied",
        target_type="warehouse",
        target_id="1",
    )
    wh = Warehouse.objects.filter(pk=1).first()
    if wh is None:
        raise WarehouseNotFoundError("La bodega del sistema no existe todavía.")
    return wh


def update_warehouse(
    *,
    actor: User,
    expected_version: int,
    name: str,
    request_id: UUID | None = None,
) -> Warehouse:
    """Actualiza el nombre de la bodega con control de versión optimista.

    La bodega siempre permanece activa; no existe operación de desactivación.
    """
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.warehouse_updated",
        target_type="warehouse",
        target_id="1",
    )

    name_v = validate_legal_name(name)  # no vacío, ≤ 200 chars

    try:
        with transaction.atomic():
            wh = Warehouse.objects.select_for_update().filter(pk=1).first()
            if wh is None:
                raise WarehouseNotFoundError("La bodega del sistema no existe todavía.")

            if wh.version != expected_version:
                raise StaleRecordError(
                    f"Versión obsoleta para la bodega: "
                    f"esperada {expected_version}, actual {wh.version}."
                )

            if wh.name == name_v:
                return wh

            wh.name = name_v
            wh.version += 1
            wh.save(update_fields=["name", "version", "updated_at"])

            record_audit_event(
                actor=actor,
                action="workshop_configuration.warehouse_updated",
                target_type="warehouse",
                target_id=str(wh.pk),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["name"]},
            )
            return wh

    except StaleRecordError:
        record_audit_event(
            actor=actor,
            action="workshop_configuration.warehouse_update_rejected",
            target_type="warehouse",
            target_id="1",
            result=AuditResult.FAILURE,
            reason="stale_record",
            request_id=request_id,
        )
        raise
