## MODIFIED Requirements

### Requirement: Saldo y estado de pago derivados

El saldo pendiente de cada operación artesanal SHALL derivarse del importe exigible vigente menos los pagos efectivos netos de correcciones y menos las **retenciones recibidas** vigentes, sin edición manual. El estado de pago SHALL derivarse como pendiente (sin pagos efectivos ni retenciones vigentes), parcial (saldo positivo con pagos o retenciones) o pagado (saldo cero) y SHALL ser independiente del estado operativo de la orden y del estado del documento. Dinero cobrado y retenciones SHALL mostrarse por separado y una retención SHALL NOT sumarse a efectivo, transferencia ni total cobrado. Una operación anulada SHALL tener exigible cero. Trazabilidad: RN-VEN-011/012; RF-PAG-005/006; modelo de dominio §10; propuesta de retenciones A2/D15.

#### Scenario: Saldo reproducible
- **DADO** una operación de USD 120,00 con pagos efectivos de USD 50,00 y USD 20,00 y un pago corregido de USD 10,00
- **CUANDO** se consulta
- **ENTONCES** SHALL mostrar pagado USD 70,00, saldo USD 50,00 y estado parcial, sin sumar el pago corregido.

#### Scenario: Estados independientes
- **DADO** una orden finalizada con una operación artesanal a crédito pendiente
- **CUANDO** se consulta la orden
- **ENTONCES** la orden SHALL mostrarse finalizada y la operación pendiente de pago, sin que uno condicione al otro.

#### Scenario: Retención que completa el pago artesanal
- **DADO** una operación de USD 250,00 con pagos efectivos de USD 245,00
- **CUANDO** se registra una retención vigente de USD 5,00
- **ENTONCES** SHALL mostrar cobrado USD 245,00, retenido USD 5,00, saldo USD 0,00 y estado pagado.

#### Scenario: Retención anulada no descuenta
- **DADO** una operación de USD 250,00 con pagos de USD 245,00 y una retención anulada de USD 5,00
- **CUANDO** se consulta
- **ENTONCES** SHALL mostrar saldo USD 5,00 y estado parcial.

## ADDED Requirements

### Requirement: Retenciones en las cuentas por cobrar artesanales

Las cuentas por cobrar artesanales y el detalle de cada operación SHALL mostrar el total retenido separado del dinero cobrado, calcular la deuda con el saldo que descuenta las retenciones vigentes e identificar en el historial cada retención con importe, fecha, actor, vigencia y situación de su comprobante. SHALL NOT mezclarse con retenciones comerciales de la misma orden ni compensarse entre operaciones. Trazabilidad: propuesta de retenciones D15; RF-PAG-009/010; DP-029.

#### Scenario: Orden con retención en un solo ámbito
- **DADO** una orden con una operación artesanal de USD 250,00 cerrada con USD 245,00 y retención de USD 5,00, y una venta vinculada con saldo USD 40,00
- **CUANDO** el Encargado del taller consulta las cuentas por cobrar artesanales
- **ENTONCES** la operación SHALL NOT aparecer como deuda y la retención SHALL NOT descontarse de la venta vinculada.

### Requirement: Anulación de la operación con retenciones vigentes

Una operación artesanal con retenciones vigentes SHALL NOT anularse. El intento SHALL bloquearse explicando que primero deben anularse sus retenciones con motivo, sin anularlas de forma automática. Trazabilidad: propuesta de retenciones D14; DP-029; RN-VEN-016.

#### Scenario: Intento de anular con una retención vigente
- **DADO** una operación artesanal sin pagos vigentes y con una retención vigente de USD 5,00
- **CUANDO** el Administrador intenta anularla
- **ENTONCES** SHALL bloquearse identificando la retención, sin cambiar la operación.
