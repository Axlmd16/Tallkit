# Pagos comerciales y crédito simple — delta de origen mantenimiento

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24; DP-013; RN-FIS-008/009; RF-PAG-009/010; UI-060…063/075; spec principal `pagos-comerciales-y-credito-simple`; nueva capacidad `pagos-artesanales-y-credito-simple`. Los cobros de ventas vinculadas siguen siendo cobros comerciales ordinarios. Este delta solo identifica su origen y reafirma la separación respecto de los cobros artesanales de la misma orden.

## MODIFIED Requirements

### Requirement: Consultas comerciales de deuda e historial

El sistema SHALL mostrar **cuentas por cobrar** comerciales por cliente, venta, origen (directo o mantenimiento, con el número de la orden), estado y antigüedad desde la fecha de confirmación en America/Guayaquil, con filtros, entre ellos el de origen, y paginación estable. Cada fila SHALL identificar el emisor comercial y el tipo de documento. Las sumas SHALL corresponder a todas las coincidencias autorizadas, no solo a la página visible. Los reembolsos pendientes SHALL distinguirse de deudas cobrables y SHALL NOT compensarse entre ventas. El historial SHALL identificar pagos vigentes y corregidos, medios, fecha, actor y relaciones; las acciones administrativas SHALL limitarse al Administrador. La consulta comercial SHALL NOT mezclar importes artesanales, compensar saldos entre RUC, ofrecer un pago que se reparta entre la venta vinculada y la operación artesanal de una misma orden, ni presentar antigüedad como mora, vencimiento o intereses. Trazabilidad: RF-PAG-005/006/009/010; RF-REP-006/008/010 en ámbito comercial; UI-060…063; DP-013/014.

#### Scenario: Consulta de varias ventas del mismo cliente
- **DADO** dos ventas comerciales con saldos 30.00 y 70.00 y una operación artesanal ajena a esta consulta
- **CUANDO** se filtra la deuda comercial del cliente
- **ENTONCES** SHALL mostrar ambas ventas y total comercial 100.00, excluyendo la operación artesanal y sin ofrecer un pago repartido automáticamente.

#### Scenario: Deuda de una venta vinculada
- **DADO** una venta vinculada a la orden `ART-OT-000020` con saldo 40.00 y una operación artesanal de la misma orden con saldo 60.00
- **CUANDO** un Vendedor filtra la deuda comercial por origen mantenimiento
- **ENTONCES** SHALL ver la venta con su orden de origen y saldo 40.00, sin la operación artesanal ni un total de 100.00.

#### Scenario: Historial conserva pagos corregidos
- **DADO** una venta con pago sustituido y vínculo al reemplazo
- **CUANDO** un usuario con permiso de consulta abre su historial
- **ENTONCES** SHALL distinguir los registros y su vigencia sin sumar ambos como cobros válidos; las acciones de corrección SHALL estar disponibles solo al Administrador.

#### Scenario: Exceso en una venta y deuda en otra
- **DADO** el mismo cliente con 20.00 por reembolsar en una venta y 40.00 por pagar en otra
- **CUANDO** se consulta su posición comercial
- **ENTONCES** SHALL mostrarse deuda 40.00 y reembolso pendiente 20.00 por separado, sin convertirlos en deuda neta 20.00 ni saldo a favor utilizable.

#### Scenario: Antigüedad sin mora
- **DADO** una venta a crédito pendiente confirmada diez fechas operativas antes de la fecha de consulta
- **CUANDO** se consulta su antigüedad
- **ENTONCES** SHALL mostrar diez días desde confirmación sin fecha de vencimiento, recargo ni etiqueta de morosidad.
