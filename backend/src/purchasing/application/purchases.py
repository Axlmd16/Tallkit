"""Servicios de compras: borradores, revisión y confirmación.

Una confirmación abre una única transacción exterior y toma recursos en el orden total
del diseño: recibo, identidad y compra, proveedor, productos, posiciones, contexto de
configuración y, al final, inserciones. Nunca se adquiere un recurso de un grupo anterior
después de uno posterior.
"""

from collections import defaultdict
from contextlib import suppress
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from django.core import signing
from django.db import IntegrityError, transaction
from django.utils import timezone

import inventory.application.posting as posting
import inventory.application.queries as inventory_queries
from catalog.application.inventory_references import (
    ProductReference,
    ProductReferenceError,
    get_product_references,
    lock_product_references,
)
from identity.application.authorization import require_permission
from identity.models import User
from purchasing.application import queries
from purchasing.application.calculation import (
    LineComputation,
    TaxBasis,
    compute_lines,
    document_totals,
)
from purchasing.application.commands import (
    CommandOutcome,
    execute_write,
    reject_unknown_fields,
    validated_version,
)
from purchasing.application.errors import (
    PurchaseApplicationError,
    field_error,
    not_found,
    stale_record,
)
from purchasing.domain.draft_input import (
    DRAFT_FIELDS,
    DraftInput,
    DraftValidationError,
    LineInput,
    parse_draft,
)
from purchasing.models import Purchase, PurchaseDocumentIdentity, PurchaseLine
from shared.command_values import canonical_fingerprint
from supplier_registry.application.purchase_references import (
    SupplierReference,
    SupplierReferenceError,
    get_supplier_reference,
    lock_supplier_reference,
)
from workshop_configuration.application.configuration_resolver import resolve_configuration
from workshop_configuration.application.numbering import (
    NumberingError,
    NumberingScopeNotFoundError,
    allocate_number,
    get_numbering_scope_id,
)
from workshop_configuration.application.operation_context import (
    LockedOperationContext,
    OperationContext,
    OperationContextError,
    get_operation_context,
    lock_operation_context,
    review_tax_options,
)

_TZ = ZoneInfo("America/Guayaquil")


def _today() -> date:
    return datetime.now(tz=_TZ).date()


def _constraint(exc: IntegrityError) -> str:
    diag = getattr(exc.__cause__, "diag", None)
    return str(getattr(diag, "constraint_name", "") or "")


def _parse(payload: dict[str, Any]) -> DraftInput:
    try:
        return parse_draft(payload, today=_today())
    except DraftValidationError as error:
        raise PurchaseApplicationError(
            error.code,  # type: ignore[arg-type]
            "La solicitud contiene datos inválidos.",
            error.errors,
        ) from None


def _lock_supplier(supplier_id: int) -> SupplierReference:
    try:
        return lock_supplier_reference(supplier_id)
    except SupplierReferenceError as error:
        message = (
            "El proveedor no existe."
            if error.code == "not_found"
            else "El proveedor está inactivo."
        )
        raise field_error("inactive_reference", "supplier_id", message) from None


def _lock_products(lines: tuple[LineInput, ...]) -> dict[int, ProductReference]:
    try:
        return lock_product_references({line.product_id for line in lines})
    except ProductReferenceError as error:
        bad = set(error.missing) | set(error.inactive)
        errors = {
            f"lines.{index}.product_id": [
                "El producto no existe."
                if line.product_id in error.missing
                else "El producto está inactivo."
            ]
            for index, line in enumerate(lines)
            if line.product_id in bad
        }
        raise PurchaseApplicationError(
            "inactive_reference", "Hay productos inexistentes o inactivos.", errors
        ) from None


def _check_tax_scope(lines: tuple[LineInput, ...], document_date: date) -> None:
    review = review_tax_options({line.tax_definition_id for line in lines}, on=document_date)
    errors: dict[str, list[str]] = {}
    scope = False
    for index, line in enumerate(lines):
        found = review.get(line.tax_definition_id)
        if found is None:
            errors[f"lines.{index}.tax_definition_id"] = ["La definición tributaria no existe."]
        elif found.status == "invalid_scope":
            scope = True
            errors[f"lines.{index}.tax_definition_id"] = [
                "El impuesto debe pertenecer al RUC comercial."
            ]
    if errors:
        raise PurchaseApplicationError(
            "invalid_tax_scope" if scope else "validation_error",
            "La selección tributaria no es válida para compras.",
            errors,
        )


def _stored_totals(inp_lines: tuple[LineInput, ...], document_date: date) -> dict[str, Any]:
    bases = queries.tax_bases({line.tax_definition_id for line in inp_lines}, document_date)
    computations: list[LineComputation] = compute_lines(inp_lines, bases)
    totals = document_totals(computations)
    if totals is None:
        return {
            "base_total": None,
            "tax_total": None,
            "grand_total": None,
            "inventory_value_total": None,
        }
    return {
        "base_total": totals.base,
        "tax_total": totals.tax,
        "grand_total": totals.total,
        "inventory_value_total": totals.inventory_value,
    }


def _write_lines(purchase: Purchase, lines: tuple[LineInput, ...]) -> None:
    PurchaseLine.objects.bulk_create(
        PurchaseLine(
            purchase=purchase,
            position=index,
            product_id=line.product_id,
            quantity=line.quantity,
            unit_cost=line.unit_cost,
            tax_definition_id=line.tax_definition_id,
            tax_treatment=line.treatment.value,
        )
        for index, line in enumerate(lines, start=1)
    )


def _duplicate_error() -> PurchaseApplicationError:
    return field_error(
        "duplicate_supplier_document",
        "supplier_reference",
        "Ya existe una compra con este documento del proveedor.",
    )


def create_draft(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Crea un borrador sin efectos de stock, valoración, uso fiscal ni numeración."""

    def work() -> tuple[int, dict[str, Any], list[str]]:
        inp = _parse(payload)
        _lock_supplier(inp.supplier_id)
        _lock_products(inp.lines)
        _check_tax_scope(inp.lines, inp.document_date)
        try:
            with transaction.atomic():
                identity = PurchaseDocumentIdentity.objects.create(
                    supplier_id=inp.supplier_id,
                    document_type=inp.document_type,
                    reference=inp.reference,
                    normalized_reference=inp.normalized_reference,
                )
                purchase = Purchase.objects.create(
                    document_identity=identity,
                    document_date=inp.document_date,
                    observation=inp.notes,
                    no_document_explanation=inp.no_document_reason,
                    created_by=actor,
                    **_stored_totals(inp.lines, inp.document_date),
                )
        except IntegrityError as exc:
            if _constraint(exc) in {
                "pur_identity_external_unique",
                "pur_purchase_one_root_per_identity",
            }:
                raise _duplicate_error() from None
            raise
        _write_lines(purchase, inp.lines)
        return 201, queries.purchase_detail(purchase), ["document_date", "lines"]

    return execute_write(
        actor=actor,
        permission="ingresos.crear",
        action="purchasing.purchase_created",
        target_type="purchase",
        target_id="new",
        request_id=request_id,
        payload=payload,
        work=work,
    )


def _merge(purchase: Purchase, payload: dict[str, Any]) -> dict[str, Any]:
    """Estado actual del borrador con los campos enviados; omitir no es vaciar."""
    identity = purchase.document_identity
    merged: dict[str, Any] = {
        "supplier_id": identity.supplier_id,
        "document_type": identity.document_type,
        "supplier_reference": identity.reference,
        "document_date": purchase.document_date.isoformat(),
        "notes": purchase.observation,
        "no_document_reason": purchase.no_document_explanation,
        "lines": [
            {
                "product_id": line.product_id,
                "quantity": f"{line.quantity:.0f}",
                "unit_cost": f"{line.unit_cost:.6f}",
                "tax_definition_id": line.tax_definition_id,
                "tax_recoverability": line.tax_treatment,
            }
            for line in purchase.lines.order_by("position")
        ],
    }
    merged.update({k: v for k, v in payload.items() if k in DRAFT_FIELDS})
    return merged


def _lock_purchase(purchase_id: int) -> Purchase:
    """Identidad primero y compra después (grupo 2 del orden total), con lectura previa."""
    identity_id = (
        Purchase.objects.filter(pk=purchase_id)
        .values_list("document_identity_id", flat=True)
        .first()
    )
    if identity_id is None:
        raise not_found()
    PurchaseDocumentIdentity.objects.select_for_update().filter(pk=identity_id).first()
    purchase = (
        Purchase.objects.select_for_update()
        .select_related("document_identity")
        .filter(pk=purchase_id, document_identity_id=identity_id)
        .first()
    )
    if purchase is None:
        raise not_found()
    return purchase


def update_draft(
    *, actor: User, purchase_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Edita un borrador con ``expected_version``; sustituye la colección de líneas completa."""

    def work() -> tuple[int, dict[str, Any], list[str]]:
        reject_unknown_fields(payload, DRAFT_FIELDS | {"idempotency_key", "expected_version"})
        expected = validated_version(payload)
        purchase = _lock_purchase(purchase_id)
        if purchase.state != "DRAFT":
            raise PurchaseApplicationError(
                "not_editable", "Un ingreso confirmado o anulado no puede editarse."
            )
        if purchase.version != expected:
            raise stale_record()
        merged = _merge(purchase, payload)
        inp = _parse(merged)
        _lock_supplier(inp.supplier_id)
        _lock_products(inp.lines)
        _check_tax_scope(inp.lines, inp.document_date)
        identity = purchase.document_identity
        identity_changed = (
            identity.supplier_id != inp.supplier_id
            or identity.document_type != inp.document_type
            or identity.reference != inp.reference
        )
        if identity_changed:
            if purchase.replaces_id is not None:
                raise field_error(
                    "validation_error",
                    "supplier_reference",
                    "Un reemplazo conserva la identidad documental de su antecedente.",
                )
            if identity.purchases.exclude(pk=purchase.pk).exists():
                raise PurchaseApplicationError(
                    "not_editable", "La identidad documental ya tiene reemplazos asociados."
                )
            try:
                with transaction.atomic():
                    identity.supplier_id = inp.supplier_id
                    identity.document_type = inp.document_type
                    identity.reference = inp.reference
                    identity.normalized_reference = inp.normalized_reference
                    identity.save()
            except IntegrityError as exc:
                if _constraint(exc) == "pur_identity_external_unique":
                    raise _duplicate_error() from None
                raise
        purchase.document_date = inp.document_date
        purchase.observation = inp.notes
        purchase.no_document_explanation = inp.no_document_reason
        for name, value in _stored_totals(inp.lines, inp.document_date).items():
            setattr(purchase, name, value)
        purchase.version += 1
        purchase.save()
        purchase.lines.all().delete()
        _write_lines(purchase, inp.lines)
        return 200, queries.purchase_detail(purchase), ["document_date", "lines"]

    return execute_write(
        actor=actor,
        permission="ingresos.crear",
        action="purchasing.purchase_updated",
        target_type="purchase",
        target_id=str(purchase_id),
        request_id=request_id,
        payload=payload,
        work=work,
    )


# ---------------------------------------------------------------------------
# Revisión y confirmación
# ---------------------------------------------------------------------------

REVIEW_SALT = "purchasing.review"
REVIEW_MAX_AGE_SECONDS = 15 * 60
CONFIRM_ACTION = "purchase.confirm"
CONFIRM_FIELDS = frozenset(
    {"idempotency_key", "expected_version", "review_token", "acknowledged_matches"}
)
_CONFIG_CODES = {
    "missing_entity": "configuration_missing",
    "missing_warehouse": "configuration_missing",
    "missing_tax": "configuration_missing",
    "missing_rate": "configuration_missing",
    "ambiguous_rate": "configuration_ambiguous",
    "invalid_tax_scope": "invalid_tax_scope",
}
_STATUS_CODES = {
    "missing": "configuration_missing",
    "ambiguous": "configuration_ambiguous",
    "invalid_scope": "invalid_tax_scope",
    "absent": "validation_error",
}


@dataclass(frozen=True)
class Issue:
    code: str
    field: str
    message: str

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "field": self.field, "message": self.message}


def issue_review_token(*, actor: User, action: str, purchase_id: int, digest: str) -> str:
    """Token firmado con identificadores y digest; sin costos ni datos del proveedor."""
    return signing.dumps(
        {"a": actor.pk, "act": action, "p": purchase_id, "d": digest}, salt=REVIEW_SALT
    )


def read_review_token(
    token: Any,
    *,
    actor: User,
    action: str,
    purchase_id: int,
    max_age: int | None = REVIEW_MAX_AGE_SECONDS,
) -> str:
    """Valida firma, vencimiento y ligadura a actor, acción y compra; devuelve el digest."""
    if not isinstance(token, str) or not token:
        raise field_error("validation_error", "review_token", "La revisión es obligatoria.")
    try:
        data = signing.loads(token, salt=REVIEW_SALT, max_age=max_age)
    except signing.SignatureExpired:
        raise field_error(
            "review_required", "review_token", "La revisión venció. Revise nuevamente."
        ) from None
    except signing.BadSignature:
        raise field_error("validation_error", "review_token", "La revisión no es válida.") from None
    if (
        not isinstance(data, dict)
        or data.get("a") != actor.pk
        or data.get("act") != action
        or data.get("p") != purchase_id
    ):
        raise field_error("validation_error", "review_token", "La revisión no corresponde.")
    return str(data["d"])


def _normalized(rate: Decimal | None) -> str | None:
    return None if rate is None else format(rate.normalize(), "f")


def _digest(
    purchase: Purchase,
    lines: list[PurchaseLine],
    computations: list[LineComputation],
    bases: dict[int, TaxBasis],
    entity_id: int,
    warehouse_id: int,
    matches: list[int] | None = None,
) -> str:
    identity = purchase.document_identity
    extra: dict[str, Any] = {} if matches is None else {"matches": sorted(matches)}
    return canonical_fingerprint(
        {
            **extra,
            "purchase_id": purchase.pk,
            "supplier_id": identity.supplier_id,
            "document": [identity.document_type, identity.normalized_reference],
            "document_date": purchase.document_date.isoformat(),
            "lines": [
                [
                    line.position,
                    line.product_id,
                    f"{line.quantity:.0f}",
                    f"{line.unit_cost:.6f}",
                    line.tax_definition_id,
                    line.tax_treatment,
                    None
                    if comp.amounts is None
                    else [
                        str(comp.amounts.base),
                        str(comp.amounts.tax),
                        str(comp.amounts.total),
                        str(comp.amounts.inventory_value),
                    ],
                ]
                for line, comp in zip(lines, computations, strict=True)
            ],
            "taxes": {str(pk): _normalized(basis.rate) for pk, basis in sorted(bases.items())},
            "entity_id": entity_id,
            "warehouse_id": warehouse_id,
        }
    )


def _line_signature(lines: list[PurchaseLine]) -> list[tuple[Any, ...]]:
    return sorted(
        (
            line.product_id,
            int(line.quantity),
            str(line.unit_cost),
            line.tax_definition_id,
            line.tax_treatment,
        )
        for line in lines
    )


def _find_matches(purchase: Purchase, lines: list[PurchaseLine]) -> list[Purchase]:
    """Compras confirmadas con igual proveedor, fecha y multiconjunto de líneas.

    Solo orienta al Administrador en SIN_DOCUMENTO; no es una identidad documental cierta.
    """
    if purchase.document_identity.document_type != "SIN_DOCUMENTO":
        return []
    signature = _line_signature(lines)
    candidates = (
        Purchase.objects.filter(
            state="CONFIRMED",
            document_date=purchase.document_date,
            document_identity__supplier_id=purchase.document_identity.supplier_id,
        )
        .exclude(pk=purchase.pk)
        .prefetch_related("lines")
        .order_by("id")
    )
    return [c for c in candidates if _line_signature(list(c.lines.all())) == signature]


def _check_document_chain(purchase: Purchase) -> None:
    """Un documento externo tiene a lo sumo un ingreso vigente y su reemplazo exige anulación."""
    duplicate = field_error(
        "duplicate_supplier_document",
        "supplier_reference",
        "Ya existe un ingreso vigente para este documento del proveedor.",
    )
    if (
        Purchase.objects.filter(
            document_identity_id=purchase.document_identity_id, state="CONFIRMED"
        )
        .exclude(pk=purchase.pk)
        .exists()
    ):
        raise duplicate
    if purchase.replaces_id is not None:
        antecedent_state = (
            Purchase.objects.filter(pk=purchase.replaces_id).values_list("state", flat=True).first()
        )
        if antecedent_state != "VOIDED":
            raise duplicate


def _collect_issues(
    purchase: Purchase,
    lines: list[PurchaseLine],
    supplier: SupplierReference | None,
    products: dict[int, ProductReference],
) -> list[Issue]:
    issues: list[Issue] = []
    if supplier is None:
        issues.append(Issue("inactive_reference", "supplier_id", "El proveedor no existe."))
    elif not supplier.is_active:
        issues.append(Issue("inactive_reference", "supplier_id", "El proveedor está inactivo."))
    if not lines:
        issues.append(Issue("validation_error", "lines", "Agregue al menos una línea."))
    if purchase.document_date > _today():
        issues.append(
            Issue("validation_error", "document_date", "La fecha no puede ser posterior a hoy.")
        )
    for index, line in enumerate(lines):
        ref = products.get(line.product_id)
        if ref is None or not ref.is_active:
            issues.append(
                Issue(
                    "inactive_reference",
                    f"lines.{index}.product_id",
                    "El producto no existe." if ref is None else "El producto está inactivo.",
                )
            )
    return issues


def _tax_issues(lines: list[PurchaseLine], bases: dict[int, TaxBasis]) -> list[Issue]:
    issues: list[Issue] = []
    for index, line in enumerate(lines):
        basis = bases.get(line.tax_definition_id)
        status = basis.status if basis else "absent"
        if status != "applicable":
            issues.append(
                Issue(
                    _STATUS_CODES[status],
                    f"lines.{index}.tax_definition_id",
                    "El impuesto no tiene una tarifa vigente única para la fecha del documento.",
                )
            )
    return issues


def _raise_first(issues: list[Issue]) -> None:
    if not issues:
        return
    code = issues[0].code
    errors: dict[str, list[str]] = {}
    for issue in issues:
        if issue.code == code:
            errors.setdefault(issue.field, []).append(issue.message)
    raise PurchaseApplicationError(code, issues[0].message, errors)  # type: ignore[arg-type]


def _config_issue(error: OperationContextError, lines: list[PurchaseLine]) -> Issue:
    field = "configuration"
    if error.definition_id is not None:
        for index, line in enumerate(lines):
            if line.tax_definition_id == error.definition_id:
                field = f"lines.{index}.tax_definition_id"
                break
    return Issue(_CONFIG_CODES[error.code], field, error.detail or error.code)


def _entry_lines(
    lines: list[PurchaseLine], computations: list[LineComputation]
) -> list[posting.EntryLine]:
    result = []
    for line, comp in zip(lines, computations, strict=True):
        assert comp.amounts is not None
        result.append(
            posting.EntryLine(
                line.product_id, line.quantity, comp.amounts.inventory_value, (line.pk,)
            )
        )
    return result


def preview_confirmation(
    *, actor: User, purchase_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Revisión de solo lectura: totales, efectos y token; sin uso fiscal ni numeración."""
    require_permission(
        actor=actor,
        permission="ingresos.confirmar",
        request_id=request_id,
        denial_action="purchasing.purchase_reviewed",
        target_type="purchase",
        target_id=str(purchase_id),
    )
    purchase = Purchase.objects.select_related("document_identity").filter(pk=purchase_id).first()
    if purchase is None:
        raise not_found()
    base: dict[str, Any] = {
        "purchase_id": purchase.pk,
        "state": purchase.state,
        "version": purchase.version,
        "can_confirm": False,
        "issues": [],
        "review_token": None,
        "expires_in_seconds": REVIEW_MAX_AGE_SECONDS,
        "totals": None,
        "effects": [],
        "matches": [],
        "requires_acknowledgement": False,
    }
    if purchase.state != "DRAFT":
        return base
    lines = list(purchase.lines.order_by("position"))
    supplier = get_supplier_reference(purchase.document_identity.supplier_id)
    products = get_product_references(line.product_id for line in lines)
    issues = _collect_issues(purchase, lines, supplier, products)
    inputs = queries.line_inputs(lines)
    bases = queries.tax_bases({line.tax_definition_id for line in lines}, purchase.document_date)
    issues += _tax_issues(lines, bases)
    context: OperationContext | None = None
    try:
        context = get_operation_context()
        get_numbering_scope_id(entity_type="COMERCIAL", document_type="INGRESO")
    except OperationContextError as error:
        issues.append(_config_issue(error, lines))
    except NumberingScopeNotFoundError:
        issues.append(Issue("configuration_missing", "series", "Falta la serie COM-ING."))
    computations = compute_lines(inputs, bases)
    totals = document_totals(computations)
    found = _find_matches(purchase, lines)
    matches = (
        None
        if purchase.document_identity.document_type != "SIN_DOCUMENTO"
        else [m.pk for m in found]
    )
    base["matches"] = [
        {"purchase_id": m.pk, "state": m.state, "internal_number": m.internal_number} for m in found
    ]
    base["requires_acknowledgement"] = bool(found)
    base["issues"] = [issue.as_dict() for issue in issues]
    base["totals"] = queries.totals_dict(totals)
    quantities: dict[int, Decimal] = defaultdict(Decimal)
    for line in lines:
        quantities[line.product_id] += line.quantity
    for product_id, quantity in quantities.items():
        position = (
            inventory_queries.get_position(product_id, warehouse_id=context.warehouse_id)
            if context
            else None
        )
        current = position.quantity if position else Decimal(0)
        ref = products.get(product_id)
        base["effects"].append(
            {
                "product_id": product_id,
                "code": ref.code if ref else None,
                "name": ref.name if ref else None,
                "quantity_to_receive": f"{quantity:.0f}",
                "current_quantity": f"{current:.0f}",
                "resulting_quantity": f"{current + quantity:.0f}",
            }
        )
    if not issues and context is not None:
        digest = _digest(
            purchase,
            lines,
            computations,
            bases,
            context.entity_id,
            context.warehouse_id,
            matches,
        )
        base["can_confirm"] = True
        base["review_token"] = issue_review_token(
            actor=actor, action=CONFIRM_ACTION, purchase_id=purchase.pk, digest=digest
        )
    return base


def confirm_purchase(
    *, actor: User, purchase_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Confirma el ingreso en una sola transacción; repetir no duplica efectos."""

    def work() -> tuple[int, dict[str, Any], list[str]]:
        reject_unknown_fields(payload, CONFIRM_FIELDS)
        expected = validated_version(payload)
        token = payload.get("review_token")
        purchase = _lock_purchase(purchase_id)
        if purchase.state != "DRAFT":
            digest = read_review_token(
                token, actor=actor, action=CONFIRM_ACTION, purchase_id=purchase.pk, max_age=None
            )
            if digest != purchase.applied_review:
                raise PurchaseApplicationError(
                    "idempotency_conflict",
                    "El ingreso ya fue confirmado con contenido distinto.",
                )
            return 200, queries.purchase_detail(purchase), []
        if purchase.version != expected:
            raise stale_record()
        _check_document_chain(purchase)
        reviewed = read_review_token(
            token, actor=actor, action=CONFIRM_ACTION, purchase_id=purchase.pk
        )
        lines = list(purchase.lines.order_by("position"))
        identity = purchase.document_identity

        supplier = None
        with suppress(SupplierReferenceError):
            supplier = lock_supplier_reference(identity.supplier_id, require_active=False)
        try:
            products = lock_product_references(
                {line.product_id for line in lines}, require_active=False
            )
        except ProductReferenceError as error:
            products = {
                pk: ref
                for pk, ref in get_product_references({line.product_id for line in lines}).items()
                if pk not in error.missing
            }
        _raise_first(_collect_issues(purchase, lines, supplier, products))

        try:
            preliminary = get_operation_context()
            positions = posting.lock_positions(products, warehouse_id=preliminary.warehouse_id)
            locked: LockedOperationContext = lock_operation_context(
                tax_definition_ids={line.tax_definition_id for line in lines},
                on=purchase.document_date,
            )
        except OperationContextError as error:
            _raise_first([_config_issue(error, lines)])
            raise
        if locked.context.warehouse_id != preliminary.warehouse_id:
            raise PurchaseApplicationError(
                "review_required", "La bodega configurada cambió. Revise nuevamente."
            )
        try:
            scope_id = get_numbering_scope_id(entity_type="COMERCIAL", document_type="INGRESO")
        except NumberingScopeNotFoundError:
            raise field_error(
                "configuration_missing", "series", "Falta la serie COM-ING."
            ) from None

        bases = {pk: TaxBasis(pk, "applicable", snap.rate) for pk, snap in locked.taxes.items()}
        inputs = queries.line_inputs(lines)
        computations = compute_lines(inputs, bases)
        found = _find_matches(purchase, lines)
        digest = _digest(
            purchase,
            lines,
            computations,
            bases,
            locked.context.entity_id,
            locked.context.warehouse_id,
            [m.pk for m in found] if identity.document_type == "SIN_DOCUMENTO" else None,
        )
        if digest != reviewed:
            raise PurchaseApplicationError(
                "review_required",
                "Los importes o datos relevantes cambiaron desde la revisión.",
            )
        acknowledged = payload.get("acknowledged_matches", [])
        if not isinstance(acknowledged, list) or not all(
            isinstance(item, int) and not isinstance(item, bool) for item in acknowledged
        ):
            raise field_error(
                "validation_error", "acknowledged_matches", "Indique los IDs revisados."
            )
        if {m.pk for m in found} - set(acknowledged):
            raise field_error(
                "validation_error",
                "acknowledged_matches",
                "Reconozca las compras coincidentes revisadas para continuar.",
            )
        totals = document_totals(computations)
        assert totals is not None

        consumer_id = str(purchase.pk)
        resolve_configuration(
            entity_type="COMERCIAL",
            tax_codes=[snap.code for snap in locked.taxes.values()],
            operation_date=purchase.document_date,
            consumer_type="purchase",
            consumer_id=consumer_id,
        )
        try:
            allocation = allocate_number(
                scope_id=scope_id,
                consumer_type="purchase",
                consumer_id=consumer_id,
                request_key=f"purchase:{purchase.pk}:confirm",
                request_fingerprint=digest,
            )
        except NumberingError as error:
            raise field_error("configuration_missing", "series", str(error)) from None

        operation = posting.prepare_operation(
            kind="PURCHASE_RECEIPT",
            actor=actor,
            source_type="PURCHASE",
            source_id=purchase.pk,
            entry_lines=_entry_lines(lines, computations),
            fingerprint=digest,
        )
        posting.post_operation(operation, positions, products)

        for line, comp in zip(lines, computations, strict=True):
            assert comp.amounts is not None
            snap = locked.taxes[line.tax_definition_id]
            ref = products[line.product_id]
            PurchaseLine.objects.filter(pk=line.pk).update(
                product_snapshot={
                    "schema_version": 1,
                    "product_id": ref.id,
                    "code": ref.code,
                    "name": ref.name,
                    "content_quantity": str(ref.content_quantity),
                    "unit_name": ref.unit_name,
                    "unit_symbol": ref.unit_symbol,
                },
                tax_snapshot={
                    "schema_version": 1,
                    "definition_id": snap.definition_id,
                    "code": snap.code,
                    "name": snap.name,
                    "rate": format(snap.rate, "f"),
                    "period_id": snap.period_id,
                    "starts_on": snap.starts_on.isoformat(),
                    "ends_on": snap.ends_on.isoformat() if snap.ends_on else None,
                },
                base_amount=comp.amounts.base,
                tax_amount=comp.amounts.tax,
                total_amount=comp.amounts.total,
                inventory_value=comp.amounts.inventory_value,
            )
        assert supplier is not None
        purchase.supplier_snapshot = {
            "schema_version": 1,
            "id": supplier.id,
            "name": supplier.name,
            "identification_type": supplier.identification_type,
            "identification": supplier.identification,
        }
        purchase.fiscal_snapshot = {
            "schema_version": 1,
            "entity": {
                "id": locked.context.entity_id,
                "type": locked.context.entity_type,
                "ruc": locked.context.ruc,
                "legal_name": locked.context.legal_name,
            },
            "warehouse": {
                "id": locked.context.warehouse_id,
                "name": locked.context.warehouse_name,
            },
            "series_code": allocation.series_code,
        }
        purchase.base_total = totals.base
        purchase.tax_total = totals.tax
        purchase.grand_total = totals.total
        purchase.inventory_value_total = totals.inventory_value
        purchase.internal_number = allocation.visible_number
        purchase.number_allocation_id = allocation.allocation_id
        purchase.inventory_operation_id = operation.pk
        purchase.confirmation_fingerprint = canonical_fingerprint(payload)
        purchase.applied_review = digest
        purchase.confirmed_at = timezone.now()
        purchase.confirmed_by = actor
        purchase.state = "CONFIRMED"
        purchase.version += 1
        try:
            with transaction.atomic():
                purchase.save()
        except IntegrityError as exc:
            if _constraint(exc) == "pur_purchase_one_confirmed_per_identity":
                raise _duplicate_error() from None
            raise
        return 200, queries.purchase_detail(purchase), ["state", "internal_number"]

    return execute_write(
        actor=actor,
        permission="ingresos.confirmar",
        action="purchasing.purchase_confirmed",
        target_type="purchase",
        target_id=str(purchase_id),
        request_id=request_id,
        payload=payload,
        work=work,
    )


# ---------------------------------------------------------------------------
# Reemplazo vinculado
# ---------------------------------------------------------------------------


def create_replacement(
    *, actor: User, purchase_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Crea un borrador que reutiliza la identidad externa de un antecedente."""

    def work() -> tuple[int, dict[str, Any], list[str]]:
        reject_unknown_fields(payload, frozenset({"idempotency_key"}))
        antecedent = _lock_purchase(purchase_id)
        if antecedent.state not in {"CONFIRMED", "VOIDED"}:
            raise PurchaseApplicationError(
                "not_editable", "Solo un ingreso confirmado o anulado admite reemplazo."
            )
        lines = list(antecedent.lines.order_by("position"))
        inputs = tuple(queries.line_inputs(lines))
        replacement = Purchase.objects.create(
            document_identity=antecedent.document_identity,
            document_date=antecedent.document_date,
            observation=antecedent.observation,
            no_document_explanation=antecedent.no_document_explanation,
            replaces=antecedent,
            created_by=actor,
            **_stored_totals(inputs, antecedent.document_date),
        )
        _write_lines(replacement, inputs)
        return 201, queries.purchase_detail(replacement), ["replaces"]

    return execute_write(
        actor=actor,
        permission="ingresos.crear",
        action="purchasing.purchase_replacement_created",
        target_type="purchase",
        target_id=str(purchase_id),
        request_id=request_id,
        payload=payload,
        work=work,
    )


# ---------------------------------------------------------------------------
# Anulación
# ---------------------------------------------------------------------------

VOID_ACTION = "purchase.void"
VOID_FIELDS = frozenset({"idempotency_key", "expected_version", "review_token", "reason"})
REASON_MAX = 2000
_BLOCKER_CODES = {
    "later_movements": "unsafe_reversal",
    "inconsistent": "inventory_inconsistent",
    "reserved_stock": "insufficient_stock",
}


def _void_digest(purchase: Purchase) -> str:
    return canonical_fingerprint(
        {
            "purchase_id": purchase.pk,
            "operation_id": purchase.inventory_operation_id,
            "effects": [
                [
                    e.product_id,
                    e.ordinal,
                    str(e.quantity_after),
                    str(e.value_after),
                    str(e.current_quantity),
                    str(e.current_reserved),
                    str(e.current_value),
                    e.last_ordinal,
                ]
                for e in inventory_queries.operation_effects(purchase.inventory_operation_id or 0)
            ],
        }
    )


def _blocker_issues(
    purchase: Purchase, products: dict[int, ProductReference]
) -> list[dict[str, Any]]:
    issues = []
    for blocker in inventory_queries.reversal_blockers(purchase.inventory_operation_id or 0):
        ref = products.get(blocker.product_id)
        reference = (
            f"INV-{blocker.blocking_operation_id}" if blocker.blocking_operation_id else None
        )
        issues.append(
            {
                "code": _BLOCKER_CODES[blocker.code],
                "field": "lines",
                "product_id": blocker.product_id,
                "product_code": ref.code if ref else None,
                "blocking_reference": reference,
                "message": (
                    "El producto tiene movimientos posteriores; no se puede anular el ingreso."
                    if blocker.code == "later_movements"
                    else (
                        "La disponibilidad es insuficiente para anular el ingreso."
                        if blocker.code == "reserved_stock"
                        else "Los saldos actuales no coinciden con el historial del ingreso."
                    )
                ),
            }
        )
    return issues


def void_preview(
    *, actor: User, purchase_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Efecto compensatorio previsto; solo lectura, sin recibo ni efectos."""
    require_permission(
        actor=actor,
        permission="ingresos.anular",
        request_id=request_id,
        denial_action="purchasing.purchase_void_reviewed",
        target_type="purchase",
        target_id=str(purchase_id),
    )
    purchase = Purchase.objects.select_related("document_identity").filter(pk=purchase_id).first()
    if purchase is None:
        raise not_found()
    if purchase.state == "DRAFT":
        raise PurchaseApplicationError("not_editable", "Un borrador no se anula.")
    result: dict[str, Any] = {
        "purchase_id": purchase.pk,
        "state": purchase.state,
        "version": purchase.version,
        "can_void": False,
        "issues": [],
        "effects": [],
        "review_token": None,
        "expires_in_seconds": REVIEW_MAX_AGE_SECONDS,
    }
    if purchase.state != "CONFIRMED":
        return result
    lines = list(purchase.lines.all())
    products = get_product_references(line.product_id for line in lines)
    issues = _blocker_issues(purchase, products)
    result["issues"] = issues
    result["effects"] = [
        {
            "product_id": e.product_id,
            "code": products[e.product_id].code if e.product_id in products else None,
            "quantity_to_remove": f"{e.quantity_in:.0f}",
            "quantity_to_restore": f"{e.quantity_out:.0f}",
            "current_quantity": f"{e.current_quantity:.0f}",
        }
        for e in inventory_queries.operation_effects(purchase.inventory_operation_id or 0)
    ]
    if not issues:
        result["can_void"] = True
        result["review_token"] = issue_review_token(
            actor=actor, action=VOID_ACTION, purchase_id=purchase.pk, digest=_void_digest(purchase)
        )
    return result


def _validated_reason(payload: dict[str, Any]) -> str:
    reason = payload.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise field_error("validation_error", "reason", "El motivo es obligatorio.")
    if len(reason.strip()) > REASON_MAX:
        raise field_error(
            "validation_error", "reason", f"El motivo no puede exceder {REASON_MAX} caracteres."
        )
    return reason.strip()


def void_purchase(
    *, actor: User, purchase_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Anula el ingreso compensando exactamente su efecto; repetirlo no compensa dos veces."""

    def work() -> tuple[int, dict[str, Any], list[str]]:
        reject_unknown_fields(payload, VOID_FIELDS)
        expected = validated_version(payload)
        reason = _validated_reason(payload)
        purchase = _lock_purchase(purchase_id)
        if purchase.state == "VOIDED":
            if reason != purchase.void_reason:
                raise PurchaseApplicationError(
                    "idempotency_conflict", "El ingreso ya fue anulado con otro motivo."
                )
            return 200, queries.purchase_detail(purchase), []
        if purchase.state == "DRAFT":
            raise PurchaseApplicationError("not_editable", "Un borrador no se anula.")
        if purchase.version != expected:
            raise stale_record()
        reviewed = read_review_token(
            payload.get("review_token"), actor=actor, action=VOID_ACTION, purchase_id=purchase.pk
        )
        lines = list(purchase.lines.all())
        original = posting.lock_operation(purchase.inventory_operation_id or 0)
        products = lock_product_references(
            {line.product_id for line in lines}, require_active=False
        )
        warehouse_id = int((purchase.fiscal_snapshot or {})["warehouse"]["id"])
        positions = posting.lock_positions(products, warehouse_id=warehouse_id)
        issues = _blocker_issues(purchase, products)
        if issues:
            first = issues[0]
            raise PurchaseApplicationError(
                first["code"],
                first["message"],
                {
                    "lines": [
                        f"Producto {i['product_code']}: "
                        f"movimiento posterior {i['blocking_reference']}"
                        if i["blocking_reference"]
                        else f"Producto {i['product_code']}: saldo inconsistente"
                        for i in issues
                    ]
                },
            )
        if _void_digest(purchase) != reviewed:
            raise PurchaseApplicationError(
                "review_required", "Los saldos cambiaron desde la revisión. Revise nuevamente."
            )
        try:
            reversal, _ = posting.reverse_operation(
                original,
                actor=actor,
                source_type="PURCHASE_VOID",
                source_id=purchase.pk,
                reason=reason,
                locked=positions,
                product_refs=products,
            )
        except posting.ReversalBlockedError as error:
            raise PurchaseApplicationError(
                "inventory_inconsistent" if error.code == "inconsistent" else "unsafe_reversal",
                str(error),
            ) from None
        purchase.state = "VOIDED"
        purchase.version += 1
        purchase.void_reason = reason
        purchase.voided_at = timezone.now()
        purchase.voided_by = actor
        purchase.void_operation_id = reversal.pk
        purchase.save(
            update_fields=[
                "state",
                "version",
                "void_reason",
                "voided_at",
                "voided_by",
                "void_operation",
                "updated_at",
            ]
        )
        return 200, queries.purchase_detail(purchase), ["state"]

    return execute_write(
        actor=actor,
        permission="ingresos.anular",
        action="purchasing.purchase_voided",
        target_type="purchase",
        target_id=str(purchase_id),
        request_id=request_id,
        payload=payload,
        work=work,
    )
