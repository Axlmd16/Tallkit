## MODIFIED Requirements

### Requirement: Acceso fiscal comercial sin cambiar la confirmación de venta

Administrador y Vendedor SHALL poder acceder desde una venta confirmada a su preparación fiscal, solicitudes y evidencias vinculadas, según los permisos de cada capacidad. La acción de inicio SHALL llamarse «Preparar datos fiscales», y una preparación completada SHALL mostrarse como «Preparación local» y «Pendiente de emisión». Ningún texto SHALL presentarla como factura emitida, autorizada, enviada o aprobada por el SRI.

La consulta SHALL distinguir **documento interno**, **estado de pago**, preparación local y evidencia externa no verificada. El comprobante interno SHALL conservar número, historia y la advertencia de que no constituye factura electrónica autorizada. Un Encargado sin rol comercial SHALL conservar exclusivamente su consulta limitada de ventas vinculadas y SHALL NOT acceder por ella a expedientes fiscales, XML ni acciones fiscales comerciales.

Trazabilidad: propuesta P1/P2 y Modified Capabilities; propuesta de simplificación A6; DP-018/029; RN-FIS-009; RF-VEN-015; spec principal de ventas, autorización por acción.

#### Scenario: Venta confirmada sin preparación
- **DADO** una venta confirmada consultada por un Vendedor
- **CUANDO** abre el apartado fiscal
- **ENTONCES** SHALL mostrarse sin preparación y ofrecer «Preparar datos fiscales», sin sugerir una autorización pendiente ya solicitada.

#### Scenario: Venta con preparación completada
- **DADO** una venta confirmada con preparación local completada
- **CUANDO** el Vendedor abre su ficha
- **ENTONCES** SHALL verse «Preparación local · Pendiente de emisión» sin la palabra «factura emitida» ni «autorizada».

#### Scenario: Evidencia importada vinculada
- **DADO** una venta con un XML externo archivado y vinculado
- **CUANDO** el Vendedor consulta su situación fiscal
- **ENTONCES** SHALL ver identidad, origen externo y condición no verificada, y descargar únicamente la evidencia a la que tenga acceso, sin sustituir el número interno.

#### Scenario: Encargado intenta seguir enlace fiscal comercial
- **DADO** un Encargado que puede consultar el resumen de una venta vinculada
- **CUANDO** intenta abrir su XML o preparación comercial sin rol adicional
- **ENTONCES** SHALL denegarse conservando el acceso limitado al resumen económico autorizado.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
