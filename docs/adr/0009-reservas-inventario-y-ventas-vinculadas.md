# ADR-0009: Reservas de inventario y coordinación con ventas vinculadas

- Estado: Aceptada el 2026-09-24 al aplicar el cambio `integrar-mantenimiento-ventas-cobros-por-ruc`; el diseño y este ADR fueron aprobados por el usuario el 2026-09-24.
- Fecha: 2026-09-24

## Contexto

DP-012 establece que solo la venta abierta vinculada a un mantenimiento reserva existencias, y que la reserva reduce la disponibilidad sin generar Kardex. La publicación de inventario (ADR-0005) valida solo la existencia, y varias operaciones (ventas directas, ajustes, correcciones, anulación de ingresos) producen salidas sin conocer reservas. El modelo de dominio señaló esta coordinación como candidata a ADR.

## Decisión

- `InventoryPosition` mantiene el agregado `reserved`, protegido por el check de base de datos `0 ≤ reserved ≤ quantity`. `InventoryReservation` registra cada reserva por línea de venta vinculada, con estado activa, liberada o consumida.
- Reservar, redimensionar y liberar solo es posible sobre posiciones bloqueadas. `post_operation` valida toda salida contra la disponibilidad y consume, en la misma transacción, las reservas propias de la venta vinculada que se confirma.
- Orden global de bloqueos: recibo → orden de mantenimiento → operación artesanal/líneas de servicio → venta → cliente/vehículo → productos → posiciones → configuración → numeración → inserciones.
- Dependencias de código: `workshop → sales → inventory`; `sales` referencia la orden solo mediante una FK de integridad.

## Alternativas consideradas

- Calcular la disponibilidad a partir de las líneas de venta: obliga a inventario a leer ventas y no ofrece una garantía en base de datos.
- Validar la disponibilidad en cada llamador: frágil ante nuevas salidas.
- Reservar mediante movimientos de Kardex: contradice DP-012.

## Consecuencias

Ninguna salida puede consumir unidades reservadas, aunque un llamador omita la validación. Confirmar una venta vinculada descuenta exactamente una vez y libera su reserva de forma atómica. Añade un campo caliente en la posición, ya serializada por su bloqueo, y exige conciliar reservas con líneas abiertas.

## Referencias

- [Diseño del cambio](../../openspec/changes/archive/2026-09-24-integrar-mantenimiento-ventas-cobros-por-ruc/design.md) (D2, D3, D4, D7).
- [ADR-0005](0005-publicacion-transaccional-inventario.md), [ADR-0006](0006-coordinacion-transaccional-ventas-comerciales.md).
