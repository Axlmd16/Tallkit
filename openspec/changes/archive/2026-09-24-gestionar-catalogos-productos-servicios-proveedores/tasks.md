## 1. Preparación, aprobaciones y línea base

- [x] 1.1 Antes de apply, comprobar aprobación explícita de estas tareas y presencia de proposal, specs, design y tasks en `master`; registrar commit, rama y `git status --short`, preservando cambios ajenos. La solicitud de crear tasks aprueba avanzar desde design, no ejecutar la implementación.
- [x] 1.2 Revalidar las fuentes enumeradas en `proposal.md` y `design.md`, las tres specs y el estado de `gestionar-clientes-y-vehiculos` y `aplicar-catalogo-visual-frontend`; registrar contradicciones y pendientes sin cerrar esos cambios ni asumir verificaciones anteriores.
- [x] 1.3 Ejecutar la línea base `make check`, `make test` y `make audit` con PostgreSQL disponible; registrar fallos previos y bloqueos de entorno antes de cambios funcionales, sin modificar umbrales ni atribuirlos a este catálogo.
- [x] 1.4 Crear durante apply `docs/negocio/requisitos/cobertura-catalogos.md` y su referencia terminológica con las 126 filas de escenarios, identificadas por capacidad/requisito/título y estado pendiente. Incorporar evidencia por tarea, sin confundir validación documental con implementación.

Evidencia: commits/estado de Git, comandos de línea base y matriz de 126 escenarios sin cobertura ficticia.

## 2. Dominio y contratos puros

- [x] 2.1 Aplicar **TDD** a normalización de nombres/códigos y validación de categoría, unidad y marca en `backend/tests/catalog/test_validation.py`; implementar `catalog/domain/validation.py` y errores puros, cubriendo espacios, capitalización, Unicode, longitudes y rechazo de jerarquías.
- [x] 2.2 Probar primero precio USD de hasta dos decimales y contenido positivo de hasta seis, con límites de design §2, cero permitido solo en precio, exceso de escala, exponentes, NaN/infinito y número JSON; implementar validación decimal sin redondeo en dominio de catálogo.
- [x] 2.3 Probar ficha de producto y servicio: campos obligatorios/opcionales, IDs, descripción, kit completo, listas de compatibilidad y servicios homónimos; implementar normalización sin tipos DRF/Django ni conceptos de stock.
- [x] 2.4 Probar reutilización de CI/RUC y contactos en `backend/tests/supplier_registry/test_validation.py`; publicar la reexportación `customer_registry/domain/identification.py` y validar proveedor sin tipo de persona ni teléfono obligatorio, con ausencia conjunta de documento/tipo, longitudes, ceros iniciales y email opcional.
- [x] 2.5 Probar clave de comando y huella canónica en `backend/tests/test_command_values.py`; implementar `shared/command_values.py` con límites y distinción omitir/borrar, sin compartir persistencia de configuración ni incluir datos personales en logs.

Comandos: `cd backend && uv run pytest --no-cov tests/catalog/test_validation.py tests/supplier_registry/test_validation.py tests/test_command_values.py`. `--no-cov` se limita al ciclo enfocado; la cobertura global permanece obligatoria en make check.

## 3. Persistencia y migraciones aditivas

- [x] 3.1 Escribir pruebas de registro de aplicaciones y frontera; crear `catalog/apps.py`, `supplier_registry/apps.py`, registrar ambas en `config/settings/base.py` y mantener dependencias unidireccionales conforme a design §1.
- [x] 3.2 Probar constraints de categorías, unidades y marcas de producto en `backend/tests/catalog/test_models.py`; implementar sus modelos con nombres normalizados únicos incluidos inactivos, estado, versión y fechas, sin confundir marcas de vehículo.
- [x] 3.3 Probar e implementar Product, ProductCompatibility y Service en `catalog/models.py`: relaciones PROTECT, código único, precio y contenido decimales, compatibilidad única, selección tributaria, ausencia de código/identidad única de servicio y de campos de stock/costos.
- [x] 3.4 Probar e implementar Supplier en `supplier_registry/models.py`: nombre mínimo, contactos opcionales, NULL conjunto de documento/tipo, unicidad parcial de par también inactivo y coexistencia de varios proveedores no identificados.
- [x] 3.5 Probar e implementar CatalogCommand y SupplierCommand con clave única por actor/acción, huella, resultado y estado de respuesta; proteger actor y evitar exposición/edición administrativa de recibos.
- [x] 3.6 Generar migraciones iniciales mediante `cd backend && uv run python manage.py makemigrations catalog supplier_registry`; fijar dependencias reales de usuario, VehicleBrand y TaxDefinition. Revisar que solo añadan tablas/constraints propias, sin semillas ficticias ni cambios a datos anteriores.
- [x] 3.7 Actualizar `docs/arquitectura/modelo-datos.md` y su referencia a partir del diseño ya aprobado; documentar modelos, relaciones, índices y límites, conservando el carácter conceptual de `modelo-dominio.md`.

Evidencia: pruebas enfocadas de modelos/frontera con PostgreSQL y `cd backend && uv run python manage.py makemigrations --check --dry-run`; revisar las migraciones generadas, no marcar solo por existencia de archivos.

## 4. Interfaces de referencias e integración fiscal

- [x] 4.1 Probar y publicar `customer_registry/application/catalog_references.py` para DTO de marcas y bloqueo ordenado al asociarlas; conservar permisos y comportamiento existentes de clientes/vehículos y no escribir marcas desde catálogo.
- [x] 4.2 Probar y crear `workshop_configuration/application/catalog_options.py` con opciones paginadas del ámbito fijo y validación de referencia según design §3; distinguir tarifa cero, missing y ambiguous usando fecha operativa del servidor, sin crear ConfigurationUse ni numeración.
- [x] 4.3 Probar que las nuevas consultas internas no requieren conceder `parametros.gestionar` a roles operativos; mantener intactos los endpoints administrativos y comprobar que el servicio consumidor autoriza antes de invocarlas.
- [x] 4.4 Verificar consultas por página sin N+1, ámbito inmutable y ausencia de escrituras en configuración; incluir cambio de vigencia sin recalcular precios y error de referencia fiscal cruzada.

Comandos: `cd backend && uv run pytest --no-cov tests/customer_registry tests/workshop_configuration tests/catalog/test_fiscal_integration.py`; ajustar la selección al archivo real de pruebas, documentándolo en cobertura.

## 5. Comandos, auditoría e idempotencia

- [x] 5.1 Escribir primero pruebas de replay y conflicto en `backend/tests/catalog/test_commands.py`; implementar `catalog/application/commands.py` con reclamo por inserción única/savepoint dentro de la transacción, resultado persistido y autorización antes del replay.
- [x] 5.2 Repetir los casos para `supplier_registry/application/commands.py` y su recibo propio; comprobar que respuestas con contacto nunca se registren en auditoría/logs ni se expongan por endpoints de comandos.
- [x] 5.3 Probar dos solicitudes concurrentes con la misma clave e igual/distinto payload en ambos módulos mediante conexiones independientes; comprobar espera, un solo efecto exitoso, conflicto incompatible y posibilidad de reclamar tras rollback del primero.
- [x] 5.4 Probar fallo entre recibo provisional, escritura y auditoría; impedir commit de recibos incompletos y efectos parciales. Implementar traducción de errores concretos después del rollback, sin disfrazar IntegrityError desconocido.
- [x] 5.5 Probar versiones esperadas, no-op con versión vigente y replay previo a comparación de versión; implementar auditoría mediante `record_audit_event` con nombres de campos y razones, evitando eventos duplicados por denegación.

Comandos: `cd backend && uv run pytest --no-cov tests/catalog/test_commands.py tests/supplier_registry/test_commands.py`; registrar evidencia concurrente con barreras, sin sleeps usados como sincronización.

## 6. Casos de uso de productos y auxiliares

- [x] 6.1 Probar y crear gestión/consulta de categorías, unidades y marcas en `catalog/application/auxiliaries.py` y `queries.py`, incluyendo unicidad concurrente, activos/inactivos, consulta de ficha y conservación de referencias.
- [x] 6.2 Probar y crear alta/edición de producto en `catalog/application/products.py`, con precio final, contenido, marca opcional, compatibilidades, selección fiscal y autorización diferenciada al cambiar precio.
- [x] 6.3 Probar y crear baja/reactivación de producto con identidad estable, no-op y referencias conservadas; permitir corrección ajena a una marca/unidad inactiva y exigir categoría activa al reactivar.
- [x] 6.4 Probar el bloqueo de baja de categoría con productos activos y permitirlo solo con productos inactivos; implementar el orden de bloqueos de design §4 sin cascadas.
- [x] 6.5 Probar carreras de baja de categoría contra alta, reclasificación y reactivación de producto; también baja de unidad/marca contra nueva asociación, incluidas marcas de vehículo. Revalidar versiones/referencias leídas preliminarmente y abortar sin adquirir bloqueos fuera de orden.
- [x] 6.6 Probar e implementar búsqueda OR código/nombre y filtros AND categoría/estado/marcas, paginación estable sin duplicados por compatibilidad, activos por defecto y recuperación de fichas inactivas.

Comando: `cd backend && uv run pytest --no-cov tests/catalog`; evidencia específica de invariantes tras cada carrera, unicidad y ausencia de efectos económicos.

## 7. Casos de uso de servicios y proveedores

- [x] 7.1 Probar e implementar `catalog/application/services.py` con alta, ficha, edición, precio referencial final, impuesto artesanal, nombres repetidos permitidos y gestión por Encargado/Administrador.
- [x] 7.2 Probar estados y consultas de servicios en `catalog/application/queries.py`: búsqueda/estado/paginación, desactivación/reactivación/no-op, referencias conservadas y ausencia de stock, cobros, mantenimiento y uso tributario confirmado.
- [x] 7.3 Probar e implementar `supplier_registry/application/suppliers.py` con alta mínima, edición, identificación opcional y validación de unicidad en creación/edición, incluidas carreras y registros inactivos.
- [x] 7.4 Probar e implementar consultas y advertencias en `supplier_registry/application/queries.py`: búsqueda nombre/documento, estado/paginación, matches por nombre normalizado con límite y has_more; coincidencia no impide guardar ni fusiona clientes/proveedores.
- [x] 7.5 Probar baja/reactivación y no-op de proveedores conservando identidad/referencias, acceso exclusivo del Administrador y rechazo de compra, saldo o proveedor exclusivo de producto.

Comando: `cd backend && uv run pytest --no-cov tests/catalog tests/supplier_registry`; registrar pruebas de cada escenario y no crear operaciones futuras simuladas en producción.

## 8. API, autorización y OpenAPI

- [x] 8.1 Escribir pruebas de API de auxiliares y productos; crear serializers/vistas/rutas bajo `catalog/api/` y montarlas en `config/api/urls.py` para las bases de design §6, con GET/POST/PATCH y acciones activate/deactivate.
- [x] 8.2 Escribir pruebas y exponer services y suppliers mediante sus respectivos adaptadores; mantener validación y permisos en servicios, PATCH parcial con expected_version, clave obligatoria y respuestas con versión/fechas.
- [x] 8.3 Probar/exponer `products/tax-options/`, `services/tax-options/` y `suppliers/matches/` antes de rutas de ID; validar permiso, ámbito fijo, campos mínimos y CSRF de matches sin exigirle recibo de escritura.
- [x] 8.4 Probar contrato de listas, total, páginas vacías/fuera de rango, filtros inválidos, límites, decimales textuales y referencias mínimas. Rechazar campos desconocidos y DELETE/PUT; no descartar silenciosamente stock, costos, jerarquías o estado en PATCH.
- [x] 8.5 Probar la matriz completa por ruta/método para los tres roles y uniones; incluir anónimo, inactivo, contraseña temporal, sesión invalidada, falta de CSRF y replay después de retirar permiso. No ampliar permisos administrativos fiscales.
- [x] 8.6 Probar errores uniformes y códigos de design §6 con campos/request_id, 400/403/404/405/409 y duplicados sin filtración; comprobar que auditoría existente permite consultar los eventos nuevos solo al Administrador.
- [x] 8.7 Documentar y generar `backend/schema.yml` con drf-spectacular incluyendo comandos, límites, filtros, respuestas y errores; validar el esquema y revisar compatibilidad con clientes/configuración.

Comandos: `cd backend && uv run pytest --no-cov tests/catalog tests/supplier_registry tests/identity tests/api` y `cd backend && uv run python manage.py spectacular --file schema.yml --validate`. Corregir solo fallos del alcance y registrar incompatibilidades reales.

## 9. Clientes frontend y estado remoto

- [x] 9.1 Probar y crear types/api/hooks de `frontend/src/features/products/`, `product-categories/`, `measurement-units/` y `product-brands/` usando ApiClient y TanStack Query; conservar importes como cadenas.
- [x] 9.2 Probar y crear types/api/hooks de `features/services/` y `features/suppliers/`, incluidas opciones fiscales y advertencias de coincidencias, sin llamar desde Encargado a endpoints administrativos.
- [x] 9.3 Probar claves de consulta e invalidación de listas/fichas/referencias según design §8; integrar invalidación mínima en cambios de marca de vehículo y configuración fiscal, con regresión de hooks existentes.
- [x] 9.4 Probar conservación de clave/payload tras respuesta incierta, reintento explícito, nueva clave para nueva intención y recarga tras replay; no reintentar mutaciones automáticamente ni persistir contacto/borradores en localStorage.

Comandos: desde frontend, `npm test -- src/features/products src/features/product-categories src/features/measurement-units src/features/product-brands src/features/services src/features/suppliers` y `npm run typecheck`; ejecutar también pruebas de hooks anteriores modificados.

## 10. Pantallas de productos y auxiliares

- [x] 10.1 Probar y construir páginas de categorías, unidades y marcas de producto bajo `frontend/src/pages/` y sus formularios: listas/ficha en panel, búsqueda, estado, paginación, errores, baja/reactivación y confirmaciones.
- [x] 10.2 Probar y construir lista/ficha de productos con columnas y grupos de design §8, filtros combinados, precio final y presentación; no incluir stock, costos o indicadores ficticios.
- [x] 10.3 Probar y construir formulario de producto: categoría/unidad obligatorias, marca y compatibilidades opcionales, kit completo y selección fiscal explícita. Conservar referencias inactivas ya asociadas sin habilitar nuevas selecciones inválidas.
- [x] 10.4 Probar selector paginado de varias marcas de vehículo y acceso a auxiliares conservando borrador; componer UI existente y evitar dos trampas de foco simultáneas.
- [x] 10.5 Probar y presentar rechazo de categoría con productos activos, versiones obsoletas y configuración tributaria pendiente; conservar valores, explicar correcciones y prevenir doble envío.

Comandos: `cd frontend && npm test -- src/pages/products src/pages/product-categories src/pages/measurement-units src/pages/product-brands src/features/products` y `npm run typecheck` desde frontend; verificar controles compartidos nuevos si fueran necesarios.

## 11. Pantallas de servicios, proveedores y navegación

- [x] 11.1 Probar y construir lista/ficha/formulario de servicios en `pages/services/` y `features/services/`, con precio referencial final, opciones artesanales mínimas, estado y permisos de lectura/gestión.
- [x] 11.2 Probar y construir lista/ficha/formulario de proveedores en `pages/suppliers/` y `features/suppliers/`: nombre mínimo, contactos opcionales, par tipo/documento, advertencia de nombres y consulta restringida.
- [x] 11.3 Integrar rutas y guards en `app/App.tsx` y navegación en `AuthenticatedShell.tsx`; añadir Productos/Servicios/Proveedores, accesos a auxiliares y distinguir etiqueta Marcas de vehículo sin cambiar su ruta/permisos.
- [x] 11.4 Probar en todas las superficies carga/vacío/sin coincidencias/error/éxito, errores por campo, filtros en URL y retorno, confirmaciones, advertencia de cambios sin guardar, recuperación de foco y limpieza de caché al invalidarse sesión.
- [x] 11.5 Revisar estilos computados y componentes reutilizados contra DESIGN.md, conservando tokens, Nunito, superficies y breakpoints; registrar adaptaciones sin atribuir nodos Figma inventados ni cambiar la aceptación visual de otros cambios.

Comandos: `cd frontend && npm test -- src/pages/services src/pages/suppliers src/features/services src/features/suppliers src/app` y `make frontend-check`; no presentar una captura como aprobación visual.

## 12. Integración, concurrencia y revisión visual

- [x] 12.1 Crear pruebas E2E en `frontend/e2e/catalogs.spec.ts` para los ciclos principales de cuatro catálogos y auxiliares contra API real: búsquedas, inactivos, relaciones, proveedor sin documento/contacto y servicio administrado por Encargado.
- [x] 12.2 Completar E2E de permisos y llamadas directas denegadas, filtros al volver, precisión monetaria, baja de categoría bloqueada, conflictos/reintentos y errores recuperables; usar fixtures sintéticas aisladas.
- [x] 12.3 Ejecutar la matriz de concurrencia completa en PostgreSQL con conexiones independientes; comprobar invariantemente resultados, versiones, cantidad de eventos y recibos, rollback e idempotencia en ambos módulos.
- [x] 12.4 Probar explícitamente ausencia de escrituras de stock, costo, bodega, series, ConfigurationUse y NumberAllocation al usar catálogos; verificar límites de módulos y que ningún consumidor escriba persistencia ajena.
- [x] 12.5 Revisar keyboard/axe, controles táctiles, texto largo, foco y ausencia de overflow a 360/768/1024/1440 y navegación en 1279/1280; guardar evidencia externa y presentar revisión visual sin promover baselines ni marcar aprobación humana automáticamente.
- [x] 12.6 Ejecutar regresión de identidad, clientes, vehículos y configuración, comparando fallos con línea base; corregir regresiones introducidas y registrar pendientes ajenos.

Comandos: `cd frontend && npm run test:e2e -- e2e/catalogs.spec.ts`, pruebas PostgreSQL enfocadas y luego `cd frontend && npm run test:e2e`. Evidencia visual fuera del repositorio; aceptación y pruebas técnicas se registran por separado.

## 13. Ensayo de migración, documentación y verificación final

- [x] 13.1 Ensayar migraciones en PostgreSQL limpio y copia desechable con identidad/clientes/configuración; verificar constraints y preservación de datos, registrar dependencias reales y ausencia de semillas falsas. No usar una base operativa para pruebas destructivas.
- [x] 13.2 Documentar carga inicial de auxiliares/proveedores y requisito de configuración para productos/servicios en README y modelo de datos; incluir respaldo, orden backend/migraciones/frontend y recuperación hacia adelante. No ejecutar despliegue ni restauración sin autorización.
- [x] 13.3 Sincronizar reglas, requisitos, roles, CU/UI, matriz de trazabilidad y glosarios/referencias afectados, conservando exclusiones y decisiones fiscales abiertas; actualizar arquitectura con fronteras reales. Confirmar que ADR-0001/0003/0004 y C4 no cambian; si aparece una decisión transversal distinta, proponerla antes de ampliarla.
- [x] 13.4 Completar `cobertura-catalogos.md` con las 126 filas y pruebas/resultados recientes; distinguir garantías locales de historia y obligaciones de consumidores futuros sin declarar implementadas compras/ventas/mantenimientos.
- [x] 13.5 Ejecutar `make check`, `make test`, `make audit`, `make compose-check`, `cd frontend && npm run test:e2e`, `cd backend && uv run python manage.py spectacular --validate`, `openspec validate --all --strict` y `git diff --check`; registrar comandos, resultados y bloqueos reales sin bajar umbrales.
- [x] 13.6 Revisar diff, migraciones, OpenAPI, dependencias/lockfiles y ausencia de secretos, archivos generados o datos personales; verificar que cada tarea marcada tenga implementación y evidencia. Preparar verificación OpenSpec sin archivar, hacer push o integrar automáticamente.
- [x] 13.7 Entregar resumen de alcance real, migraciones/pasos operativos, decisiones y limitaciones. Dejar sincronización final de specs principales y archivo para el flujo autorizado desde master, después de verificar e integrar; no dar por terminado el software porque los cuatro artefactos existan.

## Ajuste posterior: código del fabricante

- [x] 14.1 Añadir `manufacturer_code` opcional al producto (migración `catalog/0002_product_manufacturer_code.py`, dominio, servicios, búsqueda OR con `code`/`name`, serializadores, OpenAPI, formulario, ficha y listado), conservando `code` como código interno obligatorio; unicidad por marca de producto. Pruebas: `backend/tests/catalog/test_manufacturer_code.py`, `ProductForm.test.tsx`, `ProductsPage.test.tsx`.

Evidencia: ensayo reproducible, matriz completa, comandos oficiales recientes y revisión del diff. Las verificaciones pendientes permanecen sin marcar.
