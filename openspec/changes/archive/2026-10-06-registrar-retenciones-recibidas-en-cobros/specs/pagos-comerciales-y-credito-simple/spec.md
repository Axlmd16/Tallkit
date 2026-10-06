## MODIFIED Requirements

### Requirement: Saldo y estado derivados con exceso separado

El sistema SHALL calcular E como importe exigible vigente tras correcciones, P como pagos válidos netos de anulaciones/correcciones, R como reembolsos efectivamente registrados y W como **retenciones recibidas** vigentes de la misma venta. El dinero neto cobrado SHALL ser P − R y el importe aplicado neto SHALL ser (P − R) + W; el **saldo pendiente** SHALL ser máximo(E − (P − R) − W, 0). El exceso total SHALL ser máximo((P − R) + W − E, 0); el exceso pendiente de reembolso SHALL ser el menor entre ese exceso total y el dinero neto cobrado, y la parte restante SHALL mostrarse como retención en exceso, nunca como dinero por devolver. El **estado de pago** SHALL ser pendiente si E > 0 y no hay importe aplicado, parcial si existe aplicación positiva menor que E, y pagado si el saldo es cero; una venta de importe cero SHALL quedar sin deuda y sin pago ficticio. Un exceso SHALL mostrarse separadamente hasta liquidarse, incluso cuando el estado sea pagado. Dinero cobrado y retenciones SHALL mostrarse siempre por separado y una retención SHALL NOT sumarse a efectivo, transferencia ni total cobrado. SHALL NOT existir edición manual de saldo, total pagado, total retenido o estado de pago. Trazabilidad: DP-014; RN-VEN-011/012/019; RF-PAG-005/006; modelo de dominio §10; propuesta de ventas, recomendaciones 3/4; propuesta de retenciones A2/D15/D16.

#### Scenario: Abono parcial de crédito
- **DADO** una venta a crédito de 100.00 sin cobros
- **CUANDO** se registra un abono de 30.00
- **ENTONCES** SHALL mostrar aplicado 30.00, saldo 70.00 y estado parcial.

#### Scenario: Abono que completa el crédito
- **DADO** una venta a crédito de 100.00 con un abono válido de 30.00
- **CUANDO** se registra otro pago de 70.00
- **ENTONCES** SHALL mostrar aplicado 100.00, saldo cero y estado pagado, conservando ambos pagos independientes.

#### Scenario: Devolución sobre venta parcialmente pagada
- **DADO** una venta de 100.00 con pagos válidos de 60.00
- **CUANDO** una devolución reduce el exigible a 80.00
- **ENTONCES** SHALL resultar saldo 20.00 y estado parcial, sin reembolso pendiente.

#### Scenario: Exceso por devolución sin deuda negativa
- **DADO** una venta con exigible 80.00, pagos válidos 100.00 y ningún reembolso
- **CUANDO** se consultan sus saldos
- **ENTONCES** SHALL mostrar saldo cero, estado pagado y 20.00 por reembolsar; SHALL NOT presentar saldo a favor, deuda negativa o cobro adicional.

#### Scenario: Reembolso liquida el exceso
- **DADO** exigible 80.00, pagos válidos 100.00 y exceso 20.00
- **CUANDO** se registra el reembolso efectivo de 20.00
- **ENTONCES** SHALL mostrar aplicación neta 80.00, saldo cero y exceso cero, sin deuda nueva.

#### Scenario: Venta de importe cero
- **DADO** una venta válida cuyos precios finales vigentes producen total cero
- **CUANDO** se confirma
- **ENTONCES** SHALL mostrar saldo cero y estado pagado sin inventar un pago de cero; SHALL rechazarse todo intento de cobrarla mientras no exista deuda.

#### Scenario: Retención que completa el pago
- **DADO** una venta de 250.00 con pagos válidos de 245.00
- **CUANDO** se registra una retención vigente de 5.00
- **ENTONCES** SHALL mostrar dinero cobrado 245.00, retenido 5.00, saldo cero y estado pagado.

#### Scenario: Solo retención sobre una venta sin dinero
- **DADO** una venta a crédito de 100.00 sin pagos
- **CUANDO** se registra una retención de 2.00
- **ENTONCES** SHALL mostrar dinero cobrado 0.00, retenido 2.00, saldo 98.00 y estado parcial.

#### Scenario: Retención anulada
- **DADO** una venta de 250.00 con pagos de 245.00 y una retención de 5.00
- **CUANDO** el Administrador anula la retención
- **ENTONCES** SHALL mostrar saldo 5.00 y estado parcial, sin sumar la retención anulada.

#### Scenario: Exceso con retención tras una devolución
- **DADO** una venta con pagos válidos de 245.00 y retención vigente de 5.00
- **CUANDO** una devolución reduce el exigible a 0.00
- **ENTONCES** SHALL mostrar 245.00 por reembolsar y 5.00 de retención en exceso, sin ofrecer reembolsar 250.00.

## ADDED Requirements

### Requirement: Retenciones en la deuda y el historial comerciales

Las **cuentas por cobrar** comerciales y el detalle de cada venta SHALL mostrar el total retenido separado del dinero cobrado y SHALL calcular la deuda con el saldo que descuenta las retenciones vigentes. El historial SHALL identificar cada retención con importe, fecha, actor, vigencia, situación de su comprobante y, si fue anulada, el motivo. Las sumas SHALL corresponder a todas las coincidencias autorizadas. SHALL NOT mezclarse retenciones artesanales ni compensarse retenciones entre ventas. Trazabilidad: propuesta de retenciones D15; RF-PAG-005/006/009/010; DP-013.

#### Scenario: Venta cerrada con retención fuera de la deuda
- **DADO** una venta de 250.00 con dinero cobrado 245.00 y retención vigente 5.00
- **CUANDO** se consultan las cuentas por cobrar comerciales
- **ENTONCES** SHALL NOT aparecer como deuda; su detalle SHALL mostrar 245.00 cobrados y 5.00 retenidos por separado.

#### Scenario: Historial con retención anulada
- **DADO** una venta con una retención anulada y otra vigente
- **CUANDO** se abre su historial
- **ENTONCES** SHALL distinguirse ambas y su vigencia, sumando solo la vigente al total retenido.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
