from django.test import Client


def test_openapi_schema_exposes_versioned_technical_endpoints(client: Client) -> None:
    response = client.get("/api/v1/schema/", HTTP_ACCEPT="application/vnd.oai.openapi")

    assert response.status_code == 200
    body = response.content.decode()
    assert "/api/v1/health/" in body
    assert "/api/v1/auth/login/" in body
    assert "/api/v1/products/label-data/" in body
    assert "catalog_product_label_data" in body


def test_openapi_describes_the_entry_flow_and_drops_the_previous_purchase_routes(
    client: Client,
) -> None:
    body = client.get("/api/v1/schema/", HTTP_ACCEPT="application/vnd.oai.openapi").content.decode()

    for path in (
        "/api/v1/purchases/entries/",
        "/api/v1/purchases/entries/review/",
        "/api/v1/purchases/{id}/void-preview/",
        "/api/v1/suppliers/options/",
    ):
        assert path in body
    for retired in (
        "/api/v1/purchases/tax-options/",
        "/api/v1/purchases/{id}/preview/",
        "/api/v1/purchases/{id}/confirm/",
        "/api/v1/purchases/{id}/replacement/",
        "purchasing_purchase_create",
        "purchasing_purchase_update",
    ):
        assert retired not in body
