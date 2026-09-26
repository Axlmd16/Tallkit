"""Comprobantes sintéticos: nunca representan documentos emitidos ni autorizados."""

from __future__ import annotations

from datetime import date

from fiscal.domain.access_key import build_access_key

SYNTHETIC_RUC = "9999999999001"
SYNTHETIC_DAY = date(2026, 9, 25)
SYNTHETIC_SEQUENTIAL = "000000001"


def _access_key(document_type: str) -> str:
    return build_access_key(
        emission_date=SYNTHETIC_DAY,
        doc_type=document_type,
        ruc=SYNTHETIC_RUC,
        environment="1",
        establishment="001",
        emission_point="001",
        sequential=SYNTHETIC_SEQUENTIAL,
        numeric_code="12345678",
    )


def _tax_info(document_type: str) -> str:
    return f"""
  <infoTributaria>
    <ambiente>1</ambiente><tipoEmision>1</tipoEmision>
    <razonSocial>ENTIDAD SINTETICA</razonSocial><ruc>{SYNTHETIC_RUC}</ruc>
    <claveAcceso>{_access_key(document_type)}</claveAcceso><codDoc>{document_type}</codDoc>
    <estab>001</estab><ptoEmi>001</ptoEmi><secuencial>{SYNTHETIC_SEQUENTIAL}</secuencial>
    <dirMatriz>DIRECCION SINTETICA</dirMatriz>
  </infoTributaria>"""


def synthetic_invoice(version: str = "2.1.0") -> bytes:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="{version}">
{_tax_info("01")}
  <infoFactura>
    <fechaEmision>25/09/2026</fechaEmision>
    <tipoIdentificacionComprador>07</tipoIdentificacionComprador>
    <razonSocialComprador>CONSUMIDOR FINAL</razonSocialComprador>
    <identificacionComprador>9999999999999</identificacionComprador>
    <totalSinImpuestos>10.00</totalSinImpuestos><totalDescuento>0.00</totalDescuento>
    <totalConImpuestos><totalImpuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje>
      <baseImponible>10.00</baseImponible><tarifa>0.00</tarifa><valor>0.00</valor>
    </totalImpuesto></totalConImpuestos>
    <importeTotal>10.00</importeTotal><moneda>DOLAR</moneda>
    <pagos><pago><formaPago>01</formaPago><total>10.00</total></pago></pagos>
  </infoFactura>
  <detalles><detalle><codigoPrincipal>SERVICIO-1</codigoPrincipal>
    <descripcion>SERVICIO SINTETICO</descripcion><cantidad>1.00</cantidad>
    <precioUnitario>10.00</precioUnitario><descuento>0.00</descuento>
    <precioTotalSinImpuesto>10.00</precioTotalSinImpuesto>
    <impuestos><impuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje>
      <tarifa>0.00</tarifa><baseImponible>10.00</baseImponible><valor>0.00</valor>
    </impuesto></impuestos>
  </detalle></detalles>
</factura>""".encode()


def synthetic_credit_note(version: str = "1.1.0") -> bytes:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<notaCredito id="comprobante" version="{version}">
{_tax_info("04")}
  <infoNotaCredito>
    <fechaEmision>25/09/2026</fechaEmision>
    <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
    <razonSocialComprador>RECEPTOR SINTETICO</razonSocialComprador>
    <identificacionComprador>{SYNTHETIC_RUC}</identificacionComprador>
    <codDocModificado>01</codDocModificado><numDocModificado>001-001-000000001</numDocModificado>
    <fechaEmisionDocSustento>24/09/2026</fechaEmisionDocSustento>
    <totalSinImpuestos>10.00</totalSinImpuestos><valorModificacion>10.00</valorModificacion>
    <moneda>DOLAR</moneda><totalConImpuestos><totalImpuesto><codigo>2</codigo>
      <codigoPorcentaje>0</codigoPorcentaje><baseImponible>10.00</baseImponible>
      <valor>0.00</valor></totalImpuesto></totalConImpuestos>
    <motivo>CORRECCION SINTETICA</motivo>
  </infoNotaCredito>
  <detalles><detalle><codigoInterno>SERVICIO-1</codigoInterno>
    <descripcion>SERVICIO SINTETICO</descripcion><cantidad>1.00</cantidad>
    <precioUnitario>10.00</precioUnitario><descuento>0.00</descuento>
    <precioTotalSinImpuesto>10.00</precioTotalSinImpuesto>
    <impuestos><impuesto><codigo>2</codigo><codigoPorcentaje>0</codigoPorcentaje>
      <tarifa>0.00</tarifa><baseImponible>10.00</baseImponible><valor>0.00</valor>
    </impuesto></impuestos>
  </detalle></detalles>
</notaCredito>""".encode()


def synthetic_authorization_wrapper(document: bytes, *, state: str = "AUTORIZADO") -> bytes:
    access_key = _access_key("01" if b"<factura " in document else "04")
    return (
        b'<?xml version="1.0" encoding="UTF-8"?>\n<autorizacion>'
        + f"<estado>{state}</estado><numeroAutorizacion>{access_key}</numeroAutorizacion>".encode()
        + b"<fechaAutorizacion>2026-09-25T12:00:00-05:00</fechaAutorizacion>"
        + b"<ambiente>PRUEBAS</ambiente><comprobante><![CDATA["
        + document
        + b"]]></comprobante><mensajes/></autorizacion>"
    )
