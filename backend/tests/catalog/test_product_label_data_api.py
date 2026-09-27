from typing import Any

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from catalog.application.queries import list_product_label_data
from catalog.models import (
    MeasurementUnit,
    Product,
    ProductBrand,
    ProductCategory,
    ProductCompatibility,
)
from customer_registry.models import VehicleBrand
from identity.models import UserRole
from workshop_configuration.models import TaxDefinition

pytestmark = pytest.mark.django_db
URL = "/api/v1/products/label-data/"


def client_for(*roles: str) -> APIClient:
    user = get_user_model().objects.create_user(
        username="labels_" + "_".join(roles or ("none",)), password="pw"
    )
    for role in roles:
        UserRole.objects.create(user=user, role=role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def product_refs(commercial_tax: TaxDefinition) -> dict[str, Any]:
    return {
        "category": ProductCategory.objects.create(name="Filtros"),
        "other_category": ProductCategory.objects.create(name="Lubricantes"),
        "unit": MeasurementUnit.objects.create(name="Unidad"),
        "brand": ProductBrand.objects.create(name="Mahle"),
        "other_brand": ProductBrand.objects.create(name="Bosch"),
        "vehicle_brand": VehicleBrand.objects.create(name="Toyota"),
        "other_vehicle_brand": VehicleBrand.objects.create(name="Chevrolet"),
        "tax": commercial_tax,
    }


def create_product(refs: dict[str, Any], **overrides: Any) -> Product:
    number = Product.objects.count() + 1
    values = {
        "code": f"PRO-{number:03d}",
        "manufacturer_code": f"MFR-{number:03d}",
        "name": f"Producto {number:03d}",
        "category": refs["category"],
        "unit": refs["unit"],
        "product_brand": refs["brand"],
        "content_quantity": 1,
        "sale_price": 10,
        "tax_definition": refs["tax"],
    }
    values.update(overrides)
    return Product.objects.create(**values)


@pytest.mark.parametrize("role", ["ADMINISTRADOR", "VENDEDOR", "ENCARGADO_TALLER"])
def test_each_product_reader_gets_the_minimal_label_projection(
    role: str, product_refs: dict[str, Any]
) -> None:
    product = create_product(
        product_refs,
        code="FIL-00125",
        manufacturer_code="OC-90",
        name="Filtro de aceite",
        description="No debe salir",
        sale_price=99,
    )

    response = client_for(role).get(URL)

    assert response.status_code == 200
    assert response.data == {
        "count": 1,
        "results": [
            {
                "id": product.pk,
                "code": "FIL-00125",
                "manufacturer_code": "OC-90",
                "name": "Filtro de aceite",
                "product_brand": {"id": product_refs["brand"].pk, "name": "Mahle"},
            }
        ],
    }
    assert not {"sale_price", "description", "is_active", "stock", "cost"} & set(
        response.data["results"][0]
    )


def test_anonymous_and_user_without_permission_receive_no_product_data(
    product_refs: dict[str, Any],
) -> None:
    create_product(product_refs)

    anonymous = APIClient().get(URL)
    forbidden = client_for().get(URL)

    assert anonymous.status_code == 403
    assert forbidden.status_code == 403
    assert "results" not in anonymous.data
    assert "results" not in forbidden.data


def test_filters_match_the_product_list_and_keep_stable_order(product_refs: dict[str, Any]) -> None:
    first = create_product(product_refs, code="FIL-A", name="filtro alpha")
    second = create_product(product_refs, code="FIL-B", name="Filtro beta")
    excluded_category = create_product(
        product_refs,
        code="FIL-C",
        name="Filtro gamma",
        category=product_refs["other_category"],
    )
    excluded_brand = create_product(
        product_refs,
        code="FIL-D",
        name="Filtro delta",
        product_brand=product_refs["other_brand"],
    )
    create_product(product_refs, code="FIL-E", name="Filtro inactivo", is_active=False)
    for product in (first, second, excluded_category, excluded_brand):
        ProductCompatibility.objects.create(
            product=product, vehicle_brand=product_refs["vehicle_brand"]
        )
    ProductCompatibility.objects.create(
        product=first, vehicle_brand=product_refs["other_vehicle_brand"]
    )
    params = {
        "search": "fil",
        "is_active": "true",
        "category_id": product_refs["category"].pk,
        "product_brand_id": product_refs["brand"].pk,
        "vehicle_brand_id": product_refs["vehicle_brand"].pk,
    }
    client = client_for("VENDEDOR")

    labels = client.get(URL, params)
    listing = client.get("/api/v1/products/", params)

    assert labels.status_code == 200
    assert (
        [row["id"] for row in labels.data["results"]]
        == [row["id"] for row in listing.data["results"]]
        == [first.pk, second.pk]
    )


def test_label_projection_returns_more_than_the_regular_page_limit(
    product_refs: dict[str, Any],
) -> None:
    Product.objects.bulk_create(
        [
            Product(
                code=f"LOT-{index:03d}",
                name=f"Lote {index:03d}",
                category=product_refs["category"],
                unit=product_refs["unit"],
                product_brand=product_refs["brand"],
                content_quantity=1,
                sale_price=1,
                tax_definition=product_refs["tax"],
            )
            for index in range(105)
        ]
    )

    response = client_for("ADMINISTRADOR").get(URL)

    assert response.status_code == 200
    assert response.data["count"] == 105
    assert len(response.data["results"]) == 105
    assert len({row["id"] for row in response.data["results"]}) == 105


@pytest.mark.parametrize(
    ("params", "field"),
    [
        ({"is_active": "unknown"}, "is_active"),
        ({"category_id": "abc"}, "category_id"),
        ({"page": "1"}, "page"),
        ({"page_size": "20"}, "page_size"),
        ({"price": "10"}, "price"),
    ],
)
def test_invalid_or_unrelated_filters_are_rejected_without_partial_results(
    params: dict[str, str], field: str, product_refs: dict[str, Any]
) -> None:
    create_product(product_refs)

    response = client_for("ADMINISTRADOR").get(URL, params)

    assert response.status_code == 400
    assert response.data["code"] in {"validation_error", "unknown_field"}
    assert field in response.data["errors"]
    assert "results" not in response.data


def test_empty_filter_returns_an_empty_batch() -> None:
    response = client_for("VENDEDOR").get(URL)

    assert response.status_code == 200
    assert response.data == {"count": 0, "results": []}


def test_projection_uses_one_query_for_any_number_of_products(
    django_assert_num_queries: Any, product_refs: dict[str, Any]
) -> None:
    create_product(product_refs)
    create_product(product_refs)

    with django_assert_num_queries(1):
        batch = list_product_label_data({})

    assert batch.count == 2
