# Diseño: venta vinculada vacía y textos del comprobante de servicios

Estado: **diseño aprobado para crear tareas**; el usuario respondió «haz commit y continua». Fecha: 2026-09-24, America/Guayaquil. Se basa en la propuesta aprobada con A1 (`344c903`) y en las specs registradas en `master` (`3bf551f`). No aprueba tareas ni implementación.

## Context

Inspección del código realizada el 2026-09-24:

- `sales/application/workshop_links.py::remove_linked_line` libera la reserva con `inventory.application.reservations.release`, elimina la `SaleLine` e incrementa `sale.version`, pero conserva la `Sale` en `DRAFT` aunque quede sin líneas.
- `workshop/application/parts.py::remove_part` bloquea la orden, luego la venta abierta (`lock_open_linked_sale`) y delega en `remove_linked_line` dentro de `execute_write` (recibo `WorkshopCommand`, auditoría `maintenance.part_remove`).
- Los triggers de `sales.0002_history_protection` **permiten** borrar una venta y sus líneas solo en `DRAFT`, y bloquean el borrado de ventas confirmadas o anuladas. La base ya respalda la regla.
- Referencias a la venta sin FK: `SalesCommand.result_id` (recibos de ventas), `InventoryReservation.source_reference` (JSON, reservas ya liberadas) y los eventos de auditoría (`target_id` en texto). Un borrador vinculado no tiene FK entrantes más allá de sus líneas: no tiene número, costos, pagos ni operaciones de inventario.
- `record_audit_event` filtra los metadatos con una lista blanca en `identity`; el motivo (`reason`) es texto libre.
- Textos por cambiar: `frontend/src/features/maintenance/EconomicSummary.tsx`, `BillingDialogs.tsx` y `ServiceLines.tsx`, sus pruebas (`billing.test.tsx`, `components.test.tsx`) y `frontend/e2e/maintenance-billing.spec.ts`.

## Goals / Non-Goals

**Goals:** eliminar en la misma transacción el borrador vinculado que queda vacío; ofrecer un comando explícito para limpiar los que ya existan; aclarar los textos del comprobante de servicios.

**Non-Goals:** cambios en ventas directas, en la API pública, en los códigos internos (`document_services`, `nothing_to_document`), en los modelos o en las migraciones; logotipos por RUC (cambio posterior `logotipos-por-ruc-en-comprobantes`).

## Decisions

### D1. Eliminación dentro de `remove_linked_line`

Después de liberar la reserva y borrar la línea, si la venta no conserva líneas, `remove_linked_line`:
1. la elimina (`sale.delete()`, permitido por el trigger porque está en `DRAFT`);
2. registra el evento de auditoría `sales.linked_draft_discarded`: `target_type="sale"`, `target_id` con el id de la venta, resultado de éxito y motivo con el número de la orden (por ejemplo «Borrador vinculado vacío de ART-OT-000001»).

El motivo lleva la orden porque la lista blanca de metadatos de `identity` no admite claves nuevas y este cambio no la amplía. Todo ocurre en la transacción de `remove_part`, bajo el bloqueo de la orden y de la venta (orden global D7 del cambio de integración). La función devuelve si eliminó la venta, para que el taller pueda informarlo; la respuesta HTTP sigue siendo el detalle de la orden.

Alternativa descartada: eliminar el borrador desde `workshop`. `workshop` no escribe modelos de `sales` (ADR-0001).

### D2. Idempotencia y concurrencia

- **Reintento con la misma clave:** el recibo `WorkshopCommand` devuelve la proyección actual de la orden sin volver a ejecutar; no hay error aunque la venta ya no exista.
- **Retirar frente a confirmar:** ambas acciones bloquean la venta. Si retirar gana, `confirm_sale` encuentra la venta inexistente y responde `not_found`; si confirmar gana, retirar recibe `stale_record` o el error de venta confirmada.
- **Agregar frente a retirar la última línea:** las dos acciones bloquean la orden, así que quedan serializadas. Si la venta ya se eliminó, agregar crea un borrador nuevo; el índice único parcial de un borrador por orden sigue respaldando la regla.

### D3. Comando `purge_empty_linked_drafts`

Se crea `sales/management/commands/purge_empty_linked_drafts.py`, con la lógica en `sales/application/workshop_links.py::purge_empty_linked_drafts(confirm: bool)`:

- Selecciona ventas con `origin_type=MAINTENANCE`, `state=DRAFT`, sin líneas.
- Por omisión solo lista cada venta con su orden.
- Con `--confirm` las elimina una por una, en una transacción con bloqueo de fila y revalidando que sigan vacías, y audita cada eliminación con actor nulo (sistema) y el mismo tipo de evento.
- Repetirlo no tiene efectos.
- No se ejecuta en migraciones.

### D4. Textos de la interfaz

| Lugar | Hoy | Nuevo |
|---|---|---|
| Botón del resumen | «Documentar servicios» | «Generar comprobante de servicios» |
| Título del diálogo | «Documentar servicios» | «Generar comprobante de servicios» |
| Botón de confirmar | «Confirmar operación de servicios» | «Generar comprobante» |
| Etiqueta de línea sin comprobante | «Pendiente de documentar» | «Sin comprobante» |
| Etiqueta de línea con comprobante | «Documentado en ART-SER-…» | «En comprobante ART-SER-…» |
| Bloqueo de la línea | «Bloqueada: pertenece a una operación confirmada» | «Bloqueada: incluida en un comprobante» |
| Aviso pendiente del resumen (servidor) | «Pendiente de documentar: todavía no genera deuda.» | «Sin comprobante: todavía no genera deuda.» |
| Notificación de éxito | «Servicios documentados en …» | «Comprobante de servicios … generado» |

El diálogo añade la frase «Comprobante interno: no es una factura electrónica autorizada por el SRI.». El único texto del servidor que cambia es la etiqueta del resumen económico (`workshop/application/economic_summary.py`); los códigos, campos y la API se mantienen.

## Risks / Trade-offs

- **[Un recibo de ventas apunta a un borrador eliminado]** → Reintentar una edición antigua de ese borrador responde `not_found`, que es el resultado correcto. Se cubre con una prueba de reintento.
- **[El Vendedor tiene abierto el borrador en el editor cuando se vacía]** → Al guardar o confirmar recibe `not_found` y la interfaz muestra el estado de error existente; no se pierde información relevante.
- **[Hay pruebas que esperaban la venta vacía]** → Se actualizan con el nuevo comportamiento (`tests/sales/test_workshop_links.py`, `tests/workshop/test_parts.py`).

## Migration Plan

Sin migraciones. Tras el despliegue, se ejecuta `python manage.py purge_empty_linked_drafts` para revisar y luego `--confirm` para limpiar. En la base de desarrollo existe un borrador vacío de la prueba del usuario.

**Rollback:** revertir el código; los borradores ya eliminados no se recuperan, y no hace falta porque no tenían contenido.

## Estrategia de pruebas

- **`tests/sales/test_workshop_links.py`:** retirar la última línea elimina la venta y audita el evento; retirar una de dos líneas conserva la venta; agregar después crea otro borrador.
- **`tests/workshop/test_parts.py`:** flujo por la orden; reintento con la misma clave sin error.
- **`tests/sales/test_purge_empty_linked_drafts.py`:** informe por omisión sin cambios; `--confirm` elimina solo los vacíos vinculados (no borradores directos, vinculados con líneas ni confirmados); segunda ejecución sin efectos.
- **`tests/workshop/test_integration_concurrency.py`:** retirar la última línea frente a confirmar la venta.
- **Frontend:** actualizar las aserciones de textos en `billing.test.tsx` y `components.test.tsx`; E2E solo `maintenance-billing.spec.ts`.
- Solo se ejecutan las pruebas afectadas, conforme a la preferencia del usuario.

## Open Questions

Ninguna.

Referencia terminológica: [design-glossary-reference.md](design-glossary-reference.md).
