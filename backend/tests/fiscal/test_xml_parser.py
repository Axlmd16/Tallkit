from __future__ import annotations

from decimal import Decimal

import pytest
from tests.fiscal.xml_samples import (
    SYNTHETIC_RUC,
    synthetic_authorization_wrapper,
    synthetic_credit_note,
    synthetic_invoice,
)

from fiscal.infrastructure.xml_parser import (
    MAX_ATTRIBUTES,
    MAX_DEPTH,
    MAX_ELEMENTS,
    MAX_XML_BYTES,
    FiscalXmlError,
    parse_fiscal_xml,
    read_bounded_xml,
)


@pytest.mark.parametrize(
    ("document_type", "version", "factory"),
    [
        ("01", "1.0.0", synthetic_invoice),
        ("01", "1.1.0", synthetic_invoice),
        ("01", "2.0.0", synthetic_invoice),
        ("01", "2.1.0", synthetic_invoice),
        ("04", "1.0.0", synthetic_credit_note),
        ("04", "1.1.0", synthetic_credit_note),
    ],
)
def test_supported_synthetic_documents_are_extracted_and_xsd_validated(
    document_type: str, version: str, factory: object
) -> None:
    original = factory(version)  # type: ignore[operator]

    parsed = parse_fiscal_xml(original)

    assert parsed.original_bytes == original
    assert parsed.document_bytes == original
    assert parsed.wrapper_bytes is None
    assert parsed.document_type == document_type
    assert parsed.version == version
    assert parsed.issuer_ruc == SYNTHETIC_RUC
    assert parsed.environment == "1"
    assert parsed.establishment == "001"
    assert parsed.emission_point == "001"
    assert parsed.sequential == "000000001"
    assert parsed.total == Decimal("10.00")
    assert parsed.tax_total == Decimal("0.00")
    assert parsed.receiver_identification in {"9999999999999", SYNTHETIC_RUC}
    assert parsed.currency == "DOLAR"
    assert parsed.line_count == 1
    assert parsed.line_facts == (
        {
            "position": 1,
            "quantity": "1.00",
            "base_amount": "10.00",
            "tax_amount": "0.00",
            "tax_treatments": [
                {
                    "tax_code": "2",
                    "percentage_code": "0",
                    "rate": "0.00",
                    "base_amount": "10.00",
                    "tax_amount": "0.00",
                }
            ],
        },
    )
    assert parsed.declared_authorization_state is None
    assert parsed.is_officially_verified is False


def test_authorization_wrapper_is_preserved_and_only_records_its_declaration() -> None:
    document = synthetic_invoice()
    wrapper = synthetic_authorization_wrapper(document)

    parsed = parse_fiscal_xml(wrapper)

    assert parsed.original_bytes == wrapper
    assert parsed.wrapper_bytes == wrapper
    assert parsed.document_bytes == document
    assert parsed.declared_authorization_state == "AUTORIZADO"
    assert parsed.is_officially_verified is False


@pytest.mark.parametrize(
    "payload",
    [
        b'<!DOCTYPE factura SYSTEM "file:///etc/passwd"><factura/>',
        b'<!DOCTYPE factura [<!ENTITY secret SYSTEM "file:///etc/passwd">]><factura>&secret;</factura>',
        b'<!DOCTYPE factura [<!ENTITY repeated "123">]><factura>&repeated;</factura>',
    ],
)
def test_dtd_and_entities_are_rejected_without_leaking_content(payload: bytes) -> None:
    with pytest.raises(FiscalXmlError) as captured:
        parse_fiscal_xml(payload)

    assert captured.value.code == "unsafe_xml"
    assert "passwd" not in str(captured.value)
    assert "secret" not in str(captured.value)


def test_external_schema_hint_is_ignored_in_favor_of_the_local_manifest() -> None:
    payload = synthetic_invoice().replace(
        b'<factura id="comprobante"',
        b'<factura xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        b'xsi:noNamespaceSchemaLocation="http://127.0.0.1:9/foreign.xsd" id="comprobante"',
    )

    assert parse_fiscal_xml(payload).version == "2.1.0"


@pytest.mark.parametrize(
    "payload",
    [
        b"not xml and private-value-123",
        b"<factura><private-value-123></factura>",
    ],
)
def test_malformed_xml_errors_are_sanitized(payload: bytes) -> None:
    with pytest.raises(FiscalXmlError) as captured:
        parse_fiscal_xml(payload)

    assert captured.value.code == "invalid_xml"
    assert "private-value-123" not in str(captured.value)


def test_unknown_version_is_rejected_without_fallback() -> None:
    payload = synthetic_invoice().replace(b'version="2.1.0"', b'version="9.9.9"')

    with pytest.raises(FiscalXmlError) as captured:
        parse_fiscal_xml(payload)

    assert captured.value.code == "unsupported_schema"


def test_access_key_and_declared_identity_must_match() -> None:
    payload = synthetic_invoice().replace(b"<estab>001</estab>", b"<estab>002</estab>")

    with pytest.raises(FiscalXmlError) as captured:
        parse_fiscal_xml(payload)

    assert captured.value.code == "identity_mismatch"


def test_declared_totals_must_be_coherent() -> None:
    payload = synthetic_invoice().replace(
        b"<importeTotal>10.00</importeTotal>", b"<importeTotal>11.00</importeTotal>"
    )

    with pytest.raises(FiscalXmlError) as captured:
        parse_fiscal_xml(payload)

    assert captured.value.code == "totals_mismatch"


def test_wrapper_identity_and_environment_must_match_the_document() -> None:
    wrapper = synthetic_authorization_wrapper(synthetic_invoice()).replace(
        b"<ambiente>PRUEBAS</ambiente>", b"<ambiente>PRODUCCION</ambiente>"
    )

    with pytest.raises(FiscalXmlError) as captured:
        parse_fiscal_xml(wrapper)

    assert captured.value.code == "wrapper_mismatch"


def test_zip_xinclude_and_xslt_are_not_accepted() -> None:
    for payload in (
        b"PK\x03\x04fake",
        b'<r xmlns:xi="http://www.w3.org/2001/XInclude"><xi:include href="file:///etc/passwd"/></r>',
        b'<?xml-stylesheet href="http://127.0.0.1/style.xsl"?><r/>',
    ):
        with pytest.raises(FiscalXmlError) as captured:
            parse_fiscal_xml(payload)
        assert captured.value.code == "unsupported_xml_feature"


def test_byte_limit_accepts_boundary_and_rejects_one_more() -> None:
    minimal = b"<r/>"
    at_limit = b"<!--" + b"x" * (MAX_XML_BYTES - len(minimal) - 7) + b"-->" + minimal

    assert len(at_limit) == MAX_XML_BYTES
    assert read_bounded_xml(at_limit).tag == "r"
    with pytest.raises(FiscalXmlError, match="tamaño"):
        read_bounded_xml(at_limit + b" ")


def test_depth_limit_is_enforced_while_reading() -> None:
    accepted = b"<n>" * MAX_DEPTH + b"</n>" * MAX_DEPTH
    rejected = b"<n>" * (MAX_DEPTH + 1) + b"</n>" * (MAX_DEPTH + 1)

    assert read_bounded_xml(accepted).tag == "n"
    with pytest.raises(FiscalXmlError, match="profundidad"):
        read_bounded_xml(rejected)


def test_attribute_limit_is_enforced_while_reading() -> None:
    accepted = ("<r " + " ".join(f'a{i}="x"' for i in range(MAX_ATTRIBUTES)) + "/>").encode()
    rejected = accepted.replace(b"/>", b' extra="x"/>')

    assert len(read_bounded_xml(accepted).attrib) == MAX_ATTRIBUTES
    with pytest.raises(FiscalXmlError, match="atributos"):
        read_bounded_xml(rejected)


def test_element_limit_is_enforced_while_reading() -> None:
    accepted = b"<r>" + b"<n/>" * (MAX_ELEMENTS - 1) + b"</r>"
    rejected = b"<r>" + b"<n/>" * MAX_ELEMENTS + b"</r>"

    assert len(read_bounded_xml(accepted)) == MAX_ELEMENTS - 1
    with pytest.raises(FiscalXmlError, match="elementos"):
        read_bounded_xml(rejected)
