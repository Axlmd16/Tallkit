# ADR-0011: Valoración de inventario con costo ausente

- Estado: Aceptada el 2026-10-04 al aplicar el cambio `simplificar-entradas-de-stock-por-vendedor`; el diseño fue aprobado por el usuario el 2026-10-04.
- Fecha: 2026-10-04

## Contexto

DP-030 permite registrar una entrada de stock sin costo. Hasta ahora toda entrada aportaba un valor y la posición de inventario solo conocía el estado «con valor» (ADR-0005). Un costo ausente no puede tratarse como cero: abarataría el promedio de las unidades que sí tienen costo y haría pasar por conocido un dato que no lo es. Además deben seguir cumpliéndose la inmutabilidad de los movimientos, la reversión exacta y la conciliación contra el Kardex.

## Decisión

- La posición de inventario distingue **valorada** de **sin costo registrado** (`InventoryPosition.valued`). Sin costo registrado significa existencia positiva con valor y promedio cero sin significado económico. Una posición vacía siempre está valorada. Una restricción de base de datos impide que una posición sin costo tenga valor o carezca de existencia.
- Reglas de entrada, puras y sin Django en `inventory.domain.valuation.receive_entry`:
  - Con costo sobre una posición valorada: promedio ponderado habitual.
  - Con costo sobre una posición sin costo: las unidades previas se valoran al costo unitario de la entrada; el importe asignado es la **regularización** y queda en el movimiento.
  - Sin costo sobre una posición valorada con existencia: suma `cantidad × promedio vigente` y conserva el promedio y los residuos.
  - Sin costo sobre una posición vacía: usa el **último promedio conocido**; si no existe, la posición queda sin costo registrado.
  - Sin costo sobre una posición sin costo: sigue sin costo.
- El último promedio conocido **no se almacena**: se deriva del movimiento vigente más reciente con promedio positivo, ignorando las compensaciones y los movimientos que compensaron. Como la reversión solo procede sobre el último movimiento, la historia vigente se comporta como una pila y el valor derivado es exacto también tras anular.
- Las salidas desde una posición sin costo no tienen valor (cero) y dejan el movimiento marcado; al agotarse, la posición vuelve a vacía.
- Cada movimiento conserva `cost_known`, `valued_before`, `valued_after` y `regularization_value`. Son columnas aditivas con valores por defecto: no se reescribe historia protegida por triggers y las restricciones `>= 0` se mantienen. `cost_known` es verdadero cuando el costo aplicado es real: en una entrada, si la posición queda valorada; en una salida, si lo estaba.
- La reversión exacta compara y restituye también `valued`. La conciliación reproduce las reglas anteriores y señala cualquier cadena que no cuadre.
- Las ventas conservan `SaleCostAllocation.cost_known`. Una devolución cuya salida original no tenía costo reingresa como entrada sin costo. El margen de una línea con costo ausente no es calculable.
- Las lecturas con valoración informan el costo ausente como `null` y un indicador explícito; el valor total del inventario excluye los productos sin costo e informa cuántos son. Nada de esto se envía a quien no posee `inventario.ver_valorizacion`.

## Alternativas descartadas

- Valorar la entrada sin costo en cero: abarata el promedio y presenta como conocido lo que no lo es.
- Valorarla al precio de venta: mezcla magnitudes distintas.
- Guardar el último promedio conocido en la posición: exigiría conservar su valor previo en cada movimiento para restituirlo al revertir.
- Permitir completar el costo después: reescribe historia y obliga a revalorar salidas ya vendidas.
- Un campo nulo en lugar de banderas: invalidaría las restricciones y las filas existentes.

## Consecuencias

La existencia nunca queda con un valor inventado y el margen se declara no calculable en lugar de falso. A cambio, la posición y los movimientos cargan tres banderas más, la regularización asigna a unidades antiguas un costo que pudo no ser el suyo (queda trazada y visible al Administrador) y el valor total del inventario puede ser parcial. Complementa a ADR-0005 sin reemplazarlo.
