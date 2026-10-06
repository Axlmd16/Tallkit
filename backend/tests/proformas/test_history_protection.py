"""La oferta emitida, su marca y el origen de la venta resisten ORM, bulk y SQL directo."""

import hashlib
from decimal import Decimal
from typing import Any

import pytest
from django.db import DatabaseError, connection, transaction
from django.utils import timezone

from proformas.models import Proforma, ProformaBrandAsset, ProformaLine
from sales.models import Sale, SaleLine

from .factories import issued_values, line_amounts, make_line, make_proforma
from .test_sale_origin_models import from_proforma, make_sale

pytestmark = pytest.mark.django_db
D = Decimal


def raw(sql: str, params: list[Any]) -> None:
    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(sql, params)


def rejected(action: Any) -> None:
    with pytest.raises(DatabaseError), transaction.atomic():
        action()


@pytest.fixture
def asset(db: None) -> ProformaBrandAsset:
    content = b"logo-historico"
    return ProformaBrandAsset.objects.create(
        content=content,
        mime_type="image/png",
        size=len(content),
        sha256=hashlib.sha256(content).hexdigest(),
    )


@pytest.fixture
def issued(
    customer: Any, commercial: Any, actor: Any, product: Any, asset: ProformaBrandAsset
) -> Proforma:
    proforma = make_proforma(customer, commercial, actor)
    line = make_line(proforma, product)
    ProformaLine.objects.filter(pk=line.pk).update(**line_amounts())
    Proforma.objects.filter(pk=proforma.pk).update(**issued_values(actor, brand_asset=asset))
    proforma.refresh_from_db()
    return proforma


def test_draft_is_freely_editable(customer: Any, commercial: Any, actor: Any, product: Any) -> None:
    draft = make_proforma(customer, commercial, actor)
    line = make_line(draft, product)
    line.quantity = D(5)
    line.save()
    line.delete()
    draft.version += 1
    draft.save()


def test_issued_content_rejects_ordinary_bulk_and_direct_writes(
    issued: Proforma, actor: Any
) -> None:
    def ordinary() -> None:
        issued.grand_total = D("1.00")
        issued.save()

    rejected(ordinary)
    rejected(lambda: Proforma.objects.filter(pk=issued.pk).update(internal_number="COM-PRO-9"))
    rejected(lambda: Proforma.objects.filter(pk=issued.pk).update(valid_until="2027-01-01"))
    rejected(
        lambda: Proforma.objects.filter(pk=issued.pk).update(
            header_snapshot={"schema_version": 1, "x": 1}
        )
    )
    rejected(lambda: Proforma.objects.filter(pk=issued.pk).update(brand_asset=None))
    rejected(
        lambda: Proforma.objects.filter(pk=issued.pk).update(customer_id=issued.customer_id + 999)
    )
    rejected(lambda: raw("UPDATE proformas_proforma SET tax_total = 0 WHERE id = %s", [issued.pk]))
    rejected(
        lambda: raw("UPDATE proformas_proforma SET state = 'DRAFT' WHERE id = %s", [issued.pk])
    )
    rejected(lambda: Proforma.objects.filter(pk=issued.pk).delete())
    rejected(lambda: raw("DELETE FROM proformas_proforma WHERE id = %s", [issued.pk]))
    issued.refresh_from_db()
    assert (issued.state, issued.internal_number, issued.grand_total) == (
        "ISSUED",
        "COM-PRO-000001",
        D("23.00"),
    )


def test_issued_lines_reject_every_write(issued: Proforma, product: Any) -> None:
    line = issued.lines.get()
    rejected(lambda: ProformaLine.objects.filter(pk=line.pk).update(quantity=D(9)))
    rejected(lambda: ProformaLine.objects.filter(pk=line.pk).update(unit_price=D("1.00")))
    rejected(lambda: ProformaLine.objects.filter(pk=line.pk).delete())
    rejected(lambda: make_line(issued, product, position=2))
    rejected(
        lambda: ProformaLine.objects.bulk_create(
            [ProformaLine(proforma=issued, product=product, position=3, quantity=D(1))]
        )
    )
    rejected(lambda: raw("DELETE FROM proformas_proformaline WHERE id = %s", [line.pk]))
    assert issued.lines.get().quantity == D(2)


def test_brand_asset_is_immutable(issued: Proforma, asset: ProformaBrandAsset) -> None:
    rejected(lambda: ProformaBrandAsset.objects.filter(pk=asset.pk).update(content=b"otro"))
    rejected(lambda: raw("DELETE FROM proformas_proformabrandasset WHERE id = %s", [asset.pk]))
    asset.refresh_from_db()
    assert bytes(asset.content) == b"logo-historico"


def test_legitimate_transitions_work(
    customer: Any, commercial: Any, actor: Any, issued: Proforma
) -> None:
    now = timezone.now()
    Proforma.objects.filter(pk=issued.pk).update(version=issued.version + 1)
    Proforma.objects.filter(pk=issued.pk).update(
        state="CONVERTED", converted_at=now, converted_by=actor, version=issued.version + 2
    )
    rejected(
        lambda: Proforma.objects.filter(pk=issued.pk).update(
            state="VOIDED", converted_at=None, converted_by=None, voided_at=now, voided_by=actor
        )
    )
    rejected(
        lambda: Proforma.objects.filter(pk=issued.pk).update(
            state="ISSUED", converted_at=None, converted_by=None
        )
    )
    other = make_proforma(customer, commercial, actor)
    Proforma.objects.filter(pk=other.pk).update(**issued_values(actor, number="COM-PRO-000002"))
    Proforma.objects.filter(pk=other.pk).update(state="VOIDED", voided_at=now, voided_by=actor)
    rejected(
        lambda: Proforma.objects.filter(pk=other.pk).update(
            state="ISSUED", voided_at=None, voided_by=None
        )
    )
    other.refresh_from_db()
    assert (other.state, other.internal_number) == ("VOIDED", "COM-PRO-000002")


def test_transition_cannot_smuggle_content_changes(issued: Proforma, actor: Any) -> None:
    now = timezone.now()
    rejected(
        lambda: Proforma.objects.filter(pk=issued.pk).update(
            state="VOIDED", voided_at=now, voided_by=actor, grand_total=D("0.00")
        )
    )
    rejected(
        lambda: Proforma.objects.filter(pk=issued.pk).update(
            state="CONVERTED", converted_at=now, converted_by=actor, internal_number="COM-PRO-7"
        )
    )


def test_draft_cannot_jump_to_converted(customer: Any, commercial: Any, actor: Any) -> None:
    draft = make_proforma(customer, commercial, actor)
    rejected(
        lambda: Proforma.objects.filter(pk=draft.pk).update(
            **issued_values(
                actor, state="CONVERTED", converted_at=timezone.now(), converted_by=actor
            )
        )
    )


def test_sale_origin_is_protected_even_while_draft(
    customer: Any, commercial: Any, actor: Any, issued: Proforma, product: Any
) -> None:
    sale = make_sale(customer, commercial, actor, **from_proforma(issued))
    SaleLine.objects.create(sale=sale, position=1, product=product, quantity=D(1))
    rejected(
        lambda: Sale.objects.filter(pk=sale.pk).update(
            origin_type="DIRECT", origin_proforma=None, origin_reference="", proforma_snapshot=None
        )
    )
    rejected(lambda: Sale.objects.filter(pk=sale.pk).update(origin_reference="COM-PRO-000099"))
    rejected(
        lambda: Sale.objects.filter(pk=sale.pk).update(
            proforma_snapshot={"schema_version": 1, "lines": [{"x": 1}]}
        )
    )
    rejected(
        lambda: raw(
            "UPDATE sales_sale SET origin_proforma_id = NULL, origin_type = 'DIRECT', "
            "origin_reference = '', proforma_snapshot = NULL WHERE id = %s",
            [sale.pk],
        )
    )
    # La edición ordinaria del borrador sigue funcionando.
    sale.notes = "ajuste"
    sale.version += 1
    sale.save()
    sale.lines.all().delete()
    sale.refresh_from_db()
    assert (sale.origin_type, sale.origin_proforma_id) == ("PROFORMA", issued.pk)


def test_empty_sale_cannot_be_deleted_to_release_the_conversion(
    customer: Any, commercial: Any, actor: Any, issued: Proforma
) -> None:
    sale = make_sale(customer, commercial, actor, **from_proforma(issued))
    rejected(lambda: sale.delete())
    rejected(lambda: Sale.objects.filter(pk=sale.pk).delete())
    rejected(lambda: raw("DELETE FROM sales_sale WHERE id = %s", [sale.pk]))
    assert Sale.objects.filter(origin_proforma_id=issued.pk).count() == 1


def test_direct_sale_cannot_acquire_a_proforma_origin(
    customer: Any, commercial: Any, actor: Any, issued: Proforma
) -> None:
    direct = make_sale(customer, commercial, actor)
    rejected(lambda: Sale.objects.filter(pk=direct.pk).update(**from_proforma(issued)))
    direct.delete()  # un borrador directo vacío conserva su comportamiento previo
