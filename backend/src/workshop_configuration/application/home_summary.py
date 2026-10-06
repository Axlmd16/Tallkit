"""Lecturas de configuración para el resumen de inicio.

El aviso de la calificación artesanal usa la misma ventana de advertencia que la configuración
y, a diferencia de ella, también informa la calificación ya vencida. Decide con
``has_permission``, que no audita denegaciones.
"""

from dataclasses import dataclass
from datetime import date

from identity.application.authorization import has_permission
from identity.models import User
from workshop_configuration.application.electronic_profiles import CURRENT_CONDITIONS_FORMAT
from workshop_configuration.application.withholding_settings import withholding_settings
from workshop_configuration.domain.electronic_profile import (
    ARTISAN_QUALIFICATION,
    QUALIFICATION_WARNING_DAYS,
    parse_profile_conditions,
)
from workshop_configuration.domain.validation import FiscalEntityType
from workshop_configuration.models import ElectronicProfileRevision


@dataclass(frozen=True)
class QualificationNotice:
    entity_id: int
    ends_on: date
    days_left: int
    expired: bool


def artisan_qualification_notice(actor: User, *, on: date) -> QualificationNotice | None:
    """Calificación artesanal que vence en la ventana de advertencia o que ya venció."""
    if not has_permission(actor, "parametros.gestionar"):
        return None
    profile = (
        ElectronicProfileRevision.objects.filter(
            fiscal_entity__entity_type=FiscalEntityType.ARTESANAL.value
        )
        .order_by("-revision")
        .first()
    )
    if profile is None or profile.conditions_format != CURRENT_CONDITIONS_FORMAT:
        return None
    qualification = parse_profile_conditions(profile.conditions).get(ARTISAN_QUALIFICATION)
    if (
        qualification is None
        or qualification.status != "APPLICABLE"
        or qualification.ends_on is None
    ):
        return None
    days_left = (qualification.ends_on - on).days
    if days_left > QUALIFICATION_WARNING_DAYS:
        return None
    return QualificationNotice(
        entity_id=profile.fiscal_entity_id,
        ends_on=qualification.ends_on,
        days_left=days_left,
        expired=days_left < 0,
    )


def registers_withholdings(entity_type: str) -> bool:
    """Si la entidad fiscal de ese tipo tiene activado el registro de retenciones recibidas."""
    return withholding_settings(entity_type).registration_enabled
