"""Precarga del borrador fiscal desde la operación y la configuración centralizada.

El receptor se copia de la instantánea histórica del cliente y las formas de pago se
sugieren desde los cobros vigentes y la forma predeterminada. Los borradores
anteriores conservan lo que el usuario completó, pero sus datos técnicos (ambiente,
punto, fecha, plazo) se ignoran: la configuración se resuelve de nuevo al revisar.
"""

from dataclasses import asdict
from datetime import date
from typing import Any

from fiscal.domain.payment_suggestion import suggest_payment_forms
from workshop_configuration.application.preparation_settings import (
    V1_ENABLEABLE_PAYMENT_FORMS,
    effective_defaults,
)

DRAFT_FORMAT = 3
_IDENTIFICATION_TYPES = {"RUC": "04", "CI": "05"}
_RECEIVER_FIELDS = ("identification_type", "identification", "legal_name", "address", "email")


def receiver_from_customer(customer: Any) -> dict[str, Any]:
    """Traduce la instantánea del cliente sin corregir ni completar sus datos."""
    snapshot = dict(customer or {})
    receiver: dict[str, Any] = {
        "identification_type": _IDENTIFICATION_TYPES.get(
            str(snapshot.get("identification_type") or ""), ""
        ),
        "identification": str(snapshot.get("identification") or ""),
        "legal_name": str(snapshot.get("name") or ""),
    }
    for field in ("address", "email"):
        value = snapshot.get(field)
        if isinstance(value, str) and value.strip():
            receiver[field] = value.strip()
    return receiver


def service_details_from_source(source: Any) -> list[dict[str, Any]]:
    """Detalle de cada línea artesanal tal como lo conserva la operación; vacío en comerciales."""
    return [
        {"position": line.position, "detail": str(line.detail)}
        for line in source.lines
        if hasattr(line, "detail")
    ]


def _enabled_by_method(enabled_codes: tuple[str, ...]) -> dict[str, str]:
    return {
        method: code
        for code, method in V1_ENABLEABLE_PAYMENT_FORMS.items()
        if code in enabled_codes
    }


def suggested_payments(*, source: Any, entity_id: int, on: date) -> dict[str, Any]:
    defaults = effective_defaults(entity_id=entity_id, on=on)
    suggestion = suggest_payment_forms(
        total=str(source.grand_total),
        collected=dict(getattr(source, "collected_by_method", {}) or {}),
        enabled_forms=_enabled_by_method(defaults.enabled_payment_codes),
        default_code=defaults.payment_code,
    )
    return {
        "forms": [asdict(form) for form in suggestion.forms],
        "suggested": True,
        "suggestion_origin": suggestion.origin,
    }


def initial_draft(*, source: Any, entity_id: int, on: date) -> dict[str, Any]:
    return {
        "draft_format": DRAFT_FORMAT,
        "receiver": receiver_from_customer(source.customer_snapshot),
        "payments": suggested_payments(source=source, entity_id=entity_id, on=on),
        "additional_info": [],
        "service_details": service_details_from_source(source),
    }


def normalized_draft(
    draft: dict[str, Any] | None, *, source: Any, entity_id: int, on: date
) -> dict[str, Any]:
    """Versión del borrador que el flujo simplificado usa; no escribe en la base."""
    current = dict(draft or {})
    receiver = current.get("receiver")
    if not isinstance(receiver, dict) or not receiver:
        receiver = receiver_from_customer(source.customer_snapshot)
    else:
        receiver = {key: receiver[key] for key in _RECEIVER_FIELDS if key in receiver}
    stored = current.get("payments")
    stored_payments: dict[str, Any] = stored if isinstance(stored, dict) else {}
    forms = stored_payments.get("forms")
    if not isinstance(forms, list) or not forms:
        payments = suggested_payments(source=source, entity_id=entity_id, on=on)
    else:
        payments = {
            "forms": [
                {"payment_code": form.get("payment_code"), "amount": form.get("amount")}
                for form in forms
                if isinstance(form, dict)
            ],
            "suggested": bool(stored_payments.get("suggested", False)),
            "suggestion_origin": stored_payments.get("suggestion_origin"),
        }
    # El plazo del comprobante se conserva solo como dato único del borrador; el que traían las
    # formas de pago en borradores anteriores no se reutiliza y se vuelve a pedir.
    if stored_payments.get("term_days") is not None:
        payments["term_days"] = stored_payments["term_days"]
    additional = current.get("additional_info")
    stored_details = current.get("service_details")
    return {
        "draft_format": DRAFT_FORMAT,
        "receiver": receiver,
        "payments": payments,
        "additional_info": additional if isinstance(additional, list) else [],
        "service_details": (
            stored_details
            if isinstance(stored_details, list)
            else service_details_from_source(source)
        ),
    }
