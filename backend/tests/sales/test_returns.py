"""Devoluciones: corrección económica histórica y reingreso solo de lo apto."""

import uuid
from decimal import Decimal
from itertools import count
from typing import Any

import pytest

from catalog.models import Product
from identity.application.authorization import BusinessPermissionDeniedError
from inventory.models import InventoryMovement, InventoryOperation, InventoryPosition
from sales.application import returns
from sales.application.errors import SalesApplicationError
from sales.models import Sale, SaleLine, SaleReturn, SaleReturnLine
from workshop_configuration.models import Warehouse

from .test_payments import parts, pay, summary

pytestmark = pytest.mark.django_db
D = Decimal
_keys = count(1)


@pytest.fixture(autouse=True)
def base(commercial: Any, warehouse: Warehouse) -> None:
    """Contexto comercial y bodega única."""


def line_id(sale_id: int, position: int = 1) -> int:
    return SaleLine.objects.get(sale_id=sale_id, position=position).pk


def request(
    lines: list[dict[str, Any]], reason: str = "Producto equivocado", **extra: Any
) -> dict[str, Any]:
    return {"operation_id": str(uuid.uuid4()), "reason": reason, "lines": lines, **extra}


def item(sale_line: int, fit: Any = 0, unfit: Any = 0) -> dict[str, Any]:
    return {"sale_line_id": sale_line, "fit_quantity": fit, "unfit_quantity": unfit}


def do_return(admin: Any, sale_id: int, data: dict[str, Any]) -> Any:
    review = returns.preview_return(actor=admin, sale_id=sale_id, payload=data)
    assert review["can_return"], review["issues"]
    return returns.register_return(
        actor=admin,
        sale_id=sale_id,
        payload={
            **data,
            "idempotency_key": f"ret-key-{next(_keys):06d}",
            "review_token": review["review_token"],
        },
    )


@pytest.fixture
def five(confirmed_sale: Any) -> dict[str, Any]:
    """Cinco unidades a 10.00 (total 50.00); costo histórico 4.00 por unidad."""
    sale: dict[str, Any] = confirmed_sale(price="10.00", quantity=5)
    return sale


def test_partial_return_with_mixed_fitness_corrects_three_and_restocks_two(
    admin: Any, five: dict[str, Any]
) -> None:
    lid = line_id(five["id"])
    position = InventoryPosition.objects.get(product=five["product"])
    assert (position.quantity, position.value) == (D(15), D("60.000000"))
    outcome = do_return(admin, five["id"], request([item(lid, fit=2, unfit=1)]))
    body = outcome.body
    assert outcome.status == 201
    assert body["grand_total"] == "30.00"
    assert body["restocked"] is True
    assert body["lines"][0]["fit_quantity"] == "2"
    assert body["lines"][0]["unfit_quantity"] == "1"
    position.refresh_from_db()
    assert (position.quantity, position.value) == (D(17), D("68.000000"))
    money = summary(five["id"])
    assert money["exigible"] == "20.00"
    assert money["returned_total"] == "30.00"
    preview = returns.preview_return(
        actor=admin, sale_id=five["id"], payload=request([item(lid, fit=2)])
    )
    assert preview["lines"][0]["still_returnable"] == "0"
    over = returns.preview_return(
        actor=admin, sale_id=five["id"], payload=request([item(lid, fit=3)])
    )
    assert over["can_return"] is False


def test_return_entry_references_the_return_and_the_original_exit(
    admin: Any, five: dict[str, Any]
) -> None:
    do_return(admin, five["id"], request([item(line_id(five["id"]), fit=1)]))
    sale = Sale.objects.get(pk=five["id"])
    operation = InventoryOperation.objects.get(kind="CUSTOMER_RETURN_IN")
    sale_return = SaleReturn.objects.get()
    assert (operation.source_type, operation.source_id) == ("SALE_RETURN", sale_return.pk)
    assert operation.corrects_operation_id == sale.inventory_operation_id
    assert operation.reverses_id is None
    assert not InventoryOperation.objects.filter(kind="REVERSAL").exists()


def test_accumulated_limit_rejects_three_more_even_when_split_across_repeated_entries(
    admin: Any, five: dict[str, Any]
) -> None:
    lid = line_id(five["id"])
    do_return(admin, five["id"], request([item(lid, fit=3)]))
    before = InventoryMovement.objects.count()
    for lines in ([item(lid, fit=3)], [item(lid, fit=1), item(lid, unfit=1), item(lid, fit=1)]):
        review = returns.preview_return(actor=admin, sale_id=five["id"], payload=request(lines))
        assert review["can_return"] is False
    with pytest.raises(SalesApplicationError):
        returns.register_return(
            actor=admin,
            sale_id=five["id"],
            payload={
                **request([item(lid, fit=1), item(lid, unfit=1), item(lid, fit=1)]),
                "idempotency_key": "ret-limit-0001",
                "review_token": "x",
            },
        )
    assert SaleReturn.objects.count() == 1
    assert InventoryMovement.objects.count() == before


def test_ineligible_targets_are_rejected_without_altering_any_operation(
    admin: Any, seller: Any, five: dict[str, Any], confirmed_sale: Any, customer: Any
) -> None:
    other = confirmed_sale(price="10.00", quantity=1)
    foreign = line_id(other["id"])
    own = line_id(five["id"])
    before = InventoryOperation.objects.count()
    review = returns.preview_return(
        actor=admin, sale_id=five["id"], payload=request([item(foreign, fit=1)])
    )
    assert review["can_return"] is False
    assert review["issues"][0]["field"] == "lines.0.sale_line_id"
    with pytest.raises(SalesApplicationError) as artisan:
        returns.preview_return(
            actor=admin,
            sale_id=five["id"],
            payload=request([item(own, fit=1)], entity_type="ARTESANAL"),
        )
    assert "entity_type" in artisan.value.errors
    from sales.application import sales

    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "ret-draft-0001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [{"product_id": five["product"].pk, "quantity": "1"}],
        },
    ).body
    draft_line = SaleLine.objects.get(sale_id=draft["id"]).pk
    for sale_id, lid in ((draft["id"], draft_line),):
        review = returns.preview_return(
            actor=admin, sale_id=sale_id, payload=request([item(lid, fit=1)])
        )
        assert review["can_return"] is False
        assert review["issues"][0]["code"] == "invalid_state"
    Sale.objects.filter(pk=other["id"]).update(state="VOIDED", void_reason="x")
    voided = returns.preview_return(
        actor=admin, sale_id=other["id"], payload=request([item(foreign, fit=1)])
    )
    assert voided["can_return"] is False
    assert InventoryOperation.objects.count() == before
    assert SaleReturn.objects.count() == 0


@pytest.mark.parametrize(
    "quantities",
    [
        {"fit": 0, "unfit": 0},
        {"fit": -1, "unfit": 2},
        {"fit": "1.5", "unfit": 0},
        {"fit": 1.5, "unfit": 0},
        {"fit": True, "unfit": 0},
        {"fit": "x", "unfit": 0},
    ],
)
def test_invalid_quantities_are_rejected_without_partial_effects(
    admin: Any, five: dict[str, Any], quantities: dict[str, Any]
) -> None:
    lid = line_id(five["id"])
    with pytest.raises(SalesApplicationError):
        returns.preview_return(
            actor=admin,
            sale_id=five["id"],
            payload=request([item(lid, quantities["fit"], quantities["unfit"])]),
        )
    assert SaleReturn.objects.count() == 0


def test_missing_fitness_classification_is_rejected(admin: Any, five: dict[str, Any]) -> None:
    lid = line_id(five["id"])
    with pytest.raises(SalesApplicationError) as error:
        returns.preview_return(
            actor=admin,
            sale_id=five["id"],
            payload=request([{"sale_line_id": lid, "fit_quantity": 1}]),
        )
    assert "lines.0.unfit_quantity" in error.value.errors
    with pytest.raises(SalesApplicationError):
        returns.preview_return(
            actor=admin,
            sale_id=five["id"],
            payload=request([{"sale_line_id": lid, "quantity": 1}]),
        )


def test_an_unfit_product_reduces_the_receivable_without_increasing_stock(
    admin: Any, five: dict[str, Any]
) -> None:
    before = InventoryPosition.objects.get(product=five["product"])
    operations = InventoryOperation.objects.count()
    body = do_return(admin, five["id"], request([item(line_id(five["id"]), unfit=2)])).body
    assert body["restocked"] is False
    assert body["grand_total"] == "20.00"
    after = InventoryPosition.objects.get(product=five["product"])
    assert (after.quantity, after.value) == (before.quantity, before.value)
    assert InventoryOperation.objects.count() == operations
    assert not InventoryOperation.objects.filter(kind="CUSTOMER_RETURN_IN").exists()
    assert summary(five["id"])["exigible"] == "30.00"


def test_a_product_deactivated_after_the_sale_admits_the_historical_return(
    admin: Any, five: dict[str, Any]
) -> None:
    Product.objects.filter(pk=five["product"].pk).update(is_active=False)
    do_return(admin, five["id"], request([item(line_id(five["id"]), fit=1)]))
    assert InventoryPosition.objects.get(product=five["product"]).quantity == D(16)
    assert Product.objects.get(pk=five["product"].pk).is_active is False


def test_a_return_after_later_movements_is_not_blocked_by_exact_reversal_rules(
    admin: Any, five: dict[str, Any], stock: Any
) -> None:
    stock(five["product"], 4, "20.00")  # compra posterior: el último movimiento ya no es la venta
    do_return(admin, five["id"], request([item(line_id(five["id"]), fit=2)]))
    position = InventoryPosition.objects.get(product=five["product"])
    assert position.quantity == D(21)
    assert position.value == D("60.000000") + D("20.000000") + D("8.000000")


def test_a_full_return_without_payments_zeroes_the_balance_keeping_the_sale_confirmed(
    admin: Any, five: dict[str, Any]
) -> None:
    body = do_return(admin, five["id"], request([item(line_id(five["id"]), fit=5)])).body
    money = body["money"]
    assert (money["exigible"], money["balance"], money["refund_due"]) == ("0.00", "0.00", "0.00")
    sale = Sale.objects.get(pk=five["id"])
    assert sale.state == "CONFIRMED"
    assert SaleReturn.objects.filter(sale=sale).count() == 1
    position = InventoryPosition.objects.get(product=five["product"])
    assert (position.quantity, position.value) == (D(20), D("80.000000"))


def test_full_fit_return_restores_exactly_the_historical_value_including_residues(
    admin: Any, confirmed_sale: Any, make_product: Any, stock: Any
) -> None:
    product = make_product(sale_price=D("10.00"))
    stock(product, 3, "10.000001")
    sale = confirmed_sale(price="10.00", quantity=3, product=product)
    lid = line_id(sale["id"])
    do_return(admin, sale["id"], request([item(lid, fit=1)]))
    do_return(admin, sale["id"], request([item(lid, fit=1)]))
    do_return(admin, sale["id"], request([item(lid, fit=1)]))
    position = InventoryPosition.objects.get(product=product)
    assert (position.quantity, position.value) == (D(3), D("10.000001"))
    lines = SaleReturnLine.objects.filter(sale_line_id=lid)
    assert sum(line.fit_value for line in lines) == D("10.000001")


def test_a_review_made_stale_by_another_payment_or_return_requires_a_new_review(
    admin: Any, seller: Any, five: dict[str, Any]
) -> None:
    lid = line_id(five["id"])
    data = request([item(lid, fit=1)])
    review = returns.preview_return(actor=admin, sale_id=five["id"], payload=data)
    pay(seller, five["id"], parts("10.00"))
    with pytest.raises(SalesApplicationError) as error:
        returns.register_return(
            actor=admin,
            sale_id=five["id"],
            payload={
                **data,
                "idempotency_key": "ret-stale-0001",
                "review_token": review["review_token"],
            },
        )
    assert error.value.code == "review_required"
    do_return(admin, five["id"], request([item(lid, fit=1)]))
    with pytest.raises(SalesApplicationError):
        returns.register_return(
            actor=admin,
            sale_id=five["id"],
            payload={
                **data,
                "idempotency_key": "ret-stale-0002",
                "review_token": review["review_token"],
            },
        )
    assert SaleReturn.objects.count() == 1


def test_historical_amounts_ignore_current_catalog_price_and_rates(
    admin: Any, five: dict[str, Any], commercial: Any
) -> None:
    from workshop_configuration.models import TaxPeriod

    Product.objects.filter(pk=five["product"].pk).update(sale_price=D("99.00"))
    TaxPeriod.objects.filter(tax_definition=commercial["tax"]).update(rate=D("5"))
    body = do_return(admin, five["id"], request([item(line_id(five["id"]), fit=2)])).body
    assert body["grand_total"] == "20.00"
    assert body["base_total"] == "17.39"
    assert body["tax_total"] == "2.61"


def test_replay_by_operation_id_does_not_duplicate_and_conflicting_reuse_is_rejected(
    admin: Any, five: dict[str, Any]
) -> None:
    lid = line_id(five["id"])
    data = request([item(lid, fit=1)])
    review = returns.preview_return(actor=admin, sale_id=five["id"], payload=data)
    payload = {**data, "idempotency_key": "ret-replay-0001", "review_token": review["review_token"]}
    first = returns.register_return(actor=admin, sale_id=five["id"], payload=payload)
    again = returns.register_return(
        actor=admin, sale_id=five["id"], payload={**payload, "idempotency_key": "ret-replay-0002"}
    )
    assert first.body["id"] == again.body["id"]
    assert SaleReturn.objects.count() == 1
    assert InventoryMovement.objects.filter(movement_type="CUSTOMER_RETURN_IN").count() == 1
    with pytest.raises(SalesApplicationError) as reuse:
        returns.register_return(
            actor=admin,
            sale_id=five["id"],
            payload={
                **request([item(lid, fit=2)]),
                "operation_id": data["operation_id"],
                "idempotency_key": "ret-replay-0003",
                "review_token": review["review_token"],
            },
        )
    assert reuse.value.code == "idempotency_conflict"


def test_only_the_administrator_can_register_returns(
    seller: Any, five: dict[str, Any], db: None
) -> None:
    with pytest.raises(BusinessPermissionDeniedError):
        returns.preview_return(
            actor=seller,
            sale_id=five["id"],
            payload=request([item(line_id(five["id"]), fit=1)]),
        )


def test_a_failure_in_a_multi_line_return_leaves_no_partial_effects(
    admin: Any,
    confirmed_sale: Any,
    make_product: Any,
    stock: Any,
    customer: Any,
    seller: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from inventory.application import posting
    from sales.application import reviews, sales
    from sales.models import SaleReturnLine

    first, second = make_product(sale_price=D("10.00")), make_product(sale_price=D("10.00"))
    stock(first, 10, "40.00")
    stock(second, 10, "40.00")
    draft = sales.create_draft(
        actor=seller,
        payload={
            "idempotency_key": "ret-multi-00001",
            "customer_id": customer.pk,
            "condition": "CREDITO",
            "lines": [
                {"product_id": first.pk, "quantity": "2"},
                {"product_id": second.pk, "quantity": "2"},
            ],
        },
    ).body
    review = reviews.preview_confirmation(actor=seller, sale_id=draft["id"])
    sales.confirm_sale(
        actor=seller,
        sale_id=draft["id"],
        payload={
            "idempotency_key": "ret-multi-00002",
            "expected_version": 1,
            "review_token": review["review_token"],
        },
    )
    lines = [line_id(draft["id"], 1), line_id(draft["id"], 2)]
    data = request([item(lines[0], fit=1), item(lines[1], fit=1)])
    preview = returns.preview_return(actor=admin, sale_id=draft["id"], payload=data)
    operations = InventoryOperation.objects.count()

    def boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("falla al publicar el reingreso")

    monkeypatch.setattr(posting, "post_operation", boom)
    with pytest.raises(RuntimeError):
        returns.register_return(
            actor=admin,
            sale_id=draft["id"],
            payload={
                **data,
                "idempotency_key": "ret-multi-00003",
                "review_token": preview["review_token"],
            },
        )
    monkeypatch.undo()
    assert SaleReturn.objects.count() == 0
    assert SaleReturnLine.objects.count() == 0
    assert InventoryOperation.objects.count() == operations
    assert InventoryPosition.objects.get(product=first).quantity == D(8)
    assert summary(draft["id"])["returned_total"] == "0.00"
    retried = returns.register_return(
        actor=admin,
        sale_id=draft["id"],
        payload={
            **data,
            "idempotency_key": "ret-multi-00003",
            "review_token": preview["review_token"],
        },
    )
    assert retried.status == 201
