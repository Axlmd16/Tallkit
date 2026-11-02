# Correcciones de ventas y reembolsos — delta de ventas vinculadas

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24 con P5; DP-014/015/028; RN-VEN-016; RN-TAL-013; CU-015/019; spec principal `correcciones-de-ventas-y-reembolsos`. Una venta vinculada a un mantenimiento corresponde a repuestos instalados en el vehículo. Anularla restituiría existencias ficticias, por lo que esta entrega la bloquea. Las devoluciones físicas del flujo existente no cambian.

## MODIFIED Requirements

### Requirement: Anulación total conservadora de una venta

Una **anulación** SHALL conservar la venta, sus líneas, número e historia, dejar exigible cero y compensar sus efectos como una acción atómica. SHALL admitirse únicamente para una venta directa confirmada sin devoluciones previas, sin anulación anterior y cuando cada salida siga siendo el último efecto de inventario de su producto y pueda restituirse exactamente cantidad y valoración previas sin negativos. Una venta vinculada a un mantenimiento SHALL NOT anularse: el intento SHALL bloquearse explicando que sus repuestos se consideran utilizados en el vehículo y que su corrección requiere un procedimiento de devolución o nota de crédito ajeno a la orden, sin ofrecer una acción que lo simule. Si existen movimientos posteriores, SHALL bloquearse explicando la dependencia; una devolución física real SHALL seguir su flujo propio y SHALL NOT inventarse para sortear el bloqueo. SHALL NOT completarse con pagos sin tratamiento trazable. Reabrir, finalizar o consultar una orden SHALL NOT anular sus ventas vinculadas. Trazabilidad: RF-VEN-011; RN-VEN-006/016; RN-INV-011/012; RN-TAL-013; CU-015; propuesta de ventas, recomendación 4; propuesta P5.

#### Scenario: Anular una venta sin cobros ni dependencias
- **DADO** una venta directa confirmada sin pagos ni devoluciones y cuyas salidas son los últimos efectos de sus productos
- **CUANDO** el Administrador confirma su anulación con motivo y revisión vigente
- **ENTONCES** SHALL quedar anulada, con exigible cero, cantidades y valoración previas restituidas mediante movimientos vinculados y número original conservado.

#### Scenario: Un producto tiene movimiento posterior
- **DADO** una venta de varios productos y un movimiento posterior en uno de ellos
- **CUANDO** se solicita anular la venta
- **ENTONCES** SHALL rechazarse toda la anulación identificando la dependencia, sin compensar los otros productos ni reescribir movimientos.

#### Scenario: Anulación después de devolución parcial
- **DADO** una venta que ya tiene devolución confirmada
- **CUANDO** se solicita anularla totalmente
- **ENTONCES** SHALL rechazarse y conservarse la venta con sus correcciones; cualquier devolución adicional SHALL limitarse a lo aún devolvible.

#### Scenario: Repetir una anulación completada
- **DADO** una venta ya anulada
- **CUANDO** se repite su anulación compatible
- **ENTONCES** SHALL devolverse el resultado existente sin otros movimientos, reembolsos o cambios de numeración.

#### Scenario: Anulación de una venta vinculada bloqueada
- **DADO** una venta vinculada confirmada, con o sin pagos, cuyas salidas son los últimos efectos de sus productos
- **CUANDO** el Administrador solicita anularla
- **ENTONCES** SHALL rechazarse explicando que sus repuestos se consideran utilizados, sin restituir inventario, modificar pagos ni cambiar la orden.
