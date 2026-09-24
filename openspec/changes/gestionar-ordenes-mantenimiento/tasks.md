<!--
Tareas aprobadas el 2026-09-24: el usuario invocó `/opsx:apply` sobre este artefacto después de
la solicitud expresa de aprobación. La propuesta (557d59c), las specs (0510577) y el diseño con
ADR-0007 (6e331e4) están registrados en master; las tareas se registran en master antes de aplicar.

Aplicar TDD en cada grupo de comportamiento: primero la prueba que falla por la razón esperada,
después la implementación mínima y por último la refactorización. Las rutas existentes se
confirmaron por inspección; los archivos nuevos provienen del diseño. Backend siempre con
`uv run --frozen` (salvo `uv add`), frontend con npm. Toda evidencia debe ser un resultado real
ejecutado, nunca una afirmación anticipada.
-->

## 1. Preparación del módulo de taller y fronteras

- [x] 1.1 Crear `backend/src/workshop/` con `__init__.py`, `apps.py` (`WorkshopConfig`, etiqueta `workshop`), `models.py` vacío, `domain/`, `application/`, `api/`, `management/commands/` y `migrations/`, sin lógica todavía.
- [x] 1.2 Registrar `workshop.apps.WorkshopConfig` en `backend/src/config/settings/base.py` después de `sales.apps.SalesConfig`.
- [x] 1.3 Crear `backend/tests/workshop/` (sin `__init__.py`, como `tests/sales/`) con `conftest.py` que construya usuarios por rol, entidad artesanal, cliente, vehículo con propietario vigente y servicios mediante los servicios públicos existentes.
- [x] 1.4 Escribir `backend/tests/workshop/test_boundaries.py` (adaptando `tests/sales/test_boundaries.py`): `workshop` solo importa las interfaces `*.application.workshop_references`, `identity.application.*` y `shared`; `workshop/domain/` no importa Django, DRF ni persistencia; ningún otro módulo importa `workshop`.
- [x] 1.5 Evidencia: `cd backend && uv run --frozen pytest --no-cov tests/workshop/test_boundaries.py` en verde y `uv run --frozen python manage.py check` sin errores.

## 2. Interfaces públicas en módulos dueños

- [x] 2.1 Escribir pruebas que fallan en `backend/tests/customer_registry/test_workshop_references.py`: `lock_customer_and_vehicle` exige transacción, bloquea cliente → vehículo → período vigente, informa inexistente/inactivo/no propietario vigente y devuelve DTO con nombre, tipo e identificación, placa, marca y modelo; `list_customer_options` solo activos; `list_vehicle_options(customer_id)` solo activos del propietario vigente; `get_vehicle_summary` incluye inactivos.
- [x] 2.2 Implementar `backend/src/customer_registry/application/workshop_references.py` con DTO inmutables y sin escrituras.
- [x] 2.3 Escribir pruebas que fallan en `backend/tests/catalog/test_workshop_references.py`: `lock_service_reference` (inexistente, inactivo, datos copiables incluido `tax_definition_id` y nombre tributario) y `list_service_options` (solo activos, búsqueda y paginación).
- [x] 2.4 Implementar `backend/src/catalog/application/workshop_references.py`.
- [x] 2.5 Escribir pruebas que fallan en `backend/tests/workshop_configuration/test_workshop_references.py` para `get_artisan_entity` (datos de la entidad artesanal y error cuando falta configuración) e implementar `backend/src/workshop_configuration/application/workshop_references.py`.
- [x] 2.6 Evidencia: las tres pruebas nuevas en verde y las suites existentes `tests/customer_registry`, `tests/catalog` y `tests/workshop_configuration` sin regresiones.

## 3. Dominio puro del taller

- [x] 3.1 Escribir `backend/tests/workshop/test_domain_amounts.py`: precios decimales ≥ 0 con hasta dos decimales, sin redondeo, cero válido, máximo declarado; cantidades enteras 1…9 999; subtotal exacto y total 3 × 0,10 + 1 × 19,99 = 20,29; rechazo de negativos, fracciones, NaN/Infinity y cadenas no numéricas.
- [x] 3.2 Implementar `backend/src/workshop/domain/amounts.py` con `Decimal` construido desde `str`.
- [x] 3.3 Escribir `backend/tests/workshop/test_domain_rules.py`: tabla de edición por estado (D5), transiciones permitidas y rechazadas, requisitos de finalización de la intervención inicial (diagnóstico, ≥ 1 línea) y correctiva (trabajo realizado), lista de comprobaciones de finalización extensible, validación de kilometraje (entero 0…9 999 999) y regla de confirmación cuando es menor que el último conocido, y validación de causa de reapertura.
- [x] 3.4 Implementar `backend/src/workshop/domain/states.py`, `finalization.py`, `odometer.py` e `input.py` (parseo estricto de entradas con rechazo de campos desconocidos como `state`, `number`, `subtotal`, `total`, `discount`).
- [x] 3.5 Evidencia: `uv run --frozen pytest --no-cov tests/workshop/test_domain_*.py` en verde y `uv run --frozen mypy src/workshop` sin errores.

## 4. Persistencia y migraciones

- [x] 4.1 Escribir `backend/tests/workshop/test_models.py`: unicidad de `sequence` y `number`, formato `ART-OT-`, índice único parcial de una orden abierta por vehículo, una sola intervención inicial y una sola abierta por orden, causa obligatoria en correctiva, checks de cantidad y precios, tipos de contenido de fotografía, pares de transición permitidos, recibo idempotente único y fila única del contador.
- [x] 4.2 Implementar en `backend/src/workshop/models.py` `MaintenanceOrder`, `MaintenanceCounter`, `Intervention`, `ServiceLine`, `OrderPhoto`, `StateTransition` y `WorkshopCommand` según D2, con FK ajenas `PROTECT` y `related_name="+"`, e índices declarados.
- [x] 4.3 Generar `workshop/migrations/0001_initial.py` y escribir `0002_seed_counter.py` reversible que crea `MaintenanceCounter(id=1, last_number=0)`.
- [x] 4.4 Evidencia: `uv run --frozen python manage.py makemigrations --check --dry-run` sin cambios pendientes, `uv run --frozen python manage.py migrate` aplicado en la base de desarrollo y `tests/workshop/test_models.py` en verde.

## 5. Comandos de órdenes: creación, edición y numeración

- [x] 5.1 Escribir `backend/tests/workshop/test_orders.py` (pruebas que fallan): creación válida con estado `REGISTERED`, intervención inicial, número `ART-OT-000001`, creador y fechas; rechazo de vehículo de otro propietario sin transferir propiedad; cliente o vehículo inactivo; fecha futura (America/Guayaquil) y datos obligatorios ausentes; sin configuración artesanal; segunda orden abierta del vehículo con `open_order_exists` y conflicto identificado; ningún número consumido tras rechazo.
- [x] 5.2 Añadir casos de kilometraje: menor que el último conocido sin confirmación (`odometer_confirmation_required` con `details`), con confirmación registrada (usuario y fecha), edición de una orden sin alterar las anteriores y sin escribir en `Vehicle`.
- [x] 5.3 Añadir casos de edición: completar diagnóstico progresivamente, cambiar vehículo por otro del mismo cliente actualizando snapshots, `stale_record` con versión desactualizada, `unknown_field` para estado/número/auditoría, `not_editable` en `FINALIZED` y en `REOPENED` para datos generales.
- [x] 5.4 Implementar `backend/src/workshop/application/commands.py` (recibo, `execute_write`, auditoría y errores con código estable en `application/errors.py`), `application/orders.py` (crear/editar con el orden de bloqueos de D4 y contador) y `application/projection.py` (detalle con `services_total`, `pending_requirements`, `allowed_actions`).
- [x] 5.5 Añadir el parámetro opcional `details` a `problem_response` y `application_error_response` en `backend/src/config/api/errors.py` con prueba en `backend/tests/api/test_errors.py` que confirme la retrocompatibilidad.
- [x] 5.6 Evidencia: `uv run --frozen pytest --no-cov tests/workshop/test_orders.py tests/api/test_errors.py` en verde.

## 6. Líneas de servicio

- [x] 6.1 Escribir `backend/tests/workshop/test_service_lines.py`: agregar servicio activo copiando nombre, precio referencial y definición tributaria; precio aplicado ajustado sin tocar el catálogo; precio cero; precio inválido sin redondeo; servicio inactivo, inexistente o libre rechazado; servicio repetido como líneas independientes; reintento con la misma clave sin duplicar; cambio de cantidad y retiro con total recalculado; campos de descuento rechazados; cambio posterior de precio, nombre o estado del catálogo sin alterar líneas; líneas bloqueadas en `FINALIZED`; líneas de la inicial bloqueadas en `REOPENED`; correctivas con precio 0,00 forzado y rechazo de precio > 0; total cobrable sin cambios por correctivas.
- [x] 6.2 Añadir la verificación de `mantenimientos.cambiar_precio_servicio` cuando el precio difiere del referencial, simulando un actor sin ese permiso.
- [x] 6.3 Implementar `backend/src/workshop/application/service_lines.py` (bloqueo orden → servicio, versión, estado, intervención abierta).
- [x] 6.4 Evidencia: `uv run --frozen pytest --no-cov tests/workshop/test_service_lines.py` en verde.

## 7. Finalización, reapertura e intervención correctiva

- [x] 7.1 Escribir `backend/tests/workshop/test_transitions.py`: finalizar incompleto enumerando requisitos sin cambios; finalizar completo registrando transición, usuario, fecha y estado anterior; reintento con la misma clave sin segunda transición; reabrir sin causa rechazado; reabrir con otra orden abierta del vehículo rechazado; reabrir tras transferencia del vehículo permitido sin revalidar propietario; editar trabajo realizado y observaciones de la correctiva; finalizar correctiva sin trabajo rechazado; nueva finalización conservando número, líneas y fotos sin duplicar e historial de tres transiciones; intervención inicial intacta.
- [x] 7.2 Implementar `backend/src/workshop/application/transitions.py` y `application/interventions.py` con el punto de extensión de comprobaciones de finalización sin comprobaciones simuladas.
- [x] 7.3 Escribir `backend/tests/workshop/test_no_side_effects.py`: un ciclo completo (crear, líneas, fotos, finalizar, reabrir, finalizar) no crea ni modifica filas de ventas, pagos, inventario, Kardex, reservas, `NumberAllocation` ni `ConfigurationUse`.
- [x] 7.4 Evidencia: `uv run --frozen pytest --no-cov tests/workshop/test_transitions.py tests/workshop/test_no_side_effects.py` en verde.

## 8. Fotografías privadas

- [x] 8.1 Añadir `pillow` con `cd backend && uv add "pillow>=<versión actual>,<siguiente mayor>"`, conservar `uv.lock` y documentar la justificación en el README.
- [x] 8.2 Añadir `PRIVATE_MEDIA_ROOT` a `backend/src/config/settings/base.py` (entorno, por omisión `backend/private-media`) y uno temporal por prueba en `config/settings/test.py` o fixture; añadir `backend/private-media/` a `.gitignore`.
- [x] 8.3 Escribir `backend/tests/workshop/test_photo_validation.py` con imágenes generadas en memoria: JPEG, PNG y WebP válidos aceptados; GIF, PNG animado, WebP animado, PDF y ejecutable renombrado rechazados; > 10 MiB rechazado sin leer por completo; > 25 MP rechazado antes de decodificar; miniatura WebP de 480 px sin EXIF.
- [x] 8.4 Implementar `backend/src/workshop/domain/photo_rules.py` (límites) y `backend/src/workshop/application/photo_storage.py` (almacenamiento dedicado, nombres UUID, validación con Pillow, miniatura, borrado).
- [x] 8.5 Escribir `backend/tests/workshop/test_photos.py`: carga válida con descripción, usuario y fecha asociada a la intervención abierta; descripción > 200 rechazada; límite de 20 vigentes; carga en `FINALIZED` rechazada sin archivos; fallo simulado de base tras escribir archivos sin registro ni archivo; reintento idempotente con una sola foto; retiro con auditoría y archivos borrados tras commit; retiro de foto de la inicial en `REOPENED` rechazado; retiro repetido inocuo.
- [x] 8.6 Implementar `backend/src/workshop/application/photos.py` según D8.
- [x] 8.7 Escribir `backend/tests/workshop/test_purge_files.py` e implementar `backend/src/workshop/management/commands/purge_workshop_files.py`: elimina solo archivos sin foto vigente y más antiguos que el margen; segunda ejecución sin errores; no toca fotos vigentes.
- [x] 8.8 Evidencia: `uv run --frozen pytest --no-cov tests/workshop/test_photo_validation.py tests/workshop/test_photos.py tests/workshop/test_purge_files.py` en verde.

## 9. Consultas e historial

- [x] 9.1 Escribir `backend/tests/workshop/test_queries.py`: listado paginado con orden estable; búsqueda por número, nombre o identificación del cliente y placa sin distinguir mayúsculas; filtros de estado y rango de fechas; rango invertido rechazado; `services_total` y `service_summary`; historial por vehículo con órdenes de dos propietarios; historial por cliente que incluye vehículos vendidos y excluye órdenes de propietarios anteriores; consultas tras desactivar cliente, vehículo y servicio con datos conservados e indicación de inactividad.
- [x] 9.2 Implementar `backend/src/workshop/application/queries.py` con agregación SQL de totales y sin consultas N+1 (verificado con `django_assert_max_num_queries`).
- [x] 9.3 Evidencia: `uv run --frozen pytest --no-cov tests/workshop/test_queries.py` en verde.

## 10. API HTTP, permisos y OpenAPI

- [x] 10.1 Escribir `backend/tests/workshop/test_api.py`: contratos de D10 (códigos 200/201/400/403/404/409, `application/problem+json`, envoltura de paginación, importes como cadenas decimales, multipart de fotos, CSRF exigido en escrituras con sesión).
- [x] 10.2 Escribir `backend/tests/workshop/test_authorization.py`: matriz de D9 para Administrador, Encargado, Vendedor y Vendedor+Encargado en cada endpoint, incluidas descargas de archivo y miniatura sin sesión y con Vendedor; 403 sin revelar existencia; denegaciones de escritura auditadas.
- [x] 10.3 Escribir en `test_api.py` las cabeceras de entrega de fotografías: `Content-Type` guardado, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, CSP `default-src 'none'`; foto retirada o de otra orden → 404.
- [x] 10.4 Implementar `backend/src/workshop/api/serializers.py`, `views.py` y `urls.py` (vistas delgadas con `HasBusinessPermission`) y registrar `path("maintenance-orders/", include("workshop.api.urls"))` en `backend/src/config/api/urls.py`.
- [x] 10.5 Regenerar `backend/schema.yml` con el comando usado por `tests/api/test_openapi.py` y añadir `backend/tests/workshop/test_openapi.py` para las operaciones del módulo.
- [x] 10.6 Evidencia: `uv run --frozen pytest --no-cov tests/workshop tests/api` en verde.

## 11. Concurrencia e idempotencia (PostgreSQL)

- [x] 11.1 Escribir `backend/tests/workshop/test_concurrency.py` con `transaction=True` e hilos: dos creaciones simultáneas obtienen números distintos y consecutivos; dos creaciones para el mismo vehículo producen una sola orden sin consumir número extra; edición contra finalización nunca deja una orden finalizada modificada; carga de fotografía contra finalización sin foto en la orden cerrada ni archivo permanente; dos reaperturas producen una sola intervención correctiva; creación de orden contra transferencia de propiedad sin interbloqueo.
- [x] 11.2 Ajustar implementación si alguna prueba revela un orden de bloqueos distinto del documentado y actualizar D4 del diseño si cambia.
- [x] 11.3 Evidencia: `uv run --frozen pytest --no-cov tests/workshop/test_concurrency.py` en verde de forma repetida (tres ejecuciones consecutivas).

## 12. Infraestructura y operación

- [x] 12.1 Añadir `client_max_body_size 12m;` en `location /api/` de `infra/nginx/default.conf`.
- [x] 12.2 Añadir el volumen nombrado `private_media` montado en `PRIVATE_MEDIA_ROOT` para el servicio `backend` en `compose.yaml` e `infra/compose.production.example.yaml`, con la variable de entorno correspondiente.
- [x] 12.3 Documentar en `README.md` la ubicación de las fotografías, la necesidad de respaldar el volumen (DA-003 abierta), el comando `purge_workshop_files` y su ejecución periódica sugerida.
- [x] 12.4 Evidencia: `make compose-check` sin errores.

## 13. Frontend: base de datos y API

- [x] 13.1 Escribir en `frontend/src/shared/api/client.test.ts` la prueba que falla: `request` con `FormData` no fija `Content-Type`, envía `X-CSRFToken` y conserva el manejo de problemas; implementar el soporte en `frontend/src/shared/api/client.ts`.
- [x] 13.2 Crear `frontend/src/features/maintenance/types.ts` y `api.ts` (lista, detalle, crear, editar, intervención, líneas, finalizar, reabrir, fotos, opciones) con `api.test.ts`, incluida la lectura de `details` del problema de kilometraje.
- [x] 13.3 Crear `frontend/src/features/maintenance/hooks.ts` con TanStack Query, claves de caché e invalidación de lista, detalle e historiales; claves idempotentes por intención con `shared/api/idempotency.ts`; `hooks.test.tsx`.
- [x] 13.4 Evidencia: `cd frontend && npx vitest run src/shared/api src/features/maintenance` en verde.

## 14. Frontend: pantallas de órdenes

- [x] 14.1 Escribir `frontend/src/pages/maintenance/MaintenanceOrdersPage.test.tsx` e implementar la lista a ancho completo con búsqueda, filtro de estado, rango de fechas, paginación y estados de carga, vacío y error.
- [x] 14.2 Escribir `MaintenanceOrderEditorPage.test.tsx` e implementar el editor de página completa con `OrderForm.tsx`: combobox de cliente y vehículo filtrado por propietario vigente con placa, marca y modelo; aviso y enlace si el vehículo tiene orden abierta; fecha por omisión hoy sin futuro; advertencia de kilometraje con confirmación explícita; errores por campo; conflicto con recarga que conserva lo escrito; envío único; precarga por `customer_id` y `vehicle_id`.
- [x] 14.3 Escribir `MaintenanceOrderDetailPage.test.tsx` e implementar el detalle con estado, acciones según `allowed_actions`, secciones de información general, diagnóstico y observaciones, intervenciones, servicios, fotografías e historial de transiciones; sin repuestos, ventas, pagos ni saldos.
- [x] 14.4 Implementar y probar `ServiceLinesTable.tsx` y `ServiceLineDialog.tsx` (FormModal): precio referencial y precio aplicado rotulado «aplicado a esta orden», cantidad, subtotal, «Total de servicios de la orden», correctivas «Sin cargo», retiro con confirmación.
- [x] 14.5 Implementar y probar `PhotoGallery.tsx` y `PhotoUploadDialog.tsx`: miniaturas, vista ampliada, descripción, carga con vista previa local liberada, errores que conservan archivo y descripción, retiro con confirmación, sin acciones en órdenes finalizadas.
- [x] 14.6 Implementar y probar `FinalizeDialog.tsx` (resumen y requisitos pendientes, confirmación deshabilitada si faltan), `ReopenDialog.tsx` (causa obligatoria y explicación), `InterventionPanel.tsx` y `TransitionTimeline.tsx`; confirmaciones con Toast.
- [x] 14.7 Registrar las rutas `/maintenance`, `/maintenance/new`, `/maintenance/:id` y `/maintenance/:id/edit` en `frontend/src/app/App.tsx` con `PermissionGuard` y añadir `frontend/src/app/maintenance-routes.test.tsx`.
- [x] 14.8 Evidencia: `cd frontend && npx vitest run src/pages/maintenance src/features/maintenance src/app` en verde.

## 15. Frontend: historial en clientes y vehículos

- [x] 15.1 Escribir pruebas que fallan en `frontend/src/features/maintenance/MaintenanceHistorySection.test.tsx`: lista paginada con fecha, número, estado, resumen y total; enlace al detalle; estado vacío; acción «Nueva orden» solo con `mantenimientos.gestionar`.
- [x] 15.2 Integrar la sección en `frontend/src/pages/customers/CustomerDetailPage.tsx` y `frontend/src/pages/vehicles/VehicleDetailPage.tsx`, visible solo con `mantenimientos.ver`, y ampliar sus pruebas existentes con Vendedor (sin sección) y Encargado (con sección).
- [x] 15.3 Evidencia: `cd frontend && npx vitest run src/pages/customers src/pages/vehicles src/features/maintenance` en verde.

## 16. Documentación y trazabilidad

- [x] 16.1 Crear `docs/negocio/requisitos/cobertura-mantenimientos.md` y su referencia de glosario, con RN/RF/CU/UI cubiertos, aplazados (cancelación, RF-TAL-008…012/014, UI-074/077) y evidencia de pruebas.
- [x] 16.2 Actualizar `docs/negocio/requisitos/matriz-trazabilidad.md`, la nota de estado de `casos-de-uso.md` (CU-017 y CU-019 parciales) y `interfaz-y-navegacion.md` (UI-070…073/075/076/078 implementadas en el alcance aprobado).
- [x] 16.3 Cambiar ADR-0007 a «Aceptada» con fecha de aplicación y actualizar `docs/tecnico/arquitectura-inicial.md` y `docs/architecture/c4-containers.md` si mencionan módulos o almacenamiento.
- [x] 16.4 Registrar en el glosario técnico o del producto los términos nuevos necesarios (orden de mantenimiento, total de servicios de la orden) solo si no existen equivalentes.
- [x] 16.5 Evidencia: revisión de enlaces relativos de los documentos modificados y `openspec validate gestionar-ordenes-mantenimiento --strict` válido.

## 17. Verificación final

- [x] 17.1 `make check` completo (formato, lint, tipos, `manage.py check`, `makemigrations --check`, pytest con cobertura ≥ 85 %, frontend format/lint/typecheck/test:coverage/build y `compose-check`) en verde, registrando resultados reales.
  - Resultado 2026-09-24: tras corregir el usuario los errores preexistentes de `backend/tests/workshop_configuration/`, `make check` pasa en formato, `ruff check` (sin errores), `mypy` (sin problemas en 362 archivos), `manage.py check`, `makemigrations --check`, frontend (882 pruebas, cobertura y build) y `compose-check`. En esa corrida `pytest` falló al crear la base `test_sys_taller`, en uso por otra sesión; repetido de forma aislada con `uv run --frozen pytest`: 1738 aprobadas, cobertura 92,41 %.
- [x] 17.2 `make audit` sin vulnerabilidades altas nuevas (incluida Pillow).
- [x] 17.3 Revisión visual con la aplicación en ejecución, si el entorno lo permite: lista, creación con advertencia de kilometraje, líneas, carga y retiro de fotos, finalizar con pendientes, reabrir, historial en cliente y vehículo, y rol Vendedor sin acceso; registrar limitaciones si no fue posible.
- [x] 17.4 Revisar que no se añadieron órdenes ni fotografías de ejemplo en migraciones o datos de producción y que `git status` solo contiene archivos del cambio.
