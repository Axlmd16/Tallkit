"""Lectura sin bloqueos de las referencias vigentes de una oferta (revisiones y consultas)."""

from collections.abc import Sequence
from datetime import date
from decimal import Decimal

from catalog.application.sales_references import get_sale_product_references
from customer_registry.application.sales_references import get_customer_reference
from inventory.application.reservations import read_availability
from proformas.application.offer import Issue, LineSource, OfferView, build_view
from workshop_configuration.application.brand import (
    BrandIdentity,
    BrandUnavailableError,
    read_entity_brand,
)
from workshop_configuration.application.numbering import (
    NumberingScopeNotFoundError,
    get_numbering_scope_id,
)
from workshop_configuration.application.operation_context import (
    OperationContext,
    OperationContextError,
    get_operation_context,
    review_tax_options,
)

COMMERCIAL = "COMERCIAL"
DOCUMENT_TYPE = "PROFORMA"


def current_context() -> OperationContext | None:
    try:
        return get_operation_context()
    except OperationContextError:
        return None


def current_availability(
    product_ids: Sequence[int], context: OperationContext | None
) -> dict[int, Decimal]:
    """Existencia menos reservas vigentes; solo lectura, sin crear posiciones."""
    if context is None:
        return {}
    rows = read_availability(product_ids, warehouse_id=context.warehouse_id)
    return {product_id: row.available for product_id, row in rows.items()}


def read_view(
    *,
    customer_id: int | None,
    sources: Sequence[LineSource],
    on: date,
    explicit_valid_until: date | None,
    with_issue_requirements: bool = False,
) -> OfferView:
    """Vista vigente sin bloqueos ni escrituras. Con ``with_issue_requirements`` añade la
    marca del emisor y la serie de proformas, exigidas solo para emitir."""
    products = get_sale_product_references(source.product_id for source in sources)
    reviews = review_tax_options({p.tax_definition_id for p in products.values()}, on=on)
    context = current_context()
    extra: list[Issue] = []
    brand: BrandIdentity | None = None
    if with_issue_requirements:
        try:
            brand = read_entity_brand(COMMERCIAL).identity
        except BrandUnavailableError as error:
            if error.code == "logo_unreadable":
                extra.append(Issue("logo_unreadable", "logo", error.message))
        try:
            get_numbering_scope_id(entity_type=COMMERCIAL, document_type=DOCUMENT_TYPE)
        except NumberingScopeNotFoundError:
            extra.append(
                Issue(
                    "configuration_missing",
                    "series",
                    "Falta la serie comercial de proformas.",
                )
            )
    return build_view(
        customer=get_customer_reference(customer_id) if customer_id else None,
        sources=sources,
        products=products,
        rates={pk: review.rate for pk, review in reviews.items()},
        context=context,
        on=on,
        explicit_valid_until=explicit_valid_until,
        availability=current_availability(sorted(products), context),
        brand=brand,
        extra_issues=extra,
    )
