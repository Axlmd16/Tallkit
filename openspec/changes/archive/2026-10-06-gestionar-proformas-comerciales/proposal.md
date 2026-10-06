## Why

El local ya registra ventas, pero no dispone de una **proforma** para comunicar cuánto costarían los repuestos antes de que el cliente decida comprarlos. Este cambio permite preparar y entregar una cotización trazable con los precios del local y convertirla en una venta sin volver a capturar sus líneas.

## What Changes

Incorporar creación, consulta, edición de borradores, emisión, vencimiento, anulación y copia vinculada de proformas de productos del **RUC comercial**, para Administrador y Vendedor. La oferta no reserva ni descuenta inventario, no crea deuda y no recibe pagos. Exige cliente registrado y presentaciones completas; no incluye descuentos.

### Decisiones confirmadas en la entrevista

| ID | Comportamiento acordado |
|---|---|
| D1 | Usar exclusivamente el **precio final de catálogo**, sin edición manual. Conservar lo cotizado al emitir y mostrar diferencias de precios e impuestos al convertir a venta. |
| D2 | Sugerir 7 días de vigencia, con fecha ajustable antes de emitir. Una proforma vencida conserva su historia y no se reactiva: puede originar una nueva vinculada con valores actuales. |
| D3 | Editar libremente el borrador. Una vez emitida, conservar el contenido intacto; los cambios solicitados por el cliente originan una nueva proforma vinculada. La inmutabilidad del contenido no impide las transiciones autorizadas de estado. |
| D4 | Permitir cotizar productos del catálogo aunque su disponibilidad sea insuficiente. Mostrar disponibilidad informativa y aviso en la cotización; confirmar la venta sigue exigiendo stock suficiente. |
| D5 | Ofrecer vista A4 para imprimir o guardar como PDF desde el navegador, con datos y logotipo del local cuando exista, cliente, número, vigencia, repuestos, cantidades, precios y totales. |
| D6 | Convertir una proforma válida una sola vez en una **venta de repuestos** en borrador. Permitir ajustar productos y cantidades antes de confirmar, conservando la oferta original y el vínculo con esa única venta. |

### Alcance y recomendaciones para aprobación

- Listado y detalle con búsqueda, estado, vigencia y navegación entre oferta original, nuevas ofertas vinculadas y venta generada. No se reutiliza el número de una oferta anterior.
- Emitir con la serie comercial de proformas, inicialmente `COM-PRO`, y numeración transaccional conforme a DP-006. El borrador no consume número. Conservar los datos mostrados al emitir, incluidos emisor, cliente, productos, importes y disponibilidad de ese momento; distinguir esta última de la consulta actual.
- Recomendar que la fecha sugerida sea fecha de emisión más 7 días y que la vigencia incluya todo el día indicado en America/Guayaquil. Antes de emitir, revisar la fecha y los valores vigentes; no emitir una oferta ya vencida.
- Recomendar que solo una proforma emitida vigente y no convertida pueda convertirse; una anulada o vencida puede servir de origen a una nueva oferta, sin reactivarse. Anular no borra contenido ni número. Una convertida conserva su estado y vínculo aunque se corrija posteriormente la venta.
- Copiar cliente y líneas al borrador de venta, recalcular con catálogo e impuestos actuales y mostrar diferencias. Las modificaciones de líneas no reescriben la proforma ni permiten convertirla otra vez. Confirmación, condición contado/crédito y cobro siguen las reglas existentes de ventas.
- Presentar el impreso como cotización informativa, sin reserva ni garantía de disponibilidad o precio al comprar; aclarar que la venta revalida valores. No presentarlo como factura electrónica.
- Proteger emisión y conversión ante concurrencia, doble clic y reintentos, sin números ni ventas duplicadas. Mantener autorización en servidor y trazabilidad de acciones y vínculos.

### Fuera de alcance

Proformas de servicios o presupuestos de mantenimiento; mezcla de RUC; precios negociados, descuentos o precios garantizados hasta el vencimiento; reservas de inventario; anticipos; conversiones parciales a varias ventas; envío automático por correo o WhatsApp; generación de PDF en servidor; firma o emisión fiscal; cambios a cobros, retenciones o correcciones de ventas.

## Capabilities

### New Capabilities

- `proformas-comerciales`: ciclo de oferta comercial, precios de catálogo, vigencia, contenido emitido inmutable, disponibilidad informativa, nuevas ofertas vinculadas, numeración, impresión y conversión única.

### Modified Capabilities

- `ventas-comerciales`: admitir origen proforma, conservar y mostrar su referencia, recibir el borrador editable generado y presentar diferencias respecto de lo cotizado antes de confirmar con las reglas comerciales vigentes.

## Impact

**Usuarios y operación.** Administrador y Vendedor usan los permisos documentados `proformas.ver`, `proformas.gestionar`, `proformas.anular` y `proformas.convertir`. No se amplían los permisos del Encargado del taller sin rol comercial. Se reduce la recaptura de datos y se conserva evidencia de lo entregado al cliente.

**Reutilización.** Clientes, catálogo, disponibilidad, configuración comercial, numeración, autorización, auditoría y flujo de venta existentes. La inspección de `backend/src/sales/domain/draft_input.py` y `application/calculation.py` confirma que ventas ya obtiene precios e impuestos del servidor; no recibe precios manuales.

**Modificación.** La capacidad de ventas y sus consultas deben reconocer un nuevo origen: hoy `sales/models.py` limita el origen a directo o mantenimiento. Frontend incorpora listado, editor, detalle e impresión de proformas y navegación a ventas. API y datos deberán conservar oferta, historia y vínculos, sin modificar ventas históricas; el diseño posterior definirá contratos, persistencia y migración. No se sustituye el flujo actual ni se añaden dependencias en esta fase.

**Dependencias y riesgos.** Requiere clientes y productos válidos, configuración comercial y serie aplicable. Los riesgos principales son confundir vigencia con precio garantizado, confundir disponibilidad histórica con stock actual, sobrescribir una oferta emitida y duplicar la conversión. Se atenderán mediante textos explícitos, historia conservada y criterios de atomicidad, idempotencia y concurrencia. Se preservan las fronteras modulares y los contratos de ADR-0004 y ADR-0006.

### Fuentes consultadas y trazabilidad

- `docs/negocio/decisiones/decisiones-confirmadas.yaml`, leído completo: DP-004/006/008/009/012/017/018/025/026 y CT-001.
- `docs/arquitectura/modelo-dominio.md`, leído completo, y `openspec/specs/modelo-dominio-taller/spec.md`: oferta sin efectos definitivos, estados y conversión única.
- Secciones aplicables de `docs/negocio/producto/alcance-v1.md`, `reglas-negocio.md` y `glosario.md`: RN-PRO-001…008, RN-INV-009, RN-VEN-017 y RN-FIS-008/010.
- `docs/negocio/requisitos/requisitos-funcionales.md`, `actores-y-roles.md`, `casos-de-uso.md`, `interfaz-y-navegacion.md` y `matriz-trazabilidad.md`: RF-PRO-001…011, RF-VEN-002/005/014, CU-010/011 y UI-050…052.
- `openspec/specs/ventas-comerciales/spec.md` y secciones de numeración de `openspec/specs/configuracion-operativa-y-fiscal/spec.md`; arquitectura técnica inicial y ADR-0004/0006.
- Entrevista `grill-me` de este cambio: aceptación expresa de D1…D6. No equivale todavía a aprobar este documento completo.

### Contradicciones, pendientes e información insuficiente

- CU-010 y UI-051 permiten interpretar captura libre de precios; D1 concreta que proceden del catálogo. UI-050…052 y la tabla de estados de interfaz permiten editar una vigente; D3 limita la edición al borrador. Las specs y la documentación afectada deberán sincronizarse con estas decisiones.
- El modelo cita RN-PRO-001…009, pero el catálogo consultado contiene RN-PRO-001…008. Corregir la referencia al sincronizar; no inventar RN-PRO-009.
- Algunas descripciones de estado afirman que el dominio no está implementado; ventas ya existe. La spec conceptual también conserva reglas anteriores a DP-030/032 para ingresos y saldos. Se registran como brechas ajenas al alcance, sin usarlas para redefinir proformas ni ampliar este cambio.
- Las recomendaciones de alcance anteriores se someten a aprobación con esta propuesta. No quedan preguntas bloqueantes para redactarla; los detalles técnicos corresponden al diseño posterior. No se resuelven tarifas reales ni obligaciones tributarias externas.

Estado: propuesta aprobada por el usuario el 2026-10-06 mediante «gestionar-proformas-comerciales, haz commit y continua», después de su presentación para revisión. La aprobación comprende D1…D6 y las recomendaciones de alcance. Se autoriza registrar esta propuesta en `master` y continuar con specs; no autoriza implementación ni adelantar design o tasks.

Ajuste posterior (2026-10-06, durante la aplicación, a pedido del usuario): el impreso es el documento que recibe el cliente. Muestra el código del producto, el código del fabricante y la marca, y no muestra disponibilidad, avisos de insuficiencia, la leyenda de cotización interna ni la mención del sistema. Esto concreta D4 y D5 y el punto de alcance sobre el texto del impreso; la disponibilidad sigue visible en las pantallas internas.

Segundo ajuste (2026-10-06, a pedido del usuario): el cliente es opcional en la proforma, porque se cotiza también a personas no registradas; al convertir, la venta exige un cliente registrado, que se elige en ese momento si la oferta no lo tiene. La ficha de la proforma muestra las mismas columnas que el impreso. Esto modifica la frase «Exige cliente registrado» de «What Changes».

Referencia terminológica: [proposal-glossary-reference.md](proposal-glossary-reference.md).
