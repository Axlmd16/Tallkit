from typing import Any


class CheckoutError(Exception):
    """Error controlado del orquestador «Cobrar y facturar»."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status: int = 400,
        errors: dict[str, list[str]] | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.errors = errors
        self.details = details
