# ruff: noqa: S608 - consultas de verificación con identificadores enteros propios de la prueba.
"""Respaldo y restauración sintéticos: ofertas, logo histórico y vínculo con la venta.

Vuelca la base de pruebas con ``pg_dump`` y la restaura en una base temporal del mismo
servidor de desarrollo; nunca toca datos operativos. Se omite si el contenedor de PostgreSQL
del proyecto no está disponible.
"""

import shutil
import subprocess
import uuid
from typing import Any

import pytest
from django.db import connection
from tests.workshop_configuration.logo_helpers import image_bytes, upload

from proformas.models import Proforma, ProformaBrandAsset
from sales.models import Sale
from workshop_configuration.application import entity_logos

CONTAINER = "sys-taller-db-1"
pytestmark = pytest.mark.django_db(transaction=True)


def _exec(*command: str, stdin: bytes | None = None) -> bytes:
    result = subprocess.run(  # noqa: S603
        ["docker", "exec", "-i", CONTAINER, *command],  # noqa: S607
        input=stdin,
        capture_output=True,
        check=False,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr.decode()[-800:]
    return result.stdout


def _available() -> bool:
    if shutil.which("docker") is None:
        return False
    probe = subprocess.run(  # noqa: S603
        ["docker", "exec", CONTAINER, "pg_dump", "--version"],  # noqa: S607
        capture_output=True,
        check=False,
        timeout=30,
    )
    return probe.returncode == 0


def _scalar(user: str, database: str, sql: str) -> str:
    return _exec("psql", "-U", user, "-d", database, "-At", "-c", sql).decode().strip()


@pytest.mark.skipif(not _available(), reason="Contenedor de PostgreSQL no disponible")
def test_backup_and_restore_keep_offers_logo_and_link(
    new_draft: Any,
    issue: Any,
    convert: Any,
    admin: Any,
    product: Any,
    commercial: dict[str, Any],
    at: Any,
) -> None:
    at(2026, 10, 6)
    entity_logos.upload_entity_logo(
        actor=admin,
        entity_id=commercial["entity"].pk,
        file=upload(image_bytes()),
        idempotency_key=f"logo-{uuid.uuid4().hex}",
    )
    issued = issue(new_draft((product, 2)))
    converted = convert(issued).body
    proforma = Proforma.objects.get(pk=issued["id"])
    asset = ProformaBrandAsset.objects.get()
    sale = Sale.objects.get(pk=converted["sale"]["id"])

    settings = connection.settings_dict
    user, source = str(settings["USER"]), str(settings["NAME"])
    target = f"proformas_restore_{uuid.uuid4().hex[:10]}"
    dump = _exec("pg_dump", "-U", user, "-d", source, "--no-owner")
    _exec("createdb", "-U", user, target)
    try:
        _exec("psql", "-U", user, "-d", target, "-q", "-v", "ON_ERROR_STOP=1", stdin=dump)
        where = f"WHERE id = {proforma.pk}"
        assert (
            _scalar(
                user,
                target,
                f"SELECT state || '|' || internal_number FROM proformas_proforma {where}",
            )
            == "CONVERTED|COM-PRO-000001"
        )
        assert (
            _scalar(user, target, f"SELECT grand_total FROM proformas_proforma {where}") == "23.00"
        )
        assert (
            _scalar(
                user,
                target,
                "SELECT encode(sha256(content), 'hex') || '|' || size "
                f"FROM proformas_proformabrandasset WHERE id = {asset.pk}",
            )
            == f"{asset.sha256}|{asset.size}"
        )
        assert (
            _scalar(
                user,
                target,
                "SELECT origin_type || '|' || origin_proforma_id || '|' || origin_reference "
                f"FROM sales_sale WHERE id = {sale.pk}",
            )
            == f"PROFORMA|{proforma.pk}|COM-PRO-000001"
        )
        assert (
            _scalar(
                user,
                target,
                f"SELECT count(*) FROM proformas_proformaline WHERE proforma_id = {proforma.pk} "
                "AND unit_price = 11.50 AND availability_at_issue IS NOT NULL",
            )
            == "1"
        )
        # Los triggers de historia viajan en el respaldo: la oferta restaurada sigue protegida.
        blocked = subprocess.run(  # noqa: S603
            [  # noqa: S607
                "docker",
                "exec",
                CONTAINER,
                "psql",
                "-U",
                user,
                "-d",
                target,
                "-c",
                f"UPDATE proformas_proforma SET grand_total = 0 {where}",
            ],
            capture_output=True,
            check=False,
            timeout=60,
        )
        assert blocked.returncode != 0
        assert b"solo admite" in blocked.stderr
    finally:
        _exec("dropdb", "-U", user, "--if-exists", target)
