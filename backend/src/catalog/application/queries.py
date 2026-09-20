"""Consultas y proyecciones JSON del catálogo (sin costos ni existencias)."""

from dataclasses import dataclass
from typing import Any

from django.db.models import Exists, OuterRef, Q, QuerySet
from django.db.models.functions import Lower

from catalog.application.errors import field_error, not_found
from catalog.models import (
    MeasurementUnit,
    Product,
    ProductBrand,
    ProductCategory,
    ProductCompatibility,
    Service,
)
from customer_registry.application.catalog_references import get_vehicle_brand_refs
from workshop_configuration.application.catalog_options import (
    CatalogTaxOption,
    get_catalog_tax_options,
)

MAX_PAGE_SIZE = 100
Model = ProductCategory | MeasurementUnit | ProductBrand | Product | Service


@dataclass(frozen=True)
class Page:
    results: list[dict[str, Any]]
    count: int
    page: int
    page_size: int

    @property
    def total_pages(self) -> int:
        return -(-self.count // self.page_size) if self.count else 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "count": self.count,
            "page": self.page,
            "page_size": self.page_size,
            "total_pages": self.total_pages,
            "results": self.results,
        }


def _decimal_text(value: Any, places: int) -> str:
    return f"{value:.{places}f}"


def _iso(value: Any) -> str:
    return str(value.isoformat())


def _base(obj: Any) -> dict[str, Any]:
    return {
        "id": obj.pk,
        "is_active": obj.is_active,
        "version": obj.version,
        "created_at": _iso(obj.created_at),
        "updated_at": _iso(obj.updated_at),
    }


def _ref(obj: Any) -> dict[str, Any] | None:
    return None if obj is None else {"id": obj.pk, "name": obj.name, "is_active": obj.is_active}


def tax_dict(option: CatalogTaxOption | None) -> dict[str, Any] | None:
    if option is None:
        return None
    return {
        "id": option.id,
        "code": option.code,
        "name": option.name,
        "entity_type": option.entity_type,
        "rate": None if option.rate is None else str(option.rate),
        "tax_status": option.tax_status,
    }


def category_dict(obj: ProductCategory) -> dict[str, Any]:
    return {"name": obj.name, "description": obj.description, **_base(obj)}


def unit_dict(obj: MeasurementUnit) -> dict[str, Any]:
    return {"name": obj.name, "symbol": obj.symbol, **_base(obj)}


def brand_dict(obj: ProductBrand) -> dict[str, Any]:
    return {"name": obj.name, **_base(obj)}


def _product_dict(
    product: Product,
    vehicle_brand_ids: list[int],
    tax: dict[int, CatalogTaxOption],
    vehicle_refs: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    return {
        "code": product.code,
        "manufacturer_code": product.manufacturer_code,
        "name": product.name,
        "description": product.description,
        "category": _ref(product.category),
        "unit": _ref(product.unit),
        "product_brand": _ref(product.product_brand),
        "vehicle_brands": [vehicle_refs[i] for i in vehicle_brand_ids if i in vehicle_refs],
        "content_quantity": _decimal_text(product.content_quantity, 6),
        "sale_price": _decimal_text(product.sale_price, 2),
        "is_kit": product.is_kit,
        "tax": tax_dict(tax.get(product.tax_definition_id)),
        **_base(product),
    }


def product_dicts(products: list[Product]) -> list[dict[str, Any]]:
    """Proyecta productos con consultas acotadas por página (sin N+1)."""
    ids = [p.pk for p in products]
    links: dict[int, list[int]] = {i: [] for i in ids}
    for product_id, brand_id in ProductCompatibility.objects.filter(product_id__in=ids).values_list(
        "product_id", "vehicle_brand_id"
    ):
        links[product_id].append(brand_id)
    all_brand_ids = {b for lst in links.values() for b in lst}
    refs = {
        r.id: {"id": r.id, "name": r.name, "is_active": r.is_active}
        for r in get_vehicle_brand_refs(all_brand_ids)
    }
    for lst in links.values():
        lst.sort(key=lambda i: (str(refs[i]["name"]).lower() if i in refs else "", i))
    tax = get_catalog_tax_options({p.tax_definition_id for p in products})
    return [_product_dict(p, links[p.pk], tax, refs) for p in products]


def product_dict(product: Product) -> dict[str, Any]:
    product = Product.objects.select_related("category", "unit", "product_brand").get(pk=product.pk)
    return product_dicts([product])[0]


def service_dicts(services: list[Service]) -> list[dict[str, Any]]:
    tax = get_catalog_tax_options({s.tax_definition_id for s in services})
    return [
        {
            "name": s.name,
            "description": s.description,
            "reference_price": _decimal_text(s.reference_price, 2),
            "tax": tax_dict(tax.get(s.tax_definition_id)),
            **_base(s),
        }
        for s in services
    ]


def service_dict(service: Service) -> dict[str, Any]:
    return service_dicts([service])[0]


# ---------------------------------------------------------------------------
# Parámetros de listas y consultas
# ---------------------------------------------------------------------------


def parse_list_params(params: dict[str, Any]) -> tuple[str, str, int, int]:
    """(search, is_active, page, page_size); valores inválidos responden 400."""
    search = params.get("search", "")
    if not isinstance(search, str):
        raise field_error("validation_error", "search", "La búsqueda debe ser texto.")
    is_active = params.get("is_active", "true")
    if is_active not in ("true", "false", "all"):
        raise field_error("validation_error", "is_active", "Use true, false o all.")
    return (
        search.strip(),
        is_active,
        _positive_int(params.get("page", 1), "page"),
        _positive_int(params.get("page_size", 20), "page_size", MAX_PAGE_SIZE),
    )


def _positive_int(value: Any, field: str, maximum: int | None = None) -> int:
    try:
        number = int(str(value))
    except ValueError:
        raise field_error("validation_error", field, "Debe ser un entero positivo.") from None
    if number < 1 or (maximum is not None and number > maximum):
        limit = f" y como máximo {maximum}" if maximum else ""
        raise field_error("validation_error", field, f"Debe ser mayor que cero{limit}.")
    return number


def optional_id_param(params: dict[str, Any], field: str) -> int | None:
    return None if params.get(field) in (None, "") else _positive_int(params[field], field)


def _paginate(queryset: QuerySet[Any], page: int, page_size: int) -> tuple[list[Any], int]:
    count = queryset.count()
    offset = (page - 1) * page_size
    return list(queryset[offset : offset + page_size]), count


def _state_filter(queryset: QuerySet[Any], is_active: str) -> QuerySet[Any]:
    if is_active == "all":
        return queryset
    return queryset.filter(is_active=is_active == "true")


def _ordered(queryset: QuerySet[Any]) -> QuerySet[Any]:
    return queryset.order_by(Lower("name"), "id")


AUX_MODELS: dict[str, tuple[type[Any], Any]] = {
    "category": (ProductCategory, category_dict),
    "unit": (MeasurementUnit, unit_dict),
    "brand": (ProductBrand, brand_dict),
}


def list_auxiliaries(kind: str, params: dict[str, Any]) -> Page:
    model, to_dict = AUX_MODELS[kind]
    search, is_active, page, page_size = parse_list_params(params)
    queryset = _state_filter(model.objects.all(), is_active)
    if search:
        queryset = queryset.filter(name__icontains=search)
    rows, count = _paginate(_ordered(queryset), page, page_size)
    return Page([to_dict(r) for r in rows], count, page, page_size)


def get_auxiliary(kind: str, pk: int) -> dict[str, Any]:
    model, to_dict = AUX_MODELS[kind]
    obj = model.objects.filter(pk=pk).first()
    if obj is None:
        raise not_found("El registro")
    return dict(to_dict(obj))


def list_products(params: dict[str, Any]) -> Page:
    search, is_active, page, page_size = parse_list_params(params)
    queryset = _state_filter(
        Product.objects.select_related("category", "unit", "product_brand"), is_active
    )
    if search:
        queryset = queryset.filter(
            Q(code__icontains=search)
            | Q(manufacturer_code__icontains=search)
            | Q(name__icontains=search)
        )
    if (category_id := optional_id_param(params, "category_id")) is not None:
        queryset = queryset.filter(category_id=category_id)
    if (brand_id := optional_id_param(params, "product_brand_id")) is not None:
        queryset = queryset.filter(product_brand_id=brand_id)
    if (vehicle_brand_id := optional_id_param(params, "vehicle_brand_id")) is not None:
        queryset = queryset.filter(
            Exists(
                ProductCompatibility.objects.filter(
                    product=OuterRef("pk"), vehicle_brand_id=vehicle_brand_id
                )
            )
        )
    rows, count = _paginate(_ordered(queryset), page, page_size)
    return Page(product_dicts(rows), count, page, page_size)


def get_product(pk: int) -> dict[str, Any]:
    product = (
        Product.objects.select_related("category", "unit", "product_brand").filter(pk=pk).first()
    )
    if product is None:
        raise not_found("El producto")
    return product_dicts([product])[0]


def list_services(params: dict[str, Any]) -> Page:
    search, is_active, page, page_size = parse_list_params(params)
    queryset = _state_filter(Service.objects.all(), is_active)
    if search:
        queryset = queryset.filter(name__icontains=search)
    rows, count = _paginate(_ordered(queryset), page, page_size)
    return Page(service_dicts(rows), count, page, page_size)


def get_service(pk: int) -> dict[str, Any]:
    service = Service.objects.filter(pk=pk).first()
    if service is None:
        raise not_found("El servicio")
    return service_dicts([service])[0]


def list_tax_options(scope: str, params: dict[str, Any]) -> Page:
    """Proyecciones fiscales paginadas de un ámbito fijo (COMERCIAL/ARTESANAL)."""
    from workshop_configuration.application.catalog_options import list_catalog_tax_options

    search, _, page, page_size = parse_list_params({**params, "is_active": "all"})
    options = list_catalog_tax_options(
        entity_type=scope, search=search, page=page, page_size=page_size
    )
    results = [t for o in options.items if (t := tax_dict(o)) is not None]
    return Page(results, options.total_count, page, page_size)
