# Cobertura de proformas comerciales

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `openspec/changes/gestionar-proformas-comerciales`; specs `proformas-comerciales` (nueva) y `ventas-comerciales` (delta) |
| Estado | Implementado (44 de 46 tareas); pendientes la suite completa (10.5), la verificación OpenSpec formal (10.6), la revisión visual humana del impreso y el archivo del cambio |
| Fecha | 2026-10-06 |
| Alcance | **Proformas** de productos del **RUC comercial**: borrador, emisión numerada, vigencia, anulación, copia vinculada, impresión y conversión única a venta. Excluye servicios, descuentos, reservas, anticipos, PDF en servidor y facturación electrónica |

## 1. Resumen

| Capacidad | Requisitos | Escenarios | Cumplidos | Parciales | Pendientes |
|---|---|---|---|---|---|
| Proformas comerciales | 10 | 45 | 45 | 0 | 0 |
| Ventas comerciales (delta) | 5 | 31 | 31 | 0 | 0 |
| **Total** | **15** | **76** | **76** | **0** | **0** |

«Cumplido» significa que una prueba automatizada ejecutada localmente verifica el comportamiento del escenario. «Regresión preservada» identifica los 18 escenarios ya vigentes de los requisitos modificados de `ventas-comerciales`: su evidencia original está en [cobertura de ventas y pagos](cobertura-ventas-pagos.md) y aquí se volvieron a ejecutar. Las rutas son relativas a la raíz del repositorio y `archivo::prueba` identifica la prueba exacta (cuando se cita un archivo, todas sus pruebas).

## 2. Escenarios

### Proformas comerciales

| ID | Requisito | Escenario | Prueba | Resultado |
|---|---|---|---|---|
| P-01 | Autorización de proformas por acción | Acciones comerciales autorizadas | `backend/tests/proformas/test_api.py::test_commercial_roles_can_use_every_action` | Cumplido |
| P-02 | Autorización de proformas por acción | Acceso directo sin rol comercial | `backend/tests/proformas/test_api.py::test_workshop_manager_alone_is_denied_everything_without_effects`; `frontend/src/app/proformas-routes.test.tsx` | Cumplido |
| P-03 | Autorización de proformas por acción | Roles acumulados sin acceso a costos | `backend/tests/proformas/test_api.py::test_combined_roles_never_receive_costs` | Cumplido |
| P-04 | Autorización de proformas por acción | Reintento después de perder autorización | `backend/tests/proformas/test_api.py::test_replay_after_losing_permission_reveals_nothing_and_repeats_nothing, ::test_unauthenticated_or_invalidated_session_is_rejected` | Cumplido |
| P-05 | Borradores de oferta comercial sin efectos definitivos | Preparar y corregir el borrador | `backend/tests/proformas/test_drafts.py::test_prepare_and_correct_the_draft` | Cumplido |
| P-06 | Borradores de oferta comercial sin efectos definitivos | Emitir una oferta incompleta | `backend/tests/proformas/test_issue.py::test_incomplete_offer_cannot_be_issued` | Cumplido |
| P-07 | Borradores de oferta comercial sin efectos definitivos | Línea incompatible | `backend/tests/proformas/test_drafts.py::test_incompatible_line_is_not_partially_saved`; `backend/tests/proformas/test_domain_input.py` | Cumplido |
| P-08 | Borradores de oferta comercial sin efectos definitivos | Producto desactivado antes de emitir | `backend/tests/proformas/test_issue.py::test_product_deactivated_before_issuing_identifies_the_line` | Cumplido |
| P-09 | Borradores de oferta comercial sin efectos definitivos | Cotizar un kit | `backend/tests/proformas/test_drafts.py::test_kit_is_quoted_intact` | Cumplido |
| P-10 | Borradores de oferta comercial sin efectos definitivos | Intento de cobrar una oferta | `backend/tests/proformas/test_api.py::test_no_delete_and_no_payment_routes_exist_for_offers` | Cumplido |
| P-11 | Precios de catálogo y cálculo de la oferta | Precio manual enviado por un Administrador | `backend/tests/proformas/test_drafts.py::test_manual_price_or_discount_from_an_administrator_is_rejected`; `backend/tests/proformas/test_api.py::test_unknown_and_economic_fields_are_rejected` | Cumplido |
| P-12 | Precios de catálogo y cálculo de la oferta | Desglose inclusivo de la oferta | `backend/tests/proformas/test_domain_amounts.py::test_inclusive_breakdown_of_the_offer`; `backend/tests/proformas/test_issue.py::test_valid_issue_numbers_and_freezes_the_offer_without_economic_effects` | Cumplido |
| P-13 | Precios de catálogo y cálculo de la oferta | Redondeo y suma por línea | `backend/tests/proformas/test_domain_amounts.py::test_rounding_is_per_line_and_the_document_sums_lines` | Cumplido |
| P-14 | Precios de catálogo y cálculo de la oferta | Cambio posterior a la revisión | `backend/tests/proformas/test_issue.py::test_relevant_change_after_review_requires_a_new_review` | Cumplido |
| P-15 | Precios de catálogo y cálculo de la oferta | Configuración tributaria ausente | `backend/tests/proformas/test_issue.py::test_missing_tax_configuration_is_an_impediment_not_an_exemption` | Cumplido |
| P-16 | Vigencia y estados de la oferta | Fecha sugerida y ajuste | `backend/tests/proformas/test_issue.py::test_suggested_validity_and_adjustment`; `backend/tests/proformas/test_domain_validity.py` | Cumplido |
| P-17 | Vigencia y estados de la oferta | Límite del vencimiento | `backend/tests/proformas/test_domain_validity.py::test_validity_is_inclusive_until_the_end_of_the_local_day`; `backend/tests/proformas/test_lifecycle_queries.py::test_validity_limit_without_manual_intervention` | Cumplido |
| P-18 | Vigencia y estados de la oferta | Emisión posterior a la fecha elegida | `backend/tests/proformas/test_issue.py::test_validity_before_today_must_be_corrected` | Cumplido |
| P-19 | Vigencia y estados de la oferta | Anular y conservar historia | `backend/tests/proformas/test_lifecycle_queries.py::test_void_valid_or_expired_offer_keeps_number_content_and_history` | Cumplido |
| P-20 | Vigencia y estados de la oferta | Estado terminal conservado | `backend/tests/proformas/test_lifecycle_queries.py::test_terminal_state_is_kept_and_never_reactivated` | Cumplido |
| P-21 | Emisión numerada e historia inmutable | Emisión válida | `backend/tests/proformas/test_issue.py::test_valid_issue_numbers_and_freezes_the_offer_without_economic_effects` | Cumplido |
| P-22 | Emisión numerada e historia inmutable | Cambio de datos maestros | `backend/tests/proformas/test_issue.py::test_master_data_changes_do_not_recalculate_the_issued_offer` | Cumplido |
| P-23 | Emisión numerada e historia inmutable | Edición de documento emitido | `backend/tests/proformas/test_drafts.py::test_issued_document_rejects_ordinary_edition`; `backend/tests/proformas/test_history_protection.py` | Cumplido |
| P-24 | Emisión numerada e historia inmutable | Falla durante emisión | `backend/tests/proformas/test_issue.py::test_failure_during_issue_rolls_everything_back` | Cumplido |
| P-25 | Emisión numerada e historia inmutable | Falta serie activa | `backend/tests/proformas/test_issue.py::test_missing_active_proforma_series_never_uses_another_series` | Cumplido |
| P-26 | Disponibilidad informativa sin reserva | Ofertar por encima de disponibilidad | `backend/tests/proformas/test_issue.py::test_quoting_above_availability_is_allowed_and_recorded` | Cumplido |
| P-27 | Disponibilidad informativa sin reserva | Stock cambia después de emitir | `backend/tests/proformas/test_lifecycle_queries.py::test_document_is_historical_and_separates_current_availability` | Cumplido |
| P-28 | Nueva oferta vinculada con valores actuales | Retomar una vencida con otro precio | `backend/tests/proformas/test_drafts.py::test_copy_of_expired_offer_uses_current_price_and_keeps_the_original` | Cumplido |
| P-29 | Nueva oferta vinculada con valores actuales | Cambiar cantidades de una emitida | `backend/tests/proformas/test_drafts.py::test_copy_changes_quantities_only_in_the_new_draft` | Cumplido |
| P-30 | Conversión única y atómica a venta | Conversión válida | `backend/tests/proformas/test_conversion.py::test_valid_conversion_creates_one_draft_sale_without_effects`; `frontend/e2e/proformas.spec.ts` | Cumplido |
| P-31 | Conversión única y atómica a venta | Oferta no convertible | `backend/tests/proformas/test_conversion.py::test_offer_that_is_not_convertible_creates_no_sale, ::test_new_attempt_on_converted_offer_reports_the_existing_sale` | Cumplido |
| P-32 | Conversión única y atómica a venta | Referencia desactivada al convertir | `backend/tests/proformas/test_conversion.py::test_deactivated_reference_is_reported_without_partial_sale` | Cumplido |
| P-33 | Conversión única y atómica a venta | Fallo de creación de la venta | `backend/tests/proformas/test_conversion.py::test_failure_after_creating_the_sale_rolls_everything_back` | Cumplido |
| P-34 | Conversión única y atómica a venta | Conversiones simultáneas | `backend/tests/proformas/test_concurrency.py::test_double_conversion_creates_a_single_sale` | Cumplido |
| P-35 | Conversión única y atómica a venta | Conversión compite con anulación o vencimiento | `backend/tests/proformas/test_concurrency.py::test_conversion_competes_with_void_without_partial_effects, ::test_day_changes_while_the_conversion_waits_for_the_lock` | Cumplido; el paso de día se prueba con reloj controlado en backend |
| P-36 | Reintentos y ediciones concurrentes de proformas | Respuesta de creación perdida | `backend/tests/proformas/test_drafts.py::test_lost_creation_response_returns_the_same_draft, ::test_copy_changes_quantities_only_in_the_new_draft` | Cumplido |
| P-37 | Reintentos y ediciones concurrentes de proformas | Reemisión del mismo documento | `backend/tests/proformas/test_issue.py::test_reissue_with_another_key_returns_the_same_number`; `backend/tests/proformas/test_concurrency.py::test_double_issue_of_the_same_draft_assigns_one_number`; `frontend/e2e/proformas.spec.ts` | Cumplido |
| P-38 | Reintentos y ediciones concurrentes de proformas | Identidad de intento incompatible | `backend/tests/proformas/test_drafts.py::test_reused_key_with_other_quantities_is_a_conflict` | Cumplido |
| P-39 | Reintentos y ediciones concurrentes de proformas | Guardado obsoleto | `backend/tests/proformas/test_drafts.py::test_stale_save_does_not_overwrite`; `backend/tests/proformas/test_concurrency.py::test_edit_competes_with_issue_without_partial_effects` | Cumplido |
| P-40 | Reintentos y ediciones concurrentes de proformas | Emisiones independientes simultáneas | `backend/tests/proformas/test_concurrency.py::test_simultaneous_issues_of_different_offers_get_distinct_consecutive_numbers` | Cumplido |
| P-41 | Consulta e impresión de cotizaciones | Buscar y navegar | `backend/tests/proformas/test_lifecycle_queries.py::test_search_filter_and_navigate`; `backend/tests/proformas/test_conversion.py::test_search_converted_and_open_the_linked_sale`; `frontend/src/pages/proformas/ProformasPage.test.tsx` | Cumplido |
| P-42 | Consulta e impresión de cotizaciones | Impresión comercial completa | `frontend/src/features/proformas/ProformaDocument.test.tsx`; `frontend/e2e/proformas.spec.ts (impresión A4 de 60 líneas)` | Cumplido; la fidelidad visual del impreso queda para revisión humana (evidencia en PDF y capturas fuera del repositorio) |
| P-43 | Consulta e impresión de cotizaciones | Emisor sin logo | `backend/tests/proformas/test_issue.py::test_offer_issued_without_logo_keeps_that_absence`; `frontend/src/features/proformas/ProformaDocument.test.tsx`; `frontend/e2e/proformas.spec.ts` | Cumplido |
| P-44 | Consulta e impresión de cotizaciones | Imprimir después de anular o vencer | `backend/tests/proformas/test_lifecycle_queries.py::test_document_after_void_or_expiry_keeps_values_and_shows_state`; `frontend/src/features/proformas/ProformaDocument.test.tsx` | Cumplido |
| P-45 | Consulta e impresión de cotizaciones | Captura accesible y error recuperable | `frontend/src/pages/proformas/ProformaEditorPage.test.tsx`; `frontend/e2e/proformas.spec.ts (360 px y teclado)` | Cumplido |

### Ventas comerciales (delta)

| ID | Requisito | Escenario | Prueba | Resultado |
|---|---|---|---|---|
| V-01 | Origen proforma conservado y venta editable | Cliente acepta una parte | `backend/tests/proformas/test_sale_from_proforma.py::test_customer_accepts_a_part` | Cumplido |
| V-02 | Origen proforma conservado y venta editable | Venta queda sin líneas | `backend/tests/proformas/test_sale_from_proforma.py::test_emptied_sale_keeps_its_link_and_cannot_be_confirmed_or_reconverted`; `backend/tests/proformas/test_history_protection.py::test_empty_sale_cannot_be_deleted_to_release_the_conversion` | Cumplido |
| V-03 | Origen proforma conservado y venta editable | Intento de cambiar el origen | `backend/tests/proformas/test_sale_from_proforma.py::test_origin_cannot_be_set_or_changed_through_the_ordinary_api`; `backend/tests/proformas/test_history_protection.py::test_sale_origin_is_protected_even_while_draft` | Cumplido |
| V-04 | Origen proforma conservado y venta editable | Anulación posterior de la venta | `backend/tests/proformas/test_sale_from_proforma.py::test_later_void_of_the_sale_keeps_the_offer_converted` | Cumplido |
| V-05 | Revisión de diferencias entre oferta y venta | Precio distinto al cotizado | `backend/tests/proformas/test_sale_from_proforma.py::test_price_different_from_the_quoted_one_is_shown_and_never_manual`; `backend/tests/sales/test_proforma_comparison.py` | Cumplido |
| V-06 | Revisión de diferencias entre oferta y venta | Cambia la tarifa | `backend/tests/proformas/test_sale_from_proforma.py::test_tax_rate_change_shows_the_current_breakdown` | Cumplido |
| V-07 | Revisión de diferencias entre oferta y venta | Conversión sin disponibilidad suficiente | `backend/tests/proformas/test_sale_from_proforma.py::test_conversion_without_availability_warns_and_confirmation_is_rejected`; `frontend/e2e/proformas.spec.ts` | Cumplido |
| V-08 | Revisión de diferencias entre oferta y venta | Nuevo cambio después de revisar | `backend/tests/proformas/test_sale_from_proforma.py::test_price_different_from_the_quoted_one_is_shown_and_never_manual (tramo 13.00)` | Cumplido |
| V-09 | Revisión de diferencias entre oferta y venta | Vence la oferta después de convertir | `backend/tests/proformas/test_sale_from_proforma.py::test_confirm_after_offer_expiry_and_charge_independently` | Cumplido |
| V-10 | Revisión de diferencias entre oferta y venta | Confirmación y cobro independientes | `backend/tests/proformas/test_sale_from_proforma.py::test_confirm_after_offer_expiry_and_charge_independently` | Cumplido |
| V-11 | Autorización comercial por acción | Vendedor confirma una venta autorizada | `backend/tests/sales/test_authorization.py, test_api.py` | Regresión preservada: reejecutada y aprobada |
| V-12 | Autorización comercial por acción | Encargado sin rol comercial intenta acceder | `backend/tests/sales/test_authorization.py, test_api.py` | Regresión preservada: reejecutada y aprobada |
| V-13 | Autorización comercial por acción | Encargado consulta la venta vinculada de una orden | `backend/tests/sales/test_authorization.py, test_api.py` | Regresión preservada: reejecutada y aprobada |
| V-14 | Autorización comercial por acción | Roles acumulados y costos restringidos | `backend/tests/sales/test_authorization.py, test_api.py` | Regresión preservada: reejecutada y aprobada |
| V-15 | Autorización comercial por acción | Sesión invalidada antes de confirmar | `backend/tests/sales/test_authorization.py, test_api.py` | Regresión preservada: reejecutada y aprobada |
| V-16 | Autorización comercial por acción | Acceso a venta de origen proforma | `backend/tests/proformas/test_sale_from_proforma.py::test_workshop_manager_gets_no_access_through_the_link` | Cumplido |
| V-17 | Borradores directos sin efectos económicos | Guardar y editar un borrador | `backend/tests/sales/test_drafts.py, test_confirm.py, test_workshop_links.py` | Regresión preservada: reejecutada y aprobada |
| V-18 | Borradores directos sin efectos económicos | Borrador vinculado reserva sin descontar | `backend/tests/sales/test_drafts.py, test_confirm.py, test_workshop_links.py` | Regresión preservada: reejecutada y aprobada |
| V-19 | Borradores directos sin efectos económicos | Confirmación incompleta o con cantidad inválida | `backend/tests/sales/test_drafts.py, test_confirm.py, test_workshop_links.py` | Regresión preservada: reejecutada y aprobada |
| V-20 | Borradores directos sin efectos económicos | Desactivación de producto después de preparar la venta | `backend/tests/sales/test_drafts.py, test_confirm.py, test_workshop_links.py` | Regresión preservada: reejecutada y aprobada |
| V-21 | Borradores directos sin efectos económicos | Intento de mezclar servicios o entidad artesanal | `backend/tests/sales/test_drafts.py, test_confirm.py, test_workshop_links.py` | Regresión preservada: reejecutada y aprobada |
| V-22 | Borradores directos sin efectos económicos | Venta de un kit completo | `backend/tests/sales/test_drafts.py, test_confirm.py, test_workshop_links.py` | Regresión preservada: reejecutada y aprobada |
| V-23 | Borradores directos sin efectos económicos | Editar cantidades sin cambiar la oferta original | `backend/tests/proformas/test_sale_from_proforma.py::test_editing_quantities_changes_only_the_sale_draft` | Cumplido |
| V-24 | Consulta comercial y comprobante interno accesibles | Filtrar ventas y abrir detalle | `backend/tests/sales/test_queries.py, test_api.py; frontend/src/pages/sales/*.test.tsx` | Regresión preservada: reejecutada y aprobada |
| V-25 | Consulta comercial y comprobante interno accesibles | Vendedor encuentra repuestos pendientes de confirmar | `backend/tests/sales/test_queries.py, test_api.py; frontend/src/pages/sales/*.test.tsx` | Regresión preservada: reejecutada y aprobada |
| V-26 | Consulta comercial y comprobante interno accesibles | Imprimir una venta anulada | `backend/tests/sales/test_queries.py, test_api.py; frontend/src/pages/sales/*.test.tsx` | Regresión preservada: reejecutada y aprobada |
| V-27 | Consulta comercial y comprobante interno accesibles | Error durante captura accesible | `backend/tests/sales/test_queries.py, test_api.py; frontend/src/pages/sales/*.test.tsx` | Regresión preservada: reejecutada y aprobada |
| V-28 | Consulta comercial y comprobante interno accesibles | Comprobante con logotipo comercial | `backend/tests/sales/test_queries.py, test_api.py; frontend/src/pages/sales/*.test.tsx` | Regresión preservada: reejecutada y aprobada |
| V-29 | Consulta comercial y comprobante interno accesibles | Comprobante sin logotipo comercial | `backend/tests/sales/test_queries.py, test_api.py; frontend/src/pages/sales/*.test.tsx` | Regresión preservada: reejecutada y aprobada |
| V-30 | Consulta comercial y comprobante interno accesibles | Encargado consulta una venta vinculada | `backend/tests/sales/test_queries.py, test_api.py; frontend/src/pages/sales/*.test.tsx` | Regresión preservada: reejecutada y aprobada |
| V-31 | Consulta comercial y comprobante interno accesibles | Filtrar ventas originadas por proformas | `backend/tests/proformas/test_sale_from_proforma.py::test_origin_filter_lists_only_sales_from_proformas`; `frontend/src/pages/sales/proforma-origin.test.tsx` | Cumplido |

## 3. Comandos y resultados

| Tarea | Comando | Resultado |
|---|---|---|
| 1.1 | `git status --short`; `git log --oneline` del cambio y de ADR-0012 | Propuesta `d166ec7`, specs `d23996e`, diseño y ADR `732562b`, tareas `310fd19` en `master` |
| 1.2, 10.3 | Generación de esta matriz desde ambas specs con comprobación `total == 76` | 45 escenarios de proformas y 31 de ventas |
| 2…7 (backend) | `cd backend && uv run --frozen pytest --no-cov tests/proformas tests/sales tests/api tests/workshop tests/fiscal tests/workshop_configuration/test_brand_contract.py` | 1464 aprobadas y 1 fallo ajeno y anterior a este cambio: `tests/fiscal/test_boundaries.py::test_fiscal_uses_only_published_cross_module_interfaces` (`fiscal/api/views.py` importa `workshop_configuration.application.withholding_settings` desde el cambio de retenciones) |
| 3.4 | `uv run --frozen python manage.py makemigrations --check --dry-run`; `tests/proformas/test_migrations.py` | `No changes detected`; avance y reversión sin datos nuevos aprobados. No se ejecutó `make migrate` sobre datos del usuario |
| 7.1, 7.2 | `uv run --frozen pytest --no-cov tests/proformas/test_concurrency.py` | 12 aprobadas con PostgreSQL real, conexiones independientes y barreras; sin esperas temporizadas |
| 7.5 | `uv run --frozen python manage.py spectacular --validate --file schema.yml` | 0 errores; 9 advertencias (7 únicas) no introducidas por proformas |
| Calidad backend | `uv run --frozen ruff format --check .`, `ruff check`, `mypy src tests/proformas` | Sin hallazgos |
| 8, 9.1, 9.2 (frontend) | `cd frontend && npx vitest run src/features/proformas src/pages/proformas src/features/sales src/pages/sales src/app/proformas-routes.test.tsx src/app/sales-routes.test.tsx src/shared/ui/business src/features/product-labels` | 30 archivos y 256 pruebas aprobadas; `tsc --noEmit`, ESLint y Prettier sin hallazgos en los archivos tocados |
| 9.3, 9.4 | `CI=1 PLAYWRIGHT_BASE_URL=… npx playwright test e2e/proformas.spec.ts --retries=0` | 6 aprobadas: flujo completo, respuesta perdida, sin stock, oferta vencida, logo histórico e impresión A4 de 60 líneas con 360 px, teclado y axe. Se ejecutó contra servidores en puertos alternos porque el 8001 lo ocupa otro proyecto. Además `e2e/product-labels.spec.ts` y los casos de comprobante de `e2e/sales-payments.spec.ts`: 3 aprobadas |
| 10.4 | `uv run --frozen pytest --no-cov tests/proformas/test_backup_restore.py`; `tests/proformas/test_conversion.py -k reconcil` | Respaldo `pg_dump` y restauración en base temporal: oferta, líneas, logo (hash y tamaño), vínculo y triggers conservados; conciliación de solo lectura aprobada |
| 10.5 (parcial) | Cobertura de `src/proformas`, `proforma_links`, `proforma_comparison` y `brand` con `tests/proformas`; `ruff format --check .`, `ruff check .`, `manage.py check`, `npm run build`, `docker compose config --quiet`, `openspec validate gestionar-proformas-comerciales --strict` | 93 % de cobertura (umbral 85 %); 278 aprobadas; lint, chequeo de Django, build, Compose y validación OpenSpec sin hallazgos. **La casilla 10.5 queda sin marcar**: `make check` completo no se ejecutó y fallaría por la prueba de frontera fiscal ajena |

No se ejecutó la suite completa (`make check`, `make test`) ni el resto de Playwright: solo las pruebas relacionadas con este cambio. `make audit` no aplica porque no se añadieron dependencias ni se tocaron los lockfiles.

## 4. Riesgos y limitaciones

- La oferta vencida en E2E se presenta interceptando la respuesta, porque la prueba no controla el día del servidor; la regla de fechas y sus rechazos se verifican en backend con reloj controlado.
- La impresión se verificó generando un PDF A4 de varias páginas y con aserciones de visibilidad; la aceptación visual humana del impreso sigue pendiente. El marco de la aplicación deja visible la franja «RUC comercial» al imprimir, igual que en los comprobantes de venta.
- La evidencia visual (PDF y capturas) se guardó fuera del repositorio, en la carpeta temporal de la sesión; no se versiona.
- El fallo de frontera del módulo fiscal es anterior y ajeno a este cambio; no se corrigió aquí.

Referencia terminológica: [cobertura-proformas-glossary-reference.md](cobertura-proformas-glossary-reference.md).
