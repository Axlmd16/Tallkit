# ADR-0012: Proformas independientes y conversión comercial atómica

- Estado: Aceptada el 2026-10-06 junto al diseño de `gestionar-proformas-comerciales`, mediante aprobación del usuario «haz commit y continua». Implementada en el cambio `gestionar-proformas-comerciales` (módulo `proformas`, `sales.application.proforma_links` y `workshop_configuration.application.brand`).
- Fecha: 2026-10-06.

## Contexto

La **proforma** conserva una oferta emitida inmutable y se convierte una sola vez en venta editable. Debe conservar identidad visual histórica aunque el logo configurable se reemplace. Las ventas existentes son propietarias de cobros, saldos e inventario y no deben depender de consultas al documento de oferta para confirmarse.

## Decisión propuesta

Crear un módulo `proformas` propietario de ofertas y recibos. La conversión usa una **transacción atómica** exterior de proformas y una interfaz pública `sales.application.proforma_links` que crea solo persistencia de ventas sin otra unidad de idempotencia. El código depende de proformas hacia ventas; ventas conserva referencia única de integridad y copia inmutable de los valores cotizados, sin importar ni consultar modelos de proformas.

Orden: recibo → proforma → raíz comercial → cliente → productos → configuración → inserciones. Las lecturas de disponibilidad no reservan ni adquieren posiciones para escritura. Confirmar/corregir ventas no bloquea proformas. Emisión respeta ADR-0004 para impuestos y numeración. Estado convertida, vínculo y venta se publican o revierten juntos; la restricción única impide una segunda venta por oferta.

Guardar el logo normalizado del emisor como activo binario inmutable y deduplicado dentro de la persistencia de proformas, en la transacción de emisión. Su lectura procede de un contrato público de configuración, con verificación de versión/hash y límites existentes. Se sirve únicamente con autorización sobre la oferta. El archivo reemplazable de configuración no es referencia histórica suficiente.

## Alternativas

- Reutilizar venta como oferta: menor número de entidades, pero mezcla estados y consumidores de deuda/stock.
- Coordinación por HTTP o transacciones separadas: permite conversiones parciales y exige compensaciones innecesarias.
- Dependencias de código bidireccionales: evita copiar valores, pero acopla confirmación y bloqueos al módulo de ofertas.
- Referenciar el logo actual o su archivo: no conserva historia después de sustitución/purga.
- Versionar todo el almacenamiento gráfico de configuración: amplía la capacidad fuera del alcance; los bytes limitados y deduplicados resuelven la necesidad actual.

## Consecuencias

Se preservan fronteras, historia y conversión única con PostgreSQL, sin nuevas dependencias. A cambio, se duplica deliberadamente la referencia económica cotizada en la venta y se almacenan bytes históricos de marca. Se requieren pruebas de restricciones, concurrencia, rollback, respaldo e importaciones permitidas. El estado efectivo de vencimiento se calcula con fecha local, sin tarea programada.

Complementa ADR-0004/0006/0008/0009; no modifica reservas de mantenimiento ni introduce documentos económicos comunes entre RUC. La identidad de marca que se compara bajo bloqueo usa la revisión y la huella de la carga del logotipo registradas en configuración; el hash del activo emitido se calcula sobre los bytes normalizados realmente leídos.

## Referencias

- [Diseño propuesto](../../openspec/changes/archive/2026-10-06-gestionar-proformas-comerciales/design.md).
- [ADR-0004](0004-contrato-transaccional-configuracion-y-numeracion.md).
- [ADR-0006](0006-coordinacion-transaccional-ventas-comerciales.md).
- [ADR-0009](0009-reservas-inventario-y-ventas-vinculadas.md).
- [Referencia terminológica](0012-proformas-y-conversion-comercial-atomica-glossary-reference.md).
