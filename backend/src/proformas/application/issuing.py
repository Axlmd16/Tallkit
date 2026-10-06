"""Emisión numerada de una proforma en una sola transacción atómica.

Orden de recursos (diseño D5): recibo, proforma, cliente, productos por ID, lectura
informativa de disponibilidad, contexto comercial (entidad, bodega, impuestos), marca,
numeración y, después, solo instantáneas y auditoría. Los bytes del logo se leen antes de la
transacción; bajo bloqueo solo se comprueba que su identidad sigue siendo la revisada.
No reserva ni descuenta inventario, no crea deuda ni usa la serie de ventas.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from catalog.application.sales_references import (
    SaleProductReference,
    SaleProductReferenceError,
    lock_product_references,
)
from customer_registry.application.sales_references import (
    CustomerReference,
    CustomerReferenceError,
    lock_customer_reference,
)
from identity.models import User
from inventory.application.reservations import read_availability
from proformas.application import clock, queries, references, reviews
from proformas.application.commands import (
    CommandOutcome,
    CommandResult,
    execute_write,
    reject_unknown_fields,
    transition_error,
    validated_version,
)
from proformas.application.drafts import lock_proforma
from proformas.application.errors import (
    ProformaApplicationError,
    field_error,
    stale_record,
)
from proformas.application.offer import (
    Issue,
    OfferView,
    build_view,
    collect_issues,
    issue_digest,
    needed_by_product,
    normalized_rate,
)
from proformas.application.references import COMMERCIAL, DOCUMENT_TYPE
from proformas.domain.validity import TransitionError, ensure_allowed
from proformas.models import Proforma, ProformaBrandAsset, ProformaLine
from workshop_configuration.application.brand import (
    BrandUnavailableError,
    EntityBrand,
    lock_brand_identity,
    read_entity_brand,
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
    OperationContextError,
    lock_operation_context,
)

ISSUE_FIELDS = frozenset({"idempotency_key", "expected_version", "review_token"})
_CONFIG_CODES = {
    "missing_entity": "configuration_missing",
    "missing_warehouse": "configuration_missing",
    "missing_tax": "configuration_missing",
    "missing_rate": "configuration_missing",
    "ambiguous_rate": "configuration_ambiguous",
    "invalid_tax_scope": "validation_error",
}
REVIEW_CHANGED = "Los valores o datos relevantes cambiaron desde la revisión. Revise nuevamente."


def raise_issues(issues: list[Issue]) -> None:
    """Falla con el primer código y todos los campos que lo comparten."""
    if not issues:
        return
    code = issues[0].code
    errors: dict[str, list[str]] = {}
    for issue in issues:
        if issue.code == code:
            errors.setdefault(issue.field, []).append(issue.message)
    raise ProformaApplicationError(code, issues[0].message, errors)  # type: ignore[arg-type]


def lock_references(
    proforma: Proforma, lines: list[ProformaLine]
) -> tuple[CustomerReference | None, dict[int, SaleProductReference]]:
    """Bloquea cliente y productos (ID ascendente) sin exigir que estén activos: la vista
    informa después qué referencia debe corregirse."""
    customer: CustomerReference | None = None
    if proforma.customer_id is not None:
        try:
            customer = lock_customer_reference(proforma.customer_id, require_active=False)
        except CustomerReferenceError:
            customer = None
    try:
        products = lock_product_references(
            {line.product_id for line in lines}, require_active=False
        )
    except SaleProductReferenceError as error:
        raise ProformaApplicationError(
            "inactive_reference",
            "Hay productos inexistentes.",
            {
                f"lines.{index}.product_id": ["El producto no existe."]
                for index, line in enumerate(lines)
                if line.product_id in error.missing
            },
        ) from None
    return customer, products


def config_error(
    error: OperationContextError,
    lines: list[ProformaLine],
    products: dict[int, SaleProductReference],
) -> ProformaApplicationError:
    field = "configuration"
    if error.definition_id is not None:
        for index, line in enumerate(lines):
            product = products.get(line.product_id)
            if product and product.tax_definition_id == error.definition_id:
                field = f"lines.{index}.product_id"
                break
    message = error.detail or error.code
    return ProformaApplicationError(
        _CONFIG_CODES[error.code],  # type: ignore[arg-type]
        message,
        {field: [message]},
    )


def _product_snapshot(ref: SaleProductReference, *, sufficient: bool) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "product_id": ref.id,
        "code": ref.code,
        "manufacturer_code": ref.manufacturer_code,
        "brand_name": ref.brand_name,
        "name": ref.name,
        "content_quantity": str(ref.content_quantity),
        "unit_name": ref.unit_name,
        "unit_symbol": ref.unit_symbol,
        "is_kit": ref.is_kit,
        "availability_sufficient": sufficient,
    }


def _brand_asset(brand: EntityBrand) -> ProformaBrandAsset | None:
    """Activo inmutable del logo emitido, deduplicado por hash."""
    asset = brand.asset
    if asset is None:
        return None
    stored, _ = ProformaBrandAsset.objects.get_or_create(
        sha256=asset.sha256,
        defaults={
            "content": asset.content,
            "mime_type": asset.content_type,
            "size": asset.size,
        },
    )
    return stored


def issue_proforma(
    *, actor: User, proforma_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Emite la proforma: número, historia, estado y auditoría juntos o ninguno.

    Reemitir el mismo documento con la revisión originalmente aplicada recupera el resultado
    sin asignar otro número, aunque la clave de intento sea distinta.
    """
    # Lectura previa de los bytes del logo: nunca dentro de la sección crítica.
    brand: EntityBrand | None
    brand_error: BrandUnavailableError | None = None
    try:
        brand = read_entity_brand(COMMERCIAL)
    except BrandUnavailableError as error:
        brand, brand_error = None, error

    def work() -> CommandResult:
        reject_unknown_fields(payload, ISSUE_FIELDS)
        expected = validated_version(payload)
        token = payload.get("review_token")
        proforma = lock_proforma(proforma_id)
        if proforma.internal_number:
            digest = reviews.read_token(
                token,
                actor=actor,
                action=reviews.ISSUE_ACTION,
                proforma_id=proforma.pk,
                version=None,
                max_age=None,
            )
            if digest != proforma.applied_review:
                raise ProformaApplicationError(
                    "idempotency_conflict", "La proforma ya fue emitida con contenido distinto."
                )
            return CommandResult(200, proforma.pk)
        try:
            ensure_allowed("issue", proforma.state, proforma.valid_until, clock.today())
        except TransitionError as error:
            raise transition_error(error) from None
        if proforma.version != expected:
            raise stale_record()
        reviewed = reviews.read_token(
            token,
            actor=actor,
            action=reviews.ISSUE_ACTION,
            proforma_id=proforma.pk,
            version=proforma.version,
        )
        lines = list(proforma.lines.order_by("position"))
        customer, products = lock_references(proforma, lines)
        if brand_error is not None and brand_error.code == "logo_unreadable":
            raise field_error("logo_unreadable", "logo", brand_error.message)
        if brand is None:
            raise field_error(
                "configuration_missing", "configuration", "Falta la configuración comercial."
            )
        preliminary = references.current_context()
        if preliminary is None:
            raise field_error(
                "configuration_missing", "configuration", "Falta la configuración comercial."
            )
        # Observación informativa, sin bloquear posiciones ni prometer stock al commit.
        observed_at = clock.now()
        availability = {
            product_id: row.available
            for product_id, row in read_availability(
                sorted(products), warehouse_id=preliminary.warehouse_id
            ).items()
        }
        on = clock.today()  # capturada tras los bloqueos de datos maestros
        try:
            locked: LockedOperationContext = lock_operation_context(
                tax_definition_ids={p.tax_definition_id for p in products.values()}, on=on
            )
        except OperationContextError as error:
            raise config_error(error, lines, products) from None
        if locked.context.warehouse_id != preliminary.warehouse_id:
            raise ProformaApplicationError("review_required", REVIEW_CHANGED)
        identity = lock_brand_identity(COMMERCIAL)
        if identity != brand.identity:
            raise ProformaApplicationError("review_required", REVIEW_CHANGED)
        try:
            scope_id = get_numbering_scope_id(entity_type=COMMERCIAL, document_type=DOCUMENT_TYPE)
        except NumberingScopeNotFoundError:
            raise field_error(
                "configuration_missing", "series", "Falta la serie comercial de proformas."
            ) from None
        if clock.today() != on:
            raise ProformaApplicationError("review_required", REVIEW_CHANGED)

        view: OfferView = build_view(
            customer=customer,
            customer_id=proforma.customer_id,
            sources=queries.sources_of(proforma),
            products=products,
            rates={pk: snap.rate for pk, snap in locked.taxes.items()},
            context=locked.context,
            on=on,
            explicit_valid_until=proforma.valid_until,
            availability=availability,
            brand=identity,
        )
        raise_issues(collect_issues(view))
        digest = issue_digest(proforma.pk, view)
        if digest != reviewed:
            raise ProformaApplicationError("review_required", REVIEW_CHANGED)
        totals = view.offer.totals
        valid_until = view.valid_until
        assert totals is not None
        assert valid_until is not None

        consumer_id = str(proforma.pk)
        resolve_configuration(
            entity_type=COMMERCIAL,
            tax_codes=[snap.code for snap in locked.taxes.values()],
            operation_date=on,
            consumer_type="proforma",
            consumer_id=consumer_id,
        )
        try:
            allocation = allocate_number(
                scope_id=scope_id,
                consumer_type="proforma",
                consumer_id=consumer_id,
                request_key=f"proforma:{proforma.pk}:issue",
                request_fingerprint=digest,
            )
        except NumberingError as error:
            raise field_error("configuration_missing", "series", str(error)) from None

        needed = needed_by_product(view)
        amounts = {item.line.position: item for item in view.offer.lines}
        for line in lines:
            item = amounts[line.position]
            assert item.amounts is not None
            ref = products[line.product_id]
            snap = locked.taxes[ref.tax_definition_id]
            available = availability.get(line.product_id, Decimal(0))
            ProformaLine.objects.filter(pk=line.pk).update(
                product_snapshot=_product_snapshot(
                    ref, sufficient=needed[line.product_id] <= available
                ),
                tax_snapshot={
                    "schema_version": 1,
                    "definition_id": snap.definition_id,
                    "code": snap.code,
                    "name": snap.name,
                    "rate": normalized_rate(snap.rate),
                    "period_id": snap.period_id,
                },
                unit_price=ref.sale_price,
                tax_rate=snap.rate,
                base_amount=item.amounts.base,
                tax_amount=item.amounts.tax,
                total_amount=item.amounts.total,
                availability_at_issue=available,
            )
        now = clock.now()
        proforma.header_snapshot = {
            "schema_version": 1,
            "issuer": {
                "id": identity.entity_id,
                "type": identity.entity_type,
                "ruc": identity.ruc,
                "legal_name": identity.legal_name,
                "trade_name": identity.trade_name,
                "address": identity.address,
                "phone": identity.phone,
                "email": identity.email,
            },
            "customer": None
            if customer is None
            else {
                "id": customer.id,
                "name": customer.name,
                "identification_type": customer.identification_type,
                "identification": customer.identification,
                "phone": customer.phone,
                "email": customer.email,
                "address": customer.address,
            },
            "series_code": allocation.series_code,
            "availability_observed_at": observed_at.isoformat(),
        }
        proforma.brand_asset = _brand_asset(brand)
        proforma.issue_date = on
        proforma.valid_until = valid_until
        proforma.base_total = totals.base
        proforma.tax_total = totals.tax
        proforma.grand_total = totals.total
        proforma.internal_number = allocation.visible_number
        proforma.number_allocation_id = allocation.allocation_id
        proforma.applied_review = digest
        proforma.issued_at = now
        proforma.issued_by = actor
        proforma.state = "ISSUED"
        proforma.version += 1
        proforma.save()
        return CommandResult(200, proforma.pk, ("state", "internal_number"))

    return execute_write(
        actor=actor,
        permissions=("proformas.gestionar",),
        action="proformas.proforma_issued",
        target_id=str(proforma_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=queries.project(actor),
    )


def void_proforma(
    *, actor: User, proforma_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Anulación explícita de una oferta no convertida; conserva número, contenido e historia."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, frozenset({"idempotency_key", "expected_version"}))
        expected = validated_version(payload)
        proforma = lock_proforma(proforma_id)
        try:
            ensure_allowed("void", proforma.state, proforma.valid_until, clock.today())
        except TransitionError as error:
            raise transition_error(error) from None
        if proforma.version != expected:
            raise stale_record()
        proforma.state = "VOIDED"
        proforma.voided_at = clock.now()
        proforma.voided_by = actor
        proforma.version += 1
        proforma.save(update_fields=["state", "voided_at", "voided_by", "version", "updated_at"])
        return CommandResult(200, proforma.pk, ("state",))

    return execute_write(
        actor=actor,
        permissions=("proformas.anular",),
        action="proformas.proforma_voided",
        target_id=str(proforma_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=queries.project(actor),
    )
