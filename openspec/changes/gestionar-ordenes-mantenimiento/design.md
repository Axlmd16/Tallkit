# Diseño: órdenes de mantenimiento

Estado: diseño aprobado el 2026-09-24 para crear tareas; tras aclarar la ubicación de las fotografías (volumen privado `private_media` en `PRIVATE_MEDIA_ROOT`), el usuario respondió «haz commit, registra los cambios en la master y continua». La aprobación incluye ADR-0007 como propuesta, que pasará a Aceptada al aplicar el cambio. Fecha: 2026-09-24, America/Guayaquil. Se basa en la propuesta aprobada (P1…P5) y en las cuatro specs aprobadas, registradas en `master` (`88c6932`). No aprueba tareas ni implementación.

## Context

La propuesta y las specs definen una orden operativa del RUC artesanal con intervención inicial y correctivas, líneas de servicio con precio aplicado, fotografías privadas e historial por cliente/vehículo, sin efectos económicos ni de inventario. Este diseño concreta cómo implementarlo sobre el código real.

Inspección realizada (código, no documentación de arranque):

- **Backend** (`backend/src/`): monolito modular Django 5.2/DRF con módulos `identity`, `customer_registry`, `workshop_configuration`, `catalog`, `supplier_registry`, `inventory`, `purchasing` y `sales`, cada uno con `domain/`, `application/`, `api/`, `models.py` y migraciones. No existe módulo de taller ni modelos de órdenes, adjuntos o fotografías.
- **Patrones reutilizables** tomados de `sales`: recibo idempotente por módulo (`SalesCommand`: actor, acción, clave, huella, identidad del resultado), `execute_write` que autoriza antes del replay y audita éxito/fracaso, errores de aplicación con código estable, `expected_version` para concurrencia optimista, bloqueo de filas en orden total, `shared.transactions.retryable_transaction` para traducir `40P01/40001/55P03` y `shared.command_values` para claves y huellas. Las vistas son delgadas y responden `application/problem+json` mediante `config.api.errors`.
- **Clientes y vehículos** (`customer_registry`): `Customer`, `Vehicle` y `OwnershipPeriod` con índice único parcial de un período abierto por vehículo; `current_owner` derivado; `is_active` y `version`. La transferencia (`transfer_vehicle_ownership`) bloquea cliente nuevo → vehículo → período. Existe una interfaz pública para ventas (`application/sales_references.py`) con DTO inmutables y `lock_customer_reference`. Vehicle no tiene kilometraje.
- **Catálogo** (`catalog.models.Service`): `name`, `description`, `reference_price` Decimal(14,2) ≥ 0, `tax_definition` → `workshop_configuration.TaxDefinition`, `is_active`, `version`. Hay interfaces públicas para ventas e inventario, ninguna para taller.
- **Configuración** (`workshop_configuration`): `FiscalEntity` comercial/artesanal, `TaxDefinition`/`TaxPeriod`, `NumberingScope`/`DocumentSeries`/`NumberAllocation` para tipos documentales fiscales (`INGRESO`, `PROFORMA`, `VENTA`, `SERVICIO`) según ADR-0004. `get_operation_context()` solo resuelve el contexto comercial.
- **Identidad**: permisos `mantenimientos.*` ya declarados para Administrador y Encargado; Vendedor no tiene `mantenimientos.ver`. `HasBusinessPermission` mapea método → permiso; `require_permission` y `record_audit_event` (metadatos filtrados por lista blanca) están disponibles.
- **Archivos**: `STORAGES["default"]` es `FileSystemStorage` sin `MEDIA_ROOT`/`MEDIA_URL`; no hay modelos de archivos, API de carga ni volumen persistente. Pillow no es dependencia. `infra/nginx/default.conf` no define `client_max_body_size` (1 MiB por omisión) y solo proxea `/api/`, `/admin/` y `/static/`.
- **Frontend** (`frontend/src/`): React 19 + React Router 7 + TanStack Query; `features/<módulo>` (api, types, hooks, componentes) y `pages/<módulo>`; `app/navigation.ts` ya declara «Mantenimientos» en `/maintenance` con `mantenimientos.ver` sin ruta implementada. `shared/api/client.ts` solo envía JSON; `shared/api/idempotency.ts` genera claves por intención. Sistema visual Tallkit en `shared/ui` (DataTable, Pagination, FormModal, ConfirmationPanel, Tabs, DetailCard, MediaSlot, Toast, PlateTag, Money, DateControl, Combobox, Textarea).
- **Pruebas**: pytest con PostgreSQL real, cobertura mínima 85 %, pruebas de concurrencia con `transaction=True` e hilos (`tests/sales/test_concurrency.py`, `tests/customer_registry/test_ownership_concurrency.py`); Vitest + Testing Library en frontend; OpenAPI versionado en `backend/schema.yml` con prueba de sincronía.

ADR aplicables: ADR-0001 (monolito modular), ADR-0002 (dependencias), ADR-0003 (sesión y mismo origen), ADR-0004 (contrato transaccional y numeración). Se añade ADR-0007 para el almacenamiento privado de archivos.

## Goals / Non-Goals

**Goals:**

- Nuevo módulo `workshop` con órdenes, intervenciones, líneas de servicio, fotografías, transiciones y recibos idempotentes, respetando fronteras mediante interfaces públicas de `customer_registry`, `catalog` y `workshop_configuration`.
- Garantizar en servidor: relación cliente/propietario vigente, una orden abierta por vehículo, numeración `ART-OT` sin huecos por rollback, kilometraje con confirmación, precio aplicado independiente, totales decimales, bloqueo de órdenes finalizadas, reapertura con intervención correctiva, idempotencia y concurrencia.
- Fotografías privadas en almacenamiento local, validadas por contenido, servidas solo con autorización, con limpieza recuperable.
- API `/api/v1/maintenance-orders/` documentada en OpenAPI y pantallas conectadas con historial en fichas de cliente y vehículo.

**Non-Goals:**

- Cancelación, repuestos, reservas, venta vinculada, operación artesanal económica, número `ART-SER`, pagos, deuda, reposición por corrección, desglose tributario, PDF, reportes y exportaciones.
- Almacenamiento externo (S3 u otros), CDN, edición de imágenes, clasificación de fotografías, retención legal o caducidad.
- Kilometraje acumulado en `Vehicle`, cambios de propiedad desde la orden o refactorización de módulos existentes.

## Decisions

### D1. Módulo `workshop` con fronteras explícitas

Se crea `backend/src/workshop/` (app `workshop.apps.WorkshopConfig`, etiqueta `workshop`) con `domain/` (validación pura de entrada, reglas de transición, cálculo de importes, requisitos de finalización), `application/` (comandos, consultas, fotos, limpieza), `api/` (serializers, vistas, urls) y `management/commands/`. Rutas bajo `/api/v1/maintenance-orders/`.

Interfaces públicas nuevas, de solo lectura y bloqueo, en los módulos dueños (mismo estilo que `sales_references.py`):

| Módulo | Archivo | Contrato |
|---|---|---|
| `customer_registry` | `application/workshop_references.py` | `lock_customer_and_vehicle(customer_id, vehicle_id)` bloquea cliente → vehículo → período vigente y devuelve DTOs con datos identificativos, activo y propietario vigente; `list_customer_options`, `list_vehicle_options(customer_id)` (activos cuyo propietario vigente es el cliente); `get_vehicle_summary`. |
| `catalog` | `application/workshop_references.py` | `lock_service_reference(service_id)` (existencia, activo, nombre, precio referencial, `tax_definition_id`, nombre tributario); `list_service_options(search, page)` solo activos. |
| `workshop_configuration` | `application/workshop_references.py` | `get_artisan_entity()` devuelve id, RUC y razón social de la entidad artesanal o error `configuration_missing`. |

Alternativa descartada: consultar los modelos ajenos directamente desde `workshop` — viola ADR-0001 y acopla migraciones. Las FK hacia modelos ajenos usan `on_delete=PROTECT` y `related_name="+"`, como en `sales`, para no añadir campos inversos a contratos ajenos. Una prueba de fronteras (`tests/workshop/test_boundaries.py`) verifica que `workshop` solo importa las interfaces públicas.

### D2. Modelo de persistencia

| Modelo | Campos principales | Restricciones e índices |
|---|---|---|
| `MaintenanceOrder` | `sequence` (entero), `number` (`ART-OT-000001`), `fiscal_entity` FK, `customer` FK, `vehicle` FK, `customer_snapshot` y `vehicle_snapshot` JSON versionados (nombre, tipo e identificación; placa, marca, modelo), `opened_on` (date), `odometer_km` (PositiveInteger), `odometer_confirmed_by`/`_at` (nulos), `diagnosis`/`notes` (texto, máx. 5000), `state` (`REGISTERED`, `FINALIZED`, `REOPENED`), `version`, `created_by`, `created_at`, `updated_by`, `updated_at`, `last_finalized_at/_by` | Únicos: `sequence`, `number`. **Índice único parcial `(vehicle)` con `state IN (REGISTERED, REOPENED)`** (respaldo de P1). Checks: estado válido, `number` con regex `^ART-OT-[0-9]{6,}$`, textos ≤ 5000. Índices: `(-opened_on, -sequence)`, `(customer, -opened_on)`, `(vehicle, -opened_on)`, `(state, -opened_on)`. |
| `MaintenanceCounter` | fila única `id=1`, `last_number` | Check `id = 1`; creada por migración de datos. |
| `Intervention` | `order` FK, `kind` (`INITIAL`, `CORRECTIVE`), `ordinal`, `cause`, `work_performed`, `notes`, `opened_by/_at`, `closed_by/_at` | Único `(order, ordinal)`; único parcial `(order)` con `kind=INITIAL`; único parcial `(order)` con `closed_at IS NULL` (una sola abierta); check: `CORRECTIVE` exige causa no vacía. |
| `ServiceLine` | `intervention` FK, `service` FK, `service_name` (copia), `reference_price` y `applied_price` Decimal(14,2), `quantity` PositiveInteger, `tax_definition` FK y `tax_name` (copia), `position`, `created_by/_at`, `updated_by/_at` | Checks: `quantity ≥ 1`, precios ≥ 0. Índice `(intervention, position)`. |
| `OrderPhoto` | `order` FK, `intervention` FK, `storage_name`, `thumbnail_name`, `content_type`, `size_bytes`, `width`, `height`, `sha256`, `description` (≤ 200), `uploaded_by/_at`, `removed_by/_at` | Únicos `storage_name`, `thumbnail_name`. Índice `(order, removed_at)`. Check `content_type IN (image/jpeg, image/png, image/webp)`. |
| `StateTransition` | `order` FK, `intervention` FK, `from_state`, `to_state`, `reason`, `actor`, `occurred_at` | Check de pares permitidos: `REGISTERED→FINALIZED`, `REOPENED→FINALIZED`, `FINALIZED→REOPENED`. Índice `(order, occurred_at)`. |
| `WorkshopCommand` | recibo idempotente igual a `SalesCommand` | Único `(actor, action, idempotency_key)`; check de formato de clave. |

Diagnóstico y observaciones de la orden pertenecen a la intervención inicial; la intervención correctiva guarda su propia causa, trabajo y observaciones. El subtotal no se almacena: se calcula en dominio (`quantity × applied_price`, `Decimal`, sin redondeo porque ambos factores son exactos a centavos y la cantidad es entera) y el total por agregación SQL `Sum(F("quantity") * F("applied_price"))` para listas. Alternativa descartada: almacenar subtotales/totales desnormalizados — añade riesgo de divergencia sin necesidad de rendimiento en V1.

Datos históricos: los snapshots se escriben al crear y al cambiar cliente/vehículo mientras la orden está `REGISTERED`; nunca después. La línea copia nombre, precio referencial y definición tributaria al agregarse; los cambios del catálogo no las tocan. Ninguna FK usa `CASCADE`; no hay eliminación ordinaria de órdenes (sin endpoint `DELETE`, admin no registrado).

### D3. Numeración `ART-OT` propia del módulo

Se usa `MaintenanceCounter` bloqueado con `select_for_update()` dentro de la transacción de creación; `sequence = last_number + 1`, `number = f"ART-OT-{sequence:06d}"`. Un rollback revierte el incremento: no hay huecos por creaciones rechazadas y la creación concurrente queda serializada. La fila la siembra la migración `0002`; como respaldo, la asignación usa `select_for_update().get_or_create(pk=1)`, que la recrea si una base se vació (por ejemplo, en pruebas transaccionales) y serializa la carrera de inserción por la clave primaria.

Alternativas descartadas: (a) `NumberingScope` de configuración con un nuevo `DocumentType` — mezclaría un número operativo con series fiscales administrables y exigiría ampliar el enumerado y las pantallas de series, contra P5; (b) secuencia de PostgreSQL — no revierte con la transacción (ADR-0004, opción 3); (c) `MAX()+1` — inseguro ante concurrencia.

### D4. Transacciones, orden de bloqueos e idempotencia

Toda escritura se ejecuta con un `execute_write` propio del módulo (copia adaptada del patrón de `sales`, sin importarlo, para no acoplar módulos): autoriza → valida clave → reclama recibo `WorkshopCommand` en savepoint → ejecuta → guarda identidad del resultado → audita; los rechazos se auditan tras el rollback. Un replay con la misma clave y huella devuelve la proyección actual del resultado; con otra huella responde `idempotency_conflict`. La transacción exterior usa `retryable_transaction`.

Orden total de bloqueos (documentado en el módulo y probado):

1. Recibo `WorkshopCommand` (inserción única).
2. `MaintenanceOrder` objetivo (`select_for_update`), cuando existe.
3. `Customer` → `Vehicle` → `OwnershipPeriod` vigente, vía `customer_registry.workshop_references` (mismo orden que la transferencia de propiedad, evitando ciclos).
4. `Service` vía `catalog.workshop_references`.
5. `MaintenanceCounter` (solo al crear).

Cada comando valida estado y `expected_version` después de bloquear la orden, e incrementa `version` en toda modificación de datos, líneas, intervención o estado. La creación de otra orden abierta para el vehículo se comprueba tras bloquear el vehículo (bloqueo que serializa creaciones concurrentes del mismo vehículo); el índice único parcial actúa como respaldo y su `IntegrityError` se traduce a `open_order_exists` con `conflict: {type: "maintenance_order", id}`.

Transiciones:

- **Finalizar** (`POST .../finalize/`, `expected_version`, `idempotency_key`): bloquea orden; exige estado `REGISTERED` o `REOPENED`; evalúa requisitos en dominio (inicial: diagnóstico no vacío y ≥ 1 línea; correctiva: `work_performed` no vacío); cierra la intervención abierta, cambia estado, registra `StateTransition` y `last_finalized_*`. Punto de extensión: `domain/finalization.py` recibe una lista de «comprobaciones de finalización»; la funcionalidad 8 añadirá la de venta vinculada abierta (DP-021) sin tocar este flujo. Hoy no se registra ninguna comprobación simulada.
- **Reabrir** (`POST .../reopen/`, `reason`, `expected_version`, `idempotency_key`): exige `FINALIZED`, causa no vacía (≤ 1000) y ausencia de otra orden abierta del vehículo (bloqueo del vehículo + índice parcial); crea `Intervention` `CORRECTIVE` abierta, `StateTransition` y cambia estado. No revalida propietario vigente ni cliente/vehículo activos.

Edición y finalización simultáneas: ambas bloquean la orden; la segunda observa la versión o el estado nuevo y falla con `stale_record` o `not_editable`. Una edición iniciada antes de la finalización nunca modifica la orden cerrada.

### D5. Reglas de edición por estado

| Estado | Datos generales (cliente, vehículo, fecha, km, diagnóstico, observaciones) | Intervención correctiva abierta | Líneas | Fotografías |
|---|---|---|---|---|
| `REGISTERED` | editable | — | de la inicial: agregar/editar/retirar | adjuntar/retirar de la inicial |
| `REOPENED` | solo lectura | trabajo realizado y observaciones | solo de la correctiva, precio aplicado fijo 0,00 | adjuntar/retirar solo de la correctiva |
| `FINALIZED` | solo lectura | — | solo lectura | solo lectura |

Los rechazos por estado usan el código `not_editable` (409) con mensaje que indica reabrir. Las entradas de escritura rechazan campos desconocidos (`unknown_field`), incluidos `state`, `number`, `created_by`, `subtotal`, `total`, `discount`.

### D6. Kilometraje

Entero `0…9 999 999` km. En dominio, `last_known_odometer(vehicle_id, opened_on, exclude_order_id)` devuelve la orden más reciente del vehículo con `opened_on ≤ fecha` (desempate por `sequence`), en cualquier estado. Si el valor es menor y la solicitud no trae `odometer_confirmed: true`, se rechaza con código `odometer_confirmation_required` (400), `errors.odometer_km` con el valor y número de referencia, y una extensión `details: {last_known_km, order_id, order_number}` del problema. `config.api.errors.problem_response` recibe un parámetro opcional `details` retrocompatible. Con confirmación se guardan `odometer_confirmed_by/_at`. No se escribe nada en `Vehicle`.

### D7. Importes y precio aplicado

`domain/amounts.py` valida precios con `Decimal` (≤ 2 decimales, ≥ 0, ≤ 999 999 999 999,99, sin redondeo; strings o números JSON convertidos a `Decimal` desde `str`) y cantidades enteras 1…9 999. Al agregar una línea, `applied_price` por omisión es el `reference_price` bloqueado. Si el valor enviado difiere del referencial se exige además `mantenimientos.cambiar_precio_servicio` (hoy lo tienen los mismos roles; se mantiene el chequeo por la matriz). Líneas de intervención correctiva: `applied_price` forzado a 0,00 y cualquier valor > 0 rechazado. Totales expuestos: `services_total` (todas las líneas iniciales) y `corrective_lines_count`; se rotulan «Total de servicios de la orden». Sin desglose tributario ni tarifas en código: la línea conserva `tax_definition` para la futura operación artesanal.

Servicios repetidos: líneas independientes; el reintento se controla con clave idempotente, no con deduplicación por servicio.

### D8. Fotografías y almacenamiento privado (ADR-0007)

- **Dependencia nueva:** `pillow` (con `uv add`, bloqueo en `uv.lock`). Justificación: verificar contenido real, dimensiones, animación y producir miniaturas sin exponer imágenes completas en listas. Alternativa descartada: analizar cabeceras manualmente — no verifica la decodificación y aumenta el riesgo de aceptar contenido malformado.
- **Almacenamiento:** instancia dedicada `FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT, base_url=None)` en `workshop/application/photo_storage.py`; `PRIVATE_MEDIA_ROOT` configurable por entorno (por omisión `backend/private-media/`, ignorado en Git). Nombres no predecibles: `maintenance/<order_id>/<uuid4>.<ext>` y `<uuid4>_thumb.webp`. No se define `MEDIA_URL` ni ruta estática: el único acceso es la API autorizada.
- **Validación** (`domain/photo_validation.py` + adaptador Pillow): tamaño ≤ 10 MiB antes de leer; `Image.open` con `MAX_IMAGE_PIXELS = 25_000_000` y comprobación de `width × height ≤ 25 000 000` antes de decodificar; formato real ∈ {JPEG, PNG, WEBP} (se ignora extensión y `Content-Type` declarado); `is_animated`/`n_frames > 1` rechazado; `verify()` y reapertura para generar miniatura 480 px WebP con `exif_transpose`. Se calcula `sha256`. El original se conserva tal cual.
- **Flujo de carga** (`POST .../photos/`, multipart: `file`, `description`, `idempotency_key`): (1) autoriza y comprueba replay; (2) valida y escribe original y miniatura fuera de la transacción; (3) transacción: bloquea orden, exige estado abierto, límite de 20 fotos vigentes y crea `OrderPhoto` asociada a la intervención abierta; (4) si la transacción falla, borra ambos archivos inmediatamente (`transaction.on_commit` no aplica; se usa `try/except` alrededor de la unidad). Así un registro solo existe con archivos completos. La carga no exige `expected_version` ni incrementa la versión (no altera datos editables), pero sí respeta el estado bloqueado, cubriendo la carrera carga/finalización.
- **Retiro** (`POST .../photos/{id}/remove/`): bloquea orden, exige estado abierto y que la foto pertenezca a la intervención abierta; marca `removed_at/_by`; tras el commit borra los archivos (`transaction.on_commit`). Retiro repetido: respuesta 200 sin efectos ni auditoría duplicada.
- **Limpieza recuperable:** comando `uv run python manage.py purge_workshop_files [--older-than-minutes 60]` recorre `PRIVATE_MEDIA_ROOT/maintenance/` y elimina archivos sin `OrderPhoto` vigente que los referencie y con antigüedad mayor al margen (evita competir con cargas en curso). Es idempotente y registra un resumen en logs. Cubre caídas entre escritura y commit y fallos de borrado posteriores.
- **Entrega:** `GET .../photos/{id}/file/` y `.../thumbnail/` exigen `mantenimientos.ver`, devuelven `FileResponse` con el `content_type` guardado, `Content-Disposition: inline`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` y `Content-Security-Policy: default-src 'none'`. Una foto retirada o de otra orden responde 404. Las imágenes se cargan en el frontend con `<img src>` del mismo origen (cookie de sesión), sin URLs firmadas.
- **Infraestructura:** `client_max_body_size 12m` en `location /api/` de Nginx; volumen nombrado `private_media` montado en `PRIVATE_MEDIA_ROOT` en `compose.yaml` y `infra/compose.production.example.yaml`; `.gitignore` incluye `backend/private-media/`. Django: `DATA_UPLOAD_MAX_MEMORY_SIZE` se mantiene; `FILE_UPLOAD_MAX_MEMORY_SIZE` por omisión (archivos grandes van a temporal). README documenta que el volumen debe incluirse en los respaldos (DA-003 sigue abierta). En desarrollo, el servicio `backend` de `compose.yaml` ejecuta `uv sync --frozen` antes de migrar: el entorno virtual vive en el volumen `backend_venv`, que conserva el contenido de su primera creación y no recibiría dependencias nuevas como `pillow` al reconstruir la imagen. La imagen de producción crea `/var/lib/sys-taller/private-media` con dueño `app` para inicializar el volumen.

### D9. Autorización

| Acción | Permiso | Admin | Encargado | Vendedor solo |
|---|---|---|---|---|
| Listar, detalle, historial, ver/descargar fotos, opciones de selección | `mantenimientos.ver` | Sí | Sí | No |
| Crear, editar datos, editar intervención correctiva, agregar/editar/retirar líneas | `mantenimientos.gestionar` | Sí | Sí | No |
| Precio aplicado distinto del referencial | `mantenimientos.cambiar_precio_servicio` (además de gestionar) | Sí | Sí | No |
| Adjuntar/retirar fotografías | `mantenimientos.gestionar_fotos` | Sí | Sí | No |
| Finalizar | `mantenimientos.finalizar` | Sí | Sí | No |
| Reabrir | `mantenimientos.reabrir` | Sí | Sí | No |

Las vistas declaran `business_permissions` por método con `HasBusinessPermission`; los comandos repiten `require_permission` antes del replay. Denegaciones de escritura se auditan. Las respuestas 403 no revelan existencia; un ID inexistente con permiso responde 404. No se modifica `identity/domain/authorization.py`. El detalle incluye `allowed_actions` calculadas en servidor (estado × permisos) que la interfaz usa para mostrar botones.

### D10. Contrato API

Base `/api/v1/maintenance-orders/`. Errores `application/problem+json` con `code` estable. Paginación `page`/`page_size` (1…100, 20 por omisión) con envoltura `count, page, page_size, total_pages, results`.

| Método y ruta | Uso | Respuestas |
|---|---|---|
| `GET /` | Lista: `search` (número, cliente nombre/identificación, placa; `icontains` tras `strip`), `state`, `date_from`, `date_to` (inclusivos), `customer_id`, `vehicle_id`, paginación. Orden `-opened_on, -sequence`. Ítem: id, número, fecha, cliente (snapshot + activo), placa (snapshot), km, estado, `services_total`, `service_summary {names[≤3], line_count}` | 200, 400, 403 |
| `POST /` | Crear: `customer_id`, `vehicle_id`, `opened_on?`, `odometer_km`, `odometer_confirmed?`, `diagnosis?`, `notes?`, `idempotency_key` | 201, 400, 403, 409 (`open_order_exists`, `concurrent_operation`) |
| `GET /{id}/` | Detalle con intervenciones, líneas, fotos vigentes, transiciones, `services_total`, `pending_requirements`, `allowed_actions`, `version` | 200, 403, 404 |
| `PATCH /{id}/` | Editar datos generales (`expected_version`, `idempotency_key`) | 200, 400, 403, 404, 409 (`stale_record`, `not_editable`, `open_order_exists`) |
| `PATCH /{id}/current-intervention/` | `work_performed`, `notes` de la correctiva abierta | 200, 400, 403, 404, 409 |
| `POST /{id}/service-lines/` | `service_id`, `quantity?`, `applied_price?`, `expected_version`, `idempotency_key` | 201, 400, 403, 404, 409 |
| `PATCH /{id}/service-lines/{line_id}/` | `quantity?`, `applied_price?`, `expected_version`, `idempotency_key` | 200, 400, 403, 404, 409 |
| `POST /{id}/service-lines/{line_id}/remove/` | `expected_version`, `idempotency_key` | 200, 403, 404, 409 |
| `POST /{id}/finalize/` | `expected_version`, `idempotency_key` | 200, 400 (`finalize_requirements` con `errors.requirements`), 403, 404, 409 |
| `POST /{id}/reopen/` | `reason`, `expected_version`, `idempotency_key` | 200, 400, 403, 404, 409 |
| `POST /{id}/photos/` | multipart `file`, `description?`, `idempotency_key` | 201, 400 (`invalid_image`, `image_too_large`, `photo_limit_reached`), 403, 404, 409 |
| `POST /{id}/photos/{photo_id}/remove/` | `idempotency_key` | 200, 403, 404, 409 |
| `GET /{id}/photos/{photo_id}/file/` · `/thumbnail/` | Binario privado | 200, 403, 404 |
| `GET /customer-options/?search=` · `/vehicle-options/?customer_id=` · `/service-options/?search=` | Selectores: activos; vehículos del propietario vigente con `open_order_number` si tiene orden abierta | 200, 400, 403 |

Las respuestas de escritura devuelven el detalle actualizado. Los importes se serializan como cadenas decimales con dos decimales. `backend/schema.yml` se regenera y se prueba su sincronía.

### D11. Frontend

- **Estructura (implementada):** `features/maintenance/` (`api.ts`, `types.ts`, `hooks.ts`, `format.tsx`, `OrderForm.tsx`, `ServiceLines.tsx` con la tabla y el diálogo de líneas, `Photos.tsx` con galería y carga, `Transitions.tsx` con finalizar, reabrir, panel de corrección e historial, `OrderSummary.tsx`, `SectionPanel.tsx`, `MaintenanceHistorySection.tsx`; sin CSS propio) y `pages/maintenance/` (`MaintenanceOrdersPage`, `MaintenanceOrderEditorPage`, `MaintenanceOrderDetailPage`).
- **Rutas:** `/maintenance` (lista), `/maintenance/new`, `/maintenance/:id`, `/maintenance/:id/edit`, protegidas con `PermissionGuard` (`mantenimientos.ver` / `mantenimientos.gestionar`). La entrada de navegación existente se conserva. `?vehicle_id=&customer_id=` precargan la creación desde las fichas.
- **Lista:** DataTable a ancho completo con búsqueda, filtro de estado (segmented control), rango de fechas y paginación de servidor; estados de carga, vacío y error.
- **Editor (página completa, dos columnas):** a la izquierda, paneles `SectionPanel` «Cliente y vehículo» (Combobox de cliente a todo el ancho del panel para razones sociales largas; `Select` con ícono de los vehículos activos del propietario vigente, que avisa y enlaza si ya tienen una orden abierta), «Ingreso del vehículo» (fecha y kilometraje compactos con íconos y unidad «km»; advertencia de confirmación desde `details`) y «Diagnóstico y observaciones». A la derecha, un resumen fijo que refleja la selección en vivo y contiene las acciones Registrar/Guardar y Cancelar. Errores por campo, conflicto con opción de recargar que conserva lo escrito, botón deshabilitado mientras envía y clave idempotente por intención (`shared/api/idempotency.ts`). Se eligió `Select` para el vehículo porque la lista ya está acotada a los vehículos del cliente.
- **Detalle (dos columnas):** cabecera con número, estado y acciones de `allowed_actions` (Editar datos, Finalizar —«Finalizar corrección» si está reabierta— y Reabrir como acción principal de una orden finalizada). Columna principal con `SectionPanel` (cabecera `surface-subtle` e ícono): Información general, Diagnóstico y observaciones, Servicios (precio referencial, precio aplicado, cantidad, subtotal y «Total de servicios de la orden»; correctivas «Sin cargo»), Fotografías (miniaturas, visor `Modal size="media"`, carga con descripción, retiro con `ConfirmationPanel`; las de una corrección llevan etiqueta) y correcciones anteriores como línea de tiempo. Si la orden está reabierta, encabeza la columna un panel «Corrección en curso» con los tokens `scope-artisan`/`scope-artisan-soft`: título, etiqueta «Sin cargo al cliente», causa, quién reabrió, formulario del trabajo correctivo con indicador de cambios y botón principal, y lista de pasos. Columna lateral fija con el resumen (estado, total, conteos y requisitos para finalizar calculados por el servidor) y el historial en línea de tiempo. Las acciones de sección usan la variante de botón `soft` (petróleo suave en reposo); agregar/editar línea usa `FormModal size="wide"` (600 px) con una ficha del servicio elegido que muestra su nombre completo. Finalizar: modal con resumen y `pending_requirements`; confirmar deshabilitado si faltan. Reabrir: modal con causa obligatoria y explicación. Confirmaciones con Toast abajo a la derecha. Las variantes compartidas nuevas (`Button soft`, `Modal size`) están documentadas en el catálogo visual (TK-03, TK-13) como adaptaciones del proyecto.
- **Fotografías:** `ApiClient.request` acepta `FormData` (sin fijar `Content-Type`, con CSRF); ante error conserva archivo y descripción seleccionados para reintentar; vista previa local con `URL.createObjectURL` liberada al cerrar.
- **Historial:** `MaintenanceHistorySection` en `CustomerDetailPage` y `VehicleDetailPage`, visible solo con `mantenimientos.ver`, consume `GET /?customer_id=` o `?vehicle_id=` paginado, con enlace al detalle y acción «Nueva orden» si el usuario gestiona.
- Sin secciones de repuestos, pagos, saldos o facturas. Sin dependencias frontend nuevas.

### D12. Auditoría

`record_audit_event` con acciones `maintenance.create`, `maintenance.update`, `maintenance.intervention_update`, `maintenance.service_line_add|update|remove`, `maintenance.photo_add|remove`, `maintenance.finalize`, `maintenance.reopen`; `target_type="maintenance_order"`, `target_id` del pedido y `changed_fields` (lista blanca existente). La causa de reapertura queda en `StateTransition`, no en metadatos de auditoría. No se registra contenido de archivos.

## Risks / Trade-offs

- [Pillow añade superficie de ataque por decodificación de imágenes] → Límite de bytes y píxeles antes de decodificar, formatos cerrados, `pip-audit` en `make audit`, versión acotada en `pyproject.toml`.
- [Archivos escritos antes del commit pueden quedar huérfanos si el proceso muere] → Borrado inmediato ante excepciones y comando `purge_workshop_files` idempotente con margen temporal.
- [El original conserva metadatos EXIF (posible geolocalización)] → Las fotos son privadas y del taller; las miniaturas se reencodifican sin EXIF. Reencodificar originales se deja como mejora si el negocio lo pide.
- [20 × 10 MiB por orden aumentan respaldo y tráfico LAN] → Listas y detalle usan miniaturas; originales solo en vista ampliada. DA-003 decidirá la política de respaldo.
- [Nginx por omisión rechaza cargas > 1 MiB] → `client_max_body_size 12m` y prueba de humo documentada.
- [Snapshot de cliente/vehículo divergente de la ficha] → Intencional para historia; la UI muestra además el estado actual (inactivo) desde la referencia.
- [Reapertura bloqueada si el vehículo ya tiene otra orden abierta] → Mensaje con el número de la orden abierta y enlace; es la regla P1 aprobada.
- [Contador único serializa creaciones] → Volumen de un taller mediano; el bloqueo es breve.
- [Sin cancelación en esta entrega, un duplicado queda registrado] → Puede finalizarse o dejarse abierto; la cancelación queda en la línea objetivo para un cambio posterior.

## Migration Plan

1. `workshop/migrations/0001_initial.py`: tablas, restricciones e índices de D2 (aditiva, sin tocar tablas existentes).
2. `0002_seed_counter.py`: crea `MaintenanceCounter(id=1, last_number=0)`; reversible.
3. Sin migraciones en otros módulos: las interfaces nuevas no cambian esquemas. `makemigrations --check` debe quedar limpio.
4. Despliegue: `make migrate`; crear el volumen `private_media`; recargar Nginx con el nuevo límite; programar `purge_workshop_files` (manual o cron del host) — no se añade planificador.
5. Rollback: revertir código y `migrate workshop zero` mientras no existan órdenes reales; con datos, no se revierte (historial operativo) y se corrige hacia adelante. Los archivos del volumen se conservan.

No hay datos existentes que migrar ni órdenes o fotografías de ejemplo en producción.

## Estrategia de pruebas

- **Dominio (unitarias):** transiciones y tabla D5; requisitos de finalización; importes (0,10 × 3 + 19,99 = 20,29; precisión, negativos, más de dos decimales); kilometraje (negativo, fraccionario, menor sin/con confirmación); validación de fotos con imágenes generadas en memoria (JPEG/PNG/WebP válidos, GIF, PNG animado, WebP animado, PDF, ejecutable renombrado, > 10 MiB, > 25 MP).
- **Aplicación/API (integración, PostgreSQL):** creación válida, vehículo de otro propietario, inactivos, fecha futura, segunda orden abierta, número inicial y sin huecos tras rechazo; edición progresiva, `stale_record`, campos desconocidos; líneas con precio referencial/ajustado/cero, repetidas, cambio de catálogo posterior y desactivación; finalizar incompleto/completo/repetido; edición de finalizada; reapertura sin causa, con causa, nueva finalización, historial conservado, bloqueo de la intervención inicial, correctivas sin cargo; transferencia posterior y reapertura; historial por cliente y vehículo con entidades inactivas; fotos: carga, límite 20, retiro, retiro repetido, acceso a archivo por rol y sin sesión, cabeceras de respuesta, limpieza idempotente; ausencia de filas nuevas en ventas, inventario, pagos, `NumberAllocation` y `ConfigurationUse`.
- **Permisos:** matriz por rol y combinación (Vendedor, Encargado, Administrador, Vendedor+Encargado) para cada endpoint, incluidos archivos.
- **Concurrencia (`transaction=True`, hilos):** dos creaciones simultáneas (números distintos; mismo vehículo → una sola); edición contra finalización; carga de foto contra finalización; dos reaperturas; reintentos idempotentes.
- **Fronteras:** `workshop` solo importa interfaces públicas; las interfaces nuevas no escriben en módulos ajenos.
- **OpenAPI:** esquema regenerado y prueba de sincronía existente.
- **Frontend (Vitest):** api (incluido FormData), hooks, lista con filtros, editor (errores por campo, advertencia de km, conflicto conservando datos, envío único), detalle (acciones por estado/permiso, finalizar con pendientes, reabrir con causa), fotos (error conserva archivo), secciones de historial en fichas y rutas protegidas.
- **Comandos:** `make check`, `make test`, `make audit`, `make compose-check`, `openspec validate --strict`; revisión visual con la aplicación en ejecución cuando el entorno lo permita.

## Open Questions

Ninguna bloqueante. Quedan fuera de este diseño y abiertas en sus fuentes: DA-003 (respaldo y restauración, incluida la inclusión efectiva del volumen de fotografías), la cancelación de mantenimientos y la integración con repuestos, ventas y operación artesanal (funcionalidad 8).
