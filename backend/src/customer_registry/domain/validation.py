import re
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class PersonType(StrEnum):
    NATURAL = "NATURAL"
    JURIDICA = "JURIDICA"


class IdentificationType(StrEnum):
    CI = "CI"
    RUC = "RUC"


class CustomerValidationError(ValueError):
    def __init__(self, message: str, errors: dict[str, list[str]] | None = None) -> None:
        super().__init__(message)
        self.errors: dict[str, list[str]] = errors or {}


@dataclass(frozen=True)
class NormalizedCustomerData:
    person_type: PersonType
    name: str
    identification_type: IdentificationType
    identification: str
    phone: str
    email: str = ""
    address: str = ""


_EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)


def validate_name(name: Any) -> str:
    if not isinstance(name, str) or not name.strip():
        raise CustomerValidationError(
            "El nombre o razón social es obligatorio.",
            errors={"name": ["El nombre o razón social es obligatorio."]},
        )
    stripped = name.strip()
    if len(stripped) > 255:
        raise CustomerValidationError(
            "El nombre no puede exceder 255 caracteres.",
            errors={"name": ["El nombre no puede exceder 255 caracteres."]},
        )
    return stripped


def validate_person_type(person_type: Any) -> PersonType:
    if isinstance(person_type, PersonType):
        return person_type
    if isinstance(person_type, str):
        try:
            return PersonType(person_type.strip().upper())
        except ValueError:
            pass
    raise CustomerValidationError(
        "Tipo de persona inválido. Debe ser NATURAL o JURIDICA.",
        errors={"person_type": ["Tipo de persona inválido. Debe ser NATURAL o JURIDICA."]},
    )


def validate_identification_type(id_type: Any) -> IdentificationType:
    if isinstance(id_type, IdentificationType):
        return id_type
    if isinstance(id_type, str):
        try:
            return IdentificationType(id_type.strip().upper())
        except ValueError:
            pass
    raise CustomerValidationError(
        "Tipo de identificación inválido. Debe ser CI o RUC.",
        errors={"identification_type": ["Tipo de identificación inválido. Debe ser CI o RUC."]},
    )


def validate_identification(identification: Any, id_type: IdentificationType | str) -> str:
    if not isinstance(identification, str) or not identification.strip():
        raise CustomerValidationError(
            "La identificación es obligatoria.",
            errors={"identification": ["La identificación es obligatoria."]},
        )
    stripped = identification.strip()
    if len(stripped) > 32:
        raise CustomerValidationError(
            "La identificación no puede exceder 32 caracteres.",
            errors={"identification": ["La identificación no puede exceder 32 caracteres."]},
        )

    # Validar según el tipo de identificación (conservando ceros iniciales)
    resolved_type: IdentificationType | None = None
    if isinstance(id_type, IdentificationType):
        resolved_type = id_type
    else:
        try:
            resolved_type = IdentificationType(str(id_type).strip().upper())
        except ValueError:
            resolved_type = None

    if resolved_type == IdentificationType.CI and len(stripped) != 10:
        msg = "La cédula de identidad (CI) debe tener exactamente 10 caracteres."
        raise CustomerValidationError(msg, errors={"identification": [msg]})

    if resolved_type == IdentificationType.RUC and len(stripped) != 13:
        msg = "El RUC debe tener exactamente 13 caracteres."
        raise CustomerValidationError(msg, errors={"identification": [msg]})

    return stripped


def validate_phone(phone: Any) -> str:
    if not isinstance(phone, str) or not phone.strip():
        raise CustomerValidationError(
            "El teléfono es obligatorio.",
            errors={"phone": ["El teléfono es obligatorio."]},
        )
    stripped = phone.strip()
    if len(stripped) > 64:
        raise CustomerValidationError(
            "El teléfono no puede exceder 64 caracteres.",
            errors={"phone": ["El teléfono no puede exceder 64 caracteres."]},
        )
    return stripped


def validate_email(email: Any) -> str:
    if email is None:
        return ""
    if not isinstance(email, str):
        raise CustomerValidationError(
            "El correo electrónico no tiene un formato válido.",
            errors={"email": ["El correo electrónico no tiene un formato válido."]},
        )
    stripped = email.strip()
    if not stripped:
        return ""
    if len(stripped) > 254 or not _EMAIL_REGEX.match(stripped):
        raise CustomerValidationError(
            "El correo electrónico no tiene un formato válido.",
            errors={"email": ["El correo electrónico no tiene un formato válido."]},
        )
    return stripped


def validate_address(address: Any) -> str:
    if address is None:
        return ""
    if not isinstance(address, str):
        raise CustomerValidationError(
            "La dirección no es válida.",
            errors={"address": ["La dirección no es válida."]},
        )
    stripped = address.strip()
    if len(stripped) > 1024:
        raise CustomerValidationError(
            "La dirección no puede exceder 1024 caracteres.",
            errors={"address": ["La dirección no puede exceder 1024 caracteres."]},
        )
    return stripped


def validate_and_normalize_customer(data: Mapping[str, Any]) -> NormalizedCustomerData:
    errors: dict[str, list[str]] = defaultdict(list)

    # 1. person_type
    person_type: PersonType | None = None
    try:
        person_type = validate_person_type(data.get("person_type"))
    except CustomerValidationError as exc:
        for field, errs in exc.errors.items():
            errors[field].extend(errs)

    # 2. name
    name: str = ""
    try:
        name = validate_name(data.get("name"))
    except CustomerValidationError as exc:
        for field, errs in exc.errors.items():
            errors[field].extend(errs)

    # 3. identification_type
    identification_type: IdentificationType | None = None
    try:
        identification_type = validate_identification_type(data.get("identification_type"))
    except CustomerValidationError as exc:
        for field, errs in exc.errors.items():
            errors[field].extend(errs)

    # 4. identification
    identification: str = ""
    try:
        if identification_type is not None:
            identification = validate_identification(
                data.get("identification"), identification_type
            )
        else:
            raw_ident = data.get("identification")
            if not isinstance(raw_ident, str) or not raw_ident.strip():
                errors["identification"].append("La identificación es obligatoria.")
            else:
                identification = raw_ident.strip()
    except CustomerValidationError as exc:
        for field, errs in exc.errors.items():
            errors[field].extend(errs)

    # 5. phone
    phone: str = ""
    try:
        phone = validate_phone(data.get("phone"))
    except CustomerValidationError as exc:
        for field, errs in exc.errors.items():
            errors[field].extend(errs)

    # 6. email
    email: str = ""
    try:
        email = validate_email(data.get("email"))
    except CustomerValidationError as exc:
        for field, errs in exc.errors.items():
            errors[field].extend(errs)

    # 7. address
    address: str = ""
    try:
        address = validate_address(data.get("address"))
    except CustomerValidationError as exc:
        for field, errs in exc.errors.items():
            errors[field].extend(errs)

    if errors:
        raise CustomerValidationError(
            "Datos de cliente inválidos.",
            errors=dict(errors),
        )

    assert person_type is not None
    assert identification_type is not None

    return NormalizedCustomerData(
        person_type=person_type,
        name=name,
        identification_type=identification_type,
        identification=identification,
        phone=phone,
        email=email,
        address=address,
    )


class BrandValidationError(CustomerValidationError):
    pass


def validate_brand_name(name: Any) -> str:
    if not isinstance(name, str) or not name.strip():
        raise BrandValidationError(
            "El nombre de la marca es obligatorio.",
            errors={"name": ["El nombre de la marca es obligatorio."]},
        )
    stripped = name.strip()
    if len(stripped) > 255:
        raise BrandValidationError(
            "El nombre de la marca no puede exceder 255 caracteres.",
            errors={"name": ["El nombre de la marca no puede exceder 255 caracteres."]},
        )
    return stripped


class VehicleValidationError(CustomerValidationError):
    pass


def validate_vehicle_plate(plate: Any) -> str:
    if not isinstance(plate, str) or not plate.strip():
        raise VehicleValidationError(
            "La placa del vehículo es obligatoria.",
            errors={"plate": ["La placa del vehículo es obligatoria."]},
        )
    stripped = plate.strip().upper()
    if len(stripped) > 64:
        raise VehicleValidationError(
            "La placa no puede exceder 64 caracteres.",
            errors={"plate": ["La placa no puede exceder 64 caracteres."]},
        )
    return stripped


def validate_vehicle_model(model: Any) -> str:
    if not isinstance(model, str) or not model.strip():
        raise VehicleValidationError(
            "El modelo del vehículo es obligatorio.",
            errors={"model": ["El modelo del vehículo es obligatorio."]},
        )
    stripped = model.strip()
    if len(stripped) > 255:
        raise VehicleValidationError(
            "El modelo no puede exceder 255 caracteres.",
            errors={"model": ["El modelo no puede exceder 255 caracteres."]},
        )
    return stripped


def validate_vehicle_color(color: Any) -> str:
    if color is None:
        return ""
    if not isinstance(color, str):
        raise VehicleValidationError(
            "El color debe ser texto.",
            errors={"color": ["El color debe ser texto."]},
        )
    stripped = color.strip()
    if len(stripped) > 100:
        raise VehicleValidationError(
            "El color no puede exceder 100 caracteres.",
            errors={"color": ["El color no puede exceder 100 caracteres."]},
        )
    return stripped


def validate_vehicle_year(year: Any) -> int | None:
    if year is None or year == "":
        return None
    try:
        val = int(year)
    except (ValueError, TypeError):
        raise VehicleValidationError(
            "El año debe ser un número entero válido.",
            errors={"year": ["El año debe ser un número entero válido."]},
        ) from None
    if val <= 0 or val > 9999:
        raise VehicleValidationError(
            "El año debe ser un valor positivo válido.",
            errors={"year": ["El año debe ser un valor positivo válido."]},
        )
    return val


def validate_vehicle_vin(vin: Any) -> str | None:
    if vin is None or vin == "":
        return None
    if not isinstance(vin, str):
        raise VehicleValidationError(
            "El número de chasis/VIN debe ser texto.",
            errors={"vin": ["El número de chasis/VIN debe ser texto."]},
        )
    stripped = vin.strip().upper()
    if not stripped:
        return None
    if len(stripped) > 64:
        raise VehicleValidationError(
            "El número de chasis/VIN no puede exceder 64 caracteres.",
            errors={"vin": ["El número de chasis/VIN no puede exceder 64 caracteres."]},
        )
    return stripped
