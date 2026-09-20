"""Errores puros del dominio de proveedores."""


class SupplierValidationError(ValueError):
    def __init__(self, message: str, errors: dict[str, list[str]] | None = None) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = errors or {"non_field_errors": [message]}
