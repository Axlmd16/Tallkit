# Cobertura de la página de inicio

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `openspec/changes/archive/2026-10-07-redisenar-pagina-de-inicio`; specs `pagina-de-inicio` (nueva) y `sistema-visual-frontend` (delta) |
| Estado | Cambio verificado, sincronizado con las specs principales (`openspec/specs/pagina-de-inicio` y `openspec/specs/sistema-visual-frontend`) y archivado; la aceptación visual final corresponde al usuario |
| Fecha | 2026-10-06 |
| Alcance | Resumen de trabajo del inicio: acciones rápidas, pendientes, saldos por cobrar separados por **entidad fiscal** y cobros de los últimos siete días, limitado por **permisos efectivos**. Excluye stock bajo, estado del respaldo, cierre de caja, márgenes y reportes |

## 1. Resumen

| Capacidad | Requisitos | Escenarios | Cumplidos | Parciales | Pendientes |
|---|---|---|---|---|---|
| Página de inicio | 9 | 41 | 41 | 0 | 0 |
| Sistema visual (delta) | 1 | 6 | 6 | 0 | 0 |
| **Total** | **10** | **47** | **47** | **0** | **0** |

«Cumplido» significa que una prueba automatizada ejecutada localmente verifica el escenario. La columna «Prueba» nombra el archivo y la prueba; Las rutas de backend son relativas a `backend/` y las de frontend a `frontend/src/` o `frontend/`.

Notas:

- **I-09.** El escenario menciona una orden «cancelada», estado que el sistema todavía no tiene (RF-TAL-014 pendiente). La prueba usa los estados existentes; «abierta» se define por `registrado` y `reabierto`.
- **I-04.** No existe una dirección por indicador: la respuesta de cada rol simplemente no contiene los indicadores ajenos.
- **I-32.** La documentación no fija un volumen objetivo; se midió con un volumen sintético de 5 000 ventas confirmadas y 5 000 cobros.
- **I-41.** La aceptación visual final corresponde al usuario.

## 2. Escenarios

### Página de inicio

| ID | Requisito | Escenario | Tarea | Prueba | Resultado |
|---|---|---|---|---|---|
| I-01 | Resumen de inicio limitado por permisos efectivos | Resumen de un Vendedor | 5.2 | `tests/home/test_api.py::test_seller_receives_only_commercial_indicators`; `e2e/home.spec.ts` (Vendedor) | Cumplido |
| I-02 | Resumen de inicio limitado por permisos efectivos | Resumen de un Encargado del taller | 5.2 | `tests/home/test_api.py::test_manager_receives_only_workshop_indicators`; `e2e/home.spec.ts` (Encargado) | Cumplido |
| I-03 | Resumen de inicio limitado por permisos efectivos | Roles acumulados | 5.2 | `tests/home/test_api.py::test_accumulated_roles_receive_the_union` | Cumplido |
| I-04 | Resumen de inicio limitado por permisos efectivos | Consulta directa sin permiso | 5.2 | `tests/home/test_api.py::test_manager_receives_only_workshop_indicators` y `…seller_receives_only_commercial…`: la respuesta nunca contiene claves ajenas; no existe una dirección por indicador | Cumplido |
| I-05 | Resumen de inicio limitado por permisos efectivos | Sesión invalidada | 5.2 | `tests/home/test_api.py::test_anonymous_request_is_rejected`, `test_user_with_temporary_password_is_rejected` | Cumplido |
| I-06 | Acciones rápidas hacia las operaciones frecuentes | Accesos de un Vendedor | 8.2, 8.3 | `features/home/home.test.ts`; `pages/home/HomePage.test.tsx` «un Vendedor ve sus accesos» | Cumplido |
| I-07 | Acciones rápidas hacia las operaciones frecuentes | Cobrar con las dos entidades | 8.3 | `HomePage.test.tsx` «quien cobra en las dos entidades»; `e2e/home.spec.ts` (Administrador) | Cumplido |
| I-08 | Acciones rápidas hacia las operaciones frecuentes | Acceso sin efectos | 5.5, 8.3 | `tests/home/test_api.py::test_reading_the_summary_writes_nothing_and_audits_nothing`; `e2e/home.spec.ts` abre «Nueva venta» sin crear nada | Cumplido |
| I-09 | Pendientes con acceso a su lista | Mantenimientos abiertos | 3.1, 3.3 | `tests/workshop/test_home_summary.py::test_open_state_gathers_registered_and_reopened`; `e2e/home.spec.ts` | Cumplido |
| I-10 | Pendientes con acceso a su lista | Venta de contado con cobro interrumpido | 2.2 | `tests/sales/test_home_summary.py::test_cash_sale_with_interrupted_charge_counts_and_credit_does_not` | Cumplido |
| I-11 | Pendientes con acceso a su lista | Contado cubierto con retención | 2.2 | `tests/sales/test_home_summary.py::test_cash_sale_covered_with_a_withholding_does_not_count` | Cumplido |
| I-12 | Pendientes con acceso a su lista | Proformas que vencen hoy o mañana | 4.1, 4.2 | `tests/proformas/test_home_summary.py::test_offers_expiring_today_or_tomorrow` | Cumplido |
| I-13 | Pendientes con acceso a su lista | Retenciones separadas por entidad | 2.3, 3.3, 8.4 | `tests/sales/…::test_pending_withholdings_match_the_list`; `tests/workshop/…::test_pending_withholdings_match_the_list`; `HomePage.test.tsx` «retenciones separadas por entidad» | Cumplido |
| I-14 | Pendientes con acceso a su lista | Entidad que no registra retenciones | 4.4, 5.2 | `tests/home/test_api.py::test_withholdings_of_an_entity_that_does_not_register_them_are_omitted` | Cumplido |
| I-15 | Pendientes con acceso a su lista | Calificación artesanal dentro del plazo de aviso | 4.3, 5.2, 8.4 | `tests/workshop_configuration/test_home_summary.py` (45 días); `tests/home/test_api.py::test_only_the_administrator_receives_the_qualification_notice`; `HomePage.test.tsx` | Cumplido |
| I-16 | Pendientes con acceso a su lista | Calificación artesanal fuera del plazo de aviso | 4.3 | `tests/workshop_configuration/test_home_summary.py::test_no_notice_sixty_one_days_before` | Cumplido |
| I-17 | Pendientes con acceso a su lista | Sin pendientes | 8.4 | `HomePage.test.tsx` «sin pendientes, cada indicador queda en cero» | Cumplido |
| I-18 | Saldos por cobrar separados por entidad fiscal | Administrador con deuda en las dos entidades | 2.4, 3.4, 8.5 | `tests/sales/…::test_balance_and_customers_match_the_receivables`; `tests/workshop/…` homónima; `HomePage.test.tsx` «sin sumarlos» | Cumplido |
| I-19 | Saldos por cobrar separados por entidad fiscal | Retención que reduce el saldo | 2.4 | `tests/sales/test_home_summary.py::test_withholding_reduces_the_balance` | Cumplido |
| I-20 | Saldos por cobrar separados por entidad fiscal | Reembolso pendiente | 2.4 | `tests/sales/test_home_summary.py::test_pending_refund_is_neither_added_nor_subtracted` | Cumplido |
| I-21 | Saldos por cobrar separados por entidad fiscal | Coincidencia con las cuentas por cobrar | 2.4, 3.4 | `tests/sales/…` y `tests/workshop/…::test_home_routes_show_the_same_numbers_as_the_lists` | Cumplido |
| I-22 | Saldos por cobrar separados por entidad fiscal | Sin deuda | 2.4, 3.4, 8.5 | `tests/sales/…::test_no_debt_is_zero`; `tests/workshop/…::test_no_debt_is_zero`; `HomePage.test.tsx` «sin deuda» | Cumplido |
| I-23 | Cobros de los últimos siete días por entidad fiscal | Siete días con un día sin cobros | 2.5 | `tests/sales/test_home_summary.py::test_seven_days_with_a_day_without_collections` | Cumplido |
| I-24 | Cobros de los últimos siete días por entidad fiscal | Cobro cerca de la medianoche | 2.5, 3.5 | `tests/sales/…::test_payment_uses_its_business_date`; `tests/workshop/…::test_window_and_business_date` | Cumplido |
| I-25 | Cobros de los últimos siete días por entidad fiscal | Pago con retención | 2.5 | `tests/sales/test_home_summary.py::test_withholding_is_not_collected_money` | Cumplido |
| I-26 | Cobros de los últimos siete días por entidad fiscal | Pago anulado | 2.5, 3.5 | `tests/sales/…::test_voided_payment_is_not_counted`; `tests/workshop/…::test_withholding_and_voided_payment_are_not_collected_money` | Cumplido |
| I-27 | Cobros de los últimos siete días por entidad fiscal | Efectivo y transferencia combinados | 3.5 | `tests/workshop/test_home_summary.py::test_combined_payment_adds_both_parts_today` | Cumplido |
| I-28 | Cobros de los últimos siete días por entidad fiscal | Dos entidades sin total conjunto | 5.4, 8.6 | `tests/home/test_api.py::test_collections_cover_seven_business_days_per_entity`; `HomePage.test.tsx` «sin total conjunto» | Cumplido |
| I-29 | Cobros de los últimos siete días por entidad fiscal | Lectura sin el gráfico | 6.2, 8.6 | `MiniBarChart.test.tsx` «cada barra expone su fecha y su importe»; `HomePage.test.tsx` «se puede leer como texto» | Cumplido |
| I-30 | Resumen calculado y de solo lectura | Valor actualizado tras una operación | 9.1 | `e2e/home.spec.ts` «baja al atenderlo» | Cumplido |
| I-31 | Resumen calculado y de solo lectura | Consulta sin efectos | 5.5 | `tests/home/test_api.py::test_reading_the_summary_writes_nothing_and_audits_nothing` | Cumplido |
| I-32 | Resumen calculado y de solo lectura | Tiempo de respuesta | 5.6 | `tests/sales/test_home_summary_volume.py` (5 000 ventas y cobros: 0,12 s en total); `tests/home/test_api.py::test_each_route_stays_within_its_query_budget` | Cumplido |
| I-33 | Estados independientes por bloque | Falla un solo bloque | 8.7 | `HomePage.test.tsx` «si falla un bloque, solo ese muestra el error» | Cumplido |
| I-34 | Estados independientes por bloque | Dato no disponible | 8.7 | `HomePage.test.tsx` «un dato que no pudo obtenerse no se muestra como cero» | Cumplido |
| I-35 | Estados independientes por bloque | Carga | 8.7 | `HomePage.test.tsx` «mientras carga, cada bloque muestra marcadores de posición» | Cumplido |
| I-36 | Estados independientes por bloque | Usuario sin funciones | 8.7 | `HomePage.test.tsx` «un usuario sin funciones ve un estado vacío» | Cumplido |
| I-37 | Inicio sin repetir la navegación | Inicio de un Administrador | 8.7 | `HomePage.test.tsx` «no repite la navegación» | Cumplido |
| I-38 | Presentación conforme al sistema Tallkit | Teléfono de 360 px | 8.8, 9.2 | `e2e/home.spec.ts` a 360 px: sin desplazamiento horizontal y objetivos de 44 px | Cumplido |
| I-39 | Presentación conforme al sistema Tallkit | Uso con teclado | 8.8, 9.2 | `e2e/home.spec.ts`: foco en acciones y barras; `StatLink.test.tsx` | Cumplido |
| I-40 | Presentación conforme al sistema Tallkit | Persona que no distingue el color | 6.1, 6.2 | `StatLink.test.tsx` y `MiniBarChart.test.tsx`: nombre e icono del ámbito | Cumplido |
| I-41 | Presentación conforme al sistema Tallkit | Coherencia con el resto de las pantallas | 9.3 | Revisión visual de las capturas a 360, 768 y 1280 px de `e2e/home.spec.ts` frente a las listas; solo tokens existentes | Cumplido |

### Sistema visual (delta)

| ID | Requisito | Escenario | Tarea | Prueba | Resultado |
|---|---|---|---|---|---|
| V-01 | Indicadores con conteo y gráfico breve | Varios indicadores en un panel | 6.1 | `StatLink.test.tsx` «varios indicadores comparten un panel» | Cumplido |
| V-02 | Indicadores con conteo y gráfico breve | Indicador que conduce a una lista | 6.1 | `StatLink.test.tsx` «es un enlace cuyo nombre reúne valor, etiqueta y ámbito», «foco visible» | Cumplido |
| V-03 | Indicadores con conteo y gráfico breve | Gráfico de un ámbito fiscal | 6.2 | `MiniBarChart.test.tsx` «identifica su ámbito con nombre e icono y usa su tono» | Cumplido |
| V-04 | Indicadores con conteo y gráfico breve | Valor de una barra | 6.2 | `MiniBarChart.test.tsx` «cada barra expone…», «muestra el valor al enfocar»; `e2e/home.spec.ts` | Cumplido |
| V-05 | Indicadores con conteo y gráfico breve | Movimiento reducido | 6.2 | `MiniBarChart.test.tsx` «no anima cuando el dispositivo pide movimiento reducido» | Cumplido |
| V-06 | Indicadores con conteo y gráfico breve | Cambio de un token | 6.1, 6.2 | Las piezas solo usan clases de token (`bg-scope-*`, `text-ink`…); `MiniBarChart.test.tsx` comprueba el tono por ámbito | Cumplido |

## 3. Verificación ejecutada

Ejecutado localmente el 2026-10-06, con pruebas focalizadas en lo que toca este cambio.

| Comando | Resultado |
|---|---|
| `uv run --frozen ruff format --check .` y `ruff check .` (backend) | Sin observaciones (644 archivos) |
| `uv run --frozen mypy src` | Sin errores (314 archivos) |
| `uv run --frozen python manage.py check` y `makemigrations --check --dry-run` | Sin incidencias; ningún cambio de esquema |
| `uv run --frozen pytest --no-cov` sobre `tests/home`, los `test_home_summary*` de ventas, taller, proformas y configuración, las pruebas de API y consultas de las listas tocadas, OpenAPI y todas las de fronteras | 277 aprobadas |
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Sin observaciones |
| `npx vitest run` sobre `pages/home`, `features/home`, `shared/ui`, `dev/visual-catalog`, las cuatro listas tocadas y `app` | 484 aprobadas en 66 archivos |
| `npm run build` | Correcto |
| `npx playwright test home.spec.ts` | 4 aprobadas, con `axe` y sin desplazamiento horizontal a 360, 768 y 1280 px |
| `openspec validate redisenar-pagina-de-inicio --strict` | Válido |

Verificación del cambio (2026-10-06): se corrigieron dos hallazgos. Las consultas del inicio ya no conservan los valores de una visita anterior (`gcTime: 0`), de modo que al volver se muestra la carga y no un dato viejo; y el gráfico breve muestra también sus estados de carga y error en el catálogo visual. Tras esta corrección se repitieron las pruebas de `features/home`, `pages/home`, `dev/visual-catalog` y `app` (52 aprobadas), no el recorrido de Playwright.

No se ejecutó:

- La suite completa de backend (`make check`, unas 1 700 pruebas) ni la suite completa de Playwright; se ejecutaron las pruebas relacionadas con este cambio.
- `uv run mypy tests`: `tests/sales/test_withholdings.py:95` tiene un error de tipos anterior a este cambio.

Observaciones:

- `make audit` termina con error por avisos en `urllib3` y `virtualenv` (backend) y dos avisos de severidad alta en dependencias de npm. Son anteriores a este cambio, que no modifica `uv.lock` ni `package-lock.json`.
- El recorrido de Playwright se ejecutó con el servidor de pruebas en el puerto 8011, porque el 8001 de la configuración estaba ocupado por el entorno de desarrollo.
- El recorrido repite ayudantes de siembra que ya existen en `e2e/sales-payments.spec.ts`; no se extrajeron a un módulo común para no modificar un recorrido ajeno a este cambio.
