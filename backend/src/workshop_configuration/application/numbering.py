"""Servicio interno de asignación de números de documento.

Este módulo implementa `allocate_number`, función interna llamada únicamente
desde la transacción del servicio consumidor. No tiene endpoint propio.

Trazabilidad: design decisión 5 (numeración y transacción del consumidor),
spec "Secuenciales seguros ante concurrencia y reintentos",
"Conservación de números asignados", "Formato visible del número interno".

Orden de bloqueos (ADR): entidad fiscal, impuestos en orden de código,
NumberingScope, DocumentSeries.
"""

from dataclasses import dataclass

from django.db import transaction

from workshop_configuration.domain.validation import MAX_SEQUENCE_VALUE, format_internal_number
from workshop_configuration.models import DocumentSeries, NumberAllocation, NumberingScope


class NumberingError(Exception):
    pass


class NumberingScopeNotFoundError(NumberingError):
    pass


class AllocationConflictError(NumberingError):
    pass


class NumberExhaustedError(NumberingError):
    pass


@dataclass(frozen=True)
class AllocateNumberResult:
    number: int
    visible_number: str
    series_code: str
    scope_id: int


def allocate_number(
    *,
    scope_id: int,
    consumer_type: str,
    consumer_id: str,
    request_key: str,
    request_fingerprint: str,
) -> AllocateNumberResult:
    """Asigna el siguiente número disponible en el ámbito, de forma idempotente.

    Precondiciones (responsabilidad del consumidor):
    - Debe llamarse dentro de una transacción de base de datos ya abierta,
      o esta función abrirá una savepoint interno.
    - El consumidor ha validado sus permisos y el estado del documento antes de llamar.

    Garantías:
    - Bloqueo de NumberingScope serializa asignaciones concurrentes.
    - Si existe asignación previa para (scope, consumer_type, consumer_id):
        - Misma huella: devuelve el resultado previo (idempotencia).
        - Distinta huella: AllocationConflictError.
    - Si existe asignación previa para (scope, request_key):
        - Misma huella: devuelve el resultado previo.
        - Distinta huella: AllocationConflictError.
    - Incrementa el contador de la serie activa y crea NumberAllocation
      dentro de la misma transacción.
    - El visible_number usa al menos seis dígitos (crece si necesario).
    """
    with transaction.atomic():
        scope = NumberingScope.objects.select_for_update().filter(pk=scope_id).first()
        if scope is None:
            raise NumberingScopeNotFoundError(f"Ámbito de numeración {scope_id} no encontrado.")

        # Comprobar asignación existente por documento (consumer_type + consumer_id)
        existing_by_document = NumberAllocation.objects.filter(
            numbering_scope=scope,
            consumer_type=consumer_type,
            consumer_id=consumer_id,
        ).first()
        if existing_by_document is not None:
            if existing_by_document.request_fingerprint != request_fingerprint:
                raise AllocationConflictError(
                    f"El documento '{consumer_id}' ya tiene un número asignado "
                    "con una huella de solicitud diferente."
                )
            return AllocateNumberResult(
                number=existing_by_document.number,
                visible_number=existing_by_document.visible_number,
                series_code=existing_by_document.series.code,
                scope_id=scope_id,
            )

        # Comprobar asignación existente por clave de solicitud (scope + request_key)
        existing_by_key = NumberAllocation.objects.filter(
            numbering_scope=scope,
            request_key=request_key,
        ).first()
        if existing_by_key is not None:
            if existing_by_key.request_fingerprint != request_fingerprint:
                raise AllocationConflictError(
                    f"La clave de solicitud '{request_key}' fue usada con una "
                    "huella diferente en este ámbito."
                )
            return AllocateNumberResult(
                number=existing_by_key.number,
                visible_number=existing_by_key.visible_number,
                series_code=existing_by_key.series.code,
                scope_id=scope_id,
            )

        # Obtener la serie activa (bloqueo ya adquirido por scope)
        series = DocumentSeries.objects.select_for_update().filter(
            numbering_scope=scope,
            is_active=True,
        ).first()
        if series is None:
            raise NumberingError(
                f"No existe una serie activa en el ámbito {scope_id}."
            )

        next_number = series.last_number + 1
        if next_number > MAX_SEQUENCE_VALUE:
            raise NumberExhaustedError(
                f"El contador de la serie '{series.code}' ha agotado su rango máximo."
            )

        # Formato del número visible: al menos 6 dígitos
        visible = format_internal_number(series.code, next_number)

        series.last_number = next_number
        series.save(update_fields=["last_number", "updated_at"])

        allocation = NumberAllocation.objects.create(
            numbering_scope=scope,
            series=series,
            number=next_number,
            consumer_type=consumer_type,
            consumer_id=consumer_id,
            request_key=request_key,
            request_fingerprint=request_fingerprint,
            visible_number=visible,
        )

        return AllocateNumberResult(
            number=allocation.number,
            visible_number=allocation.visible_number,
            series_code=series.code,
            scope_id=scope_id,
        )
