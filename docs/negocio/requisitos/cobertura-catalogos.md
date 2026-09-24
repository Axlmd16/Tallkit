# Cobertura de catálogos de productos, servicios y proveedores

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `gestionar-catalogos-productos-servicios-proveedores` |
| Estado | Evidencia local de implementación; **no** es aprobación humana ni archivo del cambio |
| Fecha | 2026-09-20 |
| Alcance | Productos, categorías, unidades, marcas de producto, compatibilidades, servicios y proveedores. Excluye existencias, costos, disponibilidad y toda operación de compra, venta o mantenimiento |

## 1. Resumen

| Capacidad | Requisitos | Escenarios | Cumplidos | Parciales | Pendientes |
|---|---|---|---|---|---|
| Catálogo de productos y categorías | 10 | 57 | 56 | 1 | 0 |
| Catálogo de servicios | 7 | 35 | 33 | 2 | 0 |
| Catálogo de proveedores | 7 | 36 | 35 | 1 | 0 |
| **Total** | **24** | **128** | **124** | **4** | **0** |

«Cumplido» significa que una prueba automatizada ejecutada localmente verifica el comportamiento descrito por el escenario; «Parcial» indica una garantía local verificada cuyo resto depende de consumidores que aún no existen, con la limitación indicada. Los nombres de prueba son archivos; la columna de tareas remite a `tasks.md`.

## 2. Comandos y resultados de la verificación local (2026-09-20)

Cada fallo listado como «previo» se reprodujo en un árbol limpio de `HEAD` (sin cambios de este cambio) o corresponde a archivos que este cambio no modifica; no se bajó ningún umbral ni se ocultó ninguna comprobación.

| Comando | Resultado | Atribución |
|---|---|---|
| `cd backend && uv run pytest` (vía `make test`) | **599 pasaron**; cobertura 90,22 % (umbral 85 %) | Sin fallos |
| `make audit` | `pip-audit` y `npm audit --audit-level=high`: sin vulnerabilidades | Sin fallos |
| `ruff format --check .`, `manage.py check`, `makemigrations --check --dry-run` | Correctos; sin migraciones pendientes | Sin fallos |
| `manage.py spectacular --validate` | 0 errores, 3 advertencias; `backend/schema.yml` coincide con el esquema generado | Sin fallos |
| `ruff check .` | 25 errores | **Previo**: todos en `tests/workshop_configuration/`, no modificado por este cambio |
| `mypy src tests` | 88 errores en 9 archivos | **Previo**: todos en `tests/workshop_configuration/` |
| `npm run lint`, `typecheck`, `build` | Correctos | Sin fallos |
| `npm run format:check` | Falla solo `src/shared/ui/surfaces/DetailCard.tsx` | **Previo**: archivo no modificado; los archivos de este cambio se formatearon |
| `npm test` / `test:coverage` | 517 pasaron, 4 fallaron (`VehicleBrandsPage.test.tsx` ×3, `CustomerDetailPage.test.tsx` ×1) | **Previo**: los mismos 4 fallan en `HEAD` limpio; la cobertura frontend no se evalúa por ese fallo |
| `npm run test:e2e` (con `CATALOG_EVIDENCE_DIR` externo) | Sin `CATALOG_EVIDENCE_DIR` aborta al cargar `e2e/catalog/*`. Con él: 144 pasaron, 19 fallaron, 66 omitidas, 4 no ejecutadas | Ver detalle inferior |
| `npx playwright test e2e/catalogs.spec.ts e2e/catalogs-quality.spec.ts e2e/responsive.spec.ts` (tras corregir esta entrega) | 25 pasaron, 1 falló | La falla es previa (detalle inferior) |
| `make compose-check`, `git diff --check` | Correctos | Sin fallos |
| `openspec validate --all --strict` | 11 de 12 válidos; falla `spec/catalogo-visual-reutilizable` | **Previo**: spec principal no modificada por este cambio; `change/gestionar-catalogos-productos-servicios-proveedores` valida |

**Detalle E2E de la primera ejecución completa (19 fallos):**

- Introducidos por este cambio y **corregidos**: `responsive.spec.ts` ×4 (navegaban al enlace «Marcas», renombrado «Marcas de vehículo» en la tarea 11.3); `catalogs.spec.ts` (el reintento tras «Cargar versión vigente» guardaba antes de terminar la recarga: ahora espera la respuesta); `catalogs-quality.spec.ts` (la página de marcas de producto sin registros no muestra un elemento `status`: ahora se siembran marcas de producto de nombre largo). Los tres archivos se volvieron a ejecutar y pasan.
- Previos, reproducidos en `HEAD` limpio: `auth.spec.ts` ×4 y `users.spec.ts` ×1 (cierre de sesión no muestra «Iniciar sesión»); `customers-vehicles.spec.ts` ×5 (textos de la lista de clientes y de vehículos que ya no coinciden con las pruebas); `responsive.spec.ts` «vehicle transfer» (no encuentra «Ver ficha» del vehículo).
- Ajenos a esta entrega: `catalog/visual-fidelity.spec.ts` ×2 exigen la configuración `playwright.catalog.config.ts` y baselines aprobados en `CATALOG_EVIDENCE_DIR/approved`; pertenecen a `aplicar-catalogo-visual-frontend`, que sigue abierto. No se promovieron baselines ni se registró aceptación humana.

**Migraciones ensayadas (2026-09-20):** PostgreSQL 17 con bases desechables. Base limpia: todas las migraciones aplican, `catalog.0001_initial` se revierte con `migrate catalog zero` y se vuelve a aplicar. Copia con identidad, clientes y configuración migrada antes de `catalog`/`supplier_registry` y con una marca de vehículo, una entidad fiscal y una definición de impuesto sintéticas: los registros previos se conservan (1/1/…), las tablas nuevas nacen vacías, no hay cambios de modelo pendientes y existen las restricciones de unicidad y `CHECK` del diseño. Las bases se eliminaron al terminar; no se usó ninguna base operativa.

## 3. Catálogo de productos y categorías (57 escenarios)

| N.º | Escenario | Requisito de spec | Tareas | Pruebas | Cobertura | Limitación |
|---|---|---|---|---|---|---|
| 1 | Consulta por cada rol | Autorización de productos y auxiliares | 8.1, 8.2, 8.5, 11.3 | Backend: `test_catalog_api.py`; Frontend: `catalog-routes.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 2 | Administración del catálogo | Autorización de productos y auxiliares | 8.1, 8.2, 8.5, 12.1 | Backend: `test_catalog_api.py`; Frontend: `catalog-routes.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 3 | Escritura directa no autorizada | Autorización de productos y auxiliares | 8.5, 12.2 | Backend: `test_catalog_api.py`, `test_catalog_errors.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 4 | Unión de roles | Autorización de productos y auxiliares | 8.5 | Backend: `test_catalog_api.py` | **Cumplido** | — |
| 5 | Sesión ausente o invalidada | Autorización de productos y auxiliares | 8.5 | Backend: `test_catalog_api.py`, `test_catalog_session_states.py` | **Cumplido** | — |
| 6 | Alta mínima y edición | Categorías planas con identidad y nombre único | 6.1, 8.1, 10.1 | Backend: `test_catalog_services.py`; Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 7 | Nombre obligatorio | Categorías planas con identidad y nombre único | 2.1, 6.1 | Backend: `test_catalog_validation.py`, `test_catalog_services.py`; Frontend: `AuxiliaryCatalogPage.test.tsx` | **Cumplido** | — |
| 8 | Duplicado normalizado o inactivo | Categorías planas con identidad y nombre único | 3.2, 6.1 | Backend: `test_catalog_models.py`, `test_catalog_services.py`, `test_catalog_errors.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 9 | Altas simultáneas equivalentes | Categorías planas con identidad y nombre único | 5.3, 12.3 | Backend: `test_catalog_concurrency.py` | **Cumplido** | — |
| 10 | Jerarquía no admitida | Categorías planas con identidad y nombre único | 2.1, 8.4 | Backend: `test_catalog_validation.py`, `test_catalog_errors.py` | **Cumplido** | — |
| 11 | Categoría con producto activo | Desactivación de categorías sin cascadas | 6.4, 10.5 | Backend: `test_catalog_services.py`, `test_catalog_api.py`, `test_catalog_concurrency.py`; Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 12 | Categoría con productos inactivos | Desactivación de categorías sin cascadas | 6.4 | Backend: `test_catalog_services.py`, `test_catalog_concurrency.py` | **Cumplido** | — |
| 13 | Reactivar categoría | Desactivación de categorías sin cascadas | 6.1 | Backend: `test_catalog_services.py` | **Cumplido** | — |
| 14 | Reactivar producto de categoría inactiva | Desactivación de categorías sin cascadas | 6.3, 6.5, 10.5 | Backend: `test_catalog_concurrency.py`, `test_catalog_services.py`; Frontend: `ProductsPage.test.tsx` | **Cumplido** | — |
| 15 | Carrera entre baja y asociación | Desactivación de categorías sin cascadas | 6.5, 12.3 | Backend: `test_catalog_concurrency.py` | **Cumplido** | — |
| 16 | Producto mínimo persistente | Producto por presentación completa | 3.3, 6.2, 12.1 | Backend: `test_catalog_models.py`, `test_catalog_services.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 17 | Código duplicado | Producto por presentación completa | 3.3, 6.2, 8.6 | Backend: `test_catalog_models.py`, `test_catalog_services.py`, `test_catalog_errors.py`, `test_manufacturer_code.py`; Frontend: `ProductForm.test.tsx` | **Cumplido** | El código interno sigue siendo único aunque exista código del fabricante. |
| 18 | Código del fabricante repetido en la misma marca | Producto por presentación completa | 14.1 | Backend: `test_manufacturer_code.py`; Frontend: `ProductForm.test.tsx` | **Cumplido** | Único por marca, incluidos inactivos y productos sin marca; con otra marca se acepta. |
| 19 | Código del fabricante opcional y buscable | Producto por presentación completa | 14.1 | Backend: `test_manufacturer_code.py`; Frontend: `ProductForm.test.tsx`, `ProductsPage.test.tsx` | **Cumplido** | Búsqueda OR con código interno y nombre, sin distinguir mayúsculas; ficha y listado muestran ambos códigos. |
| 20 | Código concurrente | Producto por presentación completa | 5.3, 12.3 | Backend: `test_catalog_concurrency.py` | **Cumplido** | — |
| 21 | Datos obligatorios o relaciones inválidas | Producto por presentación completa | 2.3, 6.2, 10.3 | Backend: `test_catalog_validation.py`, `test_catalog_services.py`, `test_catalog_errors.py`; Frontend: `ProductForm.test.tsx` | **Cumplido** | — |
| 22 | Presentaciones independientes | Producto por presentación completa | 6.2 | Backend: `test_catalog_services.py` | **Cumplido** | Cada presentación es un producto propio; no existen variantes ni conversión. |
| 23 | Edición de ficha | Producto por presentación completa | 6.2, 10.3 | Backend: `test_catalog_services.py`; Frontend: `ProductForm.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 24 | Kit comprado | Producto por presentación completa | 2.3, 6.2, 10.3 | Backend: `test_catalog_services.py`, `test_catalog_validation.py`; Frontend: `ProductForm.test.tsx` | **Cumplido** | Solo identifica el kit completo; el desarme queda fuera de alcance. |
| 25 | Gestión de auxiliares | Unidades marcas y compatibilidad informativa | 6.1, 10.1 | Backend: `test_catalog_services.py`; Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 26 | Auxiliar duplicado | Unidades marcas y compatibilidad informativa | 6.1, 12.3 | Backend: `test_catalog_models.py`, `test_catalog_services.py`, `test_catalog_concurrency.py`; Frontend: `AuxiliaryCatalogPage.test.tsx` | **Cumplido** | — |
| 27 | Varias marcas compatibles | Unidades marcas y compatibilidad informativa | 6.2, 10.4 | Backend: `test_catalog_services.py`; Frontend: `VehicleBrandPicker.test.tsx`, `ProductForm.test.tsx` | **Cumplido** | — |
| 28 | Baja de auxiliar utilizado | Unidades marcas y compatibilidad informativa | 6.5 | Backend: `test_catalog_concurrency.py`, `test_catalog_services.py` | **Cumplido** | — |
| 29 | Referencia inactiva nueva | Unidades marcas y compatibilidad informativa | 6.3, 6.5 | Backend: `test_catalog_services.py`, `test_catalog_errors.py`, `test_catalog_concurrency.py` | **Cumplido** | — |
| 30 | Corrección conservando referencia | Unidades marcas y compatibilidad informativa | 6.3, 10.3 | Backend: `test_catalog_services.py`; Frontend: `ProductForm.test.tsx` | **Cumplido** | — |
| 31 | Reactivación del auxiliar | Unidades marcas y compatibilidad informativa | 6.1 | Backend: `test_catalog_services.py` | **Cumplido** | — |
| 32 | Precio exacto y cero | Precios finales y selección tributaria comercial | 2.2, 10.3 | Backend: `test_catalog_validation.py`, `test_catalog_models.py`; Frontend: `ProductForm.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 33 | Precio inválido | Precios finales y selección tributaria comercial | 2.2, 8.4, 10.3 | Backend: `test_catalog_validation.py`, `test_catalog_errors.py`; Frontend: `ProductForm.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 34 | Impuesto ausente o de otro ámbito | Precios finales y selección tributaria comercial | 4.2, 6.2 | Backend: `test_catalog_services.py`, `test_reference_interfaces.py`, `test_catalog_errors.py` | **Cumplido** | — |
| 35 | Cambio de vigencia | Precios finales y selección tributaria comercial | 4.4 | Backend: `test_reference_interfaces.py` | **Cumplido** | El precio no se recalcula al cambiar la tarifa. |
| 36 | Configuración pendiente | Precios finales y selección tributaria comercial | 4.2, 10.5 | Backend: `test_reference_interfaces.py`; Frontend: `ProductForm.test.tsx` | **Cumplido** | — |
| 37 | Tarifa cero configurada | Precios finales y selección tributaria comercial | 4.2 | Backend: `test_reference_interfaces.py` | **Cumplido** | — |
| 38 | Filtros combinados | Consulta filtrada y paginada de productos y auxiliares | 6.6, 10.2 | Backend: `test_catalog_services.py`; Frontend: `ProductsPage.test.tsx` | **Cumplido** | — |
| 39 | Páginas estables | Consulta filtrada y paginada de productos y auxiliares | 6.6 | Backend: `test_catalog_services.py` | **Cumplido** | — |
| 40 | Sin coincidencias | Consulta filtrada y paginada de productos y auxiliares | 10.1, 10.2, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`, `ProductsPage.test.tsx` | **Cumplido** | — |
| 41 | Estado y retorno desde ficha | Consulta filtrada y paginada de productos y auxiliares | 10.2, 11.4 | Frontend: `ProductsPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 42 | Desactivación y selección | Estados del producto y separación de inventario | 6.3, 10.2 | Backend: `test_catalog_services.py`; Frontend: `ProductsPage.test.tsx`, `ProductForm.test.tsx`; E2E: `catalogs.spec.ts` | **Parcial** | Probado: baja con identidad y referencias conservadas y ausencia de nuevas selecciones inválidas en catálogo. La validación al seleccionar en operaciones futuras corresponde a sus consumidores. |
| 43 | Reactivación válida | Estados del producto y separación de inventario | 6.3, 12.1 | Backend: `test_catalog_services.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 44 | Estado repetido | Estados del producto y separación de inventario | 6.3 | Backend: `test_catalog_services.py` | **Cumplido** | Solicitud con la versión vigente no incrementa versión ni crea evento. |
| 45 | Escritura de stock o costo | Estados del producto y separación de inventario | 8.4, 12.4 | Backend: `test_catalog_errors.py`, `test_catalog_api.py`, `test_boundaries.py` | **Cumplido** | — |
| 46 | Eliminación ordinaria | Estados del producto y separación de inventario | 8.4, 8.5 | Backend: `test_catalog_api.py`, `test_catalog_errors.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 47 | Reintento después de perder la respuesta | Escrituras consistentes y auditables de productos y auxiliares | 5.1–5.4, 9.4 | Backend: `test_idempotent_commands.py`, `test_catalog_api.py`, `test_catalog_errors.py`; Frontend: `idempotency.test.ts`, `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 48 | Reintento incompatible | Escrituras consistentes y auditables de productos y auxiliares | 5.1–5.3, 8.6 | Backend: `test_idempotent_commands.py`, `test_catalog_errors.py`, `test_catalog_services.py`, `test_catalog_concurrency.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 49 | Edición concurrente | Escrituras consistentes y auditables de productos y auxiliares | 5.5, 8.6, 12.2 | Backend: `test_catalog_errors.py`, `test_catalog_services.py`, `test_supplier_services.py`; Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 50 | Falla de persistencia o auditoría | Escrituras consistentes y auditables de productos y auxiliares | 5.4 | Backend: `test_catalog_services.py`, `test_supplier_services.py`, `test_idempotent_commands.py` | **Cumplido** | — |
| 51 | Intento denegado | Escrituras consistentes y auditables de productos y auxiliares | 5.5, 8.5 | Backend: `test_catalog_api.py`, `test_catalog_services.py`, `test_supplier_services.py`, `test_catalog_session_states.py` | **Cumplido** | — |
| 52 | Carga y lista vacía | Experiencia integrada de productos y auxiliares | 10.1, 10.2, 11.1, 11.2, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`, `ProductsPage.test.tsx`, `ServicesPage.test.tsx`, `SuppliersPage.test.tsx` | **Cumplido** | — |
| 53 | Consulta fallida recuperable | Experiencia integrada de productos y auxiliares | 10.1, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`, `ProductsPage.test.tsx`, `ServicesPage.test.tsx`, `SuppliersPage.test.tsx` | **Cumplido** | El botón «Reintentar» vuelve a consultar; los filtros permanecen en la URL. |
| 54 | Error de formulario y doble envío | Experiencia integrada de productos y auxiliares | 9.4, 10.5, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`, `ProductForm.test.tsx`, `ServiceForm.test.tsx`, `SupplierForm.test.tsx`, `idempotency.test.ts`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 55 | Confirmación cancelada | Experiencia integrada de productos y auxiliares | 10.1, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 56 | Navegación por teclado y teléfono | Experiencia integrada de productos y auxiliares | 11.5, 12.5 | E2E: `catalogs-quality.spec.ts`, `catalogs-styles.spec.ts` | **Cumplido** | Axe, desbordamiento, tamaño táctil y foco a 360/768/1024/1440 px; la revisión visual humana sigue pendiente. |
| 57 | Salida con cambios pendientes | Experiencia integrada de productos y auxiliares | 11.4, 12.5 | Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs-quality.spec.ts` | **Cumplido** | — |

## 4. Catálogo de servicios (35 escenarios)

| N.º | Escenario | Requisito de spec | Tareas | Pruebas | Cobertura | Limitación |
|---|---|---|---|---|---|---|
| 58 | Lectura por los tres roles | Autorización del catálogo de servicios | 8.2, 8.5, 11.3 | Backend: `test_catalog_api.py`; Frontend: `catalog-routes.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 59 | Gestión por Encargado o Administrador | Autorización del catálogo de servicios | 7.1, 8.5, 11.1 | Backend: `test_catalog_api.py`, `test_catalog_services.py`; Frontend: `ServicesPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 60 | Vendedor intenta escribir | Autorización del catálogo de servicios | 8.5, 12.2 | Backend: `test_catalog_api.py`, `test_catalog_services.py`; Frontend: `ServicesPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 61 | Sesión inválida | Autorización del catálogo de servicios | 8.5 | Backend: `test_catalog_api.py`, `test_catalog_session_states.py` | **Cumplido** | — |
| 62 | Roles acumulados | Autorización del catálogo de servicios | 8.5 | Backend: `test_catalog_api.py` | **Cumplido** | — |
| 63 | Alta mínima | Ficha persistente de servicio referencial | 7.1, 11.1, 12.1 | Backend: `test_catalog_services.py`; Frontend: `ServiceForm.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 64 | Nombre vacío | Ficha persistente de servicio referencial | 2.3, 7.1, 11.1 | Backend: `test_catalog_validation.py`, `test_catalog_errors.py`; Frontend: `ServiceForm.test.tsx` | **Cumplido** | — |
| 65 | Edición referencial | Ficha persistente de servicio referencial | 7.1, 11.1 | Backend: `test_catalog_services.py`; Frontend: `ServiceForm.test.tsx` | **Cumplido** | — |
| 66 | Nombres coincidentes | Ficha persistente de servicio referencial | 2.3, 7.1 | Backend: `test_catalog_services.py`, `test_catalog_validation.py`, `test_catalog_models.py` | **Cumplido** | Los nombres repetidos se permiten; no hay código ni identidad única. |
| 67 | Importe válido | Precio decimal e impuesto artesanal | 2.2, 7.1, 11.1 | Backend: `test_catalog_validation.py`, `test_catalog_services.py`; Frontend: `ServiceForm.test.tsx` | **Cumplido** | — |
| 68 | Importe inválido | Precio decimal e impuesto artesanal | 2.2, 11.1 | Backend: `test_catalog_validation.py`, `test_catalog_errors.py`; Frontend: `ServiceForm.test.tsx` | **Cumplido** | — |
| 69 | Impuesto cruzado o ausente | Precio decimal e impuesto artesanal | 4.2, 7.1, 11.1 | Backend: `test_catalog_services.py`, `test_catalog_errors.py`; Frontend: `ServiceForm.test.tsx` | **Cumplido** | — |
| 70 | Opciones fiscales del Encargado | Precio decimal e impuesto artesanal | 8.3, 11.1 | Backend: `test_catalog_api.py`; Frontend: `ServicesPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 71 | Nueva vigencia | Precio decimal e impuesto artesanal | 4.4 | Backend: `test_reference_interfaces.py` | **Cumplido** | Verificada sobre la proyección tributaria común a productos y servicios. |
| 72 | Sin vigencia y tarifa cero | Precio decimal e impuesto artesanal | 4.2, 11.1 | Backend: `test_reference_interfaces.py`; Frontend: `ServiceForm.test.tsx` | **Cumplido** | — |
| 73 | Búsqueda combinada | Consulta paginada de servicios | 7.2, 11.1 | Backend: `test_catalog_services.py`; Frontend: `ServicesPage.test.tsx` | **Cumplido** | — |
| 74 | Paginación | Consulta paginada de servicios | 7.2, 8.4 | Backend: `test_catalog_services.py`, `test_catalog_api.py`; Frontend: `ServicesPage.test.tsx` | **Cumplido** | — |
| 75 | Vacío de búsqueda | Consulta paginada de servicios | 11.1, 11.4 | Frontend: `ServicesPage.test.tsx` | **Cumplido** | — |
| 76 | Retorno desde ficha | Consulta paginada de servicios | 11.1, 11.4 | E2E: `catalogs.spec.ts`; Frontend: `ServicesPage.test.tsx` | **Cumplido** | El servicio se consulta en una vista previa fija junto a la lista, sin salir de ella; los filtros y la página se conservan. |
| 77 | Baja conservando historia | Estado e independencia económica de servicios | 7.2, 3.3 | Backend: `test_catalog_services.py`, `test_catalog_models.py`; Frontend: `ServicesPage.test.tsx` | **Parcial** | Probado: identidad estable y relaciones PROTECT. No existen operaciones históricas que verificar; su conservación es obligación de consumidores futuros. |
| 78 | Reactivación | Estado e independencia económica de servicios | 7.2 | Backend: `test_catalog_services.py`; Frontend: `ServicesPage.test.tsx` | **Cumplido** | — |
| 79 | Repetición del estado | Estado e independencia económica de servicios | 7.2 | Backend: `test_catalog_services.py` | **Cumplido** | — |
| 80 | Stock y eliminación no admitidos | Estado e independencia económica de servicios | 7.2, 8.4, 12.4 | Backend: `test_catalog_errors.py`, `test_catalog_api.py`, `test_boundaries.py` | **Cumplido** | — |
| 81 | Guardado sin efectos económicos | Estado e independencia económica de servicios | 12.4 | Backend: `test_boundaries.py` | **Cumplido** | — |
| 82 | Reintento después de perder la respuesta | Escrituras consistentes y auditables de servicios | 5.1–5.4, 9.4 | Backend: `test_idempotent_commands.py`, `test_catalog_api.py`, `test_catalog_errors.py`; Frontend: `idempotency.test.ts`, `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 83 | Reintento incompatible | Escrituras consistentes y auditables de servicios | 5.1–5.3, 8.6 | Backend: `test_idempotent_commands.py`, `test_catalog_errors.py`, `test_catalog_services.py`, `test_catalog_concurrency.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 84 | Edición concurrente | Escrituras consistentes y auditables de servicios | 5.5, 8.6, 12.2 | Backend: `test_catalog_errors.py`, `test_catalog_services.py`, `test_supplier_services.py`; Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 85 | Falla de persistencia o auditoría | Escrituras consistentes y auditables de servicios | 5.4 | Backend: `test_catalog_services.py`, `test_idempotent_commands.py` | **Parcial** | La falla inyectada se prueba con productos y comandos genéricos; los servicios comparten el mismo mecanismo transaccional sin una prueba propia. |
| 86 | Intento denegado | Escrituras consistentes y auditables de servicios | 5.5, 8.5 | Backend: `test_catalog_api.py`, `test_catalog_services.py`, `test_supplier_services.py`, `test_catalog_session_states.py` | **Cumplido** | — |
| 87 | Carga y lista vacía | Experiencia integrada de servicios | 10.1, 10.2, 11.1, 11.2, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`, `ProductsPage.test.tsx`, `ServicesPage.test.tsx`, `SuppliersPage.test.tsx` | **Cumplido** | — |
| 88 | Consulta fallida recuperable | Experiencia integrada de servicios | 10.1, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`, `ProductsPage.test.tsx`, `ServicesPage.test.tsx`, `SuppliersPage.test.tsx` | **Cumplido** | El botón «Reintentar» vuelve a consultar; los filtros permanecen en la URL. |
| 89 | Error de formulario y doble envío | Experiencia integrada de servicios | 9.4, 10.5, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`, `ProductForm.test.tsx`, `ServiceForm.test.tsx`, `SupplierForm.test.tsx`, `idempotency.test.ts`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 90 | Confirmación cancelada | Experiencia integrada de servicios | 10.1, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 91 | Navegación por teclado y teléfono | Experiencia integrada de servicios | 11.5, 12.5 | E2E: `catalogs-quality.spec.ts`, `catalogs-styles.spec.ts` | **Cumplido** | Axe, desbordamiento, tamaño táctil y foco a 360/768/1024/1440 px; la revisión visual humana sigue pendiente. |
| 92 | Salida con cambios pendientes | Experiencia integrada de servicios | 11.4, 12.5 | Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs-quality.spec.ts` | **Cumplido** | — |

## 5. Catálogo de proveedores (36 escenarios)

| N.º | Escenario | Requisito de spec | Tareas | Pruebas | Cobertura | Limitación |
|---|---|---|---|---|---|---|
| 93 | Consulta y gestión autorizadas | Acceso exclusivo de administración a proveedores | 7.3, 8.5, 11.2 | Backend: `test_catalog_api.py`, `test_supplier_services.py`; Frontend: `catalog-routes.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 94 | Acceso operativo directo | Acceso exclusivo de administración a proveedores | 8.5, 12.2 | Backend: `test_catalog_api.py`, `test_supplier_services.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 95 | Sesión inválida | Acceso exclusivo de administración a proveedores | 8.5 | Backend: `test_catalog_api.py`, `test_catalog_session_states.py` | **Cumplido** | — |
| 96 | Unión de roles | Acceso exclusivo de administración a proveedores | 8.5 | Backend: `test_catalog_api.py` | **Cumplido** | — |
| 97 | Proveedor ocasional mínimo | Proveedor mínimo y contacto opcional | 2.4, 3.4, 7.3 | Backend: `test_supplier_services.py`, `test_supplier_models.py`, `test_supplier_validation.py`; Frontend: `SupplierForm.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 98 | Edición de contacto | Proveedor mínimo y contacto opcional | 7.3, 11.2 | Backend: `test_supplier_services.py`; Frontend: `SupplierForm.test.tsx` | **Cumplido** | — |
| 99 | Nombre o correo inválido | Proveedor mínimo y contacto opcional | 2.4, 11.2 | Backend: `test_supplier_validation.py`; Frontend: `SupplierForm.test.tsx` | **Cumplido** | — |
| 100 | Dato excedido | Proveedor mínimo y contacto opcional | 2.4, 11.2 | Backend: `test_supplier_validation.py`; Frontend: `SupplierForm.test.tsx` | **Cumplido** | — |
| 101 | Nombres coincidentes | Proveedor mínimo y contacto opcional | 7.4, 11.2 | Backend: `test_supplier_services.py`; Frontend: `SupplierForm.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 102 | Identificación válida | Identificación opcional y duplicados | 2.4, 7.3 | Backend: `test_supplier_validation.py`, `test_supplier_services.py`; Frontend: `SupplierForm.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 103 | Par incompleto o tipo inválido | Identificación opcional y duplicados | 2.4, 11.2 | Backend: `test_supplier_validation.py`; Frontend: `SupplierForm.test.tsx` | **Cumplido** | — |
| 104 | Longitud incorrecta | Identificación opcional y duplicados | 2.4, 11.2 | Backend: `test_supplier_validation.py`; Frontend: `SupplierForm.test.tsx` | **Cumplido** | — |
| 105 | Duplicado incluyendo inactivos | Identificación opcional y duplicados | 3.4, 7.3 | Backend: `test_supplier_models.py`, `test_supplier_services.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 106 | Alta simultánea duplicada | Identificación opcional y duplicados | 5.3, 12.3 | Backend: `test_catalog_concurrency.py` | **Cumplido** | — |
| 107 | Coincidencia con cliente | Identificación opcional y duplicados | 7.3, 7.4 | Backend: `test_supplier_services.py` | **Cumplido** | Un cliente con el mismo documento no bloquea ni se fusiona con el proveedor. |
| 108 | Retiro de identificación | Identificación opcional y duplicados | 7.3, 11.2 | Backend: `test_supplier_services.py`; Frontend: `SupplierForm.test.tsx` | **Cumplido** | — |
| 109 | Búsqueda por identificación o nombre | Consulta paginada de proveedores | 7.4, 11.2 | Backend: `test_supplier_services.py`; Frontend: `SuppliersPage.test.tsx` | **Cumplido** | — |
| 110 | Filtro y paginación | Consulta paginada de proveedores | 7.4, 11.2 | Backend: `test_supplier_services.py`; Frontend: `SuppliersPage.test.tsx` | **Cumplido** | — |
| 111 | Sin coincidencias | Consulta paginada de proveedores | 11.2, 11.4 | Frontend: `SuppliersPage.test.tsx` | **Cumplido** | — |
| 112 | Ficha y retorno | Consulta paginada de proveedores | 11.2, 11.4 | E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 113 | Baja de proveedor referenciado | Estado sin pérdida histórica ni operaciones de compra | 7.5, 3.4 | Backend: `test_supplier_services.py`, `test_supplier_models.py` | **Parcial** | Probado: identidad y relaciones conservadas. No existen compras ni saldos que referencien al proveedor; su rechazo es obligación de consumidores futuros. |
| 114 | Reactivación | Estado sin pérdida histórica ni operaciones de compra | 7.5 | Backend: `test_supplier_services.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 115 | Estado repetido | Estado sin pérdida histórica ni operaciones de compra | 7.5 | Backend: `test_supplier_services.py` | **Cumplido** | — |
| 116 | Intento de eliminación | Estado sin pérdida histórica ni operaciones de compra | 8.4, 12.2 | Backend: `test_catalog_api.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 117 | Operación ajena al catálogo | Estado sin pérdida histórica ni operaciones de compra | 7.5, 12.4 | Backend: `test_boundaries.py`, `test_catalog_api.py` | **Cumplido** | No existen rutas de compra, saldo ni pago; el módulo no depende de catálogo ni de abastecimiento. |
| 118 | Reintento después de perder la respuesta | Escrituras consistentes y auditables de proveedores | 5.1–5.4, 9.4 | Backend: `test_idempotent_commands.py`, `test_catalog_api.py`, `test_catalog_errors.py`; Frontend: `idempotency.test.ts`, `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 119 | Reintento incompatible | Escrituras consistentes y auditables de proveedores | 5.1–5.3, 8.6 | Backend: `test_idempotent_commands.py`, `test_catalog_errors.py`, `test_catalog_services.py`, `test_catalog_concurrency.py`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 120 | Edición concurrente | Escrituras consistentes y auditables de proveedores | 5.5, 8.6, 12.2 | Backend: `test_catalog_errors.py`, `test_catalog_services.py`, `test_supplier_services.py`; Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 121 | Falla de persistencia o auditoría | Escrituras consistentes y auditables de proveedores | 5.4 | Backend: `test_catalog_services.py`, `test_supplier_services.py`, `test_idempotent_commands.py` | **Cumplido** | — |
| 122 | Intento denegado | Escrituras consistentes y auditables de proveedores | 5.5, 8.5 | Backend: `test_catalog_api.py`, `test_catalog_services.py`, `test_supplier_services.py`, `test_catalog_session_states.py` | **Cumplido** | — |
| 123 | Carga y lista vacía | Experiencia integrada de proveedores | 10.1, 10.2, 11.1, 11.2, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`, `ProductsPage.test.tsx`, `ServicesPage.test.tsx`, `SuppliersPage.test.tsx` | **Cumplido** | — |
| 124 | Consulta fallida recuperable | Experiencia integrada de proveedores | 10.1, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`, `ProductsPage.test.tsx`, `ServicesPage.test.tsx`, `SuppliersPage.test.tsx` | **Cumplido** | El botón «Reintentar» vuelve a consultar; los filtros permanecen en la URL. |
| 125 | Error de formulario y doble envío | Experiencia integrada de proveedores | 9.4, 10.5, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`, `ProductForm.test.tsx`, `ServiceForm.test.tsx`, `SupplierForm.test.tsx`, `idempotency.test.ts`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 126 | Confirmación cancelada | Experiencia integrada de proveedores | 10.1, 11.4 | Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs.spec.ts` | **Cumplido** | — |
| 127 | Navegación por teclado y teléfono | Experiencia integrada de proveedores | 11.5, 12.5 | E2E: `catalogs-quality.spec.ts`, `catalogs-styles.spec.ts` | **Cumplido** | Axe, desbordamiento, tamaño táctil y foco a 360/768/1024/1440 px; la revisión visual humana sigue pendiente. |
| 128 | Salida con cambios pendientes | Experiencia integrada de proveedores | 11.4, 12.5 | Frontend: `AuxiliaryCatalogPage.test.tsx`; E2E: `catalogs-quality.spec.ts` | **Cumplido** | — |

## 6. Obligaciones de consumidores futuros y límites de esta cobertura

- Compras, ventas, proformas y mantenimientos deberán validar el estado activo del producto, servicio o proveedor al seleccionarlo y al confirmar, y conservar sus propios valores históricos; este cambio solo garantiza identidad estable y relaciones protegidas.
- No hay existencias, reservas, costos ni Kardex; RF-CAT-005 y el filtro de disponibilidad de RF-CAT-004 quedan fuera de esta cobertura.
- La revisión visual humana y la aceptación de fidelidad de otros cambios no se marcan aquí; la evidencia de capturas se guardó fuera del repositorio.
- Las políticas de redondeo, tarifas reales y retención de recibos idempotentes siguen abiertas.

[Referencia terminológica](cobertura-catalogos-glossary-reference.md).
