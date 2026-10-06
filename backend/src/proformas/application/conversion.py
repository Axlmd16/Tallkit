"""Conversión única y atómica de una proforma vigente en un borrador de venta.

Coordina la oferta y el contrato público ``sales.application.proforma_links`` dentro de la
transacción del recibo de proformas. Orden de recursos (diseño D5): recibo, proforma, raíz de
venta o consulta del vínculo, cliente y productos; después solo inserciones y auditoría.
Venta, vínculo, estado convertida y auditoría se publican juntos o ninguno. No confirma,
numera, reserva ni cobra.
"""

from typing import Any
from uuid import UUID

import sales.application.proforma_links as proforma_links
from identity.application.authorization import require_permission
from identity.models import User
from proformas.application import clock, queries, reviews
from proformas.application.commands import (
    CommandOutcome,
    CommandResult,
    execute_write,
    reject_unknown_fields,
    transition_error,
    validated_version,
)
from proformas.application.drafts import lock_proforma
from proformas.application.errors import ProformaApplicationError, not_found, stale_record
from proformas.domain.validity import TransitionError, ensure_allowed
from proformas.models import Proforma
from sales.application.proforma_links import (
    LinkedSaleError,
    ProformaAlreadyLinkedError,
    ProformaOffer,
    ProformaSaleLink,
    QuotedLine,
)
from shared.command_values import canonical_fingerprint

PERMISSIONS = ("proformas.convertir", "ventas.crear")
CONVERT_FIELDS = frozenset({"idempotency_key", "expected_version", "review_token"})
REVIEW_CHANGED = "Los valores vigentes cambiaron desde la revisión. Revise nuevamente."


def offer_of(proforma: Proforma) -> ProformaOffer:
    """DTO inmutable de la oferta emitida, con sus valores históricos."""
    assert proforma.internal_number is not None
    assert proforma.issue_date is not None
    assert proforma.valid_until is not None
    assert proforma.base_total is not None
    assert proforma.tax_total is not None
    assert proforma.grand_total is not None
    lines = []
    for line in proforma.lines.order_by("position"):
        assert line.product_snapshot is not None
        assert line.unit_price is not None
        assert line.tax_rate is not None
        assert line.base_amount is not None
        assert line.tax_amount is not None
        assert line.total_amount is not None
        lines.append(
            QuotedLine(
                position=line.position,
                product_id=line.product_id,
                product_code=line.product_snapshot["code"],
                product_name=line.product_snapshot["name"],
                quantity=line.quantity,
                unit_price=line.unit_price,
                tax_rate=line.tax_rate,
                base_amount=line.base_amount,
                tax_amount=line.tax_amount,
                total_amount=line.total_amount,
            )
        )
    return ProformaOffer(
        proforma_id=proforma.pk,
        number=proforma.internal_number,
        customer_id=proforma.customer_id,
        issue_date=proforma.issue_date,
        valid_until=proforma.valid_until,
        lines=tuple(lines),
        base_total=proforma.base_total,
        tax_total=proforma.tax_total,
        grand_total=proforma.grand_total,
    )


def _sale(link: ProformaSaleLink) -> dict[str, Any]:
    return {"id": link.sale_id, "internal_number": link.internal_number, "state": link.state}


def already_converted(link: ProformaSaleLink | None) -> ProformaApplicationError:
    """Un intento nuevo sobre una oferta convertida informa la venta existente."""
    return ProformaApplicationError(
        "proforma_converted",
        "La proforma ya fue convertida en venta.",
        conflict=None if link is None else {"sale": _sale(link)},
    )


def _ensure_convertible(proforma: Proforma) -> None:
    if proforma.state == "CONVERTED":
        raise already_converted(proforma_links.get_sale_link(proforma.pk))
    try:
        ensure_allowed("convert", proforma.state, proforma.valid_until, clock.today())
    except TransitionError as error:
        raise transition_error(error) from None


def _digest(proforma: Proforma, preview: dict[str, Any]) -> str:
    return canonical_fingerprint(
        {
            "proforma_id": proforma.pk,
            "version": proforma.version,
            "comparison": preview["comparison"],
            "issues": preview["issues"],
        }
    )


def preview_conversion(
    *, actor: User, proforma_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Diferencias actuales respecto de lo cotizado y revisión firmada; sin efectos."""
    for permission in PERMISSIONS:
        require_permission(
            actor=actor,
            permission=permission,
            request_id=request_id,
            denial_action="proformas.conversion_reviewed",
            target_type="proforma",
            target_id=str(proforma_id),
        )
    proforma = Proforma.objects.filter(pk=proforma_id).first()
    if proforma is None:
        raise not_found()
    result: dict[str, Any] = {
        "proforma_id": proforma.pk,
        "version": proforma.version,
        "can_convert": False,
        "blocked_by": None,
        "sale": None,
        "issues": [],
        "warnings": [],
        "comparison": None,
        "review_token": None,
        "expires_in_seconds": reviews.REVIEW_MAX_AGE_SECONDS,
    }
    try:
        _ensure_convertible(proforma)
    except ProformaApplicationError as error:
        result["blocked_by"] = {"code": error.code, "message": error.message}
        result["sale"] = (error.conflict or {}).get("sale")
        return result
    preview = proforma_links.preview_conversion(offer_of(proforma), on=clock.today())
    result.update(preview)
    if not preview["issues"]:
        result["can_convert"] = True
        result["review_token"] = reviews.issue_token(
            actor=actor,
            action=reviews.CONVERT_ACTION,
            proforma_id=proforma.pk,
            version=proforma.version,
            digest=_digest(proforma, preview),
        )
    return result


def convert_proforma(
    *, actor: User, proforma_id: int, payload: dict[str, Any], request_id: UUID | None = None
) -> CommandOutcome:
    """Crea la única venta en borrador de la oferta y la marca convertida, atómicamente."""

    def work() -> CommandResult:
        reject_unknown_fields(payload, CONVERT_FIELDS)
        expected = validated_version(payload)
        proforma = lock_proforma(proforma_id)
        _ensure_convertible(proforma)
        if proforma.version != expected:
            raise stale_record()
        reviewed = reviews.read_token(
            payload.get("review_token"),
            actor=actor,
            action=reviews.CONVERT_ACTION,
            proforma_id=proforma.pk,
            version=proforma.version,
        )
        offer = offer_of(proforma)
        try:
            link = proforma_links.create_draft_from_proforma(actor=actor, offer=offer)
        except ProformaAlreadyLinkedError as error:
            raise already_converted(error.link) from None
        except LinkedSaleError as error:
            raise ProformaApplicationError(
                error.code,  # type: ignore[arg-type]
                error.message,
                error.errors,
            ) from None
        # Vigencia y valores revalidados después de las esperas de bloqueo.
        _ensure_convertible(proforma)
        preview = proforma_links.preview_conversion(offer, on=clock.today())
        if _digest(proforma, preview) != reviewed:
            raise ProformaApplicationError("review_required", REVIEW_CHANGED)
        proforma.state = "CONVERTED"
        proforma.converted_at = clock.now()
        proforma.converted_by = actor
        proforma.version += 1
        proforma.save(
            update_fields=["state", "converted_at", "converted_by", "version", "updated_at"]
        )
        return CommandResult(200, proforma.pk, ("state",), link=f"sale:{link.sale_id}")

    return execute_write(
        actor=actor,
        permissions=PERMISSIONS,
        action="proformas.proforma_converted",
        target_id=str(proforma_id),
        request_id=request_id,
        payload=payload,
        work=work,
        project=queries.project(actor),
    )
