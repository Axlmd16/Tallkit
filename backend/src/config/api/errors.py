from typing import Any

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import exception_handler


class ConflictInfoSerializer(serializers.Serializer[dict[str, object]]):
    type = serializers.CharField()
    id = serializers.IntegerField()


class ProblemSerializer(serializers.Serializer[dict[str, object]]):
    type = serializers.CharField()
    title = serializers.CharField()
    status = serializers.IntegerField()
    detail = serializers.CharField()
    code = serializers.CharField()
    request_id = serializers.CharField(allow_null=True)
    errors = serializers.DictField(  # type: ignore[assignment]
        child=serializers.ListField(child=serializers.CharField()),
        required=False,
        allow_null=True,
    )
    conflict = ConflictInfoSerializer(required=False, allow_null=True)


def problem_response(
    *,
    request: Request,
    status_code: int,
    title: str,
    code: str,
    detail: str,
    errors: dict[str, list[str]] | None = None,
    conflict: dict[str, Any] | None = None,
) -> Response:
    payload: dict[str, Any] = {
        "type": "about:blank",
        "title": title,
        "status": status_code,
        "detail": detail,
        "code": code,
        "request_id": getattr(request, "request_id", None),
    }
    if errors:
        payload["errors"] = errors
    if conflict:
        payload["conflict"] = {
            "type": str(conflict.get("type", "")),
            "id": int(conflict["id"]),
        }
    response = Response(
        payload,
        status=status_code,
        content_type="application/problem+json",
    )
    response["Content-Type"] = "application/problem+json"
    return response


def problem_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    if response is None:
        return None

    request = context["request"]
    detail = "La solicitud no pudo completarse."
    errors: dict[str, list[str]] | None = None
    default_code = getattr(exc, "default_code", "request_rejected")

    if isinstance(response.data, dict):
        if isinstance(response.data.get("detail"), str):
            detail = response.data["detail"]
        else:
            extracted_errors: dict[str, list[str]] = {}
            for field, errs in response.data.items():
                if isinstance(errs, list):
                    extracted_errors[str(field)] = [str(e) for e in errs]
                elif isinstance(errs, str):
                    extracted_errors[str(field)] = [errs]
            if extracted_errors:
                errors = extracted_errors
                detail = "La solicitud contiene errores de validación."
                if default_code in ("invalid", "request_rejected"):
                    default_code = "validation_error"

    payload: dict[str, Any] = {
        "type": "about:blank",
        "title": "Solicitud inválida" if response.status_code == 400 else "Solicitud rechazada",
        "status": response.status_code,
        "detail": detail,
        "code": default_code,
        "request_id": getattr(request, "request_id", None),
    }
    if errors:
        payload["errors"] = errors

    response.data = payload
    response.content_type = "application/problem+json"
    response["Content-Type"] = "application/problem+json"
    return response


_APPLICATION_ERROR_STATUS: dict[str, tuple[int, str]] = {
    "validation_error": (400, "Solicitud inválida"),
    "unknown_field": (400, "Campo no admitido"),
    "inactive_reference": (400, "Referencia inactiva"),
    "invalid_tax_scope": (400, "Ámbito tributario inválido"),
    "not_found": (404, "Recurso no encontrado"),
    "duplicate_code": (409, "Código duplicado"),
    "duplicate_manufacturer_code": (409, "Código de fabricante duplicado"),
    "duplicate_name": (409, "Nombre duplicado"),
    "duplicate_identification": (409, "Identificación duplicada"),
    "category_has_active_products": (409, "Categoría con productos activos"),
    "stale_record": (409, "Registro desactualizado"),
    "idempotency_conflict": (409, "Clave de idempotencia reutilizada"),
    "review_required": (409, "Revisión requerida"),
    "duplicate_supplier_document": (409, "Documento del proveedor duplicado"),
    "configuration_missing": (409, "Configuración ausente"),
    "configuration_ambiguous": (409, "Configuración ambigua"),
    "insufficient_stock": (409, "Existencia insuficiente"),
    "already_initialized": (409, "Producto ya inicializado"),
    "unsafe_reversal": (409, "Reversión no segura"),
    "inventory_inconsistent": (409, "Inventario inconsistente"),
    "not_editable": (409, "Registro no editable"),
    "invalid_state": (409, "Estado no válido para la acción"),
    "dependency_conflict": (409, "Dependencia que impide la acción"),
    "concurrent_operation": (409, "Operación concurrente"),
}


def application_error_response(
    *,
    request: Request,
    code: str,
    message: str,
    errors: dict[str, list[str]] | None = None,
) -> Response:
    """Traduce un error de aplicación con código estable a ``application/problem+json``."""
    status_code, title = _APPLICATION_ERROR_STATUS.get(code, (400, "Solicitud inválida"))
    return problem_response(
        request=request,
        status_code=status_code,
        title=title,
        code=code,
        detail=message,
        errors=errors,
    )
