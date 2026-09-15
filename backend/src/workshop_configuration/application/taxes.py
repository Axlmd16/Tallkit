"""Servicios de impuestos, calendarios tributarios y sucesión prospectiva.

Trazabilidad: spec Requirements "Tarifas tributarias por entidad y vigencia",
"Vigencias tributarias no ambiguas", "Configuración tributaria histórica inmutable".
Design decisiones 3 (inicialización atómica) y 4 (vigencias y sucesión prospectiva).
"""

from datetime import date, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Max

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from workshop_configuration.domain.validation import (
    validate_tax_code,
    validate_tax_interval,
    validate_tax_rate,
)
from workshop_configuration.models import (
    ConfigurationUse,
    FiscalEntity,
    TaxDefinition,
    TaxPeriod,
)

_TZ = ZoneInfo("America/Guayaquil")


class TaxServiceError(Exception):
    pass


class TaxDefinitionNotFoundError(TaxServiceError):
    pass


class TaxPeriodNotFoundError(TaxServiceError):
    pass


class TaxPeriodOverlapError(TaxServiceError):
    pass


class TaxPeriodUsedError(TaxServiceError):
    pass


class StaleRecordError(TaxServiceError):
    pass


class SuccessionDateError(TaxServiceError):
    pass


# ---------------------------------------------------------------------------
# TaxDefinition
# ---------------------------------------------------------------------------


def create_tax_definition(
    *,
    actor: User,
    entity_id: int,
    code: str,
    name: str,
    request_id: UUID | None = None,
) -> TaxDefinition:
    """Crea una definición de impuesto para una entidad fiscal."""
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.tax_definition_created",
        target_type="tax_definition",
        target_id=f"{entity_id}:{code}",
    )

    code_v = validate_tax_code(code)
    name_s = name.strip()
    if not name_s or len(name_s) > 120:
        from workshop_configuration.domain.validation import ConfigurationValidationError

        raise ConfigurationValidationError(
            "El nombre del impuesto debe tener entre 1 y 120 caracteres.",
            errors={"name": ["Ingrese entre 1 y 120 caracteres."]},
        )

    with transaction.atomic():
        entity = FiscalEntity.objects.select_for_update().filter(pk=entity_id).first()
        if entity is None:
            raise TaxDefinitionNotFoundError(f"Entidad fiscal {entity_id} no encontrada.")

        td = TaxDefinition.objects.create(
            fiscal_entity=entity,
            code=code_v,
            name=name_s,
        )
        record_audit_event(
            actor=actor,
            action="workshop_configuration.tax_definition_created",
            target_type="tax_definition",
            target_id=str(td.pk),
            result=AuditResult.SUCCESS,
            request_id=request_id,
            metadata={"changed_fields": ["code", "name"]},
        )
        return td


def list_tax_definitions(
    *,
    actor: User,
    entity_id: int,
    request_id: UUID | None = None,
) -> list[TaxDefinition]:
    """Lista definiciones de impuestos de una entidad fiscal."""
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.tax_definition_list_denied",
        target_type="tax_definition",
        target_id=f"entity:{entity_id}",
    )
    return list(
        TaxDefinition.objects.filter(fiscal_entity_id=entity_id).order_by("code", "id")
    )


def get_tax_definition(
    *,
    actor: User,
    tax_definition_id: int,
    request_id: UUID | None = None,
) -> TaxDefinition:
    """Obtiene una definición de impuesto por PK."""
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.tax_definition_get_denied",
        target_type="tax_definition",
        target_id=str(tax_definition_id),
    )
    td = TaxDefinition.objects.filter(pk=tax_definition_id).first()
    if td is None:
        raise TaxDefinitionNotFoundError(f"Impuesto {tax_definition_id} no encontrado.")
    return td


# ---------------------------------------------------------------------------
# TaxPeriod - creación
# ---------------------------------------------------------------------------


def _check_no_overlap(
    tax_definition_id: int,
    new_start: date,
    new_end: date | None,
    exclude_period_id: int | None = None,
) -> None:
    """Comprueba solapamiento. Lanza TaxPeriodOverlapError si hay conflicto."""
    qs = TaxPeriod.objects.filter(tax_definition_id=tax_definition_id)
    if exclude_period_id is not None:
        qs = qs.exclude(pk=exclude_period_id)

    for period in qs.select_for_update():
        p_start = period.starts_on
        p_end = period.ends_on  # None = abierto

        # Intervalo existente: [p_start, p_end] (infinito si p_end is None)
        # Nuevo intervalo: [new_start, new_end] (infinito si new_end is None)
        # Solapan si: new_start <= p_end (o p abierto) AND p_start <= new_end (o nuevo abierto)
        existing_covers_new_start = p_end is None or p_end >= new_start
        new_covers_existing_start = new_end is None or new_end >= p_start
        if existing_covers_new_start and new_covers_existing_start:
            raise TaxPeriodOverlapError(
                f"El período [{new_start}, {new_end}] se solapa con "
                f"[{p_start}, {p_end}]."
            )


def create_tax_period(
    *,
    actor: User,
    tax_definition_id: int,
    rate: str,
    starts_on: date,
    ends_on: date | None = None,
    request_id: UUID | None = None,
) -> TaxPeriod:
    """Crea una vigencia tributaria sin solapamientos."""
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.tax_period_created",
        target_type="tax_period",
        target_id=f"definition:{tax_definition_id}",
    )

    rate_v = validate_tax_rate(rate)
    starts_on_v, ends_on_v = validate_tax_interval(starts_on, ends_on)

    try:
        with transaction.atomic():
            td = TaxDefinition.objects.select_for_update().filter(pk=tax_definition_id).first()
            if td is None:
                raise TaxDefinitionNotFoundError(
                    f"Impuesto {tax_definition_id} no encontrado."
                )

            _check_no_overlap(tax_definition_id, starts_on_v, ends_on_v)

            period = TaxPeriod.objects.create(
                tax_definition=td,
                rate=rate_v,
                starts_on=starts_on_v,
                ends_on=ends_on_v,
            )
            record_audit_event(
                actor=actor,
                action="workshop_configuration.tax_period_created",
                target_type="tax_period",
                target_id=str(period.pk),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["rate", "starts_on", "ends_on"]},
            )
            return period
    except TaxPeriodOverlapError:
        record_audit_event(
            actor=actor,
            action="workshop_configuration.tax_period_rejected",
            target_type="tax_period",
            target_id=f"definition:{tax_definition_id}",
            result=AuditResult.FAILURE,
            reason="overlap",
            request_id=request_id,
        )
        raise


# ---------------------------------------------------------------------------
# TaxPeriod - actualización (solo no utilizados)
# ---------------------------------------------------------------------------


def update_tax_period(
    *,
    actor: User,
    period_id: int,
    expected_version: int,
    rate: str | None = None,
    starts_on: date | None = None,
    ends_on: date | None = None,
    request_id: UUID | None = None,
) -> TaxPeriod:
    """Actualiza una vigencia tributaria no utilizada.

    Una vigencia utilizada solo puede modificarse mediante schedule_successor.
    """
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.tax_period_updated",
        target_type="tax_period",
        target_id=str(period_id),
    )

    rate_v = validate_tax_rate(rate) if rate is not None else None

    try:
        with transaction.atomic():
            period = TaxPeriod.objects.select_for_update().filter(pk=period_id).first()
            if period is None:
                raise TaxPeriodNotFoundError(f"Vigencia {period_id} no encontrada.")

            if period.version != expected_version:
                raise StaleRecordError(
                    f"Versión obsoleta para la vigencia {period_id}: "
                    f"esperada {expected_version}, actual {period.version}."
                )

            is_used = ConfigurationUse.objects.filter(tax_period=period).exists()
            if is_used:
                raise TaxPeriodUsedError(
                    "La vigencia está en uso y no puede editarse genericamente. "
                    "Use la acción de sucesión para crear una nueva tarifa."
                )

            changed_fields: list[str] = []
            new_start = starts_on if starts_on is not None else period.starts_on
            new_end = ends_on if ends_on is not None else period.ends_on

            if rate_v is not None and period.rate != rate_v:
                period.rate = rate_v
                changed_fields.append("rate")
            if starts_on is not None and period.starts_on != starts_on:
                period.starts_on = starts_on
                changed_fields.append("starts_on")
            if ends_on is not None and period.ends_on != ends_on:
                period.ends_on = ends_on
                changed_fields.append("ends_on")

            if changed_fields:
                _check_no_overlap(
                    period.tax_definition_id, new_start, new_end, exclude_period_id=period.pk
                )
                period.version += 1
                period.save()

                record_audit_event(
                    actor=actor,
                    action="workshop_configuration.tax_period_updated",
                    target_type="tax_period",
                    target_id=str(period.pk),
                    result=AuditResult.SUCCESS,
                    request_id=request_id,
                    metadata={"changed_fields": changed_fields},
                )
            return period

    except (StaleRecordError, TaxPeriodUsedError) as exc:
        record_audit_event(
            actor=actor,
            action="workshop_configuration.tax_period_update_rejected",
            target_type="tax_period",
            target_id=str(period_id),
            result=AuditResult.FAILURE,
            reason="stale_record" if isinstance(exc, StaleRecordError) else "period_used",
            request_id=request_id,
        )
        raise


# ---------------------------------------------------------------------------
# schedule_successor - sucesión prospectiva aprobada (design decisión 4)
# ---------------------------------------------------------------------------


def schedule_successor(
    *,
    actor: User,
    period_id: int,
    expected_version: int,
    new_rate: str,
    successor_starts_on: date,
    request_id: UUID | None = None,
) -> TaxPeriod:
    """Cierra la vigencia abierta y crea una sucesora atómicamente.

    Reglas (design decisión 4, reconciliación aprobada 2026-09-14):
    - El inicio sucesor debe ser estrictamente futuro en America/Guayaquil.
    - El inicio sucesor debe ser posterior (>) a toda fecha de ConfigurationUse.
    - Establece ends_on del predecesor = successor_starts_on - 1 día.
    - Crea la nueva vigencia con el nuevo inicio y tarifa.
    - Dos sucesiones concurrentes: la primera gana, la segunda recibe StaleRecordError.
    - La auditoría del éxito queda dentro de la transacción.
    - La auditoría del rechazo queda fuera (después del rollback).
    """
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.tax_period_succession_rejected",
        target_type="tax_period",
        target_id=str(period_id),
    )

    new_rate_v = validate_tax_rate(new_rate)

    # Validar que el inicio sea estrictamente futuro en la zona horaria del negocio
    from datetime import datetime

    today_local = datetime.now(tz=_TZ).date()
    if successor_starts_on <= today_local:
        record_audit_event(
            actor=actor,
            action="workshop_configuration.tax_period_succession_rejected",
            target_type="tax_period",
            target_id=str(period_id),
            result=AuditResult.FAILURE,
            reason="succession_date_not_future",
            request_id=request_id,
        )
        raise SuccessionDateError(
            "El inicio del sucesor debe ser una fecha futura en America/Guayaquil."
        )

    try:
        with transaction.atomic():
            # Bloquear TaxDefinition y el período para serializar sucesiones concurrentes
            period = TaxPeriod.objects.select_for_update().filter(pk=period_id).first()
            if period is None:
                raise TaxPeriodNotFoundError(f"Vigencia {period_id} no encontrada.")

            if period.version != expected_version:
                raise StaleRecordError(
                    f"Versión obsoleta para la vigencia {period_id}: "
                    f"esperada {expected_version}, actual {period.version}."
                )

            # Bloquear TaxDefinition
            TaxDefinition.objects.select_for_update().get(pk=period.tax_definition_id)

            # El inicio sucesor debe ser > a toda fecha de uso existente del período
            max_use_date = ConfigurationUse.objects.filter(
                tax_period=period
            ).aggregate(max_date=Max("operation_date"))["max_date"]

            if max_use_date is not None and successor_starts_on <= max_use_date:
                raise SuccessionDateError(
                    f"El inicio sucesor {successor_starts_on} no es posterior "
                    f"al último uso registrado ({max_use_date})."
                )

            predecessor_end = successor_starts_on - timedelta(days=1)
            period.ends_on = predecessor_end
            period.version += 1
            period.save(update_fields=["ends_on", "version", "updated_at"])

            successor = TaxPeriod.objects.create(
                tax_definition_id=period.tax_definition_id,
                rate=new_rate_v,
                starts_on=successor_starts_on,
                ends_on=None,
            )

            record_audit_event(
                actor=actor,
                action="workshop_configuration.tax_period_succession",
                target_type="tax_period",
                target_id=str(period.pk),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={
                    "changed_fields": ["ends_on"],
                },
            )
            return successor

    except (StaleRecordError, SuccessionDateError) as exc:
        record_audit_event(
            actor=actor,
            action="workshop_configuration.tax_period_succession_rejected",
            target_type="tax_period",
            target_id=str(period_id),
            result=AuditResult.FAILURE,
            reason=(
                "stale_record"
                if isinstance(exc, StaleRecordError)
                else "succession_date_incompatible"
            ),
            request_id=request_id,
        )
        raise
