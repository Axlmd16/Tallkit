"""Resuelve emisor y correspondencias bajo el bloqueo del comando y arma el snapshot.

Se invoca dentro de la transacción exterior del comando de preparación, después de
bloquear recibo, origen y preparación, para conservar el orden D6 hasta guardar.
Acumula impedimentos por campo: configuración incompleta, receptor inválido, formas
de pago insuficientes o importes que no admiten representación dejan la preparación en
borrador en lugar de completarse con datos ficticios.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

from fiscal.domain.payment_declaration import PaymentDeclarationError, validate_payment_declaration
from fiscal.domain.receiver import (
    FiscalReceiverError,
    check_consumer_final_total,
    parse_receiver,
)
from fiscal.domain.snapshot import build_snapshot
from fiscal.domain.snapshot_amounts import SnapshotImpedimentError
from shared.command_values import canonical_fingerprint
from workshop_configuration.application.fiscal_resolver import FiscalConfiguration
from workshop_configuration.application.fiscal_tax_mapping import resolve_mapping
from workshop_configuration.domain.validation import ConfigurationValidationError


@dataclass(frozen=True)
class AssembledSnapshot:
    snapshot: dict[str, Any]
    fingerprint: str


def _issuer_dict(config: FiscalConfiguration) -> dict[str, str]:
    return {
        "ruc": config.ruc,
        "legal_name": config.legal_name,
        "address": config.matrix_address,
        "establishment_code": config.establishment_code or "",
        "emission_point_code": config.point_code or "",
        "environment": config.environment,
    }


def _legends(config: FiscalConfiguration) -> list[str]:
    legends: list[str] = []
    for key, condition in config.conditions:
        if condition.is_resolved and condition.status == "APPLICABLE" and condition.value:
            legends.append(f"{key}: {condition.value}")
    return legends


def assemble_snapshot(
    *,
    draft: dict[str, Any] | None,
    source: Any,
    config: FiscalConfiguration,
    reference_date: date,
) -> AssembledSnapshot:
    draft = draft or {}
    impediments: list[dict[str, str]] = []

    for issue in config.preparation_issues:
        impediments.append(
            {"field": f"config.{issue}", "message": "La configuración fiscal no está lista."}
        )

    receiver = None
    try:
        receiver = parse_receiver(draft.get("receiver") or {})
    except FiscalReceiverError as error:
        for field, messages in error.errors.items():
            impediments.append({"field": f"receiver.{field}", "message": messages[0]})

    grand_total = str(source.grand_total)
    if receiver is not None and receiver.is_consumer_final:
        try:
            check_consumer_final_total(Decimal(grand_total))
        except FiscalReceiverError as error:
            for field, messages in error.errors.items():
                impediments.append({"field": f"receiver.{field}", "message": messages[0]})

    payments = None
    forms = (draft.get("payments") or {}).get("forms") or []
    try:
        payments = validate_payment_declaration(
            condition=source.condition, forms=forms, total=grand_total
        )
    except PaymentDeclarationError as error:
        for field, messages in error.errors.items():
            impediments.append({"field": f"payments.{field}", "message": messages[0]})

    lines: list[dict[str, Any]] = []
    catalog_versions: dict[str, str] = {}
    for line in source.lines:
        if line.tax_definition_id is None:
            impediments.append(
                {
                    "field": f"line[{line.position}].tax_mapping",
                    "message": "La línea no tiene una definición tributaria fiscal.",
                }
            )
            continue
        try:
            resolved = resolve_mapping(
                definition_id=line.tax_definition_id,
                on=reference_date,
                historical_rate=Decimal(str(line.tax_rate)),
            )
        except ConfigurationValidationError as error:
            impediments.append(
                {"field": f"line[{line.position}].tax_mapping", "message": str(error)}
            )
            continue
        catalog_versions["iva"] = resolved.catalog_version
        product_snapshot = getattr(line, "product_snapshot", {})
        if product_snapshot:
            item_code = str(product_snapshot.get("code", ""))
            description = str(product_snapshot.get("name", ""))
        else:
            item_code = str(getattr(line, "service_id", ""))
            description = str(getattr(line, "description", ""))
        lines.append(
            {
                "position": line.position,
                "item_code": item_code,
                "description": description,
                "quantity": str(line.quantity),
                "base_amount": str(line.base_amount),
                "tax_amount": str(line.tax_amount),
                "total_amount": str(line.total_amount),
                "tax_rate": str(line.tax_rate),
                "tax_code": resolved.tax_code,
                "percentage_code": resolved.percentage_code,
            }
        )

    if impediments or receiver is None or payments is None:
        raise SnapshotImpedimentError(impediments)

    try:
        snapshot = build_snapshot(
            issuer=_issuer_dict(config),
            receiver=receiver,
            lines=lines,
            base_total=str(source.base_total),
            tax_total=str(source.tax_total),
            grand_total=grand_total,
            payments=payments,
            reference_date=reference_date.isoformat(),
            catalog_versions=catalog_versions,
            legends=_legends(config),
            additional_info=draft.get("additional_info") or [],
        )
    except SnapshotImpedimentError as error:
        impediments.extend(error.impediments)
        raise SnapshotImpedimentError(impediments) from None

    return AssembledSnapshot(snapshot=snapshot, fingerprint=canonical_fingerprint(snapshot))
