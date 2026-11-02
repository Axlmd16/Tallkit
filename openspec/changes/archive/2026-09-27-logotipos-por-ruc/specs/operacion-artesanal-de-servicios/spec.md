## MODIFIED Requirements

### Requirement: Consulta y comprobante interno artesanal

Un usuario con `servicios_economicos.ver` (Administrador o Encargado del taller) SHALL consultar la operación desde la orden y la orden desde la operación. El detalle SHALL mostrar número, estado, fecha, emisor artesanal, cliente y vehículo conservados, condición, líneas con su desglose, totales, pagado, saldo, estado de pago, la cadena de reemplazo y la anulación cuando existan. El **documento interno** imprimible SHALL identificar el RUC artesanal, el cliente, el vehículo, los servicios, los importes, los pagos y el número, y SHALL declarar que no constituye una factura electrónica autorizada por el SRI. Su encabezado SHALL mostrar el **logotipo** vigente de la entidad artesanal junto al nombre del emisor o, si la entidad no tiene logotipo, solo el nombre del emisor; SHALL NOT mostrar el logotipo de la entidad comercial ni el de Tallkit como marca del emisor. Estado del documento, estado de pago y futura referencia fiscal SHALL ser independientes. Un Vendedor sin rol de taller SHALL NOT consultarla. Trazabilidad: DP-018; RN-CON-009; RN-FIS-009; RF-TAL-012; UI-077; modelo de dominio §5.3; propuesta `logotipos-por-ruc` §7–8.

#### Scenario: Imprimir el comprobante artesanal
- **DADO** una operación confirmada con un pago parcial
- **CUANDO** un Encargado del taller solicita su comprobante
- **ENTONCES** SHALL mostrarse el RUC artesanal, los servicios, el total, lo pagado, el saldo y el aviso de documento no autorizado por el SRI, sin repuestos ni importes comerciales.

#### Scenario: Vendedor intenta consultar una operación artesanal
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** accede directamente a una operación artesanal
- **ENTONCES** el sistema SHALL denegarlo sin revelar su existencia ni sus datos.

#### Scenario: Comprobante con logotipo artesanal
- **DADO** la entidad artesanal con logotipo y la comercial con otro logotipo
- **CUANDO** un Encargado del taller abre o imprime el comprobante de una operación confirmada
- **ENTONCES** el encabezado SHALL mostrar el logotipo artesanal y el nombre del emisor, y SHALL NOT mostrar el logotipo comercial.

#### Scenario: Comprobante sin logotipo artesanal
- **DADO** la entidad artesanal sin logotipo
- **CUANDO** se abre el comprobante de una operación
- **ENTONCES** el encabezado SHALL mostrar solo el nombre del emisor, sin espacio vacío reservado ni isotipo de Tallkit.

#### Scenario: Operación anulada antes de un cambio de logotipo
- **DADO** una operación anulada confirmada con un logotipo artesanal anterior
- **CUANDO** se consulta después de reemplazar el logotipo
- **ENTONCES** SHALL mostrar el logotipo vigente, la indicación de anulación y los datos históricos sin cambios.
