# Cobertura de compras, inventario y Kardex

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `openspec/changes/archive/2026-09-24-gestionar-compras-entradas-inventario-kardex`; specs principales en `openspec/specs/compras-e-ingresos-de-mercaderia`, `existencias-y-ajustes-de-inventario` y `kardex-de-productos` |
| Estado | Cambio verificado y archivado el 2026-09-24; la evidencia local no sustituye la revisión visual humana pendiente |
| Fecha | 2026-09-20 |
| Alcance | Ingresos de mercadería, existencias, ajustes, cargas iniciales, Kardex y sus correcciones. Excluye alertas de stock mínimo, adjuntos, ventas, mantenimientos y pagos |

## 1. Resumen

| Capacidad | Requisitos | Escenarios | Cumplidos | Parciales | Pendientes |
|---|---|---|---|---|---|
| Compras e ingresos de mercadería | 12 | 46 | 46 | 0 | 0 |
| Existencias y ajustes de inventario | 10 | 37 | 37 | 0 | 0 |
| Kardex de productos | 7 | 22 | 22 | 0 | 0 |
| **Total** | **29** | **105** | **105** | **0** | **0** |

«Cumplido» significa que una prueba automatizada ejecutada localmente verifica el comportamiento del escenario. Las rutas son relativas a la raíz del repositorio; `archivo::prueba` identifica la prueba exacta y, cuando se cita solo un archivo o clase, todas las pruebas de ese ámbito. Las pruebas de extremo a extremo se ejecutan con `cd frontend && npm run test:e2e -- e2e/purchases-inventory.spec.ts`. La validación técnica no sustituye la aceptación visual humana de las nuevas pantallas.

## 2. Escenarios


### Compras e ingresos de mercadería

| Requisito | Escenario | Estado | Prueba y comando |
|---|---|---|---|
| Autorización de compras por operación | Administrador opera con su permiso | Cumplido | `backend/tests/purchasing/test_authorization.py::test_only_the_administrator_role_reaches_any_route`; `backend/tests/purchasing/test_api.py::TestRoutesAndPermissions`. |
| Autorización de compras por operación | Acceso directo de roles operativos | Cumplido | `backend/tests/purchasing/test_authorization.py::test_only_the_administrator_role_reaches_any_route`; `backend/tests/purchasing/test_drafts.py::TestPermissionsAndIdempotency::test_non_administrators_get_no_access_even_to_direct_reads`. |
| Autorización de compras por operación | Unión de roles y sesión invalidada | Cumplido | `backend/tests/purchasing/test_authorization.py::test_removing_the_administrator_role_invalidates_the_session`. |
| Borradores de recepción completa | Guardar y retomar un borrador | Cumplido | `backend/tests/purchasing/test_drafts.py::TestCreateAndRecover::test_draft_without_lines_can_be_saved_and_reopened`. |
| Borradores de recepción completa | Agregar y retirar líneas | Cumplido | `backend/tests/purchasing/test_drafts.py::TestCreateAndRecover::test_edit_replaces_lines_and_recomputes`. |
| Borradores de recepción completa | Edición simultánea del borrador | Cumplido | `backend/tests/purchasing/test_drafts.py::TestConcurrentEdits::test_stale_version_is_rejected_and_the_first_change_is_kept`. |
| Borradores de recepción completa | Manipulación de estado o borrado | Cumplido | `backend/tests/purchasing/test_drafts.py::TestValidationAndSafety::test_status_cannot_be_edited_or_history_deleted_through_the_service`; `backend/tests/purchasing/test_history_protection.py`. |
| Productos y proveedores confirmables | Proveedor ocasional registrado | Cumplido | `backend/tests/purchasing/test_drafts.py::TestReferences::test_occasional_supplier_with_only_a_name_is_valid`. |
| Productos y proveedores confirmables | Producto desactivado después de guardar | Cumplido | `backend/tests/purchasing/test_confirm.py::test_inactive_product_or_supplier_blocks_the_whole_confirmation`. |
| Productos y proveedores confirmables | Proveedor desactivado después de guardar | Cumplido | `backend/tests/purchasing/test_confirm.py::test_inactive_product_or_supplier_blocks_the_whole_confirmation`. |
| Productos y proveedores confirmables | Selección de un servicio | Cumplido | `backend/tests/purchasing/test_drafts.py::TestReferences::test_a_service_id_is_not_an_inventory_product`. |
| Productos y proveedores confirmables | Baja concurrente y confirmación | Cumplido | `backend/tests/purchasing/test_concurrency.py::test_product_deactivation_versus_confirmation_is_an_equivalent_serial_order`. La baja del proveedor comparte el mismo bloqueo del proveedor; se probó la del producto. |
| Cantidades de presentaciones y costos de compra | Presentación de medio galón | Cumplido | `backend/tests/purchasing/test_confirm.py::test_quantities_count_presentations_never_the_content_of_each_one`. |
| Cantidades de presentaciones y costos de compra | Fracción o precisión excedida | Cumplido | `backend/tests/purchasing/test_amounts.py::test_invalid_quantities_are_rejected_without_truncating`; `backend/tests/purchasing/test_drafts.py::TestValidationAndSafety::test_invalid_line_fields_are_reported_by_path`. |
| Cantidades de presentaciones y costos de compra | Costo cero explícito | Cumplido | `backend/tests/purchasing/test_amounts.py::test_unit_cost_accepts_zero_and_six_decimals`. |
| Cantidades de presentaciones y costos de compra | Producto repetido en líneas distintas | Cumplido | `backend/tests/purchasing/test_confirm.py::test_two_lines_of_the_same_product_are_one_movement_with_detail_kept`. |
| Impuestos de compra y totales históricos | IVA recuperable y no recuperable | Cumplido | `backend/tests/purchasing/test_amounts.py::test_recoverable_tax_is_excluded_from_inventory_value`; `backend/tests/purchasing/test_confirm.py::test_non_recoverable_tax_is_added_to_the_inventory_value_and_average`. |
| Impuestos de compra y totales históricos | Redondeo por línea | Cumplido | `backend/tests/purchasing/test_amounts.py::test_rounding_happens_per_line_and_document_sums_rounded_lines`. |
| Impuestos de compra y totales históricos | Clasificación ausente o parcial | Cumplido | `backend/tests/purchasing/test_amounts.py::test_treatment_must_be_explicit_and_binary`; `backend/tests/purchasing/test_drafts.py::TestValidationAndSafety::test_invalid_line_fields_are_reported_by_path`. |
| Impuestos de compra y totales históricos | Tarifa cero explícita y tarifa ausente | Cumplido | `backend/tests/purchasing/test_amounts.py::test_explicit_zero_rate_is_accepted_with_zero_tax`; `backend/tests/purchasing/test_confirm.py::test_missing_or_wrong_configuration_rejects_everything`. |
| Impuestos de compra y totales históricos | Totales manipulados | Cumplido | `backend/tests/purchasing/test_confirm.py::test_totals_imposed_by_the_client_are_rejected`; `backend/tests/purchasing/test_drafts.py::TestValidationAndSafety::test_client_supplied_totals_and_unknown_fields_are_rejected`. |
| Fechas documentales y vigencias de compra | Documento antiguo con tarifa distinta | Cumplido | `backend/tests/purchasing/test_confirm.py::test_an_old_document_uses_its_own_date_rate_and_is_recorded_after_existing_movements`. |
| Fechas documentales y vigencias de compra | Documento futuro | Cumplido | `backend/tests/purchasing/test_drafts.py::TestValidationAndSafety::test_future_document_date_is_rejected`; `backend/tests/purchasing/test_confirm.py::test_future_document_date_is_rejected_at_confirmation`. |
| Fechas documentales y vigencias de compra | Cambio de tarifa antes de confirmar | Cumplido | `backend/tests/purchasing/test_confirm.py::test_a_price_or_rate_change_after_review_requires_a_new_review`. |
| Referencia del proveedor y prevención de duplicados | Referencia repetida normalizada | Cumplido | `backend/tests/purchasing/test_document_identity.py::test_repeated_reference_is_rejected_after_normalization`; `backend/tests/purchasing/test_document_identity.py::test_duplicates_are_detected_even_against_voided_purchases`. |
| Referencia del proveedor y prevención de duplicados | Distinto proveedor o tipo | Cumplido | `backend/tests/purchasing/test_document_identity.py::test_other_supplier_or_type_is_another_identity`. |
| Referencia del proveedor y prevención de duplicados | Altas concurrentes duplicadas | Cumplido | `backend/tests/purchasing/test_concurrency.py::test_simultaneous_duplicate_drafts_persist_at_most_one`. |
| Referencia del proveedor y prevención de duplicados | Compra sin documento externo | Cumplido | `backend/tests/purchasing/test_document_identity.py::test_matching_undocumented_purchases_are_warned_and_need_acknowledgement`; `backend/tests/purchasing/test_document_identity.py::test_new_matches_after_the_review_require_a_new_review`. |
| Reemplazo vinculado de un documento anulado | Reemplazo después de anulación | Cumplido | `backend/tests/purchasing/test_replacement.py::test_confirming_the_replacement_assigns_a_new_number_and_keeps_the_chain`. |
| Reemplazo vinculado de un documento anulado | Reemplazos simultáneos | Cumplido | `backend/tests/purchasing/test_concurrency.py::test_two_replacements_of_the_same_voided_document_confirm_at_most_one`. |
| Confirmación atómica y numeración comercial | Recepción completa | Cumplido | `backend/tests/purchasing/test_confirm.py::test_confirmation_receives_all_lines_and_records_linked_effects`; `frontend/e2e/purchases-inventory.spec.ts (flujo completo)`. |
| Confirmación atómica y numeración comercial | Falla intermedia | Cumplido | `backend/tests/purchasing/test_confirm.py::test_intermediate_failure_rolls_back_effects_number_receipt_and_success_audit`. |
| Confirmación atómica y numeración comercial | Configuración ausente o ámbito incorrecto | Cumplido | `backend/tests/purchasing/test_confirm.py::test_missing_or_wrong_configuration_rejects_everything`; `backend/tests/purchasing/test_confirm.py::test_missing_warehouse_rejects_the_confirmation_without_effects`. |
| Confirmación atómica y numeración comercial | Confirmaciones de compras distintas | Cumplido | `backend/tests/purchasing/test_concurrency.py::test_confirmations_with_products_in_reverse_order_do_not_deadlock`. |
| Confirmación idempotente e historia económica | Doble clic y reintento con otra clave | Cumplido | `backend/tests/purchasing/test_confirm.py::test_repetition_with_another_key_or_actor_returns_the_existing_confirmation`; `backend/tests/purchasing/test_concurrency.py::test_repeated_confirmation_with_another_key_confirms_once`; `frontend/e2e/purchases-inventory.spec.ts (doble envío y tiempo agotado)`. |
| Confirmación idempotente e historia económica | Misma intención con otro contenido | Cumplido | `backend/tests/purchasing/test_confirm.py::test_compatible_repetition_with_the_same_key_replays`; `backend/tests/purchasing/test_confirm.py::test_incompatible_confirmation_of_an_already_confirmed_purchase_conflicts`. |
| Confirmación idempotente e historia económica | Catálogo modificado después de confirmar | Cumplido | `backend/tests/purchasing/test_confirm.py::test_confirmed_data_is_frozen_from_snapshots_even_if_catalog_changes`. |
| Anulación conservadora con compensación | Anulación segura de la última compra | Cumplido | `backend/tests/purchasing/test_void.py::test_void_restores_exact_quantity_value_and_average_and_keeps_the_number`. |
| Anulación conservadora con compensación | Movimiento posterior con stock suficiente | Cumplido | `backend/tests/purchasing/test_void.py::test_later_movement_blocks_even_with_enough_stock`. |
| Anulación conservadora con compensación | Un producto impide anular un documento completo | Cumplido | `backend/tests/purchasing/test_void.py::test_one_blocked_product_blocks_the_whole_document_without_partial_compensation`. |
| Anulación conservadora con compensación | Carrera entre salida y anulación | Cumplido | `backend/tests/purchasing/test_concurrency.py::test_void_and_exit_on_the_same_product_yield_one_valid_order`. |
| Anulación conservadora con compensación | Anulación repetida o fallida | Cumplido | `backend/tests/purchasing/test_void.py::test_repeated_void_returns_the_voided_state_without_a_second_compensation`; `backend/tests/purchasing/test_void.py::test_failure_during_void_keeps_the_purchase_confirmed_and_stock_untouched`; `backend/tests/purchasing/test_concurrency.py::test_two_competing_voids_produce_one_compensation`. |
| Consulta y experiencia de compras | Lista filtrada y retorno | Cumplido | `frontend/src/pages/purchases/PurchasesPage.test.tsx`; `frontend/e2e/purchases-inventory.spec.ts (filtros conservados)`. |
| Consulta y experiencia de compras | Confirmación cancelada | Cumplido | `frontend/src/pages/purchases/PurchaseEditorPage.test.tsx::cancelar la revisión no confirma nada y deja el borrador editable`. |
| Consulta y experiencia de compras | Error y recuperación del formulario | Cumplido | `frontend/src/pages/purchases/PurchaseEditorPage.test.tsx (validación por campo, review_required, stale_record)`. |
| Consulta y experiencia de compras | Consulta vacía o en carga | Cumplido | `frontend/src/pages/purchases/PurchasesPage.test.tsx::presenta estados de carga, error recuperable y vacío`. |

### Existencias y ajustes de inventario

| Requisito | Escenario | Estado | Prueba y comando |
|---|---|---|---|
| Existencia comercial explicada por movimientos | Borradores excluidos del saldo | Cumplido | `backend/tests/purchasing/test_drafts.py::TestCreateAndRecover::test_draft_with_lines_computes_amounts_without_effects`. |
| Existencia comercial explicada por movimientos | Conciliación con compensaciones | Cumplido | `backend/tests/inventory/test_reconcile.py::test_consistent_history_reconciles_to_zero_differences`. |
| Existencia comercial explicada por movimientos | Escritura directa de saldo | Cumplido | `backend/tests/inventory/test_api.py::TestNoDirectBalanceWrites`. |
| Existencia comercial explicada por movimientos | Bodega inexistente o diferente | Cumplido | `backend/tests/purchasing/test_confirm.py::test_missing_warehouse_rejects_the_confirmation_without_effects`; `backend/tests/inventory/test_api.py::TestOperations::test_warehouse_and_entity_cannot_be_chosen_by_the_client`. |
| Consulta de existencias e inactivos | Inactivo con existencias | Cumplido | `backend/tests/inventory/test_stock_queries.py::test_initial_query_includes_active_and_inactive_with_history_only`. |
| Consulta de existencias e inactivos | Inactivo agotado con historia | Cumplido | `backend/tests/inventory/test_stock_queries.py::test_inactive_product_depleted_but_with_history_still_appears`. |
| Consulta de existencias e inactivos | Filtros combinados y paginación | Cumplido | `backend/tests/inventory/test_stock_queries.py::test_filters_combine_by_intersection_with_a_correct_total`; `backend/tests/inventory/test_stock_queries.py::test_order_is_stable_and_pagination_reports_totals`. |
| Consulta de existencias e inactivos | Fallo de consulta | Cumplido | `frontend/src/pages/inventory/InventoryPage.test.tsx::un fallo de consulta ofrece reintentar y nunca presenta cero como saldo`. |
| Protección de costos y operaciones administrativas | Operativo consulta inventario | Cumplido | `backend/tests/inventory/test_authorization.py::test_every_role_reads_operative_data_but_only_the_administrator_sees_valuation`. |
| Protección de costos y operaciones administrativas | Ajuste directo sin permiso | Cumplido | `backend/tests/inventory/test_api.py::TestOperations::test_manual_actions_need_the_adjust_permission`. |
| Protección de costos y operaciones administrativas | Administrador con varios roles | Cumplido | `backend/tests/inventory/test_authorization.py::test_sessions_lose_manual_operations_when_the_role_is_reduced`; `backend/tests/purchasing/test_authorization.py::test_only_the_administrator_role_reaches_any_route`. |
| Carga inicial única y trazable | Primera carga de producto sin historia | Cumplido | `backend/tests/inventory/test_initial_load.py::test_first_load_creates_stock_value_and_own_origin_without_a_supplier`. |
| Carga inicial única y trazable | Dos cargas iniciales simultáneas | Cumplido | `backend/tests/inventory/test_concurrency.py::test_two_simultaneous_initial_loads_of_the_same_product_accept_at_most_one`. |
| Carga inicial única y trazable | Producto con historia aunque esté agotado | Cumplido | `backend/tests/inventory/test_initial_load.py::test_load_is_rejected_for_products_with_history_even_if_depleted`. |
| Carga inicial única y trazable | Carga ya compensada | Cumplido | `backend/tests/inventory/test_initial_load.py::test_load_already_compensated_cannot_be_repeated`. |
| Ajustes justificados con vista previa | Salida justificada | Cumplido | `backend/tests/inventory/test_adjustments.py::test_exit_adjustment_values_at_the_current_average`. |
| Ajustes justificados con vista previa | Entrada justificada sin costo | Cumplido | `backend/tests/inventory/test_adjustments.py::test_entry_adjustment_needs_an_explicit_inventoriable_cost`. |
| Ajustes justificados con vista previa | Stock cambiado después de la vista previa | Cumplido | `backend/tests/inventory/test_adjustments.py::test_a_relevant_change_since_the_preview_requires_an_updated_review`. |
| Ajustes justificados con vista previa | Salida de producto inactivo | Cumplido | `backend/tests/inventory/test_adjustments.py::test_exit_of_an_inactive_product_with_stock_is_allowed_but_new_entries_are_not`. |
| Ajustes justificados con vista previa | Cancelación de la vista previa | Cumplido | `backend/tests/inventory/test_adjustments.py::test_preparing_and_abandoning_changes_no_stock`. |
| Stock no negativo bajo concurrencia | Stock insuficiente | Cumplido | `backend/tests/inventory/test_posting.py::TestPostEntriesAndExits::test_insufficient_stock_fails_before_valuing_and_leaves_no_effects`; `frontend/e2e/purchases-inventory.spec.ts (stock insuficiente)`. |
| Stock no negativo bajo concurrencia | Dos salidas sobre las últimas unidades | Cumplido | `backend/tests/inventory/test_concurrency.py::test_two_exits_of_four_on_stock_five_confirm_at_most_one`. |
| Stock no negativo bajo concurrencia | Entrada y salida concurrentes | Cumplido | `backend/tests/inventory/test_concurrency.py::test_entry_of_three_and_exit_of_four_on_stock_two_never_go_negative`. |
| Valoración por promedio ponderado y conservación de valor | Promedio ponderado de una entrada | Cumplido | `backend/tests/inventory/test_valuation.py::test_weighted_average_after_an_entry`. |
| Valoración por promedio ponderado y conservación de valor | Agotamiento con residuo | Cumplido | `backend/tests/inventory/test_valuation.py::test_terminal_residue_is_absorbed_by_the_last_exit`. |
| Valoración por promedio ponderado y conservación de valor | Entrada posterior a agotamiento | Cumplido | `backend/tests/inventory/test_valuation.py::test_entry_after_depletion_does_not_carry_old_value`. |
| Valoración por promedio ponderado y conservación de valor | Valor histórico de una salida | Cumplido | `backend/tests/inventory/test_valuation.py::test_partial_exit_keeps_average_and_never_exceeds_retained_value`; `backend/tests/inventory/test_kardex.py::TestPeriodBalances::test_valuation_is_only_present_when_authorized`. |
| Correcciones de cargas y ajustes sin borrar historia | Revertir ajuste de entrada erróneo | Cumplido | `backend/tests/inventory/test_corrections.py::test_last_effect_is_reversed_exactly`. |
| Correcciones de cargas y ajustes sin borrar historia | Revertir salida que agotó stock | Cumplido | `backend/tests/inventory/test_corrections.py::test_reversal_of_an_exit_that_depleted_stock_restores_its_residue`. |
| Correcciones de cargas y ajustes sin borrar historia | Corrección con movimientos posteriores | Cumplido | `backend/tests/inventory/test_corrections.py::test_later_movements_block_the_reversal`; `backend/tests/inventory/test_corrections.py::test_a_physical_difference_can_be_linked_to_the_operation_it_corrects`. |
| Correcciones de cargas y ajustes sin borrar historia | Error solo de costo con dependencias | Cumplido | `backend/tests/inventory/test_corrections.py::test_linked_entry_uses_the_current_average_and_rejects_a_cost_only_correction`. |
| Idempotencia y auditoría de inventario | Repetición de ajuste confirmado | Cumplido | `backend/tests/inventory/test_idempotency.py::test_repeated_confirmation_with_another_key_returns_the_existing_operation`. |
| Idempotencia y auditoría de inventario | Reversión simultánea repetida | Cumplido | `backend/tests/inventory/test_concurrency.py::test_two_competing_manual_reversals_produce_one_compensation`. |
| Idempotencia y auditoría de inventario | Fallo de auditoría o persistencia | Cumplido | `backend/tests/inventory/test_idempotency.py::test_audit_failure_keeps_the_previous_balance_and_leaves_no_receipt`. |
| Experiencia y alcance de inventario | Navegación desde producto | Cumplido | `frontend/src/pages/products/ProductDetailPage.test.tsx::consulta el inventario por separado y enlaza al Kardex`. |
| Experiencia y alcance de inventario | Formulario accesible y error recuperable | Cumplido | `frontend/src/pages/inventory/InventoryPage.test.tsx::el ajuste exige motivo y costo explícito`; `frontend/e2e/purchases-inventory.spec.ts (accesibilidad y foco)`. |
| Experiencia y alcance de inventario | Umbrales fuera de entrega | Cumplido | `frontend/src/pages/inventory/InventoryPage.test.tsx::muestra presentación, unidad y existencia y distingue el cero real sin umbrales`. No hay campo, alerta ni umbral implementados; RF-INV-011 sigue pendiente. |

### Kardex de productos

| Requisito | Escenario | Estado | Prueba y comando |
|---|---|---|---|
| Historia cronológica e inmutable por producto | Horas coincidentes | Cumplido | `backend/tests/inventory/test_kardex.py::TestOrderingAndQueries::test_same_hour_keeps_ordinal_order`. |
| Historia cronológica e inmutable por producto | Documento antiguo recibido hoy | Cumplido | `backend/tests/purchasing/test_confirm.py::test_an_old_document_uses_its_own_date_rate_and_is_recorded_after_existing_movements`. |
| Historia cronológica e inmutable por producto | Operación anulada | Cumplido | `backend/tests/inventory/test_kardex.py::TestReversedOperations::test_original_and_compensation_both_remain_and_link_to_each_other`. |
| Filtros y paginación de movimientos | Período inclusivo del negocio | Cumplido | `backend/tests/inventory/test_kardex.py::TestDatesAndValidation::test_local_day_ranges_are_inclusive_and_converted_to_utc`. |
| Filtros y paginación de movimientos | Filtros combinados | Cumplido | `backend/tests/inventory/test_kardex.py::TestPeriodBalances::test_a_filter_hiding_an_entry_keeps_the_real_balance`; `backend/tests/inventory/test_api.py::TestKardex::test_filters_and_cut_token`. |
| Filtros y paginación de movimientos | Parámetros inválidos | Cumplido | `backend/tests/inventory/test_kardex.py::TestDatesAndValidation::test_invalid_input_is_a_correctable_error`; `backend/tests/inventory/test_api.py::TestKardex::test_filters_and_cut_token`. |
| Saldos anteriores y del período completo | Período con saldo previo | Cumplido | `backend/tests/inventory/test_kardex.py::TestPeriodBalances::test_opening_rows_and_closing_balances`. |
| Saldos anteriores y del período completo | Filtro de tipo oculta una entrada | Cumplido | `backend/tests/inventory/test_kardex.py::TestPeriodBalances::test_a_filter_hiding_an_entry_keeps_the_real_balance`. |
| Saldos anteriores y del período completo | Período sin movimientos | Cumplido | `backend/tests/inventory/test_kardex.py::TestPeriodBalances::test_period_without_movements_and_product_without_history`. |
| Saldos anteriores y del período completo | Filtro sin coincidencias pero período con efectos | Cumplido | `backend/tests/inventory/test_kardex.py::TestPeriodBalances::test_filter_without_matches_keeps_the_period_effects`. |
| Continuidad de saldos entre páginas | Segunda página con saldo acumulado | Cumplido | `backend/tests/inventory/test_kardex.py::TestPagination::test_second_page_shows_the_running_balance_and_its_opening`. |
| Continuidad de saldos entre páginas | Página filtrada con movimientos intermedios ocultos | Cumplido | `backend/tests/inventory/test_kardex.py::TestPagination::test_filtered_page_with_hidden_intermediates`. |
| Continuidad de saldos entre páginas | Movimiento concurrente con consulta | Cumplido | `backend/tests/inventory/test_kardex.py::TestPagination::test_new_movements_after_the_cut_do_not_appear_on_later_pages`; `backend/tests/inventory/test_concurrency.py::test_kardex_pages_keep_one_cut_while_another_user_posts`. |
| Costos de Kardex según autorización | Kardex administrativo valorizado | Cumplido | `backend/tests/inventory/test_api.py::TestKardex::test_envelope_and_valuation_visibility`. |
| Costos de Kardex según autorización | Kardex operativo sin filtración | Cumplido | `backend/tests/inventory/test_authorization.py::test_every_role_reads_operative_data_but_only_the_administrator_sees_valuation`; `backend/tests/inventory/test_authorization.py::test_error_messages_and_denied_writes_do_not_reveal_economics`. |
| Costos de Kardex según autorización | Cambio posterior del catálogo | Cumplido | `backend/tests/inventory/test_models.py::TestInventoryMovement::test_historical_snapshot_survives_catalog_changes`. |
| Acceso al origen y correcciones enlazadas | Administrador abre la compra | Cumplido | `backend/tests/inventory/test_authorization.py::test_inventory_view_permission_does_not_grant_purchase_access_or_origin_links`; `frontend/src/pages/inventory/InventoryOperationDetailPage.test.tsx`. |
| Acceso al origen y correcciones enlazadas | Operativo intenta abrir compra | Cumplido | `backend/tests/inventory/test_authorization.py::test_inventory_view_permission_does_not_grant_purchase_access_or_origin_links`. |
| Acceso al origen y correcciones enlazadas | Navegación entre compensación y original | Cumplido | `frontend/src/pages/inventory/InventoryOperationDetailPage.test.tsx::vincula la compensación con su original`. |
| Experiencia de consulta y verificación de integridad | Conciliación con inventario | Cumplido | `backend/tests/inventory/test_api.py::test_stock_item_and_kardex_share_the_same_ordinal_for_comparison`; `backend/tests/inventory/test_reconcile.py`. |
| Experiencia de consulta y verificación de integridad | Regreso desde un documento | Cumplido | `frontend/src/pages/inventory/KardexPage.test.tsx::vuelve a la ficha del producto cuando se llegó desde ella`; `frontend/src/pages/products/ProductDetailPage.test.tsx`. |
| Experiencia de consulta y verificación de integridad | Error de consulta accesible | Cumplido | `frontend/src/pages/inventory/KardexPage.test.tsx::un corte vencido pide actualizar en lugar de mezclar cortes`. |

## 3. Comandos de verificación

| Ámbito | Comando |
|---|---|
| Backend enfocado | `cd backend && uv run --frozen pytest --no-cov tests/inventory tests/purchasing` |
| Backend completo | `make test` |
| Frontend | `cd frontend && npm test` |
| Extremo a extremo | `cd frontend && npm run test:e2e -- e2e/purchases-inventory.spec.ts` |
| Conciliación | `cd backend && uv run --frozen python manage.py reconcile_inventory` |

## 4. Limitaciones registradas

- No se implementan alertas de stock mínimo (RF-INV-011), adjuntos ni operaciones futuras de inventario; siguen pendientes.
- La cobertura de este documento no declara implementados todos los requisitos RF-INV.
- La conciliación de solo lectura verifica el historial de inventario; no importa ni repara datos externos.
