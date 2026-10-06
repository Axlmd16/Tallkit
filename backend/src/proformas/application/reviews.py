"""Revisiones de solo lectura y token firmado de 15 minutos.

El token liga actor, acción, proforma, versión y huella del contenido relevante; no contiene
costos ni datos del cliente. Las revisiones nunca crean recibos, números, usos de
configuración ni reservas. La disponibilidad se informa, pero no forma parte de la huella.
"""

from typing import Any
from uuid import UUID

from django.core import signing

from identity.application.authorization import require_permission
from identity.models import User
from proformas.application import clock, queries, references
from proformas.application.errors import ProformaApplicationError, field_error, not_found
from proformas.application.offer import (
    Issue,
    LineSource,
    OfferView,
    availability_warnings,
    collect_issues,
    issue_digest,
    project_lines,
    project_totals,
)
from proformas.domain.draft_input import (
    DRAFT_FIELDS,
    LINE_FIELDS,
    MAX_LINES,
    DraftValidationError,
    is_id,
    parse_quantity,
    parse_valid_until,
)
from proformas.domain.validity import suggested_valid_until
from proformas.models import Proforma
from shared.money import AmountValidationError

REVIEW_SALT = "proformas.review"
REVIEW_MAX_AGE_SECONDS = 15 * 60
ISSUE_ACTION = "proforma.issue"
CONVERT_ACTION = "proforma.convert"


def issue_token(*, actor: User, action: str, proforma_id: int, version: int, digest: str) -> str:
    return signing.dumps(
        {"a": actor.pk, "act": action, "p": proforma_id, "v": version, "d": digest},
        salt=REVIEW_SALT,
    )


def read_token(
    token: Any,
    *,
    actor: User,
    action: str,
    proforma_id: int,
    version: int | None,
    max_age: int | None = REVIEW_MAX_AGE_SECONDS,
) -> str:
    """Valida firma, vencimiento y ligadura a actor, acción, oferta y versión."""
    if not isinstance(token, str) or not token:
        raise field_error("validation_error", "review_token", "La revisión es obligatoria.")
    try:
        data = signing.loads(token, salt=REVIEW_SALT, max_age=max_age)
    except signing.SignatureExpired:
        raise field_error(
            "review_required", "review_token", "La revisión venció. Revise nuevamente."
        ) from None
    except signing.BadSignature:
        raise field_error("validation_error", "review_token", "La revisión no es válida.") from None
    if (
        not isinstance(data, dict)
        or data.get("a") != actor.pk
        or data.get("act") != action
        or data.get("p") != proforma_id
        or (version is not None and data.get("v") != version)
    ):
        raise field_error("validation_error", "review_token", "La revisión no corresponde.")
    return str(data["d"])


def projection(view: OfferView) -> dict[str, Any]:
    return {
        "issue_date": view.on.isoformat(),
        "valid_until": view.valid_until.isoformat() if view.valid_until else None,
        "suggested_valid_until": suggested_valid_until(view.on).isoformat(),
        "lines": project_lines(view),
        "totals": project_totals(view),
        "warnings": availability_warnings(view),
        "notice": queries.QUOTE_NOTICE,
    }


def _lenient_lines(payload: dict[str, Any]) -> tuple[list[LineSource], list[Issue]]:
    issues: list[Issue] = []
    sources: list[LineSource] = []
    raw = payload.get("lines", [])
    if not isinstance(raw, list) or len(raw) > MAX_LINES:
        return [], [Issue("validation_error", "lines", "Las líneas no son válidas.")]
    for index, item in enumerate(raw):
        prefix = f"lines.{index}"
        if not isinstance(item, dict):
            issues.append(Issue("validation_error", prefix, "La línea debe ser un objeto."))
            continue
        extra = sorted(set(item) - LINE_FIELDS)
        if extra:
            raise ProformaApplicationError(
                "unknown_field",
                "La solicitud contiene campos no admitidos.",
                {f"{prefix}.{name}": ["Campo no admitido."] for name in extra},
            )
        product_id = item.get("product_id")
        if not isinstance(product_id, int) or not is_id(product_id):
            issues.append(
                Issue("validation_error", f"{prefix}.product_id", "Seleccione un producto.")
            )
            continue
        try:
            quantity = parse_quantity(item.get("quantity"))
        except AmountValidationError as error:
            issues.append(
                Issue("validation_error", f"{prefix}.quantity", error.errors["quantity"][0])
            )
            continue
        sources.append(LineSource(index + 1, product_id, quantity))
    return sources, issues


def preview_draft(
    *, actor: User, payload: dict[str, Any], request_id: UUID | None = None
) -> dict[str, Any]:
    """Cálculo de una captura sin persistir nada; tolera entradas incompletas."""
    require_permission(
        actor=actor,
        permission="proformas.gestionar",
        request_id=request_id,
        denial_action="proformas.draft_previewed",
        target_type="proforma",
        target_id="draft-preview",
    )
    unknown = sorted(set(payload) - DRAFT_FIELDS)
    if unknown:
        raise ProformaApplicationError(
            "unknown_field",
            "La solicitud contiene campos no admitidos.",
            {name: ["Campo no admitido."] for name in unknown},
        )
    if payload.get("entity_type", "COMERCIAL") != "COMERCIAL":
        raise field_error(
            "validation_error", "entity_type", "Una proforma pertenece solo al RUC comercial."
        )
    sources, issues = _lenient_lines(payload)
    customer_id = payload.get("customer_id")
    if not is_id(customer_id):
        customer_id = None
        issues.append(Issue("validation_error", "customer_id", "Seleccione un cliente registrado."))
    explicit = None
    try:
        explicit = parse_valid_until(payload.get("valid_until"))
    except DraftValidationError as error:
        issues.append(Issue("validation_error", "valid_until", error.errors["valid_until"][0]))
    view = references.read_view(
        customer_id=customer_id,
        sources=sources,
        on=clock.today(),
        explicit_valid_until=explicit,
    )
    seen = {(issue.code, issue.field) for issue in issues}
    issues += [
        issue
        for issue in collect_issues(view)
        if (issue.code, issue.field) not in seen
        and not (issue.field == "customer_id" and customer_id is None)
    ]
    return {
        "status": "DRAFT_PREVIEW",
        "internal_number": None,
        "customer": None
        if view.customer is None
        else {
            "id": view.customer.id,
            "name": view.customer.name,
            "identification_type": view.customer.identification_type,
            "identification": view.customer.identification,
            "phone": view.customer.phone,
        },
        "issues": [issue.as_dict() for issue in issues],
        "can_issue": False,
        **projection(view),
    }


def preview_issue(
    *, actor: User, proforma_id: int, request_id: UUID | None = None
) -> dict[str, Any]:
    """Revisión previa a emitir: valores vigentes, impedimentos, avisos y token."""
    require_permission(
        actor=actor,
        permission="proformas.gestionar",
        request_id=request_id,
        denial_action="proformas.issue_reviewed",
        target_type="proforma",
        target_id=str(proforma_id),
    )
    proforma = Proforma.objects.filter(pk=proforma_id).first()
    if proforma is None:
        raise not_found()
    result: dict[str, Any] = {
        "proforma_id": proforma.pk,
        "state": proforma.state,
        "version": proforma.version,
        "can_issue": False,
        "issues": [],
        "review_token": None,
        "expires_in_seconds": REVIEW_MAX_AGE_SECONDS,
    }
    if proforma.state != "DRAFT":
        return result
    view = references.read_view(
        customer_id=proforma.customer_id,
        sources=queries.sources_of(proforma),
        on=clock.today(),
        explicit_valid_until=proforma.valid_until,
        with_issue_requirements=True,
    )
    issues = collect_issues(view)
    result.update(projection(view))
    result["issues"] = [issue.as_dict() for issue in issues]
    if not issues:
        result["can_issue"] = True
        result["review_token"] = issue_token(
            actor=actor,
            action=ISSUE_ACTION,
            proforma_id=proforma.pk,
            version=proforma.version,
            digest=issue_digest(proforma.pk, view),
        )
    return result
