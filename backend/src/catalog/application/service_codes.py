"""Código visible, único e inmutable de cada servicio, asignado por el sistema."""

from catalog.models import ServiceCodeCounter

PREFIX = "SRV-"


def next_service_code() -> str:
    """Siguiente código ``SRV-`` con al menos seis dígitos.

    Debe llamarse dentro de la transacción del alta: el bloqueo de la fila única del
    contador serializa las altas simultáneas y un alta revertida devuelve el número.
    """
    counter, _ = ServiceCodeCounter.objects.select_for_update().get_or_create(pk=1)
    counter.last_number += 1
    counter.save(update_fields=["last_number"])
    return f"{PREFIX}{counter.last_number:06d}"
