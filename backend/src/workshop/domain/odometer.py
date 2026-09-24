"""Kilometraje entero en km, sin prohibición absoluta de valores menores (RN-TAL-007)."""

MAX_ODOMETER = 9_999_999


class OdometerError(ValueError):
    pass


def parse_odometer(value: object) -> int:
    if isinstance(value, bool):
        raise OdometerError("Ingrese el kilometraje en kilómetros enteros.")
    if isinstance(value, str) and value.strip().isdigit():
        value = int(value.strip())
    if not isinstance(value, int):
        raise OdometerError("Ingrese el kilometraje en kilómetros enteros.")
    if value < 0:
        raise OdometerError("El kilometraje no puede ser negativo.")
    if value > MAX_ODOMETER:
        raise OdometerError("El kilometraje supera el máximo permitido.")
    return value


def needs_confirmation(odometer_km: int, last_known_km: int | None) -> bool:
    return last_known_km is not None and odometer_km < last_known_km
