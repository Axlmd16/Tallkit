# ADR-0008: Documentos económicos artesanales separados y núcleo monetario compartido

- Estado: Aceptada el 2026-09-24 al aplicar el cambio `integrar-mantenimiento-ventas-cobros-por-ruc`; el diseño y este ADR fueron aprobados por el usuario el 2026-09-24.
- Fecha: 2026-09-24

## Contexto

DM-001 dejó abierta la estructura técnica común o separada de los documentos económicos. Las ventas (`sales`) están acopladas a productos, bodega, Kardex y costo, y ADR-0006 descartó un motor genérico de documentos y pagos para ambos RUC. La octava funcionalidad necesita un documento de servicios del RUC artesanal (ART-SER) con cobros, saldos y crédito equivalentes a los comerciales, sin mezclar emisores (RN-FIS-005/006/008).

## Decisión

Para V1, cada RUC mantiene estructuras propias. La **operación artesanal de servicios** y sus pagos pertenecen al módulo `workshop`, separados de `Sale` y de los pagos comerciales. Las reglas monetarias puras, sin Django (parseo de importes, desglose inclusivo por línea con HALF_UP, totales, condición, medios, estado de pago, saldo y validación de cobro), se trasladan sin cambios a `shared/money.py`. `sales` las reexporta con los mismos nombres y `workshop` las consume. Así se cierra DM-001 para V1.

## Alternativas consideradas

- Estructura común de documentos y pagos para ambos RUC: obligaría a rehacer ventas, pagos y correcciones ya verificados y facilitaría mezclar emisores en una tabla.
- Forzar servicios como líneas de `Sale`: contradice RN-FIS-006 y las acoplaría a inventario.
- Duplicar las reglas monetarias en `workshop`: dos implementaciones que pueden divergir.

## Consecuencias

Los documentos, numeración, pagos y cuentas por cobrar quedan físicamente separados por RUC. Los cálculos de importes y saldos son idénticos en ambos. Cambiar una regla monetaria afecta a los dos ámbitos a la vez, lo que se considera deseable. Una futura referencia fiscal podrá apuntar a `Sale` o a `ServiceOperation` sin un documento común.

## Referencias

- [Diseño del cambio](../../openspec/changes/archive/2026-09-24-integrar-mantenimiento-ventas-cobros-por-ruc/design.md) (D1, D5, D6).
- [ADR-0006](0006-coordinacion-transaccional-ventas-comerciales.md).
- [Referencia terminológica](0008-documentos-artesanales-separados-y-nucleo-monetario-glossary-reference.md).
