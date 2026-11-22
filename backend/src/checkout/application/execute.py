"""Orquestación por pasos e idempotencia compuesta para «Cobrar y facturar» (ADR-0014)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid5

from django.db import IntegrityError, transaction

from checkout.application.errors import CheckoutError
from checkout.application.preview import preview_maintenance_checkout, preview_sale_checkout
from checkout.models import CheckoutReceipt
from fiscal.application.preparations import (
    FiscalPreparationError,
    PreparationImpedimentError,
    prepare_from_checkout,
)
from identity.application.authorization import BusinessPermissionDeniedError, has_permission
from identity.models import User
from sales.application import payments as commercial_payments
from sales.application import reviews as sale_reviews
from sales.application import sales as sales_app
from sales.application.errors import SalesApplicationError
from shared.command_values import canonical_fingerprint, validate_idempotency_key
from workshop.application import artisan_payments, service_operations, transitions
from workshop.application import queries as workshop_queries
from workshop.application.errors import WorkshopError

ACTION = "checkout.execute"
ZERO = Decimal("0.00")
ALLOWED_METHODS = frozenset({"EFECTIVO", "TRANSFERENCIA"})


def _step_key(base_key: str, step: str) -> str:
    return f"{base_key}:{step}"


def _step_uuid(base_key: str, step: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"tallkit:checkout:{base_key}:{step}"))


def _dec(value: Any) -> Decimal:
    if value in (None, ""):
        return ZERO
    return Decimal(str(value))


def _resolve_payment_parts(
    *,
    payment_mode: str,
    partial: bool,
    explicit: dict[str, Any] | None,
    balance: Decimal,
    block_label: str,
) -> tuple[list[dict[str, str]], dict[str, Any] | None]:
    """Resuelve partes reales de pago (EFECTIVO/TRANSFERENCIA) y retención opcional."""
    withholding = explicit.get("withholding") if explicit else None
    if explicit and explicit.get("parts") is not None:
        raw_parts = list(explicit["parts"])
        cleaned: list[dict[str, str]] = []
        for part in raw_parts:
            method = str(part.get("method", "")).upper()
            if method not in ALLOWED_METHODS:
                raise CheckoutError(
                    "invalid_payment_method",
                    f"Medio de pago no admitido en {block_label}. Solo Efectivo o Transferencia.",
                    status=400,
                )
            amt = _dec(part.get("amount"))
            if amt > ZERO:
                cleaned.append({"method": method, "amount": f"{amt:.2f}"})
        return cleaned, withholding

    if partial:
        raise CheckoutError(
            "partial_requires_business_amounts",
            f"En pago parcial debe indicar el importe explícito para {block_label}.",
            status=400,
        )
    if payment_mode == "MIXED":
        raise CheckoutError(
            "mixed_requires_parts",
            (
                "En pago combinado debe indicar el desglose de efectivo y transferencia "
                f"para {block_label}."
            ),
            status=400,
        )
    if payment_mode == "CREDIT" or balance <= ZERO:
        return [], withholding

    withheld_amt = _dec(withholding.get("amount")) if withholding else ZERO
    net = balance - withheld_amt
    if net <= ZERO:
        return [], withholding
    method = "EFECTIVO" if payment_mode == "CASH" else "TRANSFERENCIA"
    return [{"method": method, "amount": f"{net:.2f}"}], withholding


def _confirm_and_pay_commercial(
    *,
    actor: User,
    sale_id: int,
    is_draft: bool,
    condition: str,
    payment_mode: str,
    partial: bool,
    explicit_payment: dict[str, Any] | None,
    include_invoices: bool,
    receiver_mode: str,
    receiver_email: str,
    credit_term_days: int | None,
    save_email_to_customer: bool,
    base_key: str,
    request_id: UUID | None,
) -> tuple[dict[str, Any], bool, bool]:
    """Ejecuta confirmar -> cobrar -> preparar factura para una venta comercial."""
    result: dict[str, Any] = {
        "executed": True,
        "sale_id": sale_id,
        "document_number": None,
        "confirmed": False,
        "paid": False,
        "paid_amount": "0.00",
        "fiscal_state": "SKIPPED",
        "preparation_id": None,
        "fiscal_error": None,
        "error": None,
    }
    had_partial_failure = False
    email_updated = False

    sale_data = sales_app.get_sale(actor=actor, sale_id=sale_id, request_id=request_id)
    if is_draft and sale_data["state"] == "DRAFT":
        if not has_permission(actor, "ventas.confirmar"):
            raise CheckoutError(
                "permission_denied",
                "No tiene permiso para confirmar la venta comercial.",
                status=403,
            )
        if sale_data.get("condition") != condition:
            sales_app.update_draft(
                actor=actor,
                sale_id=sale_id,
                payload={
                    "expected_version": sale_data["version"],
                    "condition": condition,
                    "idempotency_key": _step_key(base_key, "com-cond"),
                },
                request_id=request_id,
            )
            sale_data = sales_app.get_sale(actor=actor, sale_id=sale_id, request_id=request_id)
        review = sale_reviews.preview_confirmation(
            actor=actor, sale_id=sale_id, request_id=request_id
        )
        if not review.get("can_confirm") or not review.get("review_token"):
            msg = " ".join(i["message"] for i in review.get("issues", [])) or (
                "La venta comercial no puede confirmarse."
            )
            raise CheckoutError("commercial_confirm_blocked", msg, status=409)
        confirmed = sales_app.confirm_sale(
            actor=actor,
            sale_id=sale_id,
            payload={
                "expected_version": sale_data["version"],
                "review_token": review["review_token"],
                "idempotency_key": _step_key(base_key, "com-confirm"),
            },
            request_id=request_id,
        )
        sale_data = confirmed.body
        result["confirmed"] = True
    else:
        result["confirmed"] = sale_data["state"] == "CONFIRMED"

    result["document_number"] = sale_data.get("internal_number")
    balance = _dec((sale_data.get("money") or {}).get("balance"))

    parts, withholding = _resolve_payment_parts(
        payment_mode=payment_mode,
        partial=partial,
        explicit=explicit_payment,
        balance=balance,
        block_label="repuestos",
    )
    if (parts or withholding) and balance > ZERO:
        if not has_permission(actor, "pagos_comerciales.registrar"):
            raise CheckoutError(
                "permission_denied",
                "No tiene permiso para registrar cobros comerciales.",
                status=403,
            )
        op_id = _step_uuid(base_key, "com-pay")
        pay_payload: dict[str, Any] = {"operation_id": op_id, "parts": parts}
        if withholding:
            pay_payload["withholding"] = withholding
        pay_review = commercial_payments.preview_payment(
            actor=actor, sale_id=sale_id, payload=pay_payload, request_id=request_id
        )
        if not pay_review.get("review_token") or pay_review.get("issues"):
            msg = " ".join(i["message"] for i in pay_review.get("issues", [])) or (
                "No se pudo validar el cobro comercial."
            )
            raise CheckoutError("commercial_payment_invalid", msg, status=400)
        commercial_payments.register_payment(
            actor=actor,
            sale_id=sale_id,
            payload={
                **pay_payload,
                "review_token": pay_review["review_token"],
                "idempotency_key": _step_key(base_key, "com-pay"),
            },
            request_id=request_id,
        )
        result["paid"] = True
        result["paid_amount"] = f"{sum((_dec(p['amount']) for p in parts), ZERO):.2f}"

    if include_invoices and has_permission(actor, "fiscal.comercial.preparar"):
        try:
            prep = prepare_from_checkout(
                actor=actor,
                source_kind="COMMERCIAL",
                source_id=sale_id,
                idempotency_key=_step_key(base_key, "com-fiscal"),
                receiver_mode=receiver_mode,
                receiver_email=receiver_email,
                credit_term_days=credit_term_days,
                save_email_to_customer=save_email_to_customer,
            )
            result["fiscal_state"] = "PREPARED"
            result["preparation_id"] = str(prep.preparation_id)
            email_updated = prep.customer_email_updated
        except PreparationImpedimentError as exc:
            had_partial_failure = True
            result["fiscal_state"] = "FAILED"
            result["fiscal_error"] = " ".join(
                str(item.get("message") or item) for item in exc.impediments
            )
        except (FiscalPreparationError, BusinessPermissionDeniedError) as exc:
            had_partial_failure = True
            result["fiscal_state"] = "FAILED"
            result["fiscal_error"] = str(exc)

    return result, had_partial_failure, email_updated


def _confirm_and_pay_artisan(
    *,
    actor: User,
    order_id: int,
    order_version: int,
    has_pending_lines: bool,
    existing_operation_id: int | None,
    condition: str,
    payment_mode: str,
    partial: bool,
    explicit_payment: dict[str, Any] | None,
    include_invoices: bool,
    receiver_mode: str,
    receiver_email: str,
    credit_term_days: int | None,
    save_email_to_customer: bool,
    base_key: str,
    request_id: UUID | None,
) -> tuple[dict[str, Any], bool, bool]:
    """Ejecuta confirmar -> cobrar -> preparar factura para la operación artesanal."""
    result: dict[str, Any] = {
        "executed": True,
        "operation_id": existing_operation_id,
        "document_number": None,
        "confirmed": False,
        "paid": False,
        "paid_amount": "0.00",
        "fiscal_state": "SKIPPED",
        "preparation_id": None,
        "fiscal_error": None,
        "error": None,
    }
    had_partial_failure = False
    email_updated = False

    op_data: dict[str, Any]
    if has_pending_lines:
        if not has_permission(actor, "servicios_economicos.confirmar"):
            raise CheckoutError(
                "permission_denied",
                "No tiene permiso para confirmar operaciones de servicios.",
                status=403,
            )
        prev = service_operations.preview_operation(
            actor=actor,
            order_id=order_id,
            payload={"condition": condition},
            request_id=request_id,
        )
        if prev.get("issues") or not prev.get("review_digest"):
            msg = " ".join(i["message"] for i in prev.get("issues", [])) or (
                "No se pueden confirmar los servicios."
            )
            raise CheckoutError("artisan_confirm_blocked", msg, status=409)
        confirmed = service_operations.confirm_operation(
            actor=actor,
            order_id=order_id,
            payload={
                "condition": condition,
                "expected_version": order_version,
                "review_digest": prev["review_digest"],
                "idempotency_key": _step_key(base_key, "art-confirm"),
            },
            request_id=request_id,
        )
        op_data = confirmed.body
        result["operation_id"] = int(op_data["id"])
        result["confirmed"] = True
    elif existing_operation_id is not None:
        op_data = service_operations.get_operation(
            actor=actor, operation_id=existing_operation_id, request_id=request_id
        )
        result["operation_id"] = existing_operation_id
        result["confirmed"] = op_data["state"] == "CONFIRMED"
    else:
        result["executed"] = False
        return result, False, False

    operation_id = int(result["operation_id"])
    result["document_number"] = op_data.get("internal_number")
    balance = _dec(op_data.get("balance"))

    parts, withholding = _resolve_payment_parts(
        payment_mode=payment_mode,
        partial=partial,
        explicit=explicit_payment,
        balance=balance,
        block_label="servicios",
    )
    if (parts or withholding) and balance > ZERO:
        if not has_permission(actor, "pagos_artesanales.registrar"):
            raise CheckoutError(
                "permission_denied",
                "No tiene permiso para registrar cobros de servicios.",
                status=403,
            )
        pay_payload: dict[str, Any] = {
            "operation_id": _step_uuid(base_key, "art-pay"),
            "parts": parts,
            "idempotency_key": _step_key(base_key, "art-pay"),
        }
        if withholding:
            pay_payload["withholding"] = withholding
        artisan_payments.register_payment(
            actor=actor,
            operation_id=operation_id,
            payload=pay_payload,
            request_id=request_id,
        )
        result["paid"] = True
        result["paid_amount"] = f"{sum((_dec(p['amount']) for p in parts), ZERO):.2f}"

    if include_invoices and has_permission(actor, "fiscal.artesanal.preparar"):
        try:
            prep = prepare_from_checkout(
                actor=actor,
                source_kind="ARTISAN",
                source_id=operation_id,
                idempotency_key=_step_key(base_key, "art-fiscal"),
                receiver_mode=receiver_mode,
                receiver_email=receiver_email,
                credit_term_days=credit_term_days,
                save_email_to_customer=save_email_to_customer,
            )
            result["fiscal_state"] = "PREPARED"
            result["preparation_id"] = str(prep.preparation_id)
            email_updated = prep.customer_email_updated
        except PreparationImpedimentError as exc:
            had_partial_failure = True
            result["fiscal_state"] = "FAILED"
            result["fiscal_error"] = " ".join(
                str(item.get("message") or item) for item in exc.impediments
            )
        except (FiscalPreparationError, BusinessPermissionDeniedError) as exc:
            had_partial_failure = True
            result["fiscal_state"] = "FAILED"
            result["fiscal_error"] = str(exc)

    return result, had_partial_failure, email_updated


def execute_checkout(
    *,
    actor: User,
    payload: dict[str, Any],
    idempotency_key: str,
    request_id: UUID | None = None,
) -> tuple[int, dict[str, Any]]:
    """Orquesta «Cobrar y facturar» con transacciones independientes e idempotencia compuesta."""
    try:
        key = validate_idempotency_key(idempotency_key)
    except ValueError as exc:
        raise CheckoutError("validation_error", str(exc), status=400) from None

    fingerprint = canonical_fingerprint(payload)
    try:
        with transaction.atomic():
            receipt = CheckoutReceipt.objects.create(
                actor=actor,
                action=ACTION,
                idempotency_key=key,
                input_fingerprint=fingerprint,
            )
    except IntegrityError:
        receipt = CheckoutReceipt.objects.get(actor=actor, action=ACTION, idempotency_key=key)
        if receipt.input_fingerprint != fingerprint:
            raise CheckoutError(
                "idempotency_conflict",
                "La clave de idempotencia corresponde a otra solicitud.",
                status=409,
            ) from None
        if receipt.completed:
            return receipt.response_status, {**receipt.response_payload, "replayed": True}

    try:
        response = _run_checkout(actor=actor, payload=payload, base_key=key, request_id=request_id)
    except (CheckoutError, SalesApplicationError, WorkshopError, BusinessPermissionDeniedError):
        CheckoutReceipt.objects.filter(pk=receipt.pk, completed=False).delete()
        raise

    receipt.response_status = 200
    receipt.response_payload = response
    receipt.completed = True
    receipt.save(update_fields=["response_status", "response_payload", "completed", "updated_at"])
    return 200, {**response, "replayed": False}


def _run_checkout(
    *,
    actor: User,
    payload: dict[str, Any],
    base_key: str,
    request_id: UUID | None,
) -> dict[str, Any]:
    origin_kind = str(payload["origin_kind"])
    payment_mode = str(payload["payment_mode"])
    partial = bool(payload.get("partial", False))
    include_invoices = bool(payload.get("include_invoices", True))
    receiver_mode = str(payload.get("receiver_mode", "CUSTOMER"))
    receiver_email = str(payload.get("receiver_email") or "").strip()
    save_email = bool(payload.get("save_email_to_customer", True))
    credit_term_days = payload.get("credit_term_days")
    close_order = bool(payload.get("close_order", False))
    com_payment = payload.get("commercial_payment")
    art_payment = payload.get("artisan_payment")

    if partial:
        if origin_kind == "MAINTENANCE" and not com_payment and not art_payment:
            raise CheckoutError(
                "partial_requires_business_amounts",
                "En pago parcial debe indicar el importe explícito por negocio.",
                status=400,
            )
        if origin_kind in ("SALE", "QUICK_SALE") and not com_payment:
            raise CheckoutError(
                "partial_requires_business_amounts",
                "En pago parcial debe indicar el importe explícito para la venta.",
                status=400,
            )

    condition = "CREDITO" if (payment_mode == "CREDIT" or partial) else "CONTADO"
    overall_partial = False
    customer_email_updated = False
    commercial_result: dict[str, Any] = {"executed": False}
    artisan_result: dict[str, Any] = {"executed": False}
    order_closure: dict[str, Any] = {"requested": close_order, "closed": False, "reason": None}

    if origin_kind == "QUICK_SALE":
        if not has_permission(actor, "ventas.crear") or not has_permission(
            actor, "ventas.confirmar"
        ):
            raise CheckoutError(
                "permission_denied",
                "No tiene permiso para crear y confirmar ventas.",
                status=403,
            )
        customer_id = payload.get("customer_id")
        lines = payload.get("lines") or []
        if not customer_id or not lines:
            raise CheckoutError(
                "validation_error",
                "Debe indicar cliente y al menos un producto.",
                status=400,
            )
        created = sales_app.create_draft(
            actor=actor,
            payload={
                "customer_id": customer_id,
                "condition": condition,
                "notes": "",
                "lines": lines,
                "idempotency_key": _step_key(base_key, "quick-draft"),
            },
            request_id=request_id,
        )
        sale_id = int(created.body["id"])
        commercial_result, partial_fail, email_upd = _confirm_and_pay_commercial(
            actor=actor,
            sale_id=sale_id,
            is_draft=True,
            condition=condition,
            payment_mode=payment_mode,
            partial=partial,
            explicit_payment=com_payment,
            include_invoices=include_invoices,
            receiver_mode=receiver_mode,
            receiver_email=receiver_email,
            credit_term_days=credit_term_days,
            save_email_to_customer=save_email,
            base_key=base_key,
            request_id=request_id,
        )
        overall_partial = partial_fail
        customer_email_updated = email_upd

    elif origin_kind == "SALE":
        sale_id = int(payload["sale_id"])
        prev = preview_sale_checkout(actor=actor, sale_id=sale_id, request_id=request_id)
        if prev["commercial"]["issues"]:
            raise CheckoutError(
                "commercial_precheck_failed",
                " ".join(prev["commercial"]["issues"]),
                status=409,
            )
        commercial_result, partial_fail, email_upd = _confirm_and_pay_commercial(
            actor=actor,
            sale_id=sale_id,
            is_draft=prev["commercial"]["pending_sale_id"] is not None,
            condition=condition,
            payment_mode=payment_mode,
            partial=partial,
            explicit_payment=com_payment,
            include_invoices=include_invoices,
            receiver_mode=receiver_mode,
            receiver_email=receiver_email,
            credit_term_days=credit_term_days,
            save_email_to_customer=save_email,
            base_key=base_key,
            request_id=request_id,
        )
        overall_partial = partial_fail
        customer_email_updated = email_upd

    elif origin_kind == "MAINTENANCE":
        order_id = int(payload["order_id"])
        prev = preview_maintenance_checkout(actor=actor, order_id=order_id, request_id=request_id)
        com_block = prev["commercial"]
        art_block = prev["artisan"]

        # Prevalidación estricta de stock/precios/impuestos antes de mutar nada.
        if com_block["visible"] and com_block["issues"]:
            raise CheckoutError(
                "commercial_precheck_failed",
                " ".join(com_block["issues"]),
                status=409,
            )
        if art_block["visible"] and art_block["issues"]:
            raise CheckoutError(
                "artisan_precheck_failed",
                " ".join(art_block["issues"]),
                status=409,
            )

        # Rechazar intentos explícitos de operar un bloque sin permiso.
        if com_payment and not com_block["visible"]:
            raise CheckoutError(
                "permission_denied",
                "No tiene permiso para operar repuestos (negocio comercial).",
                status=403,
            )
        if art_payment and not art_block["visible"]:
            raise CheckoutError(
                "permission_denied",
                "No tiene permiso para operar servicios (negocio artesanal).",
                status=403,
            )

        if com_block["visible"] and com_block["sale_id"] is not None and com_block["action_needed"]:
            commercial_result, c_fail, c_email = _confirm_and_pay_commercial(
                actor=actor,
                sale_id=int(com_block["sale_id"]),
                is_draft=com_block["pending_sale_id"] is not None,
                condition=condition,
                payment_mode=payment_mode,
                partial=partial,
                explicit_payment=com_payment,
                include_invoices=include_invoices,
                receiver_mode=receiver_mode,
                receiver_email=receiver_email,
                credit_term_days=credit_term_days,
                save_email_to_customer=save_email,
                base_key=base_key,
                request_id=request_id,
            )
            overall_partial = overall_partial or c_fail
            customer_email_updated = customer_email_updated or c_email

        if art_block["visible"] and art_block["action_needed"]:
            artisan_result, a_fail, a_email = _confirm_and_pay_artisan(
                actor=actor,
                order_id=order_id,
                order_version=int(prev["origin"]["version"]),
                has_pending_lines=bool(art_block["has_pending_lines"]),
                existing_operation_id=art_block["operation_id"],
                condition=condition,
                payment_mode=payment_mode,
                partial=partial,
                explicit_payment=art_payment,
                include_invoices=include_invoices,
                receiver_mode=receiver_mode,
                receiver_email=receiver_email,
                credit_term_days=credit_term_days,
                save_email_to_customer=save_email and not customer_email_updated,
                base_key=base_key,
                request_id=request_id,
            )
            overall_partial = overall_partial or a_fail
            customer_email_updated = customer_email_updated or a_email

        if close_order:
            if not has_permission(actor, "mantenimientos.finalizar"):
                order_closure["reason"] = "No tiene permiso para finalizar mantenimientos."
            else:
                fresh = workshop_queries.get_order(
                    actor=actor, order_id=order_id, request_id=request_id
                )
                try:
                    transitions.finalize_order(
                        actor=actor,
                        order_id=order_id,
                        payload={
                            "expected_version": fresh["version"],
                            "idempotency_key": _step_key(base_key, "finalize"),
                        },
                        request_id=request_id,
                    )
                    order_closure["closed"] = True
                except WorkshopError as exc:
                    order_closure["closed"] = False
                    order_closure["reason"] = exc.message
    else:
        raise CheckoutError("validation_error", "Origen de cobro no válido.", status=400)

    return {
        "overall_status": "partial" if overall_partial else "completed",
        "origin_kind": origin_kind,
        "commercial": commercial_result,
        "artisan": artisan_result,
        "customer_email_updated": customer_email_updated,
        "order_closure": order_closure,
    }
