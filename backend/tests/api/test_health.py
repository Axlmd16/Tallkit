import pytest
from django.db import connection
from django.test import Client


@pytest.mark.django_db
def test_health_reports_ok_when_postgresql_is_available(client: Client) -> None:
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        assert cursor.fetchone() == (1,)

    response = client.get("/api/v1/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
