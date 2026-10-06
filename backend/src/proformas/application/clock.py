"""Reloj de la aplicación: el dominio recibe el instante y el día local como datos."""

from datetime import date, datetime

from django.utils import timezone

from proformas.domain.validity import local_date


def now() -> datetime:
    return timezone.now()


def today() -> date:
    """Día del negocio en America/Guayaquil; lista, detalle y escrituras usan este mismo reloj."""
    return local_date(now())
