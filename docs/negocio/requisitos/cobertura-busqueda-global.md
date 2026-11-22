# Cobertura de búsqueda global (`buscar-en-todo-el-sistema`, U5)

| Requisito | Evidencia automatizada |
|---|---|
| Consulta global de solo lectura en cuatro grupos (`busqueda-global`) | `backend/tests/home/test_search.py` (`test_plate_without_hyphen_and_diacritics_match`, `test_group_limit_caps_items_at_five_with_real_total`, `test_short_query_returns_empty_groups_without_db_queries`, `test_search_never_writes_nor_audits`), `backend/tests/home/test_boundaries.py` |
| Autorización en el servidor por rol y entidad fiscal (`busqueda-global`) | `backend/tests/home/test_search.py` (`test_anonymous_request_is_rejected`, `test_user_with_temporary_password_is_rejected`, `test_seller_sees_only_commercial_invoices_and_no_open_order`, `test_manager_sees_open_order_and_only_artisan_invoices`, `test_accumulated_roles_see_both_businesses_without_joint_total_or_sri_marks`, `test_nobody_receives_null_for_all_groups`, `test_products_never_expose_cost_or_valuation_to_any_role`, `test_product_stock_is_omitted_without_inventory_permission`) |
| Facturas en búsqueda antes de la emisión real (`busqueda-global`) | `backend/tests/home/test_search.py` (`test_accumulated_roles_see_both_businesses_without_joint_total_or_sri_marks`), `frontend/src/features/search/GlobalSearchDialog.test.tsx` |
| Navegación directa desde cada resultado (`busqueda-global`) | `frontend/src/features/search/GlobalSearchDialog.test.tsx` |
| Estados de consulta, recientes de sesión y accesibilidad (`busqueda-global`) | `frontend/src/features/search/GlobalSearchDialog.test.tsx`, `frontend/src/app/AuthenticatedShell.test.tsx` |
| Acceso a la búsqueda global desde cualquier pantalla (`navegacion-de-uso-diario`) | `frontend/src/app/AuthenticatedShell.test.tsx`, `frontend/src/pages/home/HomePage.test.tsx` |
