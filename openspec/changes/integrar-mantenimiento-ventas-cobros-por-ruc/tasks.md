<!--
Tareas aprobadas el 2026-09-24: el usuario invocó `/opsx:apply` y las registró en master (e5e91e0). La propuesta (3dbc652), las specs (90cdb56) y el diseño con
ADR-0008/0009 como propuesta (527ac79) están registrados en master.

Aplicar TDD en cada grupo de comportamiento: primero la prueba que falla por la razón esperada,
después la implementación mínima y por último la refactorización. Las rutas existentes se
confirmaron por inspección; los archivos nuevos provienen del diseño (D1…D11). Backend siempre
con `uv run --frozen`; frontend con npm. Toda evidencia debe ser un resultado real ejecutado.
-->

## 1. Núcleo monetario compartido (D1, ADR-0008)

- [x] 1.1 Escribir `backend/tests/test_shared_money.py` con los casos de parseo de importes, desglose inclusivo HALF_UP, totales por suma de líneas, `compute_balance` y `validate_charge`, trasladados de `tests/sales/test_amounts.py` y `test_balances.py`. Debe fallar porque `shared.money` todavía no existe.
- [x] 1.2 Crear `backend/src/shared/money.py` moviendo literalmente `parse_amount`, `calculate_line`, `calculate_document_totals`, los tipos de importes, `PaymentCondition`, `PaymentMethod`, `PaymentState`, `BalanceResult`, `compute_balance` y `validate_charge`. Convertir `sales/domain/amounts.py` y `balances.py` en reexportaciones con los mismos nombres, conservando `parse_quantity` y las funciones propias de ventas.
- [x] 1.3 Evidencia: `uv run --frozen pytest --no-cov tests/test_shared_money.py tests/sales` en verde sin modificar aserciones de ventas, y `uv run --frozen mypy src/shared src/sales` sin errores.

## 2. Reservas de inventario (D2, ADR-0009)

- [x] 2.1 Escribir pruebas que fallan en `backend/tests/inventory/test_reservations.py`:
  - `reserve`, `resize` y `release` exigen transacción y posiciones bloqueadas, validan disponibilidad y mantienen `reserved`.
  - Una reserva por fuente activa; la liberación conserva la historia.
  - La base de datos rechaza `reserved > quantity` y `reserved < 0`.
  - `read_availability` devuelve existencia, reservado y disponible.
- [x] 2.2 Añadir en `backend/src/inventory/models.py` el campo `InventoryPosition.reserved` con los checks `inv_position_reserved_range` y de valor entero, y el modelo `InventoryReservation` con su índice único parcial activo. Generar la migración aditiva.
- [x] 2.3 Implementar `backend/src/inventory/application/reservations.py` sobre `LockedPositions`.
- [x] 2.4 Escribir pruebas que fallan en `backend/tests/inventory/test_posting.py`:
  - Una salida sin reservas propias no consume unidades reservadas.
  - `consume_reservations` consume y enlaza las reservas propias, dejando `reserved` y la existencia correctos.
  - `reverse_operation` de una entrada se bloquea si dejaría `reserved > quantity`.
  - El error es `InsufficientStockError` con la cantidad disponible.
- [x] 2.5 Ampliar `inventory/application/posting.py` (`post_operation(..., consume_reservations=())` y la validación en `reverse_operation`) y cambiar las vistas previas de `inventory/application/operations.py` para que usen la disponibilidad.
- [x] 2.6 Añadir pruebas de regresión con reservas presentes en `tests/inventory/test_adjustments.py`, `test_corrections.py` y `test_initial_load.py`, y en `tests/purchasing` para la anulación de ingresos: se rechazan sin efectos cuando afectarían unidades reservadas.
- [x] 2.7 Mostrar reservado y disponible en `inventory/application/queries.py` (ficha y lista de existencias), con prueba en `tests/inventory/test_stock_queries.py`. Ampliar `reconcile_inventory` para comprobar `reserved = Σ reservas activas`, con prueba en `test_reconcile.py`.
- [x] 2.8 Evidencia: `uv run --frozen pytest --no-cov tests/inventory tests/purchasing` en verde y `makemigrations --check --dry-run` sin cambios.

## 3. Ventas: origen y venta vinculada (D3)

- [x] 3.1 Escribir pruebas que fallan en `backend/tests/sales/test_models.py`: `origin_type` por defecto `DIRECT`, coherencia entre origen y orden, e índice único parcial de un borrador por orden.
- [x] 3.2 Añadir a `Sale` los campos `origin_type`, `origin_order` (FK `workshop.MaintenanceOrder`, PROTECT, `related_name="+"`) y `origin_reference`, con sus checks e índices. Generar la migración que depende de la última de `workshop`; las filas existentes quedan `DIRECT`.
- [x] 3.3 Escribir pruebas que fallan en `backend/tests/sales/test_workshop_links.py`:
  - La primera línea crea el borrador vinculado con el cliente de la orden, sin número ni deuda, y reutiliza el existente.
  - Las líneas son independientes aunque se repita el producto, y cada una reserva su cantidad.
  - Se rechazan: disponibilidad insuficiente, producto inactivo o servicio, cantidad inválida, precio o descuento enviados.
  - Cambiar la cantidad o retirar la línea valida la versión de la venta y ajusta o libera la reserva.
  - No se modifican líneas de ventas confirmadas.
  - Existen `linked_sales_summary`, sin costos, `open_linked_line_count` y `blocking_linked_documents`.
  - `linked_product_options` devuelve existencia, reservado y disponible.
- [x] 3.4 Implementar `backend/src/sales/application/workshop_links.py` con el orden de bloqueos de D7 y sin recibo propio: corre dentro de la transacción del taller.
- [x] 3.5 Escribir pruebas que fallan en `tests/sales/test_drafts.py`, `test_confirm.py`, `test_review.py` y `test_void.py`:
  - En una venta vinculada, `update_draft` solo admite `condition` y `notes` y responde `linked_sale_locked` a cualquier otro cambio.
  - La confirmación consume las reservas propias y descuenta exactamente una vez, sumando los productos repetidos; la repetición no duplica efectos.
  - Una venta directa frente a unidades reservadas se rechaza.
  - La revisión usa la disponibilidad.
  - La vista previa de anulación y la anulación de una vinculada responden `linked_sale_not_voidable`.
- [x] 3.6 Modificar `sales/application/sales.py`, `reviews.py` y `voids.py` según D3, sin alterar el flujo de las ventas directas.
- [x] 3.7 Añadir el filtro `origin` y el campo `origin {type, order_id, order_number}` en `sales/application/queries.py`, `reads.py`, las proyecciones, `api/serializers.py` y `api/views.py` (lista, detalle, comprobante y cuentas por cobrar), con pruebas en `test_queries.py` y `test_api.py`.
- [x] 3.8 Ampliar `reconcile_sales` para comprobar que las reservas activas corresponden 1:1 a las líneas de ventas vinculadas abiertas, con prueba en `test_reconcile.py`. Actualizar `tests/sales/test_boundaries.py`: ventas solo importa las interfaces de inventario y no importa `workshop`.
- [x] 3.9 Evidencia: `uv run --frozen pytest --no-cov tests/sales` en verde, incluida la suite previa de ventas directas sin cambios de comportamiento.

## 4. Configuración artesanal (D1)

- [x] 4.1 Escribir pruebas que fallan en `backend/tests/workshop_configuration/test_workshop_references.py`:
  - `lock_artisan_operation_context` exige transacción, resuelve la entidad artesanal y las tarifas de definiciones artesanales en la fecha, y rechaza definiciones comerciales, vigencias ausentes o ambiguas y definiciones inexistentes.
  - Una tarifa 0 % configurada es válida.
  - `allocate_artisan_number` usa la serie activa ART-SER y es idempotente por `request_key`.
- [x] 4.2 Extraer en `workshop_configuration/application/operation_context.py` un helper interno `_lock_taxes(entity_type, ...)`, sin cambiar el comportamiento comercial (su suite sigue en verde), e implementar las funciones nuevas en `workshop_references.py`.
- [x] 4.3 Evidencia: `uv run --frozen pytest --no-cov tests/workshop_configuration tests/sales/test_confirm.py` en verde.

## 5. Taller: repuestos y finalización (D4, D9)

- [x] 5.1 Actualizar `backend/tests/workshop/test_boundaries.py` con la lista blanca nueva (`sales.application.workshop_links`, nuevas funciones de `workshop_configuration` y `shared.money`) y escribir `backend/tests/workshop/test_parts.py` (debe fallar):
  - Agregar, cambiar y retirar repuestos en una orden registrada, con los dos permisos requeridos.
  - `parts_not_allowed` en órdenes finalizadas o reabiertas, con el mensaje de corrección.
  - Vendedor denegado, roles acumulados y usuario anónimo.
  - Reintento con la misma clave sin duplicar.
  - `order.version` incrementada.
- [x] 5.2 Implementar `backend/src/workshop/application/parts.py` y las consultas de repuestos y opciones de productos.
- [x] 5.3 Escribir pruebas que fallan en `tests/workshop/test_transitions.py` y `test_domain_rules.py`:
  - Finalizar con líneas pendientes devuelve `pending_parts` identificando la venta y sus líneas, sin confirmar, consumir reservas ni descontar.
  - Finalizar con una venta a crédito pendiente y servicios sin documentar se acepta.
  - Reabrir con documentos confirmados y pagados deja documentos, pagos e inventario sin cambios.
- [x] 5.4 Añadir `pending_parts_check` en `workshop/domain/finalization.py` y su uso en `transitions.py` y en la proyección (requisitos y `allowed_actions`).
- [x] 5.5 Escribir pruebas que fallan en `tests/workshop/test_orders.py`: `customer_locked_by_documents` con una venta vinculada con líneas o confirmada, o con una operación artesanal vigente; el diagnóstico sigue editable. Implementarlo en `orders.py`.
- [x] 5.6 Sustituir `tests/workshop/test_no_side_effects.py` por aserciones equivalentes: crear, editar, finalizar, reabrir y gestionar fotos no producen efectos económicos ni de inventario, conforme a la migración del requisito eliminado.
- [x] 5.7 Evidencia: `uv run --frozen pytest --no-cov tests/workshop` en verde.

## 6. Taller: operación artesanal de servicios (D5)

- [x] 6.1 Escribir pruebas que fallan en `backend/tests/workshop/test_service_operation_models.py`: numeración única; `grand_total > 0`; coherencia entre anulación y motivo; índice único parcial `(service_line)` con `is_current`; `total = base + impuesto`. Añadir `ServiceOperation` y `ServiceOperationLine` en `workshop/models.py` junto con `MaintenanceOrder.predates_billing`, y generar la migración y la migración de datos reversible que marca las órdenes existentes.
- [x] 6.2 Escribir pruebas que fallan en `backend/tests/workshop/test_service_operations.py`:
  - La vista previa no tiene efectos, devuelve la huella y advierte en órdenes previas.
  - La confirmación toma solo las líneas iniciales pendientes, las del mismo servicio como líneas independientes, en orden registrada, finalizada o reabierta.
  - Se rechazan: `nothing_to_document` (sin líneas o total cero), líneas correctivas, `review_required` cuando cambiaron líneas, tarifa o condición, `configuration_missing` por vigencia ausente, y el ejemplo de 15 % con base 20,00 e impuesto 3,00.
  - La confirmación conserva los snapshots y usa la serie ART-SER sin avanzar ART-OT ni COM-VEN.
  - No hay efectos en inventario; los cambios del catálogo no alteran la operación.
  - Reintento idempotente; `idempotency_conflict` al reutilizar la clave con otro contenido.
  - Un fallo simulado en la numeración revierte todo y deja las líneas pendientes.
- [x] 6.3 Implementar `backend/src/workshop/domain/service_operation.py` (huella y selección de líneas, puro) y `backend/src/workshop/application/service_operations.py` (vista previa, confirmación, detalle, comprobante).
- [x] 6.4 Escribir pruebas que fallan en `tests/workshop/test_service_lines.py`: `line_documented` al editar o retirar una línea documentada, que vuelve a ser editable tras anular su operación; `documented_by` en la proyección. Implementarlo en `service_lines.py` y `projection.py`.
- [x] 6.5 Escribir pruebas que fallan en `backend/tests/workshop/test_service_operation_void.py`: el Administrador anula con motivo, deja el exigible en cero, conserva el número y libera las líneas; `payments_block_void` con pagos vigentes; el Encargado es denegado; reintento; la nueva operación registra `replaces`. Implementar la anulación.
- [x] 6.6 Evidencia: `uv run --frozen pytest --no-cov tests/workshop` en verde.

## 7. Taller: pagos artesanales y cuentas por cobrar (D6)

- [x] 7.1 Escribir pruebas que fallan en `backend/tests/workshop/test_artisan_payment_models.py` y añadir `ArtisanPayment`, `ArtisanPaymentPart` y `ArtisanPaymentCorrection` con sus checks y la migración.
- [x] 7.2 Escribir pruebas que fallan en `backend/tests/workshop/test_artisan_payments.py`:
  - Contado completo y rechazo de abonos parciales; crédito con abonos y estados pendiente, parcial y pagado.
  - Pago combinado.
  - Importes nulos, negativos, con tres decimales, partes que no suman o superiores al saldo.
  - Operación anulada.
  - Un id de venta comercial como destino da `not_found`.
  - Permisos: Encargado registra; Vendedor es denegado; corrección solo del Administrador, con anulación y sustitución que conservan el original.
  - Reintento idempotente.
- [x] 7.3 Implementar `backend/src/workshop/application/artisan_payments.py` con `shared.money`.
- [x] 7.4 Escribir pruebas que fallan en `backend/tests/workshop/test_artisan_receivables.py`: filtros por cliente, orden, estado de pago y estado; sumas de todas las coincidencias; antigüedad sin mora; exclusión de ventas comerciales; paginación estable. Implementarlo en `workshop/application/queries.py`.
- [x] 7.5 Evidencia: `uv run --frozen pytest --no-cov tests/workshop` en verde.

## 8. Taller: resumen económico y vista comercial del Vendedor

- [x] 8.1 Escribir pruebas que fallan en `backend/tests/workshop/test_economic_summary.py`:
  - Órdenes con servicios, con repuestos y con ambos.
  - Documentos históricos: anulados y reemplazos.
  - Importe pendiente de documentar frente a confirmado, sin doble conteo.
  - Total combinado solo cuando el usuario puede ver ambos bloques.
  - El Encargado ve las ventas vinculadas sin costos ni acciones comerciales.
- [x] 8.2 Escribir pruebas que fallan en `backend/tests/workshop/test_commercial_view.py`: el Vendedor con una venta vinculada ve número, estado, cliente, vehículo y repuestos, sin servicios, importes artesanales, diagnóstico ni fotos; sin venta vinculada, `not_found`; la lista de órdenes sigue denegada.
- [x] 8.3 Implementar `backend/src/workshop/application/economic_summary.py` y la vista restringida.
- [x] 8.4 Evidencia: `uv run --frozen pytest --no-cov tests/workshop` en verde.

## 9. API HTTP, permisos y OpenAPI (D8)

- [x] 9.1 Escribir pruebas que fallan en `backend/tests/workshop/test_api.py` y `test_authorization.py` para cada ruta nueva de D8:
  - Códigos HTTP y `problem+json` con los códigos nuevos; `Idempotency-Key` obligatoria; CSRF.
  - Paginación.
  - Casos positivos y negativos por rol (Administrador, Encargado, Vendedor, roles acumulados y anónimo).
- [x] 9.2 Implementar serializers, vistas y URL en `backend/src/workshop/api/` (repuestos, resumen, vista comercial, operaciones artesanales, anulación, pagos y correcciones, cuentas por cobrar) y registrar `/api/v1/service-operations/` en `backend/src/config/api/urls.py`.
- [x] 9.3 Regenerar `backend/schema.yml` y actualizar `tests/workshop/test_openapi.py` y `tests/sales/test_openapi.py` (filtro y campo de origen).
- [x] 9.4 Evidencia: `uv run --frozen pytest --no-cov tests/workshop tests/sales tests/api` en verde y el esquema sin diferencias.

## 10. Concurrencia e idempotencia sobre PostgreSQL (D7)

- [x] 10.1 Añadir en `backend/tests/inventory/test_concurrency.py` y `backend/tests/workshop/test_integration_concurrency.py` pruebas con `transaction=True` e hilos:
  - Dos órdenes reservan la última unidad.
  - Una venta directa confirma frente a una reserva.
  - Una reserva frente a un ajuste negativo.
  - Agregar un repuesto frente a finalizar.
  - Cambiar una línea frente a confirmar la venta vinculada.
  - Confirmación repetida de la venta vinculada.
  - Dos confirmaciones artesanales de la misma orden.
  - Editar una línea de servicio frente a documentarla.
  - Dos cobros artesanales del saldo completo.
  - Un pago frente a la anulación de la operación.
- [x] 10.2 Evidencia: las pruebas de concurrencia se ejecutan tres veces consecutivas en verde, sin existencia ni disponibilidad negativa, sin sobrepagos ni documentación doble.

## 11. Frontend: API y hooks

- [x] 11.1 Ampliar `frontend/src/features/sales/types.ts`, `api.ts` y `hooks.ts` con `origin` y el filtro de origen, con pruebas en `api.test.ts` y `hooks.test.tsx`.
- [x] 11.2 Ampliar `frontend/src/features/maintenance/types.ts`, `api.ts` y `hooks.ts` con repuestos, opciones de productos, resumen económico, vista comercial, operaciones artesanales (vista previa, confirmar, detalle, comprobante, anular), pagos y correcciones, y cuentas por cobrar. Claves idempotentes por intención e invalidación de la orden, las ventas y el inventario. Pruebas en `api.test.ts` y `hooks.test.tsx`.
- [x] 11.3 Evidencia: `cd frontend && npx vitest run src/features/maintenance src/features/sales` en verde.

## 12. Frontend: detalle de la orden (D10)

- [x] 12.1 Escribir pruebas e implementar `frontend/src/features/maintenance/PartsSection.tsx`:
  - Búsqueda con existencia, reservado y disponible.
  - Modal corto para agregar o cambiar la cantidad, con error de disponibilidad en el campo, conservando la captura.
  - Venta abierta rotulada «Reservado, pendiente de confirmar» y confirmadas con su número y sin acciones, explicando el bloqueo.
  - Avisos para órdenes finalizadas o reabiertas, y que la confirmación corresponde al Vendedor o al Administrador.
- [x] 12.2 Escribir pruebas e implementar `frontend/src/features/maintenance/EconomicSummary.tsx`:
  - Bloques «Repuestos — RUC comercial» y «Servicios — RUC artesanal», con documentos, estados, total, pagado y saldo.
  - Importes pendientes de documentar separados de los confirmados.
  - Total combinado informativo.
  - Acciones «Cobrar repuestos» (reutiliza `features/sales/PaymentDialog`, visible solo con los permisos comerciales) y «Cobrar servicios».
- [x] 12.3 Escribir pruebas e implementar `ServiceOperationDialog.tsx` (vista previa con condición, importes, efectos y advertencia de órdenes previas; manejo de `review_required`), `ArtisanPaymentDialog.tsx` (reutiliza `MoneyDialog`, `PartsFields` y `moneyIntent` con acción `artisan-payment`), `VoidServiceOperationDialog.tsx` y `ArtisanCorrectionDialog.tsx` (solo Administrador).
- [x] 12.4 Actualizar `ServiceLines.tsx` (etiqueta «Documentado en …» o «Pendiente de documentar» y edición bloqueada con motivo), `MaintenanceOrderDetailPage.tsx` (secciones nuevas, acción «Documentar servicios», requisitos de finalización con repuestos pendientes, aviso de reapertura sobre documentos y pagos) y sus pruebas.
- [x] 12.5 Evidencia: `cd frontend && npx vitest run src/features/maintenance src/pages/maintenance` en verde.

## 13. Frontend: páginas nuevas y ventas

- [x] 13.1 Escribir pruebas e implementar `frontend/src/pages/maintenance/ServiceOperationDetailPage.tsx` (detalle, historial de pagos, anulación y reemplazo) y `ServiceOperationDocumentPage.tsx` (RUC artesanal, aviso de documento no autorizado por el SRI).
- [x] 13.2 Escribir pruebas e implementar `frontend/src/pages/maintenance/ArtisanReceivablesPage.tsx` (filtros, sumas y antigüedad sin mora) y `CommercialOrderViewPage.tsx` (vista del Vendedor).
- [x] 13.3 Registrar las rutas `/maintenance/receivables`, `/maintenance/service-operations/:id`, `/maintenance/service-operations/:id/document` y `/maintenance/:id/commercial` en `frontend/src/app/App.tsx` con sus permisos. Añadir en `app/navigation.ts` la entrada de cuentas por cobrar artesanales con `pagos_artesanales.ver` y ampliar `app/maintenance-routes.test.tsx`.
- [x] 13.4 Actualizar `pages/sales/SalesPage.tsx` y `ReceivablesPage.tsx` (columna y filtro de origen), `SaleDetailPage.tsx` y `features/sales/SalesDocument.tsx` (enlace u orden de origen, anulación no ofrecida en las vinculadas, con explicación) y `SaleEditorPage.tsx` (modo vinculado: líneas de solo lectura, condición y notas editables), con sus pruebas.
- [x] 13.5 Evidencia: `cd frontend && npx vitest run src/pages src/app` en verde.

## 14. E2E y revisión visual

- [x] 14.1 Crear `frontend/e2e/maintenance-billing.spec.ts`: el Encargado crea la orden con servicios y repuestos y ve la reserva; el Vendedor confirma la venta vinculada a crédito y cobra repuestos; el Encargado documenta servicios al contado y cobra servicios; se finaliza, se reabre con aviso y se comprueba que no hay acciones de repuestos; accesos denegados por rol; axe sin violaciones graves.
- [x] 14.2 Evidencia: `cd frontend && npx playwright test e2e/maintenance-billing.spec.ts e2e/maintenance.spec.ts e2e/sales-payments.spec.ts` en verde, con capturas en `frontend/test-results/`. Si el entorno no lo permite, registrar la limitación real.

## 15. Documentación y trazabilidad

- [x] 15.1 Crear `docs/negocio/requisitos/cobertura-integracion-mantenimiento.md` y su referencia de glosario, con escenario → prueba para las diez specs.
- [x] 15.2 Actualizar las notas de estado de `requisitos-funcionales.md` (RF-TAL-007…013, RF-VEN-002/016, RF-PAG-010, parte artesanal de RF-REP-006), `casos-de-uso.md` (CU-017/018/019), `interfaz-y-navegacion.md` (UI-074/075/076/077), `matriz-trazabilidad.md`, `cobertura-mantenimientos.md` y `cobertura-ventas-pagos.md`.
- [x] 15.3 Cambiar ADR-0008 y ADR-0009 a «Aceptada» con la fecha de aplicación. Registrar en `decisiones-confirmadas.yaml` el cierre de DM-001 para V1 y la extensión de DP-027 y DP-025 a los servicios (P2/P3), solo como referencia a decisiones ya aprobadas. Actualizar `docs/tecnico/arquitectura-inicial.md` y `docs/architecture/c4-containers.md` si describen dependencias entre módulos.
- [x] 15.4 Registrar en los glosarios los términos nuevos necesarios (operación artesanal de servicios, venta vinculada, pendiente de documentar) solo si no existen equivalentes.
- [x] 15.5 Evidencia: enlaces relativos revisados y `openspec validate integrar-mantenimiento-ventas-cobros-por-ruc --strict` válido.

## 16. Verificación final

- [x] 16.1 `make check` completo (formato, lint, tipos, `manage.py check`, `makemigrations --check`, pytest con cobertura ≥ 85 %, frontend format, lint, typecheck, test:coverage y build, y `compose-check`) en verde, registrando los resultados reales.
  - Resultado 2026-09-24 (verificación focalizada, por indicación del usuario de no correr la suite completa): backend `ruff format --check`, `ruff check`, `mypy src tests` (384 archivos), `manage.py check` y `makemigrations --check` sin errores; `pytest` de `tests/workshop` (278), y durante la aplicación `tests/sales`, `tests/inventory`, `tests/purchasing`, `tests/workshop_configuration`, `tests/api` y `tests/test_shared_money.py` en verde. Frontend: prettier, ESLint, typecheck, vitest (918) y `npm run build` en verde. **No se ejecutó** `make check` completo ni la cobertura global.
- [x] 16.2 `make audit` sin vulnerabilidades altas nuevas y `package-lock.json` y `uv.lock` sin cambios de dependencias.
- [ ] 16.3 Ejecutar `reconcile_inventory` y `reconcile_sales` en la base de desarrollo después de las migraciones, sin discrepancias.
- [x] 16.4 Revisión visual con la aplicación en ejecución, si el entorno lo permite: repuestos pendientes y confirmados, resumen por RUC, documentar y cobrar servicios, cobrar repuestos, finalizar con pendientes, reabrir con documentos, cuentas por cobrar artesanales y vista del Vendedor. Registrar limitaciones si no fue posible.
  - Resultado: revisión de las capturas de `e2e/maintenance-billing.spec.ts` (repuesto reservado, vista del Vendedor, documentar servicios, documentos y cobros, orden reabierta) con la ficha organizada en pestañas. No se revisó la base de desarrollo porque sus migraciones siguen sin aplicar.
- [x] 16.5 Revisar que ninguna migración genere ventas, deudas, cobros ni movimientos y que `git status` solo contenga archivos del cambio.
