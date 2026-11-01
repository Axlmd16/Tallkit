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

from fiscal.domain.additional_info import AdditionalInfoError, validate_additional_info
from fiscal.domain.payment_declaration import PaymentDeclarationError, validate_payment_declaration
from fiscal.domain.payment_term import (
    PaymentTermError,
    forms_with_term,
    parse_term_days,
    term_required,
)
from fiscal.domain.receiver import (
    FiscalReceiverError,
    check_consumer_final_total,
    parse_receiver,
)
from fiscal.domain.service_details import ServiceDetailError, parse_service_details
from fiscal.domain.snapshot import build_snapshot
from fiscal.domain.snapshot_amounts import SnapshotImpedimentError
from shared.command_values import canonical_fingerprint
from workshop_configuration.application.fiscal_resolver import FiscalConfiguration
from workshop_configuration.application.fiscal_tax_mapping import resolve_mapping
from workshop_configuration.application.official_catalog import SELECTABLE_PAYMENT_VERSION
from workshop_configuration.application.preparation_settings import (
    V1_ENABLEABLE_PAYMENT_FORMS,
    payment_form_options,
)
from workshop_configuration.domain.validation import ConfigurationValidationError


@dataclass(frozen=True)
class AssembledSnapshot:
    snapshot: dict[str, Any]
    fingerprint: str


def _issuer_dict(config: FiscalConfiguration) -> dict[str, str]:
    issuer = {
        "ruc": config.ruc,
        "legal_name": config.legal_name,
        "address": config.matrix_address,
        "establishment_address": config.establishment_address or "",
        "establishment_code": config.establishment_code or "",
        "emission_point_code": config.point_code or "",
        "environment": config.environment,
    }
    # El nombre comercial solo se conserva si fue declarado; nunca se usa la razón social.
    if config.trade_name:
        issuer["trade_name"] = config.trade_name
    return issuer


def _collected_by_code(collected_by_method: Any) -> dict[str, Any]:
    """Cobros vigentes por código de forma de pago, según la correspondencia de V1."""
    by_method = {method: code for code, method in V1_ENABLEABLE_PAYMENT_FORMS.items()}
    return {
        by_method[method]: amount
        for method, amount in dict(collected_by_method).items()
        if method in by_method
    }


def _configuration(config: FiscalConfiguration, catalogs: dict[str, str]) -> dict[str, Any]:
    return {
        "entity_id": config.entity_id,
        "entity_version": config.entity_version,
        "profile_revision": config.profile_revision,
        "defaults_version": config.defaults_version,
        "establishment": {
            "id": config.establishment_id,
            "code": config.establishment_code,
            "version": config.establishment_version,
        },
        "point": {
            "id": config.point_id,
            "code": config.point_code,
            "version": config.point_version,
        },
        "environment": config.environment,
        "catalogs": dict(catalogs),
        "tax_mapping_ids": list(config.tax_mapping_ids),
        "enabled_payment_codes": list(config.enabled_payment_codes),
    }


def _payment_details(config: FiscalConfiguration, on: date) -> dict[str, dict[str, str]]:
    return {
        option.code: {
            "description": option.description,
            "display_name": option.display_name,
            "catalog_version": option.catalog_version,
        }
        for option in payment_form_options(entity_id=config.entity_id, on=on)
        if option.code in config.enabled_payment_codes
    }


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

    if receiver is not None and receiver.requires_email and not receiver.email:
        impediments.append(
            {
                "field": "receiver.email",
                "message": "Ingrese el correo del receptor: el comprobante se envía a su correo.",
            }
        )

    grand_total = str(source.grand_total)
    if receiver is not None and receiver.is_consumer_final:
        try:
            check_consumer_final_total(Decimal(grand_total))
        except FiscalReceiverError as error:
            for field, messages in error.errors.items():
                impediments.append({"field": f"receiver.{field}", "message": messages[0]})

    payments = None
    draft_payments = draft.get("payments") or {}
    forms = draft_payments.get("forms") or []
    try:
        payments = validate_payment_declaration(
            condition=source.condition,
            forms=forms,
            total=grand_total,
            enabled_codes=config.enabled_payment_codes,
        )
    except PaymentDeclarationError as error:
        for field, messages in error.errors.items():
            impediments.append({"field": f"payments.{field}", "message": messages[0]})

    # Plazo del comprobante (DP-035, regla 2): se evalúa aquí, bajo el bloqueo del origen, con
    # el saldo vigente. Si ya no corresponde, el valor guardado se ignora sin error.
    term_days: int | None = None
    term_indexes: tuple[int, ...] = ()
    if term_required(source.condition, source.pending_balance):
        raw_term = draft_payments.get("term_days")
        if raw_term is None:
            impediments.append(
                {
                    "field": "payments.term_days",
                    "message": (
                        "Indique el plazo en días: es una operación a crédito con saldo pendiente."
                    ),
                }
            )
        else:
            try:
                term_days = parse_term_days(raw_term)
            except PaymentTermError as error:
                impediments.append(
                    {"field": "payments.term_days", "message": error.errors["term_days"][0]}
                )
        if payments is not None and term_days is not None:
            term_indexes = forms_with_term(
                payments.forms, _collected_by_code(source.collected_by_method)
            )

    additional_pairs: list[dict[str, str]] = []
    try:
        additional_pairs = validate_additional_info(draft.get("additional_info"))
    except AdditionalInfoError as error:
        for field, messages in error.errors.items():
            impediments.append({"field": field, "message": messages[0]})

    detail_positions = [line.position for line in source.lines if hasattr(line, "detail")]
    service_details: dict[int, str] = {}
    try:
        service_details = {
            item["position"]: item["detail"]
            for item in parse_service_details(
                draft.get("service_details"), valid_positions=detail_positions
            )
        }
    except ServiceDetailError as error:
        for field, messages in error.errors.items():
            impediments.append({"field": field, "message": messages[0]})

    qualification = config.tax_profile.get("artisan_qualification")
    qualification_active = (
        qualification is not None and date.fromisoformat(qualification["ends_on"]) >= reference_date
    )

    # Un Negocio Popular no cobra IVA: todas sus operaciones van con tarifa cero.
    popular_business = config.tax_profile.get("regime") == "RIMPE_NEGOCIO_POPULAR"

    lines: list[dict[str, Any]] = []
    line_details: dict[int, dict[str, Any]] = {}
    catalog_versions: dict[str, str] = {"payment_forms": SELECTABLE_PAYMENT_VERSION}
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
        line_details[line.position] = {
            "catalog_entry_id": resolved.catalog_entry_id,
            "display_name": resolved.display_name,
        }
        # La nota de la línea es del servicio (artesanal); la ajustada en el borrador manda.
        service_detail = service_details.get(line.position, str(getattr(line, "detail", "")))
        if service_detail:
            line_details[line.position]["service_detail"] = service_detail
        product_snapshot = getattr(line, "product_snapshot", {})
        if product_snapshot:
            item_code = str(product_snapshot.get("code", ""))
            description = str(product_snapshot.get("name", ""))
        else:
            item_code = str(getattr(line, "service_code", ""))
            description = str(getattr(line, "description", ""))
        if popular_business and resolved.treatment != "ZERO":
            impediments.append(
                {
                    "field": f"line[{line.position}].popular_rate",
                    "message": (
                        "El régimen RIMPE Negocio Popular no cobra IVA, pero esta línea usa "
                        f"«{resolved.display_name}»."
                    ),
                }
            )
        if qualification_active and resolved.treatment != "ZERO":
            impediments.append(
                {
                    "field": f"line[{line.position}].artisan_rate",
                    "message": (
                        "La calificación artesanal declarada exige IVA 0 %, pero esta línea usa "
                        f"«{resolved.display_name}»."
                    ),
                }
            )
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
            tax_profile=dict(config.tax_profile),
            additional_info=additional_pairs,
            configuration=_configuration(config, catalog_versions),
            payment_details=_payment_details(config, reference_date),
            line_details=line_details,
            term_days=term_days,
            term_form_indexes=term_indexes,
        )
    except SnapshotImpedimentError as error:
        impediments.extend(error.impediments)
        raise SnapshotImpedimentError(impediments) from None

    return AssembledSnapshot(snapshot=snapshot, fingerprint=canonical_fingerprint(snapshot))
