"""Representación fiscal de importes conservando los valores históricos.

Los precios comerciales y artesanales son finales con impuesto incluido; la base
ya viene redondeada a centavos por línea. Aquí se deriva el precio unitario sin
impuestos con la escala admitida por el esquema oficial y se comprueba la
coherencia de bases, impuestos, totales y agrupaciones. No se recalcula la
operación, no se distribuyen diferencias ni se añaden ajustes: una igualdad que no
se cumple es un impedimento con los valores esperado y observado.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, localcontext

PRECISION = 60
CENTS = Decimal("0.01")
# Factura 2.1.0: precio unitario y cantidad admiten hasta seis decimales.
UNIT_PRICE_QUANTUM = Decimal("0.000001")


class SnapshotImpedimentError(Exception):
    """Impedimentos de suficiencia/coherencia; cada uno identifica campo y valores."""

    def __init__(self, impediments: list[dict[str, str]]) -> None:
        super().__init__("La representación fiscal presenta impedimentos.")
        self.impediments = impediments


@dataclass(frozen=True)
class FiscalLineRepresentation:
    position: int
    quantity: str
    unit_price_without_tax: str
    base_amount: str
    tax_rate: str
    tax_amount: str
    total_amount: str
    tax_code: str
    percentage_code: str


@dataclass(frozen=True)
class TaxGroup:
    tax_code: str
    percentage_code: str
    tax_rate: str
    base_amount: str
    tax_amount: str


@dataclass(frozen=True)
class SnapshotAmounts:
    lines: tuple[FiscalLineRepresentation, ...]
    tax_groups: tuple[TaxGroup, ...]
    base_total: str
    tax_total: str
    grand_total: str


def _cents(value: Decimal) -> Decimal:
    return value.quantize(CENTS, rounding=ROUND_HALF_UP)


def _fmt_cents(value: Decimal) -> str:
    return str(_cents(value))


def build_amounts(
    *,
    lines: list[dict[str, object]],
    base_total: str,
    tax_total: str,
    grand_total: str,
) -> SnapshotAmounts:
    impediments: list[dict[str, str]] = []
    representations: list[FiscalLineRepresentation] = []
    groups: dict[tuple[str, str], dict[str, Decimal | str]] = {}
    sum_base = sum_tax = sum_total = Decimal("0.00")

    with localcontext() as context:
        context.prec = PRECISION
        for line in lines:
            position = int(line["position"])
            quantity = Decimal(str(line["quantity"]))
            base = Decimal(str(line["base_amount"]))
            tax = Decimal(str(line["tax_amount"]))
            total = Decimal(str(line["total_amount"]))
            tax_rate = str(line["tax_rate"])
            tax_code = str(line["tax_code"])
            percentage_code = str(line["percentage_code"])

            if quantity <= 0:
                impediments.append(
                    {
                        "field": f"line[{position}].quantity",
                        "message": "La cantidad histórica debe ser mayor que cero.",
                        "expected": "> 0",
                        "observed": str(quantity),
                    }
                )
                continue

            if _cents(base + tax) != _cents(total):
                impediments.append(
                    {
                        "field": f"line[{position}].total_amount",
                        "message": "La base más el impuesto no reproduce el total de la línea.",
                        "expected": _fmt_cents(base + tax),
                        "observed": _fmt_cents(total),
                    }
                )

            unit_price = (base / quantity).quantize(UNIT_PRICE_QUANTUM, rounding=ROUND_HALF_UP)
            reconstructed = _cents(unit_price * quantity)
            if reconstructed != _cents(base):
                impediments.append(
                    {
                        "field": f"line[{position}].unit_price_without_tax",
                        "message": (
                            "El precio unitario sin impuestos no reproduce la base con la "
                            "escala admitida."
                        ),
                        "expected": _fmt_cents(base),
                        "observed": str(reconstructed),
                    }
                )

            representations.append(
                FiscalLineRepresentation(
                    position=position,
                    quantity=str(line["quantity"]),
                    unit_price_without_tax=str(unit_price),
                    base_amount=_fmt_cents(base),
                    tax_rate=tax_rate,
                    tax_amount=_fmt_cents(tax),
                    total_amount=_fmt_cents(total),
                    tax_code=tax_code,
                    percentage_code=percentage_code,
                )
            )

            key = (tax_code, percentage_code)
            bucket = groups.setdefault(
                key,
                {"tax_rate": tax_rate, "base": Decimal("0.00"), "tax": Decimal("0.00")},
            )
            bucket["base"] = Decimal(bucket["base"]) + base  # type: ignore[arg-type]
            bucket["tax"] = Decimal(bucket["tax"]) + tax  # type: ignore[arg-type]

            sum_base += base
            sum_tax += tax
            sum_total += total

        expected_base, expected_tax, expected_total = (
            _cents(sum_base),
            _cents(sum_tax),
            _cents(sum_total),
        )
        for field, expected, provided in (
            ("base_total", expected_base, Decimal(base_total)),
            ("tax_total", expected_tax, Decimal(tax_total)),
            ("grand_total", expected_total, Decimal(grand_total)),
        ):
            if expected != _cents(provided):
                impediments.append(
                    {
                        "field": field,
                        "message": "El total declarado no coincide con la suma de las líneas.",
                        "expected": str(expected),
                        "observed": _fmt_cents(provided),
                    }
                )

    if impediments:
        raise SnapshotImpedimentError(impediments)

    tax_groups = tuple(
        TaxGroup(
            tax_code=code,
            percentage_code=percentage,
            tax_rate=str(bucket["tax_rate"]),
            base_amount=_fmt_cents(Decimal(bucket["base"])),  # type: ignore[arg-type]
            tax_amount=_fmt_cents(Decimal(bucket["tax"])),  # type: ignore[arg-type]
        )
        for (code, percentage), bucket in sorted(groups.items())
    )
    return SnapshotAmounts(
        lines=tuple(representations),
        tax_groups=tax_groups,
        base_total=str(expected_base),
        tax_total=str(expected_tax),
        grand_total=str(expected_total),
    )
