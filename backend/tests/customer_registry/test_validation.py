import pytest

from customer_registry.domain.validation import (
    CustomerValidationError,
    IdentificationType,
    NormalizedCustomerData,
    PersonType,
    validate_address,
    validate_and_normalize_customer,
    validate_email,
    validate_identification,
    validate_name,
    validate_person_type,
    validate_phone,
)


def test_valid_natural_person_with_ci_and_optional_fields_empty() -> None:
    data = {
        "person_type": "NATURAL",
        "name": "  Juan Pérez  ",
        "identification_type": "CI",
        "identification": "  0912345678  ",
        "phone": "  0987654321  ",
        "email": "",
        "address": "   ",
    }
    normalized = validate_and_normalize_customer(data)

    assert isinstance(normalized, NormalizedCustomerData)
    assert normalized.person_type == PersonType.NATURAL
    assert normalized.name == "Juan Pérez"
    assert normalized.identification_type == IdentificationType.CI
    assert normalized.identification == "0912345678"  # Leading zero preserved
    assert normalized.phone == "0987654321"
    assert normalized.email == ""
    assert normalized.address == ""


def test_valid_juridical_person_with_ruc_and_optional_fields() -> None:
    data = {
        "person_type": "JURIDICA",
        "name": "  Corporación Automotriz S.A.  ",
        "identification_type": "RUC",
        "identification": "  0991234567001  ",
        "phone": "042123456",
        "email": "  info@corp-auto.com.ec  ",
        "address": "  Av. Principal 123 y Secundaria  ",
    }
    normalized = validate_and_normalize_customer(data)

    assert normalized.person_type == PersonType.JURIDICA
    assert normalized.name == "Corporación Automotriz S.A."
    assert normalized.identification_type == IdentificationType.RUC
    assert normalized.identification == "0991234567001"
    assert normalized.phone == "042123456"
    assert normalized.email == "info@corp-auto.com.ec"
    assert normalized.address == "Av. Principal 123 y Secundaria"


def test_natural_person_with_ruc_is_allowed_without_fiscal_matrix() -> None:
    data = {
        "person_type": "NATURAL",
        "name": "María Gómez",
        "identification_type": "RUC",
        "identification": "1712345678001",
        "phone": "0998877665",
    }
    normalized = validate_and_normalize_customer(data)
    assert normalized.person_type == PersonType.NATURAL
    assert normalized.identification_type == IdentificationType.RUC
    assert normalized.identification == "1712345678001"


def test_rejects_missing_or_blank_required_fields() -> None:
    data = {
        "person_type": "",
        "name": "   ",
        "identification_type": "",
        "identification": "   ",
        "phone": "   ",
    }
    with pytest.raises(CustomerValidationError) as exc_info:
        validate_and_normalize_customer(data)

    errors = exc_info.value.errors
    assert "person_type" in errors
    assert "name" in errors
    assert "identification_type" in errors
    assert "identification" in errors
    assert "phone" in errors


def test_rejects_invalid_person_type() -> None:
    with pytest.raises(CustomerValidationError) as exc_info:
        validate_person_type("EXTRANJERO")
    assert "person_type" in exc_info.value.errors


def test_rejects_invalid_identification_type() -> None:
    data = {
        "person_type": "NATURAL",
        "name": "Carlos Ruiz",
        "identification_type": "PASAPORTE",
        "identification": "A123456789",
        "phone": "0991122334",
    }
    with pytest.raises(CustomerValidationError) as exc_info:
        validate_and_normalize_customer(data)
    assert "identification_type" in exc_info.value.errors


def test_rejects_ci_with_invalid_length() -> None:
    # CI must be exactly 10 characters
    for invalid_ci in ["123456789", "12345678901", ""]:
        with pytest.raises(CustomerValidationError) as exc_info:
            validate_identification(invalid_ci, IdentificationType.CI)
        assert "identification" in exc_info.value.errors


def test_rejects_ruc_with_invalid_length() -> None:
    # RUC must be exactly 13 characters
    for invalid_ruc in ["123456789012", "12345678901234", ""]:
        with pytest.raises(CustomerValidationError) as exc_info:
            validate_identification(invalid_ruc, IdentificationType.RUC)
        assert "identification" in exc_info.value.errors


def test_rejects_invalid_email_format() -> None:
    invalid_emails = ["invalid-email", "user@", "@domain.com", "user@domain", "user space@test.com"]
    for email in invalid_emails:
        with pytest.raises(CustomerValidationError) as exc_info:
            validate_email(email)
        assert "email" in exc_info.value.errors


def test_accepts_valid_email_formats() -> None:
    valid_emails = [
        "user@example.com",
        "user.name+tag@sub.domain.org",
        "taller_123@empresa.com.ec",
    ]
    for email in valid_emails:
        assert validate_email(email) == email


def test_empty_email_is_normalized_to_empty_string() -> None:
    assert validate_email(None) == ""
    assert validate_email("") == ""
    assert validate_email("   ") == ""


def test_individual_field_validators() -> None:
    assert validate_name("  Ana Morales  ") == "Ana Morales"
    with pytest.raises(CustomerValidationError):
        validate_name("   ")
    with pytest.raises(CustomerValidationError):
        validate_name("A" * 256)

    assert validate_phone("  +593 99 123 4567  ") == "+593 99 123 4567"
    with pytest.raises(CustomerValidationError):
        validate_phone("   ")
    with pytest.raises(CustomerValidationError):
        validate_phone("1" * 65)

    assert validate_person_type(PersonType.NATURAL) == PersonType.NATURAL
    assert validate_person_type("natural") == PersonType.NATURAL

    with pytest.raises(CustomerValidationError):
        validate_identification("1" * 33, IdentificationType.CI)

    with pytest.raises(CustomerValidationError):
        validate_email(123)

    assert validate_address("  Calle 1 y Calle 2  ") == "Calle 1 y Calle 2"
    assert validate_address(None) == ""
    assert validate_address("") == ""
    with pytest.raises(CustomerValidationError):
        validate_address(12345)
    with pytest.raises(CustomerValidationError):
        validate_address("x" * 1025)
