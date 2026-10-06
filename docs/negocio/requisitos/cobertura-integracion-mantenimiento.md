# Cobertura de la integración de mantenimiento, repuestos, ventas y cobros por RUC

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `integrar-mantenimiento-ventas-cobros-por-ruc` |
| Estado | Evidencia local de implementación; **no** es aprobación humana ni archivo del cambio |
| Fecha | 2026-09-24 |
| Alcance | Repuestos como venta comercial vinculada con reservas, operación artesanal ART-SER, pagos y cuentas por cobrar artesanales, resumen económico por RUC y vista comercial restringida. Excluye reposición por corrección, cancelación, devoluciones y reembolsos artesanales, anulación de ventas vinculadas, facturación y caja |

«Cumplido» significa que una prueba automatizada ejecutada localmente verifica el requisito. Las rutas son relativas a `backend/tests/` o `frontend/`. La tabla se organiza por requisito; cada fila cubre sus escenarios con las pruebas indicadas.

## Comandos ejecutados (focalizados)

- Backend: `uv run --frozen pytest --no-cov tests/workshop tests/sales tests/inventory tests/purchasing tests/workshop_configuration tests/test_shared_money.py tests/api`.
- Concurrencia real sobre PostgreSQL: `tests/workshop/test_integration_concurrency.py`, 11 escenarios, incluido retirar la última línea frente a confirmar la venta; tres corridas consecutivas en verde para la entrega original y una corrida focalizada en verde para este ajuste.
- Frontend: `npx vitest run` sobre `src/features/maintenance`, `src/features/sales`, `src/pages/maintenance`, `src/pages/sales` y `src/app`.
- E2E: `npx playwright test e2e/maintenance-billing.spec.ts e2e/maintenance.spec.ts`. Las capturas están en `frontend/test-results/maintenance-billing-evidence/`; son evidencia técnica, no una línea base aprobada.

## Repuestos del mantenimiento

| Requisito | Estado | Pruebas |
|---|---|---|
| Venta abierta vinculada única por orden | Cumplido | `sales/test_workshop_links.py::test_first_line_creates_and_later_lines_reuse_a_linked_draft`; `sales/test_models.py::test_origin_type_and_order_are_coherent`; `workshop/test_integration_concurrency.py::test_two_orders_reserving_the_last_unit` |
| Selección de productos vendibles con ayuda de disponibilidad | Cumplido | `workshop/test_parts.py::test_part_queries_return_linked_sales_and_product_availability_without_costs`; `frontend/src/features/maintenance/billingHooks.test.tsx` |
| Líneas pendientes que reservan sin descontar | Cumplido | `sales/test_workshop_links.py::test_linked_line_rejects_unavailable_inactive_service_and_client_prices`, `::test_linked_line_rejects_invalid_quantity`; `workshop/test_parts.py::test_part_retry_with_same_key_does_not_duplicate_line_or_reservation`; `inventory/test_reservations.py` |
| Modificar y retirar líneas pendientes | Cumplido | `workshop/test_parts.py::test_add_change_and_remove_parts_increment_order_version_and_adjust_reservation`, `::test_removing_the_last_part_discards_the_draft_and_retry_is_harmless`; `sales/test_workshop_links.py::test_confirmed_linked_sale_lines_cannot_be_changed`, `::test_removing_the_last_line_discards_the_empty_draft_and_audits_it`, `::test_removing_one_of_two_lines_keeps_the_draft_and_a_new_part_creates_another`; `workshop/test_integration_concurrency.py::test_change_line_against_confirming_linked_sale`, `::test_removing_the_last_line_against_confirming_the_linked_sale` |
| Confirmación comercial de la venta vinculada | Cumplido | `sales/test_confirm.py::test_linked_confirmation_consumes_own_reservations_once_for_repeated_products`; `workshop/test_integration_concurrency.py::test_repeated_linked_confirmation_confirms_once`; `workshop/test_billing_api.py::test_full_http_flow_keeps_documents_separated` |
| Dos órdenes por las últimas unidades | Cumplido | `workshop/test_integration_concurrency.py::test_two_orders_reserving_the_last_unit`, `::test_direct_sale_and_reservation_compete_for_last_unit` |
| Repuestos solo en órdenes registradas | Cumplido | `workshop/test_parts.py::test_parts_are_not_allowed_outside_registered_order`; `workshop/test_billing_api.py::test_finalized_order_rejects_parts` |
| Trazabilidad entre orden, líneas, venta y movimientos | Cumplido | `frontend/src/features/maintenance/billing.test.tsx` (enlace al Kardex); `inventory/test_posting.py::test_exit_consumes_and_links_its_own_reservations`; `sales/test_queries.py::test_origin_filter_and_projection_cover_list_detail_document_and_receivables`; `sales/test_reconcile.py::test_open_linked_lines_match_active_reservations_one_to_one` |
| Autorización de las acciones sobre repuestos | Cumplido | `workshop/test_parts.py::test_seller_and_anonymous_are_denied_without_effects`, `::test_accumulated_seller_and_manager_roles_allow_part_changes`; `workshop/test_billing_api.py::test_permission_matrix_for_billing_endpoints` |
| Experiencia de repuestos en la orden | Cumplido | `frontend/src/features/maintenance/billing.test.tsx` (PartsSection); `e2e/maintenance-billing.spec.ts` |
| Limpieza explícita de borradores vinculados vacíos | Cumplido | `sales/test_purge_empty_linked_drafts.py` (informe sin cambios, confirmación selectiva y repetible, protección de ventas no elegibles y contrato del comando) |

## Operación artesanal de servicios

| Requisito | Estado | Pruebas |
|---|---|---|
| Documento separado del RUC artesanal | Cumplido | `workshop/test_service_operations.py::test_confirm_documents_pending_initial_lines` (sin movimientos de inventario) |
| Líneas documentables y documentación única | Cumplido | `workshop/test_service_operations.py::test_new_lines_go_to_a_second_operation`, `::test_nothing_to_document`, `::test_zero_priced_lines_accompany_charged_lines`, `::test_corrective_lines_are_never_documented`, `::test_finalized_order_can_be_documented`; `workshop/test_service_operation_models.py::test_a_line_is_documented_once_while_current` |
| Importes e impuestos históricos de servicios | Cumplido | `workshop/test_service_operations.py::test_preview_has_no_effects_and_returns_digest` (15 %: base 20,00; impuesto 3,00), `::test_missing_tax_validity_is_an_error_not_an_exemption`, `::test_catalog_changes_do_not_alter_confirmed_operation`; `test_shared_money.py` |
| Revisión explícita antes de confirmar | Cumplido | `workshop/test_service_operations.py::test_changed_line_requires_new_review`, `::test_changed_condition_requires_new_review` |
| Confirmación atómica, numeración e idempotencia | Cumplido | `workshop/test_service_operations.py::test_retry_with_same_key_returns_same_operation`, `::test_failure_while_numbering_leaves_lines_pending`; `workshop/test_integration_concurrency.py::test_two_artisan_confirmations_of_the_same_order` |
| Bloqueo de líneas documentadas | Cumplido | `workshop/test_service_lines.py::test_documented_line_is_locked_until_its_operation_is_voided`; `workshop/test_integration_concurrency.py::test_editing_a_service_line_against_documenting_it` |
| Anulación de la operación artesanal | Cumplido | `workshop/test_service_operation_void.py` (5 pruebas) |
| Consulta y comprobante interno artesanal | Cumplido | `frontend/src/pages/maintenance/billingPages.test.tsx`; `workshop/test_service_operations.py::test_seller_cannot_preview_or_confirm` |
| Órdenes anteriores a esta entrega | Cumplido | `workshop/test_service_operations.py::test_orders_predating_billing_warn_before_confirming`; migración de datos `workshop/0004_mark_orders_predating_billing` (solo marca, sin documentos) |

## Pagos artesanales y crédito simple

| Requisito | Estado | Pruebas |
|---|---|---|
| Acceso a pagos artesanales por acción | Cumplido | `workshop/test_artisan_payments.py::test_seller_cannot_pay_and_manager_cannot_correct` |
| Contado y crédito separados del medio de pago | Cumplido | `workshop/test_artisan_payments.py::test_cash_condition_requires_full_payment`, `::test_credit_accepts_installments_and_derives_state` |
| Pago de una sola operación del RUC artesanal | Cumplido | `workshop/test_artisan_payments.py::test_combined_payment`, `::test_invalid_payments_are_rejected`, `::test_voided_operation_and_commercial_sale_ids_are_not_payable` |
| Saldo y estado de pago derivados | Cumplido | `workshop/test_artisan_payments.py::test_credit_accepts_installments_and_derives_state`, `::test_admin_voids_and_replaces_payments_keeping_history` |
| Corrección administrativa de pagos artesanales | Cumplido | `workshop/test_artisan_payments.py::test_admin_voids_and_replaces_payments_keeping_history` |
| Atomicidad, concurrencia e idempotencia de cobros artesanales | Cumplido | `workshop/test_artisan_payments.py::test_retry_with_same_operation_id_does_not_duplicate`; `workshop/test_integration_concurrency.py::test_two_full_artisan_payments_do_not_overpay`, `::test_payment_against_voiding_the_operation` |
| Cuentas por cobrar artesanales | Cumplido | `workshop/test_artisan_receivables.py` (5 pruebas); `frontend/src/pages/maintenance/billingPages.test.tsx` |
| Experiencia de cobro artesanal | Cumplido | `frontend/src/features/maintenance/billing.test.tsx` (diálogo de cobro); `e2e/maintenance-billing.spec.ts` |

## Resumen económico del mantenimiento

| Requisito | Estado | Pruebas |
|---|---|---|
| Bloques separados por RUC y documento | Cumplido | `workshop/test_economic_summary.py::test_both_blocks_are_separated_by_ruc`, `::test_only_services_block_and_no_empty_documents`, `::test_only_parts_with_zero_priced_services`, `::test_historical_documents_show_void_and_replacement` |
| Sin comprobante frente a obligaciones confirmadas | Cumplido | `workshop/test_economic_summary.py::test_pending_amounts_are_separated_from_confirmed`; `frontend/src/features/maintenance/billing.test.tsx` |
| Total combinado solo informativo | Cumplido | `workshop/test_economic_summary.py::test_both_blocks_are_separated_by_ruc`, `::test_manager_sees_commercial_block_without_actions_or_combined`; `frontend/src/features/maintenance/billing.test.tsx` |
| Visibilidad por rol en el resumen | Cumplido | `workshop/test_economic_summary.py::test_seller_cannot_read_order_summary`, `::test_seller_commercial_view_is_restricted` |

## Deltas de capacidades existentes

| Capacidad / requisito | Estado | Pruebas |
|---|---|---|
| Órdenes: autorización (vista restringida del Vendedor) | Cumplido | `workshop/test_economic_summary.py::test_seller_commercial_view_is_restricted`; `frontend/src/app/maintenance-billing-routes.test.tsx` |
| Órdenes: edición progresiva (cliente y vehículo bloqueados por documentos) | Cumplido | `workshop/test_orders.py::test_customer_and_vehicle_locked_by_linked_documents`, `::test_open_linked_sale_with_lines_blocks_customer_change`, `::test_confirmed_service_operation_locks_customer` |
| Órdenes: finalización con repuestos pendientes | Cumplido | `workshop/test_transitions.py::test_finalize_with_pending_parts_is_rejected_without_effects`, `::test_finalize_after_confirmed_credit_sale_with_undocumented_services`; `workshop/test_integration_concurrency.py::test_add_part_against_finalize` |
| Órdenes: reapertura con documentos confirmados y pagados | Cumplido | `workshop/test_transitions.py::test_reopen_keeps_confirmed_documents_and_inventory`; `e2e/maintenance-billing.spec.ts` |
| Órdenes: detalle y acciones visibles (pestañas) | Cumplido | `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx`; `workshop/test_domain_rules.py::test_billing_actions_follow_state_permissions_and_pending_services` |
| Órdenes: requisito eliminado «Ausencia de efectos» (migración de la garantía) | Cumplido | `workshop/test_no_side_effects.py::test_full_cycle_has_no_side_effects` |
| Servicios aplicados: líneas documentadas y total | Cumplido | `workshop/test_service_lines.py::test_documented_line_is_locked_until_its_operation_is_voided`; `frontend/src/features/maintenance/components.test.tsx` |
| Servicios y resumen: textos de comprobante interno | Cumplido | `frontend/src/features/maintenance/billing.test.tsx`, `frontend/src/features/maintenance/components.test.tsx`; `e2e/maintenance-billing.spec.ts` |
| Ventas: autorización, borradores vinculados, disponibilidad, consulta por origen | Cumplido | `sales/test_drafts.py::test_linked_draft_ordinary_edit_only_allows_condition_and_notes`; `sales/test_confirm.py::test_direct_confirmation_cannot_consume_stock_reserved_by_a_linked_sale`; `sales/test_review.py::test_review_uses_availability_and_adds_back_only_the_linked_sale_own_reservations`; `sales/test_api.py::test_origin_filter_and_field_are_exposed_by_all_sale_reads`; `frontend/src/pages/sales/*.test.tsx` |
| Existencias: reservas, disponibilidad y concurrencia | Cumplido | `inventory/test_reservations.py`; `inventory/test_posting.py` (3 pruebas de reservas); `inventory/test_adjustments.py::test_preview_and_review_token_use_available_stock`; `inventory/test_initial_load.py::test_initial_load_reversal_is_blocked_while_stock_is_reserved`; `purchasing/test_void.py::test_void_is_blocked_when_the_received_stock_is_reserved`; `inventory/test_stock_queries.py::test_stock_list_and_item_show_reserved_and_available`; `workshop/test_parts.py::test_reservation_identifies_the_order_for_the_inventory_sheet`; `frontend/src/pages/inventory/InventoryPage.test.tsx`; `frontend/src/pages/products/ProductDetailPage.test.tsx`; `inventory/test_reconcile.py::test_reserved_aggregate_must_match_active_reservations`; `workshop/test_integration_concurrency.py::test_reservation_against_negative_adjustment` |
| Correcciones: anulación de venta vinculada bloqueada | Cumplido | `sales/test_void.py::test_linked_sale_void_preview_and_command_are_not_available`; `frontend/src/pages/sales/SaleDetailPage.test.tsx` |
| Pagos comerciales: origen en cuentas por cobrar | Cumplido | `sales/test_queries.py::test_origin_filter_and_projection_cover_list_detail_document_and_receivables`; `sales/test_openapi.py::test_sale_list_and_receivables_publish_origin_filter` |

## Límites reales

- Las pruebas de concurrencia admiten cualquiera de los órdenes válidos. Verifican invariantes (sin existencia ni disponibilidad negativa, sin sobrepago, sin documentación doble), no una secuencia fija.
- Los pagos artesanales, igual que los comerciales, no registran referencia de transferencia ni efectivo recibido o cambio. Es una posible mejora conjunta fuera de esta entrega.
- La reposición por corrección (CU-024), la cancelación de órdenes y los reembolsos artesanales siguen pendientes.

## Retenciones recibidas en cobros artesanales

Cambio `registrar-retenciones-recibidas-en-cobros`: 3 requisitos y 6 escenarios de la spec delta artesanal. Matriz pendiente abierta el 2026-10-05; la capacidad compartida `retenciones-recibidas-en-cobros` se registra en `cobertura-ventas-pagos.md`.

| Capacidad / requisito | Escenarios | Tareas | Prueba o evidencia | Estado |
|---|---|---|---|---|
| [pagos-artesanales-y-credito-simple](../../../openspec/changes/registrar-retenciones-recibidas-en-cobros/specs/pagos-artesanales-y-credito-simple/spec.md) / Saldo y estado de pago derivados | Saldo reproducible; Estados independientes; Retención que completa el pago artesanal; Retención anulada no descuenta | 2, 7 | Pendiente | Pendiente |
| [pagos-artesanales-y-credito-simple](../../../openspec/changes/registrar-retenciones-recibidas-en-cobros/specs/pagos-artesanales-y-credito-simple/spec.md) / Retenciones en las cuentas por cobrar artesanales | Orden con retención en un solo ámbito | 2, 7 | Pendiente | Pendiente |
| [pagos-artesanales-y-credito-simple](../../../openspec/changes/registrar-retenciones-recibidas-en-cobros/specs/pagos-artesanales-y-credito-simple/spec.md) / Anulación de la operación con retenciones vigentes | Intento de anular con una retención vigente | 2, 7 | Pendiente | Pendiente |

Referencia terminológica: [cobertura-integracion-mantenimiento-glossary-reference.md](cobertura-integracion-mantenimiento-glossary-reference.md).
