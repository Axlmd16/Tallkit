## 1. Backend · Lecturas publicadas y endpoint de búsqueda global (Riesgo alto — TDD)

- [x] 1.1 Escribir primero las pruebas TDD en `backend/tests/home/test_search.py` cubriendo: acceso anónimo y sesión invalidada (`401`), matriz de permisos por rol (`VENDEDOR`, `ENCARGADO_TALLER`, `VENDEDOR + ENCARGADO_TALLER`, `ADMINISTRADOR` y usuario sin `inventario.ver`), separación fiscal en facturas sin total conjunto ni marcas SRI, exclusión estricta de costos/valoración en productos, tolerancia de placas sin guion y tildes, límite de 5 por grupo con `total` real, longitud mínima (`< 2` caracteres) y garantía de solo lectura.
- [x] 1.2 Agregar las funciones de lectura publicadas en los módulos dueños sin acoplar escrituras:
  - `backend/src/customer_registry/application/home_summary.py`: `search_vehicles(actor, query, limit=5)` y `search_customers(actor, query, limit=5)` con normalización insensible a mayúsculas, tildes y guiones/espacios en placas.
  - `backend/src/workshop/application/home_summary.py`: `open_orders_by_vehicles(actor, vehicle_ids)` condicionado a `mantenimientos.ver`.
  - `backend/src/fiscal/application/home_summary.py`: `search_preparations(actor, query, limit=5)` condicionado por separado a `fiscal.comercial.ver` y `fiscal.artesanal.ver`, devolviendo únicamente estado local.
  - `backend/src/catalog/application/home_summary.py`: `search_products(actor, query, limit=5)` condicionado a `productos.ver`, sin costos.
  - `backend/src/inventory/application/home_summary.py`: `stock_quantities(actor, product_ids)` condicionado a `inventario.ver`, reutilizando `list_stock_quantities`, sin costos ni valoración.
- [x] 1.3 Implementar el orquestador `backend/src/home/application/search.py` (dentro de `read_snapshot()`) y exponer `GET /api/v1/home/search/?q=...` en `backend/src/home/api/serializers.py`, `backend/src/home/api/views.py` y `backend/src/home/api/urls.py`.
- [x] 1.4 Actualizar `ALLOWED_CROSS_MODULE` en `backend/tests/home/test_boundaries.py` para permitir únicamente los nuevos `home_summary` publicados y verificar que `home` sigue sin modelos, sin migraciones y sin escrituras.
- [x] 1.5 Regenerar el contrato OpenAPI en `backend/schema.yml` (`cd backend && uv run --frozen python manage.py spectacular --file schema.yml`).

**Verificación del grupo 1:**
```bash
cd backend && uv run --frozen pytest tests/home/test_search.py tests/home/test_boundaries.py && uv run --frozen ruff format --check src/home src/customer_registry/application/home_summary.py src/workshop/application/home_summary.py src/fiscal/application/home_summary.py src/catalog/application/home_summary.py src/inventory/application/home_summary.py tests/home && uv run --frozen ruff check src/home src/customer_registry/application/home_summary.py src/workshop/application/home_summary.py src/fiscal/application/home_summary.py src/catalog/application/home_summary.py src/inventory/application/home_summary.py tests/home && uv run --frozen mypy src/home src/customer_registry/application/home_summary.py src/workshop/application/home_summary.py src/fiscal/application/home_summary.py src/catalog/application/home_summary.py src/inventory/application/home_summary.py tests/home/test_search.py tests/home/test_boundaries.py && uv run --frozen python manage.py makemigrations --check --dry-run
```

## 2. Frontend · Módulo de búsqueda global y recientes de sesión (Riesgo medio — prueba al final)

- [x] 2.1 Crear el módulo `frontend/src/features/search/`:
  - `types.ts`: tipos del contrato `GET /api/v1/home/search/`.
  - `api.ts`: cliente HTTP con `AbortSignal` para cancelar consultas obsoletas.
  - `hooks.ts`: hook `useGlobalSearch` con debounce (~220 ms) y habilitación desde 2 caracteres.
  - `recent.ts`: almacenamiento en `sessionStorage` por usuario autenticado (máximo 5 elementos) y `clearRecentSearches()`.
- [x] 2.2 Implementar `frontend/src/features/search/GlobalSearchDialog.tsx` y `GlobalSearchContext.tsx` siguiendo `docs/prototipo/Buscar.dc.html` y Grafito y cobre:
  - Diálogo accesible (`role="dialog"`, `aria-modal="true"`), foco inicial, navegación con `ArrowDown`/`ArrowUp` + `Enter`, cierre con `Escape` devolviendo foco al disparador, áreas táctiles >= 44 px y diseño adaptable desde 360 px.
  - Grupos Vehículos, Clientes, Facturas (con nombre comercial del negocio y estado local, sin marcas SRI ni total conjunto) y Productos (con existencia solo cuando viene del servidor y nunca costos), mostrando conteo y aviso si `total > items.length`.
  - Navegación directa: vehículo con `open_order` → `/maintenance/:id`, vehículo sin `open_order` → `/vehicles/:id`, cliente → `/customers/:id`, factura → `/fiscal/preparations/:id`, producto → `/products/:id`.
  - Estados inicial (recientes de la sesión o guía breve), carga, sin resultados (con sugerencia) y error recuperable con «Reintentar».
- [x] 2.3 Agregar pruebas en `frontend/src/features/search/GlobalSearchDialog.test.tsx` cubriendo resultados agrupados, destinos de navegación (vehículo con/sin mantenimiento abierto, cliente, factura, producto), estado vacío/sin resultados/error con reintento, teclado (`ArrowDown`, `Enter`, `Escape`) y limpieza de recientes al cambiar o cerrar sesión.

**Verificación del grupo 2:**
```bash
cd frontend && npm run test -- src/features/search/GlobalSearchDialog.test.tsx
```

## 3. Frontend · Integración en el marco autenticado y en Inicio (Riesgo medio — prueba al final)

- [x] 3.1 Integrar `GlobalSearchProvider` y `GlobalSearchDialog` en `frontend/src/app/AuthenticatedShell.tsx`:
  - Disparador «Buscar» en `app-topbar` (escritorio) y botón de icono >= 44 px en la cabecera móvil.
  - Atajo global `Ctrl+K` / `Cmd+K` y `/` (cuando el foco no está en un campo editable).
  - Limpieza de `clearRecentSearches()` en `logout()` y al cambiar o invalidarse la sesión.
- [x] 3.2 Conectar el buscador principal de `frontend/src/pages/home/CounterHero.tsx` (y `frontend/src/pages/home/HomePage.tsx`) para abrir la búsqueda global con el término ingresado en lugar de redirigir a una sola lista filtrada.
- [x] 3.3 Actualizar `frontend/src/app/AuthenticatedShell.test.tsx` y `frontend/src/pages/home/HomePage.test.tsx` para cubrir la apertura desde el marco, el atajo de teclado, la limpieza de recientes al cerrar sesión y el buscador de Inicio.

**Verificación del grupo 3:**
```bash
cd frontend && npm run test -- src/features/search/GlobalSearchDialog.test.tsx src/app/AuthenticatedShell.test.tsx src/pages/home/HomePage.test.tsx && npm run format:check && npm run lint && npm run typecheck && npm run build
```

## 4. Documentación, cobertura y cierre de trazabilidad (Sin prueba nueva)

- [x] 4.1 Actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md` §2.1 (línea 37) reemplazando «sin búsqueda global hasta U5» por el comportamiento implementado.
- [x] 4.2 Crear la tabla breve de cobertura (una fila por requisito) en `docs/negocio/requisitos/cobertura-busqueda-global.md` y actualizar `docs/negocio/requisitos/matriz-trazabilidad.md` y `docs/cambios-pendientes.md` (U5).

**Verificación del grupo 4:**
- Revisar que todos los enlaces en los documentos actualizados existan y que `git diff --stat` muestre únicamente los archivos del cambio.
