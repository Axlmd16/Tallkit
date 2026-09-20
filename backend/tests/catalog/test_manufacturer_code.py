"""Código del fabricante / número de parte: referencia externa opcional del producto."""

from decimal import Decimal
from typing import Any

import pytest
from django.db import IntegrityError, transaction

from catalog.application import auxiliaries, products, queries
from catalog.application.errors import CatalogApplicationError
from catalog.domain.errors import CatalogValidationError
from catalog.domain.validation import validate_product
from catalog.models import MeasurementUnit, Product, ProductBrand, ProductCategory
from workshop_configuration.models import TaxDefinition

pytestmark = pytest.mark.django_db
_counter = iter(range(1, 10_000))


def key() -> str:
    return f"mfr-key-{next(_counter):06d}"


@pytest.fixture
def base(role_admin: Any, commercial_tax: TaxDefinition) -> dict[str, Any]:
    def aux(kind: str, **fields: Any) -> dict[str, Any]:
        return auxiliaries.create_auxiliary(
            kind, actor=role_admin, payload={**fields, "idempotency_key": key()}
        ).body

    return {
        "admin": role_admin,
        "cat": aux("category", name="Lubricantes"),
        "unit": aux("unit", name="Litro", symbol="L"),
        "brand_a": aux("brand", name="Marca A"),
        "brand_b": aux("brand", name="Marca B"),
        "tax": commercial_tax,
    }


def payload(base: dict[str, Any], code: str = "INT-1", **kw: Any) -> dict[str, Any]:
    return {
        "code": code,
        "name": f"Producto {code}",
        "category_id": base["cat"]["id"],
        "unit_id": base["unit"]["id"],
        "tax_definition_id": base["tax"].pk,
        "content_quantity": "1",
        "sale_price": "10.00",
        "idempotency_key": key(),
        **kw,
    }


def create(base: dict[str, Any], code: str = "INT-1", **kw: Any) -> dict[str, Any]:
    return products.create_product(actor=base["admin"], payload=payload(base, code, **kw)).body


def _valid() -> dict[str, Any]:
    return {
        "code": "a",
        "name": "n",
        "category_id": 1,
        "unit_id": 1,
        "tax_definition_id": 1,
        "content_quantity": "1",
        "sale_price": "1",
    }


# ---------------- dominio ----------------


def test_manufacturer_code_optional_and_normalized() -> None:
    assert validate_product(_valid()).manufacturer_code == ""
    assert validate_product({**_valid(), "manufacturer_code": None}).manufacturer_code == ""
    assert validate_product({**_valid(), "manufacturer_code": "   "}).manufacturer_code == ""
    assert validate_product({**_valid(), "manufacturer_code": " bp-77/x "}).manufacturer_code == (
        "BP-77/X"
    )
    # el código interno sigue siendo obligatorio
    with pytest.raises(CatalogValidationError):
        validate_product({**_valid(), "code": " "})


@pytest.mark.parametrize("bad", [123, "x" * 65])
def test_manufacturer_code_rejects_invalid(bad: object) -> None:
    with pytest.raises(CatalogValidationError) as exc:
        validate_product({**_valid(), "manufacturer_code": bad})
    assert "manufacturer_code" in str(exc.value.errors)


# ---------------- modelo ----------------


def _model_product(tax: TaxDefinition, code: str, **kw: object) -> Product:
    data: dict[str, object] = {
        "code": code,
        "name": code,
        "category": ProductCategory.objects.get_or_create(name="C")[0],
        "unit": MeasurementUnit.objects.get_or_create(name="U")[0],
        "content_quantity": Decimal("1"),
        "sale_price": Decimal("1"),
        "tax_definition": tax,
    }
    data.update(kw)
    return Product.objects.create(**data)


def test_default_is_empty_and_many_products_may_omit_it(commercial_tax: TaxDefinition) -> None:
    a = _model_product(commercial_tax, "A")
    _model_product(commercial_tax, "B")
    assert a.manufacturer_code == ""


def test_unique_per_brand_including_inactive(commercial_tax: TaxDefinition) -> None:
    brand_a = ProductBrand.objects.create(name="A")
    brand_b = ProductBrand.objects.create(name="B")
    _model_product(commercial_tax, "P1", product_brand=brand_a, manufacturer_code="X-1")
    _model_product(commercial_tax, "P2", product_brand=brand_b, manufacturer_code="X-1")
    with pytest.raises(IntegrityError), transaction.atomic():
        _model_product(commercial_tax, "P3", product_brand=brand_a, manufacturer_code=" x-1 ")


def test_unique_among_products_without_brand(commercial_tax: TaxDefinition) -> None:
    brand = ProductBrand.objects.create(name="A")
    _model_product(commercial_tax, "P1", manufacturer_code="X-1")
    _model_product(commercial_tax, "P2", product_brand=brand, manufacturer_code="X-1")
    with pytest.raises(IntegrityError), transaction.atomic():
        _model_product(commercial_tax, "P3", manufacturer_code="x-1")


# ---------------- servicios / API ----------------


def test_create_read_update_and_clear(base: dict[str, Any]) -> None:
    created = create(base, manufacturer_code=" bp-1 ", product_brand_id=base["brand_a"]["id"])
    assert (created["code"], created["manufacturer_code"]) == ("INT-1", "BP-1")
    assert queries.get_product(created["id"])["manufacturer_code"] == "BP-1"
    upd = products.update_product(
        created["id"],
        actor=base["admin"],
        payload={"expected_version": 1, "manufacturer_code": "bp-2", "idempotency_key": key()},
    ).body
    assert (upd["code"], upd["manufacturer_code"], upd["version"]) == ("INT-1", "BP-2", 2)
    cleared = products.update_product(
        created["id"],
        actor=base["admin"],
        payload={"expected_version": 2, "manufacturer_code": "", "idempotency_key": key()},
    ).body
    assert cleared["manufacturer_code"] == ""


def test_omitted_manufacturer_code_is_empty(base: dict[str, Any]) -> None:
    assert create(base)["manufacturer_code"] == ""


def test_duplicate_manufacturer_code_same_brand_conflicts(base: dict[str, Any]) -> None:
    brand = base["brand_a"]["id"]
    create(base, "INT-1", manufacturer_code="BP-1", product_brand_id=brand)
    with pytest.raises(CatalogApplicationError) as exc:
        create(base, "INT-2", manufacturer_code="bp-1", product_brand_id=brand)
    assert exc.value.code == "duplicate_manufacturer_code"
    assert "manufacturer_code" in (exc.value.errors or {})
    # otra marca: permitido
    create(base, "INT-3", manufacturer_code="BP-1", product_brand_id=base["brand_b"]["id"])


def test_internal_code_stays_unique(base: dict[str, Any]) -> None:
    create(base, "INT-1", manufacturer_code="BP-1")
    with pytest.raises(CatalogApplicationError) as exc:
        create(base, "int-1", manufacturer_code="OTRO")
    assert exc.value.code == "duplicate_code"


def test_search_matches_both_codes_and_case_insensitive(base: dict[str, Any]) -> None:
    a = create(base, "INT-1", manufacturer_code="BP-999")
    b = create(base, "INT-2")
    by_mfr = queries.list_products({"search": "bp-99"})
    assert [r["id"] for r in by_mfr.results] == [a["id"]]
    by_internal = queries.list_products({"search": "int-"})
    assert {r["id"] for r in by_internal.results} == {a["id"], b["id"]}


def test_manufacturer_code_does_not_touch_inventory_fields(base: dict[str, Any]) -> None:
    names = {f.name for f in Product._meta.get_fields()}
    assert not names & {"stock", "quantity", "cost", "balance"}
    assert "manufacturer_code" in names
