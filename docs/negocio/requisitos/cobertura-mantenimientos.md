# Cobertura de órdenes de mantenimiento

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `gestionar-ordenes-mantenimiento` |
| Estado | Evidencia local de implementación; **no** es aprobación humana ni archivo del cambio |
| Fecha | 2026-09-24 |
| Alcance | Órdenes del RUC artesanal (registrado, finalizado, reabierto), intervención inicial y correctivas, servicios del catálogo con precio aplicado, fotografías privadas e historial por cliente y vehículo. Excluye cancelación, repuestos, ventas vinculadas, operación artesanal económica, cobros, facturación y reportes |

## 1. Resumen

| Capacidad | Requisitos | Escenarios | Cumplidos | Parciales | Pendientes |
|---|---|---|---|---|---|
| Órdenes de mantenimiento | 14 | 47 | 47 | 0 | 0 |
| Servicios aplicados al mantenimiento | 7 | 21 | 21 | 0 | 0 |
| Fotografías de mantenimiento | 4 | 14 | 14 | 0 | 0 |
| Historial de mantenimientos | 4 | 6 | 6 | 0 | 0 |
| **Total** | **29** | **88** | **88** | **0** | **0** |

«Cumplido» significa que una prueba automatizada ejecutada localmente verifica el comportamiento del escenario; «Parcial» indica una limitación real descrita en la última columna. Las rutas son relativas a la raíz del repositorio. Comandos de verificación:

- Backend: `cd backend && uv run --frozen pytest --no-cov tests/workshop tests/customer_registry/test_workshop_references.py tests/catalog/test_workshop_references.py tests/workshop_configuration/test_workshop_references.py`.
- Frontend: `cd frontend && npm test -- src/features/maintenance src/pages/maintenance src/app/maintenance-routes.test.tsx src/pages/customers src/pages/vehicles`.
- Extremo a extremo y revisión visual: `cd frontend && npx playwright test e2e/maintenance.spec.ts` (ciclo completo, axe sin violaciones graves, Vendedor sin acceso a pantallas ni archivos; capturas en `frontend/test-results/maintenance-evidence/`, evidencia técnica y no baseline aprobado).
- Concurrencia: `backend/tests/workshop/test_concurrency.py` usa PostgreSQL real con conexiones independientes (ejecutado tres veces consecutivas en verde).

## 2. Requisitos del negocio cubiertos y aplazados

| Fuente | Cobertura en esta entrega |
|---|---|
| RN-TAL-001…004, 006…010, 015…019, 021 | Cubiertas en el alcance aprobado (propuesta P1…P5). |
| RN-TAL-005, RN-TAL-013 (cancelación) | Aplazadas: la cancelación no se implementa en esta entrega. |
| RN-TAL-011, 012, 014, 020 (venta vinculada y repuestos) | Aplazadas a la funcionalidad 8; existe el punto de extensión de comprobaciones de finalización, sin comprobaciones simuladas. |
| RF-TAL-001…007, 013, 015…021; RF-CLI-011 | Cubiertos en el alcance aprobado. RF-TAL-004 «se incluye en respaldos» depende de DA-003 (volumen documentado en README y ADR-0007). |
| RF-TAL-008…012, RF-TAL-014 | Aplazados (operación artesanal, pagos, repuestos, cancelación). |
| CU-017, CU-019 | Parciales: sin operación económica, pagos, repuestos ni cancelación. |
| UI-070…073, 075, 076, 078 | Implementadas sin saldos, repuestos ni cancelación. UI-074 y UI-077 aplazadas. |

## 3. Escenarios

### Órdenes de mantenimiento

| Requisito | Escenario | Estado | Prueba | Límite real |
|---|---|---|---|---|
| Autorización de órdenes por acción | Encargado del taller crea una orden | Cumplido | `backend/tests/workshop/test_orders.py::test_create_valid_order`; `backend/tests/workshop/test_authorization.py::test_workshop_roles_are_allowed`. | — |
| Autorización de órdenes por acción | Vendedor intenta consultar una orden | Cumplido | `backend/tests/workshop/test_authorization.py::test_seller_is_denied_everywhere`; `backend/tests/workshop/test_queries.py::test_seller_cannot_list`; `frontend/src/app/maintenance-routes.test.tsx`. | — |
| Autorización de órdenes por acción | Vendedor intenta modificar o cambiar el estado | Cumplido | `backend/tests/workshop/test_authorization.py::test_seller_is_denied_everywhere`. | — |
| Autorización de órdenes por acción | Roles acumulados | Cumplido | `backend/tests/workshop/test_authorization.py::test_workshop_roles_are_allowed[seller_manager]`. | — |
| Autorización de órdenes por acción | Sesión vencida durante la edición | Cumplido | `backend/tests/workshop/test_api.py::test_csrf_is_enforced_for_session_writes`; `backend/tests/workshop/test_authorization.py::test_anonymous_cannot_read_files`; `frontend/src/pages/maintenance/MaintenanceOrderEditorPage.test.tsx` (rechazo 403 conservando lo escrito). | — |
| Registro de una orden con cliente y vehículo válidos | Crear una orden válida | Cumplido | `backend/tests/workshop/test_orders.py::test_create_valid_order`; `frontend/src/pages/maintenance/MaintenanceOrderEditorPage.test.tsx`. | — |
| Registro de una orden con cliente y vehículo válidos | Vehículo incompatible con el cliente | Cumplido | `backend/tests/workshop/test_orders.py::test_vehicle_of_another_owner_is_rejected`. | — |
| Registro de una orden con cliente y vehículo válidos | Cliente o vehículo inactivo | Cumplido | `backend/tests/workshop/test_orders.py::test_inactive_references_are_rejected`. | — |
| Registro de una orden con cliente y vehículo válidos | Datos obligatorios ausentes o fecha futura | Cumplido | `backend/tests/workshop/test_orders.py::test_future_date_and_missing_fields`; `frontend/src/pages/maintenance/MaintenanceOrderEditorPage.test.tsx`. | — |
| Registro de una orden con cliente y vehículo válidos | Sin campos fuera del alcance aprobado | Cumplido | `backend/tests/workshop/test_domain_rules.py::test_unknown_fields_are_rejected`; `backend/tests/workshop/test_orders.py::test_system_fields_are_rejected`. | — |
| Número interno de la orden | Primera orden | Cumplido | `backend/tests/workshop/test_orders.py::test_create_valid_order`; `backend/tests/workshop/test_no_side_effects.py`. | — |
| Número interno de la orden | Creaciones simultáneas | Cumplido | `backend/tests/workshop/test_concurrency.py::test_parallel_creations_get_distinct_consecutive_numbers`. | — |
| Número interno de la orden | Creación rechazada | Cumplido | `backend/tests/workshop/test_orders.py::test_vehicle_of_another_owner_is_rejected`; `backend/tests/workshop/test_orders.py::test_second_open_order_for_vehicle`. | — |
| Una sola orden abierta por vehículo | Segunda orden abierta para el mismo vehículo | Cumplido | `backend/tests/workshop/test_orders.py::test_second_open_order_for_vehicle`; `frontend/src/pages/maintenance/MaintenanceOrderEditorPage.test.tsx`. | — |
| Una sola orden abierta por vehículo | Reapertura con otra orden abierta | Cumplido | `backend/tests/workshop/test_transitions.py::test_reopen_blocked_by_other_open_order`. | — |
| Una sola orden abierta por vehículo | Creaciones simultáneas para el mismo vehículo | Cumplido | `backend/tests/workshop/test_concurrency.py::test_parallel_creations_for_same_vehicle_create_one`. | — |
| Edición progresiva de una orden registrada | Completar el diagnóstico posteriormente | Cumplido | `backend/tests/workshop/test_orders.py::test_progressive_diagnosis`. | — |
| Edición progresiva de una orden registrada | Cambiar el vehículo por otro del mismo cliente | Cumplido | `backend/tests/workshop/test_orders.py::test_change_vehicle_updates_snapshot`. | — |
| Edición progresiva de una orden registrada | Edición con una versión desactualizada | Cumplido | `backend/tests/workshop/test_orders.py::test_stale_version_is_rejected`; `frontend/src/pages/maintenance/MaintenanceOrderEditorPage.test.tsx`. | — |
| Edición progresiva de una orden registrada | Intento de cambiar el estado mediante la edición | Cumplido | `backend/tests/workshop/test_orders.py::test_system_fields_are_rejected`. | — |
| Kilometraje de la orden | Kilometraje negativo o fraccionario | Cumplido | `backend/tests/workshop/test_domain_rules.py::test_invalid_odometer`. | — |
| Kilometraje de la orden | Kilometraje menor sin confirmar | Cumplido | `backend/tests/workshop/test_orders.py::test_lower_odometer_requires_confirmation`; `frontend/src/pages/maintenance/MaintenanceOrderEditorPage.test.tsx`. | — |
| Kilometraje de la orden | Kilometraje menor confirmado | Cumplido | `backend/tests/workshop/test_orders.py::test_lower_odometer_requires_confirmation`. | — |
| Kilometraje de la orden | Editar una orden anterior no reduce el historial | Cumplido | `backend/tests/workshop/test_orders.py::test_editing_does_not_touch_previous_orders`. | — |
| Datos históricos de cliente y vehículo | Transferencia posterior del vehículo | Cumplido | `backend/tests/workshop/test_queries.py::test_customer_history_follows_order_customer`; `backend/tests/workshop/test_queries.py::test_vehicle_history_includes_both_owners`. | — |
| Datos históricos de cliente y vehículo | Reabrir después de una transferencia | Cumplido | `backend/tests/workshop/test_transitions.py::test_reopen_after_transfer_keeps_customer`. | — |
| Datos históricos de cliente y vehículo | Edición de la ficha del vehículo | Cumplido | `backend/tests/workshop/test_queries.py::test_master_data_edits_do_not_rewrite_order_snapshots`. | — |
| Finalización explícita y atómica | Finalizar con información incompleta | Cumplido | `backend/tests/workshop/test_transitions.py::test_incomplete_order_lists_requirements`; `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx`. | — |
| Finalización explícita y atómica | Finalizar una orden completa | Cumplido | `backend/tests/workshop/test_transitions.py::test_finalize_complete_order`. | — |
| Finalización explícita y atómica | Finalización repetida | Cumplido | `backend/tests/workshop/test_transitions.py::test_repeated_finalization_is_idempotent`. | — |
| Finalización explícita y atómica | Edición y finalización simultáneas | Cumplido | `backend/tests/workshop/test_concurrency.py::test_edit_and_finalize_never_modify_a_finalized_order`. | — |
| Protección de la orden finalizada | Intento de editar una orden finalizada | Cumplido | `backend/tests/workshop/test_orders.py::test_general_data_not_editable_outside_registered`; `backend/tests/workshop/test_service_lines.py::test_lines_blocked_when_finalized`; `backend/tests/workshop/test_photos.py::test_finalized_order_rejects_upload_without_files`. | — |
| Protección de la orden finalizada | Intento de eliminar una orden | Cumplido | `backend/tests/workshop/test_api.py::test_orders_cannot_be_deleted`; `backend/tests/workshop/test_openapi.py`. | — |
| Reapertura explícita por corrección | Reapertura sin causa | Cumplido | `backend/tests/workshop/test_transitions.py::test_reopen_requires_reason`; `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx`. | — |
| Reapertura explícita por corrección | Reapertura con causa y nueva finalización | Cumplido | `backend/tests/workshop/test_transitions.py::test_full_cycle_preserves_history`. | — |
| Reapertura explícita por corrección | Intento de modificar la intervención inicial durante la reapertura | Cumplido | `backend/tests/workshop/test_transitions.py::test_initial_intervention_locked_while_reopened`; `backend/tests/workshop/test_service_lines.py::test_corrective_lines_are_free_and_initial_locked`. | — |
| Reapertura explícita por corrección | Reapertura repetida o simultánea | Cumplido | `backend/tests/workshop/test_concurrency.py::test_parallel_reopens_create_one_corrective_intervention`. | — |
| Reapertura explícita por corrección | Vendedor o usuario sin permiso intenta reabrir | Cumplido | `backend/tests/workshop/test_transitions.py::test_seller_cannot_reopen`. | — |
| Historial de transiciones y auditoría | Consultar el historial de transiciones | Cumplido | `backend/tests/workshop/test_transitions.py::test_full_cycle_preserves_history`; `frontend/src/features/maintenance/components.test.tsx`. | — |
| Historial de transiciones y auditoría | Acción denegada | Cumplido | `backend/tests/workshop/test_transitions.py::test_seller_cannot_reopen`; `backend/tests/workshop/test_authorization.py::test_seller_is_denied_everywhere`. | — |
| Listado, búsqueda y filtros de órdenes | Buscar por placa y filtrar por estado | Cumplido | `backend/tests/workshop/test_queries.py::test_search`; `backend/tests/workshop/test_queries.py::test_filters`; `frontend/src/pages/maintenance/MaintenanceOrdersPage.test.tsx`. | — |
| Listado, búsqueda y filtros de órdenes | Rango de fechas inválido | Cumplido | `backend/tests/workshop/test_queries.py::test_filters`; `backend/tests/workshop/test_api.py::test_errors_use_problem_contract`. | — |
| Listado, búsqueda y filtros de órdenes | Lista vacía | Cumplido | `frontend/src/pages/maintenance/MaintenanceOrdersPage.test.tsx`. | — |
| Detalle y acciones visibles de la orden | Acciones de una orden finalizada para el Encargado del taller | Cumplido | `backend/tests/workshop/test_domain_rules.py::test_allowed_actions_follow_state_and_permissions`; `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx`. | — |
| Detalle y acciones visibles de la orden | Resumen antes de finalizar | Cumplido | `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx`. | — |
| Detalle y acciones visibles de la orden | Sin secciones futuras simuladas | Cumplido | `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx`. | — |
| Ausencia de efectos económicos e inventario | Ciclo completo sin efectos colaterales | Cumplido | `backend/tests/workshop/test_no_side_effects.py::test_full_cycle_has_no_side_effects`. | — |

### Servicios aplicados al mantenimiento

| Requisito | Escenario | Estado | Prueba | Límite real |
|---|---|---|---|---|
| Agregar servicios activos del catálogo | Agregar un servicio con su precio referencial | Cumplido | `backend/tests/workshop/test_service_lines.py::test_add_service_copies_reference_price`. | — |
| Agregar servicios activos del catálogo | Servicio inactivo o inexistente | Cumplido | `backend/tests/workshop/test_service_lines.py::test_inactive_missing_or_free_service_rejected`. | — |
| Agregar servicios activos del catálogo | Servicio libre fuera del catálogo | Cumplido | `backend/tests/workshop/test_service_lines.py::test_inactive_missing_or_free_service_rejected`. | — |
| Agregar servicios activos del catálogo | Servicio repetido | Cumplido | `backend/tests/workshop/test_service_lines.py::test_repeated_service_forms_independent_lines`. | — |
| Agregar servicios activos del catálogo | Reintento al agregar una línea | Cumplido | `backend/tests/workshop/test_service_lines.py::test_retry_with_same_key_creates_one_line`. | — |
| Precio aplicado independiente del catálogo | Ajustar el precio aplicado | Cumplido | `backend/tests/workshop/test_service_lines.py::test_adjusted_price_does_not_touch_catalog`; `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx`. | — |
| Precio aplicado independiente del catálogo | Precio aplicado inválido | Cumplido | `backend/tests/workshop/test_service_lines.py::test_invalid_price_is_rejected`; `backend/tests/workshop/test_domain_amounts.py`. | — |
| Precio aplicado independiente del catálogo | Precio aplicado cero | Cumplido | `backend/tests/workshop/test_service_lines.py::test_zero_price_is_allowed`. | — |
| Precio aplicado independiente del catálogo | Intento de aplicar un descuento | Cumplido | `backend/tests/workshop/test_service_lines.py::test_discount_fields_are_rejected`. | — |
| Cambios posteriores del catálogo | Cambio de precio referencial después de agregar el servicio | Cumplido | `backend/tests/workshop/test_service_lines.py::test_catalog_changes_do_not_alter_existing_lines`. | — |
| Cambios posteriores del catálogo | Servicio desactivado después de usarse | Cumplido | `backend/tests/workshop/test_service_lines.py::test_catalog_changes_do_not_alter_existing_lines`; `backend/tests/workshop/test_queries.py::test_history_survives_deactivation`. | — |
| Editar y retirar líneas mientras la intervención esté abierta | Cambiar la cantidad | Cumplido | `backend/tests/workshop/test_service_lines.py::test_change_quantity_and_remove`. | — |
| Editar y retirar líneas mientras la intervención esté abierta | Cantidad inválida | Cumplido | `backend/tests/workshop/test_service_lines.py::test_invalid_quantity`. | — |
| Editar y retirar líneas mientras la intervención esté abierta | Retirar una línea | Cumplido | `backend/tests/workshop/test_service_lines.py::test_change_quantity_and_remove`; `frontend/src/features/maintenance/components.test.tsx`. | — |
| Editar y retirar líneas mientras la intervención esté abierta | Modificar líneas de una orden finalizada | Cumplido | `backend/tests/workshop/test_service_lines.py::test_lines_blocked_when_finalized`. | — |
| Servicios correctivos sin cargo | Servicio correctivo | Cumplido | `backend/tests/workshop/test_service_lines.py::test_corrective_lines_are_free_and_initial_locked`. | — |
| Servicios correctivos sin cargo | Intento de cobrar un servicio correctivo | Cumplido | `backend/tests/workshop/test_service_lines.py::test_corrective_lines_are_free_and_initial_locked`. | — |
| Subtotales y total calculados por el servidor | Precisión decimal | Cumplido | `backend/tests/workshop/test_domain_amounts.py::test_subtotal_and_total_are_exact`; `backend/tests/workshop/test_api.py::test_lines_finalize_and_reopen_via_http`. | — |
| Subtotales y total calculados por el servidor | Total manipulado por el cliente | Cumplido | `backend/tests/workshop/test_service_lines.py::test_client_amounts_are_not_accepted`. | — |
| Subtotales y total calculados por el servidor | Presentación del total | Cumplido | `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx`. | — |
| Autorización de las acciones sobre servicios | Vendedor intenta agregar un servicio | Cumplido | `backend/tests/workshop/test_authorization.py::test_seller_is_denied_everywhere`. | — |

### Fotografías de mantenimiento

| Requisito | Escenario | Estado | Prueba | Límite real |
|---|---|---|---|---|
| Adjuntar fotografías válidas a una orden abierta | Carga válida | Cumplido | `backend/tests/workshop/test_photos.py::test_valid_upload`; `backend/tests/workshop/test_api.py::test_photo_upload_download_and_headers`. | — |
| Adjuntar fotografías válidas a una orden abierta | Tipo de archivo no admitido | Cumplido | `backend/tests/workshop/test_photo_validation.py::test_invalid_content_is_rejected`; `backend/tests/workshop/test_photos.py::test_invalid_file_leaves_nothing`; `frontend/src/features/maintenance/components.test.tsx`. | — |
| Adjuntar fotografías válidas a una orden abierta | Tamaño o resolución excedidos | Cumplido | `backend/tests/workshop/test_photo_validation.py::test_too_large_file_is_rejected_before_reading`; `backend/tests/workshop/test_photo_validation.py::test_too_many_pixels_is_rejected`. | — |
| Adjuntar fotografías válidas a una orden abierta | Límite de fotografías por orden | Cumplido | `backend/tests/workshop/test_photos.py::test_photo_limit`. | — |
| Adjuntar fotografías válidas a una orden abierta | Reintento de la misma carga | Cumplido | `backend/tests/workshop/test_photos.py::test_idempotent_retry`. | — |
| Consulta privada de fotografías | Usuario autorizado visualiza una fotografía | Cumplido | `backend/tests/workshop/test_api.py::test_photo_upload_download_and_headers`; `frontend/src/features/maintenance/components.test.tsx`. | — |
| Consulta privada de fotografías | Acceso no autorizado a una fotografía | Cumplido | `backend/tests/workshop/test_authorization.py::test_seller_is_denied_everywhere`; `backend/tests/workshop/test_authorization.py::test_anonymous_cannot_read_files`. | — |
| Consulta privada de fotografías | Consulta desde una orden finalizada | Cumplido | `backend/tests/workshop/test_photos.py::test_finalized_order_rejects_upload_without_files`; `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx`. | — |
| Retiro de fotografías | Retirar una fotografía de una orden registrada | Cumplido | `backend/tests/workshop/test_photos.py::test_remove_is_audited_and_deletes_files`. | — |
| Retiro de fotografías | Retirar una fotografía de la intervención inicial en una orden reabierta | Cumplido | `backend/tests/workshop/test_photos.py::test_initial_photos_kept_while_reopened`. | — |
| Retiro de fotografías | Retiro repetido | Cumplido | `backend/tests/workshop/test_photos.py::test_remove_is_audited_and_deletes_files`. | — |
| Consistencia de archivos ante fallos y concurrencia | Falla al guardar el archivo | Cumplido | `backend/tests/workshop/test_photos.py::test_database_failure_after_writing_files_leaves_nothing`; `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx` (conserva archivo y descripción). | — |
| Consistencia de archivos ante fallos y concurrencia | Carga simultánea con la finalización | Cumplido | `backend/tests/workshop/test_concurrency.py::test_photo_upload_racing_finalization`. | — |
| Consistencia de archivos ante fallos y concurrencia | Limpieza repetida | Cumplido | `backend/tests/workshop/test_purge_files.py`. | — |

### Historial de mantenimientos

| Requisito | Escenario | Estado | Prueba | Límite real |
|---|---|---|---|---|
| Historial por vehículo | Vehículo con órdenes de dos propietarios | Cumplido | `backend/tests/workshop/test_queries.py::test_vehicle_history_includes_both_owners`. | — |
| Historial por vehículo | Abrir el detalle desde el historial | Cumplido | `frontend/src/features/maintenance/MaintenanceHistorySection.test.tsx`. | — |
| Historial por cliente | Cliente que vendió su vehículo | Cumplido | `backend/tests/workshop/test_queries.py::test_customer_history_follows_order_customer`. | — |
| Conservación del historial ante desactivaciones | Consulta histórica después de desactivar entidades | Cumplido | `backend/tests/workshop/test_queries.py::test_history_survives_deactivation`. | — |
| Autorización del historial | Vendedor consulta la ficha de un cliente | Cumplido | `frontend/src/pages/customers/CustomerDetailPage.test.tsx`; `frontend/src/pages/vehicles/VehicleDetailPage.test.tsx`; `backend/tests/workshop/test_queries.py::test_seller_cannot_list`. | — |
| Autorización del historial | Historial vacío | Cumplido | `frontend/src/features/maintenance/MaintenanceHistorySection.test.tsx`. | — |

> Ampliación posterior: la integración con repuestos, ventas vinculadas, operación artesanal y cobros por RUC se documenta en [cobertura-integracion-mantenimiento.md](cobertura-integracion-mantenimiento.md).
