## 1. Guardado opcional del correo del cliente y preparación fiscal interna (Riesgo: Estricto · TDD)

- [x] 1.1 Escribir pruebas unitarias/integración primero en `backend/tests/customer_registry/test_customer_email_update.py` para `update_customer_email` (permiso `clientes.editar`, formato inválido, sin escritura si no cambió, auditoría con correo anterior/nuevo y sin alterar documentos históricos).
- [x] 1.2 Implementar `update_customer_email` en `backend/src/customer_registry/application/customers.py` con verificación de permiso `clientes.editar` y registro de evento de auditoría.
- [x] 1.3 Escribir pruebas TDD en `backend/tests/sales/test_fiscal_prepare_flow.py` cubriendo `save_email_to_customer` (`true`/`false`, sin permiso `clientes.editar`, receptor consumidor final) y el servicio `prepare_from_checkout`.
- [x] 1.4 Extender `backend/src/fiscal/application/preparations.py` y `backend/src/fiscal/api/views.py` / `serializers.py` con `save_email_to_customer` opcional en `prepare` y la función pública `prepare_from_checkout`; habilitar `customer_registry.application.customers` en `backend/tests/fiscal/test_boundaries.py`.
- [x] 1.5 Verificar Grupo 1: `cd backend && uv run pytest tests/customer_registry/test_customer_email_update.py tests/fiscal/test_boundaries.py tests/sales/test_fiscal_prepare_flow.py`.

## 2. Módulo orquestador `checkout`, migración e idempotencia (Riesgo: Estricto · TDD)

- [x] 2.1 Crear la estructura de la app `backend/src/checkout/` (`apps.py`, `models.py` con `CheckoutReceipt`, migración `migrations/0001_initial.py`), registrarla en `backend/src/config/settings.py` y montar `/api/v1/checkout/` en `backend/src/config/api/urls.py`.
- [x] 2.2 Escribir pruebas TDD primero en `backend/tests/checkout/`:
  - `test_boundaries.py` (fronteras AST: solo importa servicios públicos de otros módulos, ningún módulo importa `checkout`).
  - `test_authorization.py` (permisos positivos/negativos por `ADMINISTRADOR`, `VENDEDOR`, `ENCARGADO_TALLER` y usuaria diaria; aislamiento por RUC).
  - `test_execute_flow.py` (mantenimiento completo contado, pago parcial por negocio, crédito con plazo, combinado + retención, venta directa y `QUICK_SALE`, «Solo cobrar» sin correo, cierre opcional respetando `DP-021`, guardado de correo y fallo parcial fiscal con cobro en firme `DP-034` regla 5).
  - `test_idempotency_concurrency.py` (reintento con igual `Idempotency-Key`, conflicto 409 con distinto payload y concurrencia sobre la última unidad de stock).
- [x] 2.3 Implementar la consulta de prevalidación en `backend/src/checkout/application/preview.py` (`preview_maintenance_checkout`, `preview_sale_checkout`) con revisión de permisos, stock/precios, configuración fiscal y requisitos de cierre.
- [x] 2.4 Implementar la orquestación por pasos e idempotencia compuesta en `backend/src/checkout/application/execute.py` (`execute_checkout`) reutilizando los servicios atómicos de `sales`, `workshop`, `fiscal` y `customer_registry`.
- [x] 2.5 Implementar serializers, vistas y URLs delgadas en `backend/src/checkout/api/` (`serializers.py`, `views.py`, `urls.py`).
- [x] 2.6 Verificar Grupo 2: `cd backend && uv run pytest tests/checkout/ && uv run python manage.py makemigrations --check --dry-run`.

## 3. Consulta «Falta facturar» para Inicio (Riesgo: Estricto · TDD)

- [x] 3.1 Escribir pruebas TDD primero en `backend/tests/home/test_unbilled.py` (operaciones confirmadas sin preparación fiscal `PREPARED`, separación por negocio, permisos por rol/entidad, exclusión de anuladas y ausencia de términos de autorización SRI).
- [x] 3.2 Publicar consultas de operaciones confirmadas sin preparación fiscal en `backend/src/sales/application/home_summary.py`, `backend/src/workshop/application/home_summary.py` y `backend/src/fiscal/application/home_summary.py`.
- [x] 3.3 Componer `GET /api/v1/home/unbilled/` en `backend/src/home/application/unbilled.py`, `backend/src/home/api/views.py`, `serializers.py` y `urls.py` respetando `home/test_boundaries.py`.
- [x] 3.4 Verificar Grupo 3: `cd backend && uv run pytest tests/home/test_unbilled.py tests/home/test_boundaries.py`.

## 4. Contrato OpenAPI y chequeos estáticos de backend (Riesgo: Sin prueba nueva)

- [x] 4.1 Regenerar `backend/schema.yml` con `cd backend && uv run python manage.py spectacular --file schema.yml` y validar que incluya `/api/v1/checkout/*` y `/api/v1/home/unbilled/`.
- [x] 4.2 Verificar Grupo 4: `cd backend && uv run ruff check src tests && uv run mypy src && uv run pytest tests/api/test_openapi.py tests/home/test_openapi.py`.

## 5. Frontend: pantalla «Cobrar y facturar» y preparación fiscal (Riesgo: Prueba al final)

- [x] 5.1 Crear `frontend/src/features/checkout/` (`types.ts`, `api.ts`, `hooks.ts`) para prevalidación y ejecución de «Cobrar y facturar» con `Idempotency-Key`.
- [x] 5.2 Implementar la pantalla `frontend/src/pages/checkout/CheckoutPage.tsx` (y componentes en `frontend/src/features/checkout/`) siguiendo el prototipo `Cobrar.dc.html` con los ajustes aprobados: dos bloques separados por nombre comercial, Efectivo/Transferencia/Combinado/Queda debiendo (sin Tarjeta), pago parcial explícito por negocio, retención opcional desplegable, cálculo orientativo de vuelto, correo con aviso si difiere del guardado + casilla «Guardar este correo en la ficha del cliente», casilla «Cerrar el mantenimiento al cobrar», acción secundaria «Solo cobrar (facturar después)», estado local «Factura preparada (sin enviar)» y reporte claro ante fallos parciales.
- [x] 5.3 Registrar rutas `/maintenance/:id/checkout` y `/sales/:id/checkout` en `frontend/src/app/App.tsx`; conectar los accesos en `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.tsx`, `frontend/src/features/maintenance/OrderPanels.tsx` y `frontend/src/pages/sales/SaleDetailPage.tsx`.
- [x] 5.4 Agregar la casilla opcional «Guardar este correo en la ficha del cliente» (con aviso si reemplaza otro correo y respetando `clientes.editar`) en `frontend/src/pages/fiscal/FiscalPreparationPage.tsx`.
- [x] 5.5 Agregar/actualizar pruebas en `frontend/src/pages/checkout/CheckoutPage.test.tsx`, `frontend/src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx` y `frontend/src/pages/fiscal/FiscalPreparationPage.test.tsx`.
- [x] 5.6 Verificar Grupo 5: `cd frontend && npx vitest run src/pages/checkout/CheckoutPage.test.tsx src/pages/maintenance/MaintenanceOrderDetailPage.test.tsx src/pages/fiscal/FiscalPreparationPage.test.tsx`.

## 6. Frontend: Venta rápida en un paso, vehículo único e Inicio «Falta facturar» (Riesgo: Prueba al final)

- [x] 6.1 Conectar `frontend/src/pages/sales/QuickSalePage.tsx` (y limpiar/adaptar `frontend/src/features/sales/quickSale.ts`) con `POST /api/v1/checkout/execute/` (`origin_kind: "QUICK_SALE"`), incorporando correo precargado del cliente, casilla de guardar correo, aviso de cambio de correo y acción secundaria «Solo cobrar».
- [x] 6.2 Actualizar `frontend/src/features/maintenance/NewMaintenanceDialog.tsx` para preseleccionar automáticamente el vehículo cuando el cliente elegido tiene un solo vehículo.
- [x] 6.3 Crear `frontend/src/pages/home/UnbilledColumn.tsx` y conectarlo en `frontend/src/pages/home/HomePage.tsx` junto con `frontend/src/features/home/api.ts`, `hooks.ts` y `types.ts` (cargando y fallando de forma independiente y filtrando por permisos).
- [x] 6.4 Agregar/actualizar pruebas en `frontend/src/pages/sales/QuickSalePage.test.tsx`, `frontend/src/features/maintenance/NewMaintenanceDialog.test.tsx` y `frontend/src/pages/home/HomePage.test.tsx`.
- [x] 6.5 Verificar Grupo 6: `cd frontend && npx vitest run src/pages/sales/QuickSalePage.test.tsx src/features/maintenance/NewMaintenanceDialog.test.tsx src/pages/home/HomePage.test.tsx && npm run lint && npm run typecheck && npm run build`.

## 7. Documentación, `DP-037`, `ADR-0014`, medición de objetivos y verificación del cambio 2 (Riesgo: Sin prueba nueva)

- [x] 7.1 Registrar `DP-037` en `docs/negocio/decisiones/decisiones-confirmadas.yaml` con las decisiones cerradas de U6 y crear `docs/adr/0014-orquestacion-cobrar-y-facturar-tolerante-a-fallos-parciales.md`.
- [x] 7.2 Crear `docs/negocio/requisitos/cobertura-cobrar-y-facturar.md` (una fila por requisito + medición paso a paso de `RNF-USA-013`, `RNF-USA-014` y `RNF-USA-015` conforme a `RNF-USA-016`) y sincronizar `docs/negocio/requisitos/matriz-trazabilidad.md`, `docs/negocio/requisitos/interfaz-y-navegacion.md`, `docs/negocio/requisitos/requisitos-no-funcionales.md` y `docs/cambios-pendientes.md`.
- [x] 7.3 Ejecutar la verificación diferida de `alinear-datos-del-comprobante-con-sri` (cambio 2): correr sus pruebas relacionadas en backend (`tests/fiscal/test_receiver.py`, `tests/fiscal/test_payment_term.py`, `tests/fiscal/test_service_details.py`, `tests/sales/test_fiscal_alignment.py`) y frontend (`FiscalPreparationPage.test.tsx`, `ProfileConditionsSection.test.tsx`), y marcar su casilla de verificación en `docs/cambios-pendientes.md`.
