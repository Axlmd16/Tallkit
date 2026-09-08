from django.test import Client


def test_openapi_schema_exposes_versioned_technical_endpoints(client: Client) -> None:
    response = client.get("/api/v1/schema/", HTTP_ACCEPT="application/vnd.oai.openapi")

    assert response.status_code == 200
    body = response.content.decode()
    assert "/api/v1/health/" in body
    assert "/api/v1/auth/login/" in body
