# Diseño: integración de mantenimiento, repuestos, ventas y cobros por RUC

Estado: **diseño aprobado para crear tareas**. El usuario respondió «haz commit y continua» a la solicitud expresa de aprobar el diseño y los ADR-0008/0009 como propuesta. Fecha: 2026-09-24, America/Guayaquil. Se basa en la propuesta aprobada (P0…P7) y en las diez specs aprobadas, registradas en `master` (`90cdb56`). No aprueba tareas ni implementación.

## Context

La propuesta y las specs piden tres flujos separados sobre una misma orden: repuestos como venta comercial vinculada con reserva, servicios como operación artesanal ART-SER y cobros separados por RUC. Este diseño los concreta sobre el código real, inspeccionado el 2026-09-24:

- **`inventory`**: `InventoryPosition` (cantidad, valor, promedio, versión y ordinal, con checks de cantidad entera y no negativa). `posting.lock_positions` bloquea las posiciones ordenadas por producto; `posting.post_operation` valora todo antes de insertar, y `apply_exit` lanza `InsufficientStockError` si la salida supera la **existencia**. No existe ningún concepto de reserva. Llaman a `post_operation` o `reverse_operation` compras (confirmación y anulación de ingresos), ventas (confirmación, devolución y anulación) y las operaciones administrativas de inventario (carga inicial, ajustes y sus correcciones).
- **`sales`**: `Sale` (cliente, entidad, bodega, condición, estado DRAFT/CONFIRMED/VOIDED, versión, snapshots y número) y `SaleLine` (producto, cantidad entera y los valores congelados al confirmar). `confirm_sale` bloquea en este orden: recibo → venta → cliente → productos → posiciones → contexto comercial (entidad, bodega, impuestos) → numeración. Exige un `review_token` firmado cuya huella se recalcula bajo bloqueo. Pagos, correcciones, devoluciones, reembolsos y anulaciones serializan sobre la venta (ADR-0006). No existe un endpoint para eliminar borradores. Ningún módulo importa de `sales`.
- **`workshop`**: `MaintenanceOrder` (estado, versión, snapshots), `Intervention`, `ServiceLine` (precio aplicado, `tax_definition` artesanal copiada), `StateTransition` y el recibo `WorkshopCommand`. `execute_write` recibe una tupla de permisos, reclama el recibo, ejecuta y audita. `lock_order` bloquea la orden. `domain/finalization.py` admite comprobaciones adicionales (`extra_checks`), que son el punto de extensión previsto para DP-021. `tests/workshop/test_boundaries.py` restringe las importaciones cruzadas a una lista blanca.
- **`workshop_configuration`**: la inicialización crea la serie ART-SER (`ARTESANAL`/`SERVICIO`). `numbering.get_numbering_scope_id` y `allocate_number` siguen ADR-0004. `operation_context.lock_operation_context` solo resuelve el ámbito **comercial**. `workshop_references.get_artisan_entity` ya existe.
- **Reglas monetarias puras**: están en `sales/domain/amounts.py` (parseo de importes, `calculate_line` inclusiva HALF_UP y `calculate_document_totals`) y en `sales/domain/balances.py` (condición, medio, estado de pago, `compute_balance` y `validate_charge`). No dependen de Django.
- **Frontend**: `features/maintenance` (secciones del detalle) y `features/sales` (`PaymentDialog`, `MoneyDialog`, `PartsFields`, `moneyIntent`, `SaleReviewDialog`), páginas en `pages/*`, rutas en `app/App.tsx` y navegación en `app/navigation.ts`. No hay restricciones de importación entre features.

ADR aplicables: 0001 (monolito modular), 0003 (sesión y CSRF), 0004 (numeración), 0005 (publicación de inventario) y 0006 (ventas). Este diseño añade ADR-0008 y ADR-0009 (D11).

## Goals / Non-Goals

**Goals:**

- Reservas de inventario con disponibilidad no negativa aplicada de forma **centralizada** en la publicación y garantizada por restricciones de la base de datos.
- Ventas vinculadas que reutilizan íntegramente el borrador, la revisión, la confirmación y los cobros de `sales`, con origen inmutable y edición de líneas solo desde la orden.
- Operación artesanal ART-SER y pagos artesanales en `workshop`, reutilizando las reglas monetarias puras sin duplicarlas.
- Resumen económico, vista restringida para el Vendedor, cuentas por cobrar artesanales y las pantallas correspondientes.
- Atomicidad, idempotencia y concurrencia verificadas sobre PostgreSQL real.

**Non-Goals:** reposición por corrección, consumo interno, cancelación de órdenes, reembolsos o devoluciones artesanales, anulación de ventas vinculadas, facturación o SRI, caja y cierres, reportes y exportaciones. Tampoco se introduce un motor genérico de documentos ni se refactorizan las ventas más allá de sus puntos de integración.

## Decisions

### D1. Propiedad por módulo y contratos públicos

| Módulo | Nuevo o cambiado | Contrato público consumido por otros |
|---|---|---|
| `inventory` | Reservas (`InventoryReservation`), `InventoryPosition.reserved` y disponibilidad en la publicación y las vistas previas | `inventory/application/reservations.py`: `reserve`, `resize`, `release` y `consume` sobre `LockedPositions`; `read_availability(product_ids)`. Solo lo usa `sales`. |
| `sales` | Origen de la venta, venta vinculada, bloqueo de la vinculada, filtro de origen y anulación bloqueada | `sales/application/workshop_links.py` (nuevo): `lock_open_linked_sale`, `add_linked_line`, `change_linked_line`, `remove_linked_line`, `linked_sales_summary(order_id)`, `open_linked_line_count(order_id)`, `blocking_linked_documents(order_id)`, `linked_product_options(search, page)`. Solo lo usa `workshop`. |
| `workshop` | Sección de repuestos (coordinación), operación artesanal, pagos artesanales, resumen, vista comercial restringida y cuentas por cobrar artesanales | Ninguno nuevo hacia otros módulos. |
| `workshop_configuration` | `lock_artisan_operation_context`, `artisan_numbering_scope_id` y `allocate_artisan_number` en `workshop_references.py`, apoyados en un helper interno `_lock_taxes(entity_type, …)` que comparte con el contexto comercial sin cambiar su comportamiento | Lo usa `workshop`. |
| `shared` | `shared/money.py`: `parse_amount`, `calculate_line`, `calculate_document_totals`, `PaymentCondition`, `PaymentMethod`, `PaymentState`, `compute_balance` y `validate_charge`, trasladados sin cambios | `sales/domain/amounts.py` y `balances.py` los reexportan con los mismos nombres. |

La dirección de dependencias es `workshop → sales → inventory`, y nunca a la inversa en el código de aplicación. `sales` guarda una FK a `workshop.MaintenanceOrder` (D3) solo como referencia de integridad, sin importar código de `workshop`. `test_boundaries.py` amplía su lista blanca con `sales.application.workshop_links` y las nuevas funciones de `workshop_configuration`. Se crea `tests/sales/test_boundaries.py` para verificar que `sales` solo importa `inventory.application.reservations` y `posting`.

Alternativa descartada: que `workshop` escriba directamente `SaleLine` o posiciones. Viola ADR-0001 y duplicaría las validaciones de venta.

### D2. Reservas centralizadas en inventario

- `InventoryPosition.reserved` es un Decimal(18,6) con valor 0 por defecto, más dos checks: `reserved >= 0`, entero, y **`reserved <= quantity`**. Este último garantiza en la base de datos que **ninguna** salida, reversión, ajuste ni anulación de ingreso deje la disponibilidad negativa, aunque un llamador olvide validarla.
- `InventoryReservation`: `position` FK, `product` y `warehouse` FK, `source_type` (`SALE_LINE`), `source_id` (id de `SaleLine`), `source_reference` (snapshot con venta y orden), `quantity`, `state` (`ACTIVE`, `RELEASED` o `CONSUMED`), `consumed_by` FK a `InventoryOperation` y marcas de tiempo.
  - Índice único parcial `(source_type, source_id)` con `state=ACTIVE`.
  - Check: cantidad entera y positiva cuando `ACTIVE`.
  - La historia de las reservas liberadas o consumidas se conserva; el Kardex no cambia.
- `reserve`, `resize` y `release` exigen `LockedPositions` y validan `quantity − reserved ≥ delta` antes de escribir. Mantienen `reserved` como agregado de las reservas activas.
- `post_operation(..., consume_reservations=((source_type, source_id), …))`:
  - Para salidas, valida `line.quantity ≤ quantity − reserved + propias`.
  - En la misma transacción marca `CONSUMED` las reservas propias, las enlaza a la operación y descuenta `reserved`.
  - Sin reservas propias, la validación es contra la disponibilidad. Así, **toda venta directa, ajuste negativo o corrección** queda protegida sin tocar a sus llamadores.
  - `reverse_operation` de una entrada (anulación de un ingreso) valida igualmente `reserved`.
  - El error se expresa como `InsufficientStockError(available, requested)`, que ya traducen los llamadores.
- Las vistas previas de ajustes (`operations.py`) y la revisión de ventas (`reviews.ReviewSnapshot.availability`) usan la disponibilidad, sumando las reservas propias en el caso de una venta vinculada.
- Conciliación:
  - `reconcile_inventory` comprueba `reserved = Σ reservas activas`.
  - `reconcile_sales` comprueba que las reservas activas coinciden 1:1 con las líneas de las ventas vinculadas abiertas.

Alternativa descartada: calcular la disponibilidad en cada consulta a partir de las líneas de venta. Exigiría que inventario leyera ventas, rompería la frontera y dejaría la garantía sin respaldo en la base de datos.

### D3. Venta vinculada dentro de `sales`

- `Sale` añade tres campos:
  - `origin_type` (`DIRECT` o `MAINTENANCE`; `DIRECT` por defecto para todas las ventas existentes).
  - `origin_order` FK `workshop.MaintenanceOrder` nula, con PROTECT y `related_name="+"`.
  - `origin_reference` (número ART-OT copiado al crear; es inmutable).
- Restricciones:
  - `origin_type=MAINTENANCE ⇔ origin_order IS NOT NULL`.
  - **Índice único parcial `(origin_order)` con `state=DRAFT`**, que garantiza una sola venta abierta por orden.
  - Índice `(origin_order, state)`.
- `add_linked_line(actor, order_ref, product_id, quantity)`, que corre dentro de la transacción de `workshop` con la orden ya bloqueada:
  1. Localiza la venta DRAFT de la orden con bloqueo, o la crea con el cliente de la orden, la entidad y la bodega comerciales y la condición `CONTADO` provisional.
  2. Bloquea el producto (activo y vendible) y la posición.
  3. Inserta la línea y la reserva.
  4. Incrementa `sale.version`.

  La colisión en la creación queda serializada por el bloqueo de la orden, y el índice parcial la respalda.
- Cada línea es independiente, aunque se repita el producto. La reserva usa el id de la `SaleLine` como identidad estable. `change_linked_line` y `remove_linked_line` exigen `expected_sale_version` y ajustan o liberan la reserva.
- En los recursos ordinarios:
  - `update_draft` de una venta vinculada solo admite `condition`, `notes` y `expected_version`; cambiar cliente o líneas responde `linked_sale_locked`. `create_draft` no acepta origen.
  - `confirm_sale` no cambia su flujo: la condición la fija el Vendedor con `update_draft` y forma parte de la huella revisada. Solo añade `consume_reservations` con las líneas propias y la disponibilidad correcta en la revisión.
  - `void_sale` y su vista previa responden `linked_sale_not_voidable` (P5).
  - Devoluciones, pagos y correcciones no cambian.
- En las consultas:
  - `list_sales` y `receivables` aceptan el filtro `origin=DIRECT|MAINTENANCE`.
  - Proyecciones, detalle y comprobante incluyen `origin {type, order_id, order_number}`.

Alternativa descartada: que el Vendedor elija la condición en un campo del payload de confirmación. Duplicaría la revisión y cambiaría el contrato de `confirm_sale`, que ya comparten las ventas directas.

### D4. Coordinación de repuestos desde `workshop`

`workshop/application/parts.py` define `add_part`, `change_part` y `remove_part`, con `execute_write` y los permisos `mantenimientos.gestionar_repuestos` y `ventas.preparar_vinculada`. Cada acción:

1. Bloquea la orden (`lock_order`).
2. Exige `state=REGISTERED`; en `REOPENED` o `FINALIZED` responde `parts_not_allowed` con el mensaje de la spec.
3. Delega en `sales.workshop_links`.
4. Incrementa `order.version`, para que una edición concurrente de la orden o una finalización con la versión anterior se detecten como conflicto.

Las consultas `GET parts/` y `GET parts/product-options/` usan `linked_sales_summary` y `linked_product_options`, que devuelven existencia, reservado y disponible sin costos.

`finalization.py` añade `pending_parts_check`, que recibe `open_linked_line_count` leído bajo el bloqueo de la orden. Como toda alta de líneas también bloquea la orden, finalizar y agregar repuestos quedan serializados. La confirmación de la venta no bloquea la orden: solo puede reducir las líneas pendientes, así que no invalida la comprobación.

### D5. Operación artesanal en `workshop`

| Modelo | Campos | Restricciones |
|---|---|---|
| `ServiceOperation` | `order` FK, `fiscal_entity` FK, `customer` FK, `customer_snapshot`, `vehicle_snapshot`, `fiscal_snapshot` (RUC, razón social, serie), `number_allocation` FK, `internal_number`, `condition`, `operational_date`, `base_total`, `tax_total`, `grand_total`, `state` (`CONFIRMED`, `VOIDED`), `replaces` FK propia nula, `applied_review`, `void_reason`, `voided_by`, `voided_at`, `version`, `created_by`, `created_at` | `internal_number` único; totales ≥ 0 y `grand_total > 0`; `VOIDED ⇔ void_reason` no vacío; índices `(order, created_at)`, `(customer, state)` y `(state, operational_date)`. |
| `ServiceOperationLine` | `operation` FK, `service_line` FK a `ServiceLine`, `position`, `service_id`, `service_name`, `quantity`, `reference_price`, `applied_price`, `tax_definition_id`, `tax_snapshot`, `tax_rate`, `base_amount`, `tax_amount`, `total_amount`, `is_current` | **Índice único parcial `(service_line)` con `is_current`**: una línea no se documenta dos veces. Único `(operation, position)`; importes ≥ 0; `total = base + tax`. |

Flujo de confirmación (`service_operations.confirm`, permiso `servicios_economicos.confirmar`):

1. Bloquea en orden: recibo → orden → líneas iniciales pendientes (`select_for_update`, sin `is_current`) → `lock_artisan_operation_context(tax_ids, on=today)` → ámbito de numeración. **No** bloquea ni revalida al cliente: la operación copia los snapshots de cliente y vehículo conservados en la orden. Así una orden anterior se documenta aunque el vehículo haya cambiado de propietario (spec «Datos históricos de cliente y vehículo»).
2. Calcula los importes con `shared.money.calculate_line` usando la tarifa artesanal vigente. Si falta vigencia o hay ambigüedad, responde `configuration_missing` identificando la línea.
3. Recalcula la huella: ids, cantidades y precios de las líneas, definición, periodo y tarifa, fecha, condición y cliente. Si no coincide con `review_digest`, responde `review_required`.
4. Rechaza sin líneas o con total cero (`nothing_to_document`).
5. Llama a `allocate_artisan_number(request_key=f"service-operation:{order}:{digest}")` e inserta la operación, las líneas y los vínculos. Enlaza `replaces` si alguna línea procede de una operación anulada.
6. Incrementa `order.version` y audita.

La vista previa (`POST …/service-operations/preview/`) ejecuta el mismo cálculo sin bloqueos ni escrituras, con la lectura sin bloqueo `review_artisan_operation_context`, y devuelve la huella, los importes, los efectos y, si procede, `predates_billing_warning`.

Las líneas de servicio documentadas se bloquean en `service_lines.py`, que rechaza la edición con `line_documented` si existe un `ServiceOperationLine` vigente para la línea. La proyección de la orden añade a cada línea `documented_by {id, number}`.

La anulación (`servicios_economicos.anular`) bloquea recibo → orden → operación; exige que no haya pagos vigentes (`payments_block_void`); pone `VOIDED` y `is_current=false` en sus líneas y audita.

Las órdenes previas se marcan con `MaintenanceOrder.predates_billing = True` mediante una migración de datos que solo cambia esa marca. No genera documentos.

Alternativa descartada: guardar el estado de documentación en `ServiceLine` (`documented_by`). Duplicaría la verdad y no conservaría la cadena después de una anulación.

### D6. Pagos artesanales en `workshop`

Los modelos `ArtisanPayment` (`operation_id` UUID único, operación FK, importe > 0, `effective_at`, `effective_date`, `created_by`), `ArtisanPaymentPart` (medio, importe > 0, único `(payment, method)`) y `ArtisanPaymentCorrection` (original y reemplazo OneToOne, motivo no vacío) replican la forma de sus homólogos comerciales.

La lógica se apoya en `shared.money`:

- `compute_balance(exigible, pagado_vigente, Decimal(0))`; no hay reembolsos artesanales.
- `validate_charge(condition, balance, amount)`.

Registro, anulación y sustitución bloquean en este orden: recibo → operación (`select_for_update`) → inserciones. La operación anulada o el saldo cero se rechazan. La idempotencia usa `WorkshopCommand` más `operation_id` como identidad del hecho, igual que ADR-0006. No existe pago de orden: la URL siempre identifica una `ServiceOperation`, y un id de venta no es resoluble ahí (`not_found`). El cobro comercial sigue en `/api/v1/sales/{id}/payments/`.

Alternativa descartada: un «motor de pagos» común con `sales`. ADR-0006 lo descartó, y mezclaría RUC en una tabla.

### D7. Orden global de bloqueos

`recibo → orden de mantenimiento → operación artesanal / líneas de servicio → venta → cliente/vehículo → productos → posiciones de inventario (por product_id) → configuración (entidad, bodega, impuestos) → numeración → inserciones`.

Cada acción toma una subsecuencia ordenada de esta lista y puede omitir recursos. Confirmar venta, cobrar y devolver empiezan en «venta». Las acciones del taller empiezan en «orden». Los cobros artesanales toman solo la operación. Ninguna acción toma un recurso anterior después de uno posterior, así que no hay ciclos. Los interbloqueos y errores de serialización residuales los reintenta `shared.transactions.retryable_transaction`, que ya usan ambos módulos.

### D8. API (JSON, `problem+json`, sesión + CSRF, `idempotency_key` en el cuerpo de las escrituras)

Siguiendo la convención existente del taller y de ventas, la clave de idempotencia viaja en el cuerpo JSON (`idempotency_key`), no en un encabezado. Los cobros llevan además `operation_id` (UUID) como identidad estable del hecho.

| Método y ruta | Permiso | Notas |
|---|---|---|
| `GET /api/v1/maintenance-orders/{id}/parts/` | `mantenimientos.ver` | Ventas vinculadas (abierta y confirmadas) con líneas, totales, pagado y saldo, sin costos. |
| `GET …/{id}/parts/product-options/?search=&page=` | `mantenimientos.gestionar_repuestos` | Productos activos con existencia, reservado y disponible. |
| `POST …/{id}/parts/` | `gestionar_repuestos` + `preparar_vinculada` | `{product_id, quantity, expected_version}`; 201. |
| `PATCH`/`DELETE …/{id}/parts/{line_id}/` | ídem | `{quantity, expected_version}` (versión de la orden). |
| `GET …/{id}/economic-summary/` | `mantenimientos.ver` | Bloques por RUC según permisos, pendientes y combinado informativo. |
| `GET …/{id}/commercial-view/` | `ventas.ver` + venta vinculada | Vista restringida para el Vendedor. |
| `POST …/{id}/service-operations/preview/` | `servicios_economicos.confirmar` | `{condition}` → líneas, importes, huella y advertencias. |
| `POST …/{id}/service-operations/` | ídem | `{condition, review_digest, expected_version}`; 201. |
| `GET /api/v1/service-operations/?customer=&order=&payment_state=&state=&page=` | `pagos_artesanales.ver` | Cuentas por cobrar artesanales con sumas de todas las coincidencias y antigüedad. |
| `GET /api/v1/service-operations/{id}/` y `…/document/` | `servicios_economicos.ver` | Detalle y comprobante. |
| `POST …/{id}/void-preview/`, `…/void/` | `servicios_economicos.anular` | `{reason, expected_version}`. |
| `GET`/`POST …/{id}/payments/`, `…/payments/preview/` | `pagos_artesanales.ver` / `.registrar` | `{parts:[{method, amount}]}`. |
| `POST …/{id}/payments/{pid}/corrections/` | `pagos_artesanales.anular` | Anular o sustituir, con motivo. |
| `GET /api/v1/sales/?origin=` y `/sales/receivables/?origin=` | existentes | Nuevo filtro y campo `origin`. |

Paginación con `page` y `page_size`, igual que ahora (20 por defecto, 100 como máximo), con orden estable y total. Códigos de error nuevos, cada uno con errores por campo cuando aplica: `insufficient_availability`, `parts_not_allowed`, `linked_sale_locked`, `linked_sale_not_voidable`, `line_documented`, `nothing_to_document`, `payments_block_void`, `customer_locked_by_documents` y `pending_parts` (dentro de `finalize_requirements`). Se reutilizan `review_required`, `stale_record`, `idempotency_conflict`, `configuration_missing` y `not_found`. Se regenera `backend/schema.yml` y se actualiza su prueba de sincronía.

### D9. Edición de la orden con documentos

`orders.update_order` consulta, bajo el bloqueo de la orden, `blocking_linked_documents(order_id)` (venta abierta con líneas o confirmada) y las operaciones artesanales `CONFIRMED`. Si hay alguna y cambian el cliente o el vehículo, responde `customer_locked_by_documents` con los números afectados. Los snapshots históricos no cambian (spec de datos históricos).

### D10. Frontend

- **Detalle de la orden** (`MaintenanceOrderDetailPage`), organizado en pestañas del componente `Tabs` del sistema visual (variante de línea) para no amontonar información, a pedido del usuario durante la aplicación:
  - «Trabajo y servicios» (predeterminada): información general, diagnóstico, intervenciones y servicios con su estado de documentación.
  - «Repuestos», «Documentos y cobros» y «Fotografías».
  - La pestaña activa se conserva en la URL (`?tab=`); el resumen lateral y el historial permanecen visibles en todas.
- Componentes nuevos en `features/maintenance`:
  - `PartsSection`: buscador `Combobox` con disponibilidad; tabla con la venta abierta, rotulada «Reservado, pendiente de confirmar», y las confirmadas con su número y sin acciones; modal corto para agregar o editar la cantidad. Con `inventario.ver`, cada repuesto confirmado enlaza a su Kardex.
  - `EconomicSummary`: dos `SectionPanel` («Repuestos — RUC comercial» y «Servicios — RUC artesanal») con documentos, total, pagado, saldo y estado; acciones «Cobrar repuestos», que reutiliza `PaymentDialog` de ventas y solo aparece con `ventas.ver` y el permiso de pago comercial, y «Cobrar servicios»; total combinado con la leyenda informativa.
  - `ServiceOperationDialog`: vista previa, condición y efectos antes de confirmar.
  - `ArtisanPaymentDialog`, que reutiliza `MoneyDialog`, `PartsFields` y `moneyIntent` con la acción `artisan-payment`.
  - `VoidServiceOperationDialog` y `ArtisanCorrectionDialog`, solo para el Administrador.
- La sección de servicios muestra la etiqueta «Documentado en ART-SER-…» o «Pendiente de documentar». La reapertura avisa que los documentos y pagos conservan sus efectos.
- **Páginas nuevas**:
  - `/maintenance/service-operations/:id` (detalle, historial de pagos, anulación) y `/maintenance/service-operations/:id/document`.
  - `/maintenance/receivables` (cuentas por cobrar artesanales), con una entrada de navegación condicionada por `pagos_artesanales.ver`.
  - `/maintenance/:id/commercial` (vista restringida del Vendedor).
- **Ventas**:
  - Filtro y columna «Origen» en `SalesPage` y `ReceivablesPage`; enlace a la orden en `SaleDetailPage` y en el comprobante.
  - `SaleEditorPage` en modo vinculado: líneas de solo lectura, con un aviso y el enlace a la orden; solo se editan condición y notas.
  - La anulación de una venta vinculada no se ofrece y se explica el motivo.
- **Inventario**: la lista muestra existencia, reservado y disponible. La ficha del producto muestra además las reservas activas con la orden que las sostiene (dato copiado en la reserva, sin que inventario lea ventas) y enlaza a la orden según los permisos.
- Se aplican las memorias de interfaz (formularios cortos en modal, confirmaciones como toast, ancho completo), con estados de carga, vacío y error, prevención de doble envío y conservación de la captura. No se añaden dependencias.

### D11. ADR

- **ADR-0008 — Documentos económicos artesanales separados y núcleo monetario compartido.** Cierra DM-001 para V1 (P1): estructuras separadas por RUC y reglas puras compartidas en `shared/money.py`.
- **ADR-0009 — Reservas de inventario y coordinación con ventas vinculadas.** Reservas con agregado bloqueado, el check `reserved ≤ quantity` y su consumo en la publicación, más el orden global de bloqueos (D7). Complementa ADR-0005 y ADR-0006.

Ambos se proponen con este diseño y pasan a «Aceptada» al aplicar el cambio.

## Risks / Trade-offs

- **[El nuevo check `reserved ≤ quantity` rompe una salida existente que no conocía las reservas]** → La validación explícita en `post_operation` y `reverse_operation` produce `InsufficientStockError` antes de escribir. Se añaden pruebas de regresión para ajustes, correcciones, anulación de ingresos y ventas directas con reservas presentes.
- **[Regresiones en ventas directas o en `sales` por el traslado a `shared/money.py`]** → Traslado literal con reexportación y los mismos nombres. La suite `tests/sales` completa debe seguir pasando sin modificar sus aserciones.
- **[Interbloqueo entre el taller y ventas]** → Orden global D7, pruebas de concurrencia con hilos y `retryable_transaction`.
- **[Sale queda acoplada a `workshop.MaintenanceOrder` por FK]** → Es solo integridad referencial con PROTECT; el código de `sales` no importa `workshop`. La prueba de fronteras lo vigila.
- **[Encargado y Vendedor dependen el uno del otro para confirmar repuestos]** → Es una decisión de negocio aprobada (CU-018). La lista de ventas filtra los borradores vinculados para el Vendedor, y la finalización explica qué falta.
- **[Datos previos sin reservas]** → Ninguna venta existente es vinculada; `reserved` inicia en 0 y el check se cumple.
- **[Pagos artesanales sin referencia ni cambio]** → Paridad con los pagos comerciales. Queda como posible mejora conjunta, fuera de esta entrega.

## Migration Plan

1. `inventory`: migración aditiva con `reserved` (0 por defecto), los checks e `InventoryReservation`.
2. `sales`: `origin_type` (`DIRECT` por defecto en todas las filas), `origin_order` nula, `origin_reference`, los checks y el índice parcial. Depende de la última migración de `workshop`.
3. `workshop`: `ServiceOperation`, `ServiceOperationLine`, los tres modelos de pagos y `predates_billing`. Una migración de datos marca `predates_billing=True` en las órdenes existentes; es la única escritura sobre datos y no crea documentos, deudas, cobros ni movimientos.
4. Verificar que la serie ART-SER está activa (inicialización existente). Si falta, se configura con la pantalla de series actual; no se crea por migración.
5. `make migrate`, `make check` y `make test`, más `reconcile_inventory` y `reconcile_sales` tras el despliegue.

**Rollback:** antes de revertir el código hay que retirar las líneas de las ventas vinculadas abiertas (libera las reservas). Las migraciones son reversibles mientras no existan operaciones artesanales ni ventas vinculadas. Con datos confirmados, el rollback solo se permite con un respaldo previo, conforme a DA-003.

## Estrategia de pruebas (criterios de aceptación)

- **Dominio (unitarias)**: `shared/money` (casos trasladados y artesanales), requisitos de finalización con repuestos y huella de la operación artesanal.
- **Inventario**: reservar, redimensionar y liberar; consumo en la publicación; ajustes, correcciones y anulación de ingresos bloqueados por reservas; conciliación.
- **Ventas**: venta vinculada (creación única, líneas independientes, edición ordinaria rechazada, confirmación que consume reservas y descuenta una sola vez, productos repetidos sumados, anulación bloqueada, filtros de origen); ventas directas intactas (la suite existente) y ventas directas frente a reservas.
- **Taller**:
  - Repuestos por estado y permisos; finalización con repuestos pendientes; bloqueo de cliente y vehículo.
  - Operación artesanal: vista previa, revisión cambiada, ausencia de líneas o total cero, líneas correctivas, orden finalizada, documentación única, anulación con y sin pagos y reemplazo, órdenes previas.
  - Pagos: contado y crédito, abonos, pago al RUC equivocado, importes inválidos, correcciones.
  - Resumen y vista del Vendedor; cuentas por cobrar.
- **Concurrencia (PostgreSQL real, `transaction=True`)**:
  - Dos órdenes por la última unidad; venta directa frente a reserva; reserva frente a ajuste.
  - Agregar repuesto frente a finalizar; editar frente a confirmar la venta; confirmación repetida.
  - Dos confirmaciones artesanales; edición de línea frente a documentación.
  - Cobros simultáneos del saldo; pago frente a anulación.
- **Permisos**: casos positivos y negativos por rol y con roles acumulados en cada endpoint nuevo y en los endpoints ordinarios de ventas usados para eludir las reglas.
- **Frontend (Vitest + Testing Library)**: secciones, diálogos, estados y errores. **E2E (Playwright)**: orden con servicios y repuestos → Vendedor confirma → cobros separados → finalizar → reabrir; revisión con axe.
- **OpenAPI** sincronizado; `make check`, `make test` (cobertura ≥ 85 %), `make audit` y `openspec validate --strict`.

## Open Questions

Ninguna bloqueante. Hay que confirmar durante la aplicación que la base de desarrollo tiene la serie ART-SER activa (paso 4).
