"""Lectura local y defensiva de evidencia XML fiscal.

La validación estructural y semántica no comprueba firma, existencia ni estado ante el SRI.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation

from lxml import etree

from fiscal.domain.access_key import validate_access_key
from fiscal.infrastructure.xml_schemas import SchemaNotSupportedError, compile_local_schema

MAX_XML_BYTES = 2 * 1024 * 1024
MAX_DEPTH = 64
MAX_ELEMENTS = 50_000
MAX_ATTRIBUTES = 100
_CHUNK_SIZE = 64 * 1024
_FORBIDDEN_DECLARATION = re.compile(rb"<!\s*(?:DOCTYPE|ENTITY)\b", re.IGNORECASE)
_XSLT_INSTRUCTION = re.compile(rb"<\?xml-stylesheet\b", re.IGNORECASE)
_XINCLUDE_NAMESPACE = "http://www.w3.org/2001/XInclude"
_ROOT_TYPES = {"factura": "01", "notaCredito": "04"}


class FiscalXmlError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ParsedFiscalXml:
    original_bytes: bytes
    document_bytes: bytes
    wrapper_bytes: bytes | None
    document_type: str
    version: str
    issuer_ruc: str
    environment: str
    access_key: str
    establishment: str
    emission_point: str
    sequential: str
    issue_date: str
    total: Decimal
    tax_total: Decimal
    receiver_identification: str
    currency: str
    line_count: int
    line_facts: tuple[dict[str, object], ...]
    declared_authorization_state: str | None
    is_officially_verified: bool = field(default=False, init=False)


def _local_name(element: etree._Element) -> str:
    return etree.QName(element).localname


def _reject_unsupported_features(data: bytes) -> None:
    if data.startswith(b"PK\x03\x04"):
        raise FiscalXmlError("unsupported_xml_feature", "No se admiten archivos comprimidos.")
    if _XSLT_INSTRUCTION.search(data):
        raise FiscalXmlError("unsupported_xml_feature", "No se admiten instrucciones XML.")
    if _FORBIDDEN_DECLARATION.search(data):
        raise FiscalXmlError("unsafe_xml", "El XML contiene declaraciones no admitidas.")


def read_bounded_xml(data: bytes) -> etree._Element:
    """Parsea XML con límites comprobados mientras se alimenta el lector."""
    if not isinstance(data, bytes):
        raise FiscalXmlError("invalid_xml", "El contenido XML debe suministrarse como bytes.")
    if len(data) > MAX_XML_BYTES:
        raise FiscalXmlError("xml_too_large", "El XML excede el tamaño máximo de 2 MiB.")
    _reject_unsupported_features(data)

    parser = etree.XMLPullParser(
        events=("start", "end"),
        load_dtd=False,
        no_network=True,
        recover=False,
        resolve_entities=False,
        huge_tree=False,
        remove_comments=False,
        remove_pis=False,
    )
    depth = 0
    elements = 0
    try:
        for offset in range(0, len(data), _CHUNK_SIZE):
            parser.feed(data[offset : offset + _CHUNK_SIZE])
            for event, element in parser.read_events():
                if not isinstance(element, etree._Element):
                    continue
                if event == "start":
                    depth += 1
                    elements += 1
                    if depth > MAX_DEPTH:
                        raise FiscalXmlError(
                            "xml_too_complex", "El XML excede la profundidad máxima permitida."
                        )
                    if elements > MAX_ELEMENTS:
                        raise FiscalXmlError(
                            "xml_too_complex", "El XML excede el máximo de elementos permitido."
                        )
                    if len(element.attrib) > MAX_ATTRIBUTES:
                        raise FiscalXmlError(
                            "xml_too_complex",
                            "Un elemento excede el máximo de atributos permitido.",
                        )
                else:
                    depth -= 1
        root = parser.close()
    except FiscalXmlError:
        raise
    except (etree.XMLSyntaxError, UnicodeError, ValueError):
        raise FiscalXmlError("invalid_xml", "El contenido no es XML bien formado.") from None

    if root is None:
        raise FiscalXmlError("invalid_xml", "El contenido no contiene un documento XML.")
    if any(
        isinstance(element.tag, str) and etree.QName(element).namespace == _XINCLUDE_NAMESPACE
        for element in root.iter()
    ):
        raise FiscalXmlError("unsupported_xml_feature", "No se admite XInclude.")
    return root


def _required_text(parent: etree._Element, path: str) -> str:
    value = parent.findtext(path)
    if value is None or not value.strip():
        raise FiscalXmlError("missing_field", "El XML omite un campo fiscal obligatorio.")
    return value.strip()


def _decimal(parent: etree._Element, path: str) -> Decimal:
    try:
        return Decimal(_required_text(parent, path))
    except InvalidOperation:
        raise FiscalXmlError("invalid_amount", "El XML contiene un importe inválido.") from None


def _extract_document(
    original: bytes, root: etree._Element
) -> tuple[bytes, bytes | None, str | None, str | None, str | None]:
    if _local_name(root) != "autorizacion":
        return original, None, None, None, None

    document_node = root.find("comprobante")
    if document_node is None or document_node.text is None or not document_node.text.strip():
        raise FiscalXmlError("missing_field", "El envoltorio omite el comprobante.")
    document_text = document_node.text
    document_bytes = document_text.encode("utf-8")
    if len(document_bytes) > MAX_XML_BYTES:
        raise FiscalXmlError(
            "xml_too_large", "El comprobante extraído excede el tamaño máximo de 2 MiB."
        )
    return (
        document_bytes,
        original,
        root.findtext("estado"),
        root.findtext("numeroAutorizacion"),
        root.findtext("ambiente"),
    )


def _validate_identity(
    *,
    root: etree._Element,
    document_type: str,
    access_key: str,
    issuer_ruc: str,
    environment: str,
    establishment: str,
    emission_point: str,
    sequential: str,
    issue_date: str,
) -> None:
    try:
        issue_component = datetime.strptime(issue_date, "%d/%m/%Y").strftime("%d%m%Y")
    except ValueError:
        raise FiscalXmlError("identity_mismatch", "La identidad fiscal es incoherente.") from None
    key_matches = (
        validate_access_key(access_key)
        and access_key[:8] == issue_component
        and access_key[8:10] == document_type
        and access_key[10:23] == issuer_ruc
        and access_key[23] == environment
        and access_key[24:27] == establishment
        and access_key[27:30] == emission_point
        and access_key[30:39] == sequential
        and access_key[47] == "1"
        and _required_text(root, "infoTributaria/codDoc") == document_type
    )
    if not key_matches:
        raise FiscalXmlError("identity_mismatch", "La identidad fiscal es incoherente.")


def _validate_totals(root: etree._Element, document_type: str) -> tuple[Decimal, Decimal]:
    if document_type == "01":
        info = root.find("infoFactura")
        if info is None:
            raise FiscalXmlError("missing_field", "El XML omite información de factura.")
        total = _decimal(info, "importeTotal")
        tax_total = sum(
            (_decimal(tax, "valor") for tax in info.findall("totalConImpuestos/totalImpuesto")),
            Decimal("0"),
        )
        expected = (
            _decimal(info, "totalSinImpuestos")
            - _decimal(info, "totalDescuento")
            + tax_total
            + Decimal(info.findtext("propina", "0"))
        )
    else:
        info = root.find("infoNotaCredito")
        if info is None:
            raise FiscalXmlError("missing_field", "El XML omite información de nota de crédito.")
        total = _decimal(info, "valorModificacion")
        tax_total = sum(
            (_decimal(tax, "valor") for tax in info.findall("totalConImpuestos/totalImpuesto")),
            Decimal("0"),
        )
        expected = _decimal(info, "totalSinImpuestos") + tax_total
    if total != expected:
        raise FiscalXmlError(
            "totals_mismatch", "Los totales fiscales declarados no son coherentes."
        )
    return total, tax_total


def parse_fiscal_xml(original: bytes) -> ParsedFiscalXml:
    outer_root = read_bounded_xml(original)
    document_bytes, wrapper_bytes, state, authorization_number, wrapper_environment = (
        _extract_document(original, outer_root)
    )
    root = outer_root if wrapper_bytes is None else read_bounded_xml(document_bytes)
    root_name = _local_name(root)
    document_type = _ROOT_TYPES.get(root_name)
    if document_type is None:
        raise FiscalXmlError("unsupported_document", "El tipo de comprobante no está admitido.")

    version = root.get("version", "")
    try:
        schema = compile_local_schema(document_type=document_type, version=version)
    except SchemaNotSupportedError:
        raise FiscalXmlError(
            "unsupported_schema", "La versión declarada del comprobante no está admitida."
        ) from None
    if not schema.validate(root):
        raise FiscalXmlError(
            "schema_invalid", "El comprobante no cumple el esquema local seleccionado."
        )

    issuer_ruc = _required_text(root, "infoTributaria/ruc")
    environment = _required_text(root, "infoTributaria/ambiente")
    access_key = _required_text(root, "infoTributaria/claveAcceso")
    establishment = _required_text(root, "infoTributaria/estab")
    emission_point = _required_text(root, "infoTributaria/ptoEmi")
    sequential = _required_text(root, "infoTributaria/secuencial")
    info_name = "infoFactura" if document_type == "01" else "infoNotaCredito"
    issue_date = _required_text(root, f"{info_name}/fechaEmision")
    _validate_identity(
        root=root,
        document_type=document_type,
        access_key=access_key,
        issuer_ruc=issuer_ruc,
        environment=environment,
        establishment=establishment,
        emission_point=emission_point,
        sequential=sequential,
        issue_date=issue_date,
    )
    total, tax_total = _validate_totals(root, document_type)
    info = root.find(info_name)
    assert info is not None
    receiver_identification = _required_text(info, "identificacionComprador")
    currency = _required_text(info, "moneda")
    line_count = len(root.findall("detalles/detalle"))
    line_facts = tuple(
        {
            "position": position,
            "quantity": _required_text(line, "cantidad"),
            "base_amount": _required_text(line, "precioTotalSinImpuesto"),
            "tax_amount": str(
                sum(
                    (_decimal(tax, "valor") for tax in line.findall("impuestos/impuesto")),
                    Decimal("0"),
                )
            ),
            "tax_treatments": [
                {
                    "tax_code": _required_text(tax, "codigo"),
                    "percentage_code": _required_text(tax, "codigoPorcentaje"),
                    "rate": tax.findtext("tarifa", "0"),
                    "base_amount": _required_text(tax, "baseImponible"),
                    "tax_amount": _required_text(tax, "valor"),
                }
                for tax in line.findall("impuestos/impuesto")
            ],
        }
        for position, line in enumerate(root.findall("detalles/detalle"), start=1)
    )

    if wrapper_bytes is not None:
        expected_environment = {"1": "PRUEBAS", "2": "PRODUCCION"}[environment]
        if (authorization_number or "").strip() != access_key or (
            wrapper_environment or ""
        ).strip().upper() != expected_environment:
            raise FiscalXmlError(
                "wrapper_mismatch", "El envoltorio no concuerda con el comprobante."
            )

    return ParsedFiscalXml(
        original_bytes=original,
        document_bytes=document_bytes,
        wrapper_bytes=wrapper_bytes,
        document_type=document_type,
        version=version,
        issuer_ruc=issuer_ruc,
        environment=environment,
        access_key=access_key,
        establishment=establishment,
        emission_point=emission_point,
        sequential=sequential,
        issue_date=issue_date,
        total=total,
        tax_total=tax_total,
        receiver_identification=receiver_identification,
        currency=currency,
        line_count=line_count,
        line_facts=line_facts,
        declared_authorization_state=(state or "").strip() or None,
    )
