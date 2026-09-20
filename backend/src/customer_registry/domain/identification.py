"""Reglas puras de identificación CI/RUC publicadas para otros módulos.

Reexporta las reglas existentes sin moverlas ni cambiarlas.
"""

from customer_registry.domain.validation import (
    CustomerValidationError,
    IdentificationType,
    validate_email,
    validate_identification,
    validate_identification_type,
)

__all__ = [
    "CustomerValidationError",
    "IdentificationType",
    "validate_email",
    "validate_identification",
    "validate_identification_type",
]
