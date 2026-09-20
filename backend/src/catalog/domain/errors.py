"""Errores puros del dominio del catálogo."""


class CatalogValidationError(ValueError):
    """Entrada inválida; ``errors`` asocia campos con mensajes corregibles."""

    def __init__(self, message: str, errors: dict[str, list[str]] | None = None) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = errors or {"non_field_errors": [message]}
