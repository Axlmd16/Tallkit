"""Servicios de ciclo de vida de series de numeración.

Trazabilidad: spec Requirements "Ciclo de vida controlado de las series",
"Series internas iniciales de V1", "Formato visible del número interno".
Design decisión 5 (numeración y transacción del consumidor).
"""

from uuid import UUID

from django.db import IntegrityError, transaction

from identity.application.audit import record_audit_event
from identity.application.authorization import require_permission
from identity.models import AuditResult, User
from workshop_configuration.domain.validation import validate_series_code
from workshop_configuration.models import DocumentSeries, NumberingScope


class SeriesError(Exception):
    pass


class DocumentSeriesNotFoundError(SeriesError):
    pass


class SeriesAlreadyUsedError(SeriesError):
    pass


class SeriesScopeConflictError(SeriesError):
    pass


class StaleRecordError(SeriesError):
    pass


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------


def list_document_series(
    *,
    actor: User,
    scope_id: int,
    request_id: UUID | None = None,
) -> list[DocumentSeries]:
    """Lista todas las series de un ámbito (activas e históricas)."""
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.series_list_denied",
        target_type="document_series",
        target_id=f"scope:{scope_id}",
    )
    return list(
        DocumentSeries.objects.filter(numbering_scope_id=scope_id).order_by(
            "-is_active", "code", "id"
        )
    )


def get_document_series(
    *,
    actor: User,
    series_id: int,
    request_id: UUID | None = None,
) -> DocumentSeries:
    """Obtiene una serie por PK."""
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.series_get_denied",
        target_type="document_series",
        target_id=str(series_id),
    )
    series = DocumentSeries.objects.filter(pk=series_id).first()
    if series is None:
        raise DocumentSeriesNotFoundError(f"Serie {series_id} no encontrada.")
    return series


# ---------------------------------------------------------------------------
# Edición previa al uso
# ---------------------------------------------------------------------------


def update_series_code(
    *,
    actor: User,
    series_id: int,
    expected_version: int,
    code: str,
    request_id: UUID | None = None,
) -> DocumentSeries:
    """Actualiza el código de una serie no utilizada.

    Protecciones:
    - Si last_number > 0: SeriesAlreadyUsedError.
    - Si version != expected_version: StaleRecordError.
    - El nuevo código debe ser globalmente único.
    """
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.series_updated",
        target_type="document_series",
        target_id=str(series_id),
    )

    code_v = validate_series_code(code)

    try:
        with transaction.atomic():
            # Bloquear el ámbito para serializar contra sustitución concurrente
            series = DocumentSeries.objects.select_for_update().filter(pk=series_id).first()
            if series is None:
                raise DocumentSeriesNotFoundError(f"Serie {series_id} no encontrada.")

            if series.version != expected_version:
                raise StaleRecordError(
                    f"Versión obsoleta para la serie {series_id}: "
                    f"esperada {expected_version}, actual {series.version}."
                )

            if series.last_number > 0:
                raise SeriesAlreadyUsedError(
                    "La serie ya tiene números asignados; el código no puede modificarse. "
                    "Use la acción de sustitución para crear una serie sucesora."
                )

            if series.code == code_v:
                return series

            series.code = code_v
            series.version += 1
            try:
                series.save(update_fields=["code", "version", "updated_at"])
            except IntegrityError as exc:
                raise SeriesScopeConflictError(
                    f"El código '{code_v}' ya existe en otra serie."
                ) from exc

            record_audit_event(
                actor=actor,
                action="workshop_configuration.series_updated",
                target_type="document_series",
                target_id=str(series.pk),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["code"]},
            )
            return series

    except (StaleRecordError, SeriesAlreadyUsedError) as exc:
        record_audit_event(
            actor=actor,
            action="workshop_configuration.series_update_rejected",
            target_type="document_series",
            target_id=str(series_id),
            result=AuditResult.FAILURE,
            reason=("stale_record" if isinstance(exc, StaleRecordError) else "series_already_used"),
            request_id=request_id,
        )
        raise


# ---------------------------------------------------------------------------
# Sustitución atómica
# ---------------------------------------------------------------------------


def replace_series(
    *,
    actor: User,
    series_id: int,
    expected_version: int,
    new_code: str,
    request_id: UUID | None = None,
) -> DocumentSeries:
    """Cierra la serie activa y crea una sucesora con el nuevo código.

    Reglas (design decisión 5):
    - El código debe ser globalmente único y distinto de cualquier código retirado.
    - Solo puede haber una serie activa por ámbito.
    - La serie anterior queda inactiva; el contador histórico se conserva.
    - La sucesora empieza en last_number = 0.
    """
    require_permission(
        actor=actor,
        permission="parametros.gestionar",
        request_id=request_id,
        denial_action="workshop_configuration.series_replaced",
        target_type="document_series",
        target_id=str(series_id),
    )

    new_code_v = validate_series_code(new_code)

    try:
        with transaction.atomic():
            series = DocumentSeries.objects.select_for_update().filter(pk=series_id).first()
            if series is None:
                raise DocumentSeriesNotFoundError(f"Serie {series_id} no encontrada.")

            if series.version != expected_version:
                raise StaleRecordError(
                    f"Versión obsoleta para la serie {series_id}: "
                    f"esperada {expected_version}, actual {series.version}."
                )

            # Verificar que el nuevo código no esté ya en uso (incluyendo series retiradas)
            if DocumentSeries.objects.filter(code=new_code_v).exclude(pk=series_id).exists():
                raise SeriesScopeConflictError(
                    f"El código '{new_code_v}' ya fue utilizado por otra serie "
                    "y no puede reutilizarse."
                )

            # Bloquear el ámbito para garantizar unicidad de serie activa
            NumberingScope.objects.select_for_update().get(pk=series.numbering_scope_id)

            # Desactivar la serie anterior
            series.is_active = False
            series.version += 1
            series.save(update_fields=["is_active", "version", "updated_at"])

            # Crear la sucesora
            successor = DocumentSeries.objects.create(
                numbering_scope_id=series.numbering_scope_id,
                code=new_code_v,
                is_active=True,
                last_number=0,
            )

            record_audit_event(
                actor=actor,
                action="workshop_configuration.series_replaced",
                target_type="document_series",
                target_id=str(series.pk),
                result=AuditResult.SUCCESS,
                request_id=request_id,
                metadata={"changed_fields": ["is_active"]},
            )
            return successor

    except (StaleRecordError, SeriesScopeConflictError) as exc:
        record_audit_event(
            actor=actor,
            action="workshop_configuration.series_replace_rejected",
            target_type="document_series",
            target_id=str(series_id),
            result=AuditResult.FAILURE,
            reason=("stale_record" if isinstance(exc, StaleRecordError) else "code_conflict"),
            request_id=request_id,
        )
        raise
