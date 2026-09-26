# Repuestos del mantenimiento: borrador vinculado vacío

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24 con A1; DP-012/021; RN-CON-007; spec principal `repuestos-del-mantenimiento`. Cuando se retira el último repuesto, el borrador vinculado queda vacío: nunca tuvo número, deuda, reservas vigentes ni movimientos. Se elimina en la misma acción, para que no aparezca como venta pendiente ni pueda intentarse su confirmación.

## MODIFIED Requirements

### Requirement: Modificar y retirar líneas pendientes

Mientras la venta vinculada siga abierta y la orden esté `registrada`, un usuario con `mantenimientos.gestionar_repuestos` SHALL poder cambiar la cantidad de una línea o retirarla. Aumentar la cantidad SHALL validar la disponibilidad adicional; disminuirla o retirar la línea SHALL liberar exactamente la reserva correspondiente. Cada modificación SHALL exigir la versión vigente de la venta vinculada y SHALL rechazarse como conflicto si otra acción la cambió, la confirmó o si la orden se finalizó. Las líneas de una venta ya confirmada o anulada SHALL NOT modificarse ni retirarse. Retirar la última línea SHALL eliminar el borrador vinculado vacío en la misma acción atómica, junto con la liberación de su reserva. Esa eliminación SHALL auditarse con la venta y la orden afectadas, y SHALL NOT generar un documento vacío confirmado. Agregar un repuesto después SHALL crear un borrador vinculado nuevo. Cada cambio SHALL auditarse. Trazabilidad: RF-TAL-010; CU-018 5; CU-019 3; DP-021; propuesta A1.

#### Scenario: Retirar un repuesto no utilizado
- **DADO** una venta vinculada abierta con dos líneas, una de ellas de 4 «Bujía» con reserva 4
- **CUANDO** un Encargado del taller retira la línea de «Bujía»
- **ENTONCES** la línea SHALL dejar de existir, la reserva del producto SHALL disminuir en 4, la venta SHALL seguir abierta con la otra línea y SHALL NOT producirse movimiento de Kardex.

#### Scenario: Retirar el último repuesto elimina el borrador vacío
- **DADO** una orden registrada cuya venta vinculada abierta tiene una sola línea de 2 «Filtro» con reserva 2
- **CUANDO** un Encargado del taller retira esa línea
- **ENTONCES** la reserva SHALL liberarse, la venta vinculada en borrador SHALL dejar de existir y SHALL NOT aparecer en la lista de ventas, la orden SHALL quedar sin repuestos pendientes y la auditoría SHALL registrar la eliminación con la venta y la orden.

#### Scenario: Nuevo repuesto después de vaciar la venta
- **DADO** una orden cuyo borrador vinculado se eliminó al retirar su último repuesto
- **CUANDO** se agrega otro repuesto
- **ENTONCES** SHALL crearse un nuevo borrador vinculado con esa línea y su reserva.

#### Scenario: Reintento de retirar el último repuesto
- **DADO** una solicitud para retirar la última línea que ya se procesó y eliminó el borrador
- **CUANDO** llega otra vez con la misma identidad de intento
- **ENTONCES** SHALL devolverse el resultado existente sin error ni efectos adicionales.

#### Scenario: Aumentar la cantidad sin disponibilidad
- **DADO** una línea de 2 unidades y una disponibilidad restante de 1 para ese producto
- **CUANDO** se cambia la cantidad a 4
- **ENTONCES** el sistema SHALL rechazarlo indicando la disponibilidad, y la línea y la reserva SHALL permanecer en 2.

#### Scenario: Modificar una línea ya confirmada
- **DADO** una línea de una venta vinculada confirmada
- **CUANDO** se intenta cambiar su cantidad o retirarla desde la orden
- **ENTONCES** el sistema SHALL rechazarlo explicando que la venta está confirmada y que una corrección no forma parte de la orden.

#### Scenario: Edición concurrente con la confirmación
- **DADO** un Vendedor que confirma la venta vinculada mientras un Encargado retira o cambia una de sus líneas
- **CUANDO** ambas solicitudes se procesan
- **ENTONCES** SHALL aplicarse una sola en un orden coherente: si la confirmación se aplica primero, el cambio SHALL rechazarse; si el cambio se aplica primero, la confirmación con la revisión anterior SHALL exigir una nueva revisión o informar que la venta ya no existe. En ningún caso SHALL confirmarse una cantidad distinta de la revisada ni una venta eliminada.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
