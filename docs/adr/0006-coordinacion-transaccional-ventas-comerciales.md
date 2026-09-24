# ADR-0006: Coordinación transaccional de ventas comerciales

- Estado: Aceptada el 2026-09-21 al aplicar el cambio `gestionar-ventas-pagos-credito-simple`; el diseño y este ADR fueron aprobados por el usuario el 2026-09-20.
- Fecha: 2026-09-21

## Contexto

Ventas debe coordinar inventario, numeración, cobros y correcciones sin efectos parciales. La devolución física puede ocurrir después de otros movimientos, mientras la reversión exacta vigente solo admite el último efecto. El dinero realmente entregado no puede deshacerse mediante rollback de la base de datos.

## Decisión

Crear `sales` como propietario de ventas y hechos monetarios comerciales, con servicios internos separados para cobros y correcciones. Toda modificación del exigible, dinero o cantidad devuelta se serializa sobre la venta y participa en una única **transacción atómica** exterior. Inventario y configuración conservan sus escrituras detrás de interfaces públicas. El orden común es recibo → venta/hechos propios → operación original de inventario → cliente/productos → posiciones → configuración/numeración → publicaciones.

Distinguir identidad UUID estable del hecho de la clave de transporte para conservar **idempotencia** ante reintentos y respuestas perdidas. Cobros y reembolsos registran dinero efectivo declarado; no ejecutan transferencias bancarias. La interfaz recupera resultados por identidad y no solicita repetir un desembolso físico por un fallo de registro.

La devolución apta produce una entrada nueva a valor histórico asignado de la salida, con residuos conservados. No usa la reversión exacta ni modifica historia posterior. La anulación de venta conserva su regla de último movimiento y resuelve dinero junto a sus demás efectos. El módulo comercial no decide una estructura universal de documentos o cobros artesanales; DM-001 conserva ese alcance futuro abierto.

## Alternativas consideradas

- Transacciones separadas por módulo: permiten número, movimiento o pago huérfanos.
- Motor genérico para documentos y pagos de ambos RUC: anticipa contratos fuera del cambio aprobado.
- Reversión exacta para toda devolución: impediría devoluciones válidas con movimientos posteriores.
- Saldo editable y deduplicación solo por importe: pierden trazabilidad y confunden dos cobros legítimos iguales.

## Consecuencias

La raíz comercial permite validar saldos y cantidades conjuntamente y reutiliza inventario sin escribir sus modelos. A cambio, las acciones sobre una misma venta se serializan, hay que conservar asignaciones históricas y recibos, y se requieren pruebas de concurrencia y reconciliación. El sistema distingue coherencia del registro de dinero y movimiento físico del dinero; no promete atomicidad con el efectivo.

Complementa ADR-0001, ADR-0004 y ADR-0005, sin reemplazarlos. Implementación verificada por las pruebas del cambio: `backend/tests/sales/test_concurrency.py`, `test_confirm.py`, `test_void.py` y `test_reconcile.py`.

## Referencias

- [Diseño aprobado](../../openspec/changes/archive/2026-09-24-gestionar-ventas-pagos-credito-simple/design.md).
- [ADR-0004](0004-contrato-transaccional-configuracion-y-numeracion.md).
- [ADR-0005](0005-publicacion-transaccional-inventario.md).
- [Referencia terminológica](0006-coordinacion-transaccional-ventas-comerciales-glossary-reference.md).
