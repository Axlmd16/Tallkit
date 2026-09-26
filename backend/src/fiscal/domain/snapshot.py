"""Ensamble del snapshot fiscal versionado, inmutable e independiente de maestros.

Compone el emisor revisado, el receptor propio, las líneas con su representación de
importes y las formas de pago declaradas en una estructura con cadenas decimales que
puede interpretarse sin consultar datos maestros vigentes ni una API. La suficiencia
se comprueba acumulando impedimentos por campo: un dato obligatorio sin
representación deja la preparación en borrador en lugar de completarse con valores
ficticios.
"""

from dataclasses import asdict
from datetime import date
from typing import Any

from fiscal.domain.payment_declaration import PaymentDeclaration
from fiscal.domain.receiver import FiscalReceiver
from fiscal.domain.snapshot_amounts import SnapshotImpedimentError, build_amounts

SCHEMA_VERSION = "factura-2.1.0"
CURRENCY = "USD"
REQUIRED_ISSUER_FIELDS = (
    "ruc",
    "legal_name",
    "address",
    "establishment_code",
    "emission_point_code",
    "environment",
)
_OPTIONAL_ISSUER_FIELDS = ("trade_name",)


def _valid_iso_date(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return False
    return parsed.isoformat() == value


def build_snapshot(
    *,
    issuer: dict[str, Any],
    receiver: FiscalReceiver,
    lines: list[dict[str, Any]],
    base_total: str,
    tax_total: str,
    grand_total: str,
    payments: PaymentDeclaration,
    reference_date: str,
    catalog_versions: dict[str, str],
    legends: list[str],
    additional_info: list[dict[str, str]],
) -> dict[str, Any]:
    impediments: list[dict[str, str]] = []

    for field in REQUIRED_ISSUER_FIELDS:
        value = issuer.get(field) if isinstance(issuer, dict) else None
        if not isinstance(value, str) or not value.strip():
            impediments.append(
                {
                    "field": f"issuer.{field}",
                    "message": "Falta un dato obligatorio del emisor para la representación.",
                }
            )

    if not isinstance(receiver, FiscalReceiver):
        impediments.append(
            {"field": "receiver", "message": "El receptor fiscal validado es obligatorio."}
        )

    if not _valid_iso_date(reference_date):
        impediments.append(
            {"field": "reference_date", "message": "La fecha de referencia debe ser AAAA-MM-DD."}
        )

    if not lines:
        impediments.append(
            {"field": "lines", "message": "La preparación requiere al menos una línea."}
        )

    for pending in payments.pending:
        impediments.append(
            {
                "field": f"payments.{pending}",
                "message": "Falta un dato fiscal de la forma de pago; no se inventan vencimientos.",
            }
        )

    amounts = None
    if lines:
        try:
            amounts = build_amounts(
                lines=lines,
                base_total=base_total,
                tax_total=tax_total,
                grand_total=grand_total,
            )
        except SnapshotImpedimentError as error:
            impediments.extend(error.impediments)

    if impediments or amounts is None:
        raise SnapshotImpedimentError(impediments)

    issuer_snapshot = {
        field: issuer[field].strip() for field in REQUIRED_ISSUER_FIELDS if issuer.get(field)
    }
    for field in _OPTIONAL_ISSUER_FIELDS:
        value = issuer.get(field)
        if isinstance(value, str) and value.strip():
            issuer_snapshot[field] = value.strip()

    return {
        "schema_version": SCHEMA_VERSION,
        "currency": CURRENCY,
        "reference_date": reference_date,
        "catalog_versions": dict(catalog_versions),
        "issuer": issuer_snapshot,
        "receiver": asdict(receiver),
        "lines": [asdict(line) for line in amounts.lines],
        "tax_groups": [asdict(group) for group in amounts.tax_groups],
        "totals": {
            "base": amounts.base_total,
            "tax": amounts.tax_total,
            "grand": amounts.grand_total,
        },
        "payments": [asdict(form) for form in payments.forms],
        "legends": list(legends),
        "additional_info": [dict(item) for item in additional_info],
    }
