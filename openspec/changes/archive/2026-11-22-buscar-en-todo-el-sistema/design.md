## Context

El backend de Tallkit sigue un monolito modular (`ADR-0001`) donde el módulo `home` compone consultas de solo lectura publicadas por otros módulos (`customer_registry`, `proformas`, `sales`, `workshop`, `workshop_configuration`), sin modelos propios, sin migraciones y con pruebas de fronteras estrictas en `backend/tests/home/test_boundaries.py`. La autenticación usa sesiones Django con mismo origen (`ADR-0003`) y el servidor es la única autoridad de permisos.

En el frontend, `AuthenticatedShell.tsx` renderiza el marco autenticado (barra lateral, barra superior de escritorio `app-topbar` y cabecera móvil) y `CounterHero.tsx` renderiza el buscador principal de la página de inicio, que actualmente redirige a una sola lista filtrada.

Las specs aprobadas (`busqueda-global` y el delta de `navegacion-de-uso-diario`) requieren una búsqueda global de solo lectura en cuatro grupos (**Vehículos**, **Clientes**, **Facturas** y **Productos**), accesible desde cualquier pantalla, filtrada por permisos y entidad fiscal en el servidor, sin exponer costos ni presentar preparaciones locales como facturas autorizadas (`DP-034` regla 8, `DP-036` reglas 3 y 5).

## Goals / Non-Goals

**Goals:**
- Exponer un único endpoint de solo lectura (`GET /api/v1/home/search/?q=...`) en `home` que coordine lecturas publicadas por los módulos dueños sin violar fronteras del monolito modular.
- Garantizar en el servidor la autorización por rol y entidad fiscal, la exclusión estricta de costos/valoración para todos los roles, la existencia condicionada a `inventario.ver` y el estado de mantenimiento abierto condicionado a `mantenimientos.ver`.
- Tolerar mayúsculas, tildes y ausencia de guiones o espacios en placas sin exigir extensiones adicionales de PostgreSQL.
- Proveer en el frontend un diálogo de búsqueda global (basado en `docs/prototipo/Buscar.dc.html` y Grafito y cobre), accesible por botón en el marco (escritorio/móvil), atajo de teclado y desde el buscador de Inicio, con recientes por sesión limpiados al salir.

**Non-Goals:**
- Crear modelos de base de datos, tablas de índice de búsqueda, migraciones o motores de búsqueda externos.
- Buscar en servicios, proformas, entradas de mercadería, proveedores, usuarios o auditoría.
- Habilitar estados de emisión SRI («Solicitada», «Autorizada», «Rechazada») o descarga de RIDE/XML.
- Crear un ADR nuevo: el diseño reutiliza íntegramente `ADR-0001`, `ADR-0003` y `ADR-0010`.

## Decisions

### 1. Ubicación en el backend y fronteras del monolito modular (`home` + `home_summary`)
- **Decisión:** agregar el endpoint en `backend/src/home/` (`GET /api/v1/home/search/`, `operation_id: home_search`) y delegar las consultas a funciones de lectura publicadas en el módulo `application/home_summary.py` de cada dueño:
  - `customer_registry.application.home_summary`: `search_vehicles(actor, query, limit)` y `search_customers(actor, query, limit)`.
  - `workshop.application.home_summary`: `open_orders_by_vehicles(actor, vehicle_ids)`.
  - `fiscal.application.home_summary` (nuevo archivo delgado): `search_preparations(actor, query, limit)`.
  - `catalog.application.home_summary` (nuevo archivo delgado): `search_products(actor, query, limit)`.
  - `inventory.application.home_summary` (nuevo archivo delgado): `stock_quantities(actor, product_ids)` (reutilizando `inventory.application.queries.list_stock_quantities`).
- **Alternativa descartada:** consultar modelos de otros módulos directamente desde `home` (rompe `ADR-0001` y `test_boundaries.py`) o hacer 4 llamadas HTTP paralelas desde el frontend (duplica lógica de autorización/orquestación en el cliente y complica los estados de carga/error).
- **Fronteras:** se añaden únicamente `catalog.application.home_summary`, `inventory.application.home_summary` y `fiscal.application.home_summary` a `ALLOWED_CROSS_MODULE` en `backend/tests/home/test_boundaries.py`. `home` conserva cero modelos, cero migraciones y cero operaciones de escritura.

### 2. Contrato de la API y autorización en el servidor
- **Endpoint:** `GET /api/v1/home/search/?q=<texto>` (requiere sesión vigente; sin permiso propio de vista porque cada grupo evalúa `has_permission` sin registrar denegaciones de auditoría, igual que `PendingView` y `ReceivablesView`).
- **Longitud mínima:** si `q.strip()` tiene menos de 2 caracteres, el servidor devuelve grupos autorizados vacíos (`total: 0, items: []`) y `null` en grupos no autorizados, sin consultar la base de datos.
- **Formato de respuesta:**
  - `query`: texto normalizado recortado.
  - `vehicles`: `{ total, items: [{ id, plate, label, owner_id, owner_name, open_order }] }` o `null` si el actor no tiene `vehiculos.ver`. `open_order` es `{ id, number, status }` solo si el vehículo tiene un mantenimiento en estado `REGISTERED` o `REOPENED` **y** el actor tiene `mantenimientos.ver`; en caso contrario es `null`.
  - `customers`: `{ total, items: [{ id, full_name, identification_type, identification }] }` o `null` si el actor no tiene `clientes.ver`.
  - `invoices`: `{ total, items: [{ id, entity, number, customer_name, date, state, total }] }` o `null` si el actor no tiene `fiscal.comercial.ver` ni `fiscal.artesanal.ver`. Cuando tiene solo uno, se filtran exclusivamente las preparaciones de esa entidad fiscal. `state` conserva los valores locales (`DRAFT`, `PREPARED`, `CANCELLED`). Nunca incluye un total conjunto.
  - `products`: `{ total, items: [{ id, code, manufacturer_code, name, sale_price, stock }] }` o `null` si el actor no tiene `productos.ver`. `stock` es la existencia (`str` entero/decimal formateado) solo si el actor tiene `inventario.ver`; en caso contrario `null`. Ningún serializer ni consulta devuelve costo, costo promedio, valoración ni margen.
- **Tope por grupo:** 5 elementos por grupo (`LIMIT = 5`), devolviendo `total` real de coincidencias del grupo.
- **OpenAPI:** regenerar `backend/schema.yml` con el contrato del nuevo endpoint.

### 3. Tolerancia de búsqueda (placas sin guion, tildes y mayúsculas)
- **Decisión:** aplicar una función de normalización común en Python (`unicodedata.normalize("NFKD", ...)` retirando marcas diacríticas, en minúsculas) y, para placas, retirar además guiones y espacios (`GBA-1234` ↔ `gba1234`).
  - En consultas con PostgreSQL, evitar depender de la extensión `unaccent` (no garantizada en todos los entornos locales/Windows de `ADR-0013`): para placas comparar también con `Replace` en SQL sobre `plate` (sin guiones ni espacios), y para nombres/productos/clientes combinar el filtro rápido cuando el término es ASCII con filtrado normalizado seguro sobre el conjunto acotado del taller, de modo que «bujia» encuentre «Bujía» y «gba1234» encuentre «GBA-1234» de forma determinista tanto en pruebas como en producción.
- **Alternativa descartada:** exigir `CREATE EXTENSION unaccent` en una migración (requiere privilegios de superusuario en PostgreSQL y puede fallar en despliegues locales).

### 4. Transaccionalidad, concurrencia e idempotencia
- La consulta es estrictamente de solo lectura (`GET`), idempotente y se ejecuta dentro de `home.application.snapshot.read_snapshot()` para consistencia puntual sin bloqueos de escritura ni efectos secundarios.
- No requiere migraciones ni cambios en datos existentes.

### 5. Integración en el frontend, navegación y recientes de sesión
- **Módulo `frontend/src/features/search/`:**
  - `types.ts`, `api.ts` (con `AbortSignal`), `hooks.ts` (debounce ~220 ms, consulta desde 2 caracteres, cancelación de respuestas obsoletas), `recent.ts`, `GlobalSearchContext.tsx` y `GlobalSearchDialog.tsx`.
- **Disparadores y atajo de teclado:**
  - En `AuthenticatedShell.tsx`: botón «Buscar» con pista de atajo en `app-topbar` (escritorio) y botón de icono de 44×44 px en la cabecera móvil.
  - Atajo global: `Ctrl+K` / `Cmd+K` (y `/` cuando el foco no está dentro de un `input`, `textarea`, `select` o `contenteditable`).
  - En `CounterHero.tsx` (`HomePage.tsx`): el buscador principal de la banda grafito llama a `openSearch(term)` al enviar (y permite abrir directamente al escribir/enviar sin redirigir a una sola lista).
- **Destinos al elegir un resultado:**
  - Vehículo con `open_order`: `/maintenance/${item.open_order.id}`.
  - Vehículo sin `open_order` (o sin permiso de taller): `/customers/${item.owner_id}` (ficha del propietario donde figuran sus vehículos) o `/vehicles/${item.id}` según la ruta existente más directa (`/vehicles/${item.id}` ya existe en `App.tsx` y muestra la ficha del vehículo con enlace al propietario).
  - Cliente: `/customers/${item.id}`.
  - Factura: `/fiscal/preparations/${item.id}` (abre siempre la preparación exacta sin depender de la página actual de `/invoices`).
  - Producto: `/products/${item.id}`.
- **Recientes de sesión (`recent.ts`):**
  - Se almacenan hasta 5 elementos recientes en `sessionStorage` con clave vinculada al `username` autenticado (`tallkit.recent_search.<username>`).
  - Al ejecutar `logout()` en `AuthenticatedShell.tsx`, o cuando cambia el usuario / se invalida la sesión (`!session.authenticated`), se eliminan todas las claves de recientes de `sessionStorage` para evitar filtraciones en equipos compartidos.
- **Accesibilidad:**
  - `role="dialog"`, `aria-modal="true"`, foco inicial en el campo de búsqueda, navegación con `ArrowDown`/`ArrowUp` + `Enter`, cierre con `Escape` devolviendo el foco al disparador, áreas táctiles >= 44 px y diseño adaptable desde 360 px sin desbordamiento horizontal.

### 6. Estrategia de pruebas (según niveles de riesgo de `AGENTS.md`)
- **Alto riesgo — TDD (backend):**
  - `backend/tests/home/test_search.py`:
    - Acceso anónimo y sesión invalidada → `401`.
    - Matriz de permisos por rol: solo `VENDEDOR` (sin `open_order`, solo facturas comerciales, con `stock` y sin costos), solo `ENCARGADO_TALLER` (con `open_order`, solo facturas artesanales, sin costos), `VENDEDOR + ENCARGADO_TALLER` (unión de ambos negocios sin total conjunto), `ADMINISTRADOR` (todos los grupos, nunca costos ni valoración), y usuario sin `inventario.ver` (`stock: null`).
    - Tolerancia de placa sin guion, tildes y mayúsculas; límite de 5 por grupo con `total` real; longitud mínima; estados locales de factura sin marcas SRI; garantía de solo lectura.
  - `backend/tests/home/test_boundaries.py`: confirmar que `home` sigue sin modelos, sin escrituras y solo importa `home_summary` publicados.
- **Riesgo medio — prueba al final (frontend):**
  - `frontend/src/features/search/GlobalSearchDialog.test.tsx`: apertura, debounce/resultados agrupados, navegación a cada destino (incluyendo vehículo con y sin mantenimiento abierto), estado vacío/sin resultados/error con reintento, teclado (`Escape`, `ArrowDown`, `Enter`) y limpieza de recientes al cambiar o cerrar sesión.
  - Ajustar `frontend/src/app/AuthenticatedShell.test.tsx` y `frontend/src/pages/home/HomePage.test.tsx` para cubrir el disparador en el marco, el atajo de teclado y el buscador de Inicio.

## Risks / Trade-offs

- **Rendimiento en la búsqueda de facturas locales:** `FiscalPreparation` no almacena en columna directa el número interno ni el nombre del cliente (están en la operación origen de `sales` o `workshop`). → **Mitigación:** resolver los resúmenes por lotes (igual que `fiscal/application/listing.py`) acotando primero por entidad fiscal permitida y ordenando por más recientes; mantener la consulta bajo el objetivo de 2 s con el volumen del taller.
- **Tildes sin extensión `unaccent`:** filtrar tildes en Python sobre tablas muy grandes podría degradarse a largo plazo. → **Mitigación:** el volumen esperado de un taller mediano es acotado (miles de filas, no millones); se hace proyección mínima de columnas (`values`/`only`) y se limita el resultado a 5 por grupo; si en el futuro crece, puede activarse `unaccent` sin cambiar la API.
- **Recientes en navegador compartido si el usuario no cierra sesión:** `sessionStorage` persiste mientras la pestaña siga abierta. → **Mitigación:** el cierre de sesión automático por inactividad (ya implementado en `d2a204e`) invalida la sesión y dispara la limpieza inmediata de recientes.

## Migration Plan

Sin migraciones de base de datos ni pasos de migración de datos. El despliegue consiste en publicar el backend con el nuevo endpoint (más `backend/schema.yml` actualizado) y el bundle del frontend; el rollback es inmediato revirtiendo el release.

## Open Questions

Ninguna abierta para iniciar `tasks`.
