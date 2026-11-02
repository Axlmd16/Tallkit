## MODIFIED Requirements

### Requirement: Acceso fiscal artesanal separado de repuestos

Administrador y Encargado del taller SHALL poder preparar y consultar el expediente fiscal de una operación artesanal confirmada y acceder a evidencias vinculadas según sus permisos. La acción de inicio SHALL llamarse «Preparar datos fiscales», y una preparación completada SHALL mostrarse como «Preparación local» y «Pendiente de emisión», nunca como factura emitida, autorizada, enviada o aprobada por el SRI.

SHALL mostrarse por separado **documento interno**, **estado de pago**, preparación y evidencia externa no verificada. Un Vendedor sin rol de taller SHALL NOT consultar ese expediente aunque comparta el cliente o tenga acceso a la venta de repuestos de la misma orden. La preparación SHALL incluir únicamente los servicios de su operación artesanal y conservar el emisor artesanal; SHALL NOT mezclar ni sumar documentos comerciales.

Trazabilidad: propuesta P1/P2 y Modified Capabilities; propuesta de simplificación A6; DP-018/029; RN-FIS-003/005/006/009; RF-TAL-008.

#### Scenario: Orden con servicios y repuestos
- **DADO** una orden con una operación artesanal y una venta comercial confirmadas
- **CUANDO** el Encargado prepara los datos fiscales de servicios
- **ENTONCES** SHALL utilizarse únicamente la operación artesanal, sin añadir repuestos, importes ni datos fiscales del otro emisor.

#### Scenario: Operación con preparación completada
- **DADO** una operación artesanal con preparación local completada
- **CUANDO** el Encargado consulta la operación
- **ENTONCES** SHALL verse «Preparación local · Pendiente de emisión» y el aviso de que no es factura electrónica.

#### Scenario: Vendedor accede por cliente compartido
- **DADO** un Vendedor sin rol de taller que conoce el cliente de la orden
- **CUANDO** intenta consultar el expediente artesanal
- **ENTONCES** SHALL denegarse sin revelar el XML ni sus datos fiscales.
