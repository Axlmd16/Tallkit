"""Estado de la configuración fiscal electrónica con causas explícitas.

Única fuente de las causas que usan la consulta administrativa y la preparación: la
interfaz y los impedimentos nunca discrepan. El certificado opcional solo produce
advertencias; ningún estado afirma validación del SRI.

Al añadir o renombrar códigos de causa, actualizar también la tabla de correspondencia
de `frontend/src/features/fiscal/configuration/readiness.ts`.
"""

from dataclasses import dataclass
from datetime import date

from django.db.models import Q
from django.utils import timezone

from identity.application.authorization import require_permission
from identity.models import User
from workshop_configuration.application.electronic_profiles import CONDITIONS
from workshop_configuration.application.entity_warehouse import FiscalEntityNotFoundError
from workshop_configuration.application.official_catalog import is_current
from workshop_configuration.application.preparation_settings import (
    EffectiveDefaults,
    effective_defaults,
)
from workshop_configuration.domain.electronic_profile import (
    DeclaredCertificate,
    DeclaredCondition,
    parse_certificate_metadata,
    parse_condition,
)
from workshop_configuration.models import (
    ElectronicProfileRevision,
    FiscalEmissionPoint,
    FiscalEntity,
    FiscalTaxMapping,
    OfficialCatalogEntry,
    TaxDefinition,
    TaxPeriod,
)

NOT_CONFIGURED = "NOT_CONFIGURED"
INCOMPLETE = "INCOMPLETE"
NEEDS_REVIEW = "NEEDS_REVIEW"
READY = "READY"
ENVIRONMENT_TEST = "1"
MISSING = "MISSING"
REVIEW = "REVIEW"

CONDITION_LABELS = {
    "tax_regime": "Régimen tributario",
    "accounting_obligation": "Obligación de llevar contabilidad",
    "special_taxpayer": "Contribuyente especial",
    "withholding_agent": "Agente de retención",
    "rimpe": "RIMPE",
    "artisan_qualification": "Calificación artesanal",
}


@dataclass(frozen=True)
class StatusCause:
    code: str
    kind: str
    message: str


@dataclass(frozen=True)
class ElectronicStatus:
    entity_id: int
    state: str
    causes: tuple[StatusCause, ...]
    warnings: tuple[StatusCause, ...]
    environment: str
    profile_revision: int | None
    conditions: tuple[tuple[str, DeclaredCondition], ...]
    certificate: DeclaredCertificate | None
    defaults: EffectiveDefaults
    tax_mapping_ids: tuple[int, ...]


def _condition_causes(key: str, condition: DeclaredCondition, on: date) -> list[StatusCause]:
    label = CONDITION_LABELS.get(key, key)
    if not condition.is_resolved:
        return [
            StatusCause(
                f"conditions.{key}.unknown",
                MISSING,
                f"{label}: declare si aplica o no aplica.",
            )
        ]
    if condition.starts_on is not None and on < condition.starts_on:
        return [
            StatusCause(
                f"conditions.{key}.future",
                REVIEW,
                f"{label}: la vigencia declarada inicia el {condition.starts_on.isoformat()}.",
            )
        ]
    if condition.ends_on is not None and on > condition.ends_on:
        return [
            StatusCause(
                f"conditions.{key}.expired",
                REVIEW,
                f"{label}: la vigencia declarada terminó el {condition.ends_on.isoformat()}.",
            )
        ]
    return []


def _covers(on: date) -> Q:
    return Q(starts_on__lte=on) & (Q(ends_on__isnull=True) | Q(ends_on__gte=on))


def _tax_causes(entity_id: int, on: date) -> tuple[list[StatusCause], tuple[int, ...]]:
    causes: list[StatusCause] = []
    used: list[int] = []
    definitions = TaxDefinition.objects.filter(fiscal_entity_id=entity_id).order_by("pk")
    for definition in definitions:
        period = TaxPeriod.objects.filter(tax_definition=definition).filter(_covers(on)).first()
        if period is None:
            continue
        mappings = list(
            FiscalTaxMapping.objects.filter(tax_definition=definition).filter(_covers(on))
        )
        if len(mappings) != 1:
            ever = FiscalTaxMapping.objects.filter(tax_definition=definition).exists()
            causes.append(
                StatusCause(
                    f"tax_mapping.{definition.pk}.{'expired' if ever else 'missing'}",
                    REVIEW if ever else MISSING,
                    f"{definition.name}: "
                    + (
                        "su correspondencia con el catálogo SRI está fuera de vigencia."
                        if ever
                        else "falta relacionarlo con el catálogo SRI."
                    ),
                )
            )
            continue
        mapping = mappings[0]
        entry = (
            OfficialCatalogEntry.objects.filter(pk=mapping.catalog_entry_id).first()
            if mapping.catalog_entry_id
            else None
        )
        if entry is None or not is_current(entry, on) or entry.rate != period.rate:
            causes.append(
                StatusCause(
                    f"tax_mapping.{definition.pk}.review",
                    REVIEW,
                    f"{definition.name}: la entrada del catálogo SRI está inactiva o no "
                    "coincide con la tarifa vigente.",
                )
            )
            continue
        used.append(mapping.pk)
    return causes, tuple(used)


def _point_causes(entity: FiscalEntity, defaults: EffectiveDefaults) -> list[StatusCause]:
    if defaults.point_issue == "point_missing":
        return [
            StatusCause(
                "point_missing",
                MISSING,
                "Registre un establecimiento con un punto de emisión activo.",
            )
        ]
    if defaults.point_issue == "default_point_required":
        return [
            StatusCause(
                "default_point_required",
                MISSING,
                "Hay varios puntos activos: designe el punto predeterminado para preparar.",
            )
        ]
    if defaults.point_id is None:
        return []
    point = (
        FiscalEmissionPoint.objects.select_related("establishment")
        .filter(pk=defaults.point_id)
        .first()
    )
    if point is not None and not point.establishment.address.strip():
        return [
            StatusCause(
                "establishment_address", MISSING, "Registre la dirección del establecimiento."
            )
        ]
    return []


def _payment_causes(defaults: EffectiveDefaults) -> list[StatusCause]:
    if defaults.payment_issue == "payment_forms_missing":
        return [
            StatusCause(
                "payment_forms_missing", MISSING, "Habilite al menos una forma de pago SRI."
            )
        ]
    if defaults.payment_issue == "default_payment_form_required":
        return [
            StatusCause(
                "default_payment_form_required",
                MISSING,
                "Designe una forma de pago predeterminada habilitada.",
            )
        ]
    return []


def _certificate_warnings(
    certificate: DeclaredCertificate | None, on: date
) -> tuple[StatusCause, ...]:
    if certificate is None:
        return (
            StatusCause(
                "certificate_missing",
                REVIEW,
                "Certificado sin declarar: no impide preparar localmente.",
            ),
        )
    status = certificate.status_on(on)
    if status == "DECLARED_CURRENT":
        return ()
    message = (
        "Certificado vencido por fechas: deberá renovarse antes de una emisión futura."
        if status == "EXPIRED"
        else "Certificado con vigencia futura según las fechas declaradas."
    )
    return (StatusCause(f"certificate_{status.lower()}", REVIEW, message),)


def evaluate_electronic_status(*, entity_id: int, on: date) -> ElectronicStatus:
    """Lectura interna sin autorización; el consumidor autoriza y bloquea la entidad."""
    entity = FiscalEntity.objects.get(pk=entity_id)
    profile = (
        ElectronicProfileRevision.objects.filter(fiscal_entity=entity).order_by("-revision").first()
    )
    defaults = effective_defaults(entity_id=entity.pk, on=on)
    causes: list[StatusCause] = []
    conditions: tuple[tuple[str, DeclaredCondition], ...] = ()
    certificate = None
    if not (entity.address or "").strip():
        causes.append(StatusCause("matrix_address", MISSING, "Registre la dirección matriz."))
    if profile is not None:
        conditions = tuple(
            (key, parse_condition(profile.conditions.get(key, {"status": "UNKNOWN"})))
            for key in sorted(CONDITIONS)
        )
        for key, condition in conditions:
            causes.extend(_condition_causes(key, condition, on))
        if profile.certificate is not None:
            certificate = parse_certificate_metadata(profile.certificate)
    causes.extend(_point_causes(entity, defaults))
    causes.extend(_payment_causes(defaults))
    tax_causes, mapping_ids = _tax_causes(entity.pk, on)
    causes.extend(tax_causes)

    if profile is None:
        state = NOT_CONFIGURED
        causes.insert(
            0, StatusCause("profile", MISSING, "Todavía no existe una configuración guardada.")
        )
    elif any(cause.kind == MISSING for cause in causes):
        state = INCOMPLETE
    elif causes:
        state = NEEDS_REVIEW
    else:
        state = READY
    return ElectronicStatus(
        entity_id=entity.pk,
        state=state,
        causes=tuple(causes),
        warnings=_certificate_warnings(certificate, on),
        environment=ENVIRONMENT_TEST,
        profile_revision=profile.revision if profile else None,
        conditions=conditions,
        certificate=certificate,
        defaults=defaults,
        tax_mapping_ids=mapping_ids,
    )


def get_electronic_status(*, actor: User, entity_id: int) -> ElectronicStatus:
    require_permission(actor=actor, permission="parametros.gestionar")
    if not FiscalEntity.objects.filter(pk=entity_id).exists():
        raise FiscalEntityNotFoundError("Entidad fiscal no encontrada.")
    return evaluate_electronic_status(entity_id=entity_id, on=timezone.localdate())
