## 1. Configuración de Base de Datos y Dominio (Backend)

- [ ] 1.1 **[TDD]** Escribir pruebas unitarias que fallen para las reglas de dominio (`domain/validation.py`) y para las restricciones de base de datos de los modelos (unicidad, soft-deletion).
- [ ] 1.2 Crear las nuevas apps Django `catalog` y `purchasing` e incluirlas en `config/settings/base.py`.
- [ ] 1.3 Implementar las reglas puras y enumeraciones en la capa `domain/` para hacer pasar sus pruebas.
- [ ] 1.4 Implementar los modelos ORM de `catalog` (`ProductCategory`, `ProductBrand`, `MeasurementUnit`, `ProductPresentation`, `Product`, `ProductCompatibility`, `Service`) y `purchasing` (`Provider`). Reutilizar `VehicleBrand` de `customer_registry`.
- [ ] 1.5 Configurar restricciones (CheckConstraints) y soft-deletion (`is_active`).
- [ ] 1.6 Crear y ejecutar las migraciones iniciales de base de datos.
- [ ] 1.7 Verificar que todas las pruebas del grupo 1 pasen verde (`pytest`).

## 2. API y Casos de Uso (Backend)

- [ ] 2.1 **[TDD]** Escribir pruebas de integración que fallen para los servicios de aplicación (creación, edición, soft-deletion) y para los endpoints de la API (verificando serialización y permisos por rol).
- [ ] 2.2 Implementar servicios transaccionales de aplicación (`application/products.py`, `application/services.py`, `application/providers.py`).
- [ ] 2.3 Implementar los serializers (`api/serializers.py`) manejando relaciones y ocultando costos.
- [ ] 2.4 Desarrollar los ViewSets (`api/views.py`) que exponen el CRUD, aplicando permisos: lectura para roles operativos, y creación/modificación exclusiva para Administrador.
- [ ] 2.5 Configurar enrutadores y endpoints en `api/urls.py` y agregarlos a las URLs globales `/api/v1/`.
- [ ] 2.6 Verificar que todas las pruebas del grupo 2 pasen verde y ejecutar comprobaciones de backend (`ruff check`, `mypy`).

## 3. Estado y Contratos (Frontend Features)

- [ ] 3.1 **[TDD]** Escribir pruebas de frontend (`vitest`) que fallen para las funciones de API y los hooks de React Query, simulando (mocking) las respuestas del backend.
- [ ] 3.2 Definir las interfaces TypeScript (`types.ts`) en `src/features/catalog/` y `src/features/purchasing/` para modelos y paginación.
- [ ] 3.3 Crear las funciones de cliente HTTP con Axios (`api.ts`).
- [ ] 3.4 Configurar los hooks de React Query (`queries.ts`) para gestionar el caché de consultas y mutaciones.
- [ ] 3.5 Verificar que las pruebas del grupo 3 pasen verde.

## 4. Vistas e Interfaz Gráfica (Frontend Pages)

- [ ] 4.1 **[TDD]** Escribir pruebas de renderizado que fallen para asegurar que los componentes de UI (tablas, modales) muestren la data correctamente y manejen los eventos de formulario.
- [ ] 4.2 Desarrollar las tablas de listado (DataTables) para Productos, Servicios y Proveedores en `src/pages/`, soportando filtros.
- [ ] 4.3 Crear modales/formularios para registrar y editar Proveedores (nombre obligatorio, contacto opcionales).
- [ ] 4.4 Crear modales/formularios para registrar y editar Servicios.
- [ ] 4.5 Crear interfaces para administrar Catálogos Auxiliares (Categorías, Marcas, Unidades, Presentaciones).
- [ ] 4.6 Desarrollar el formulario integral de Productos (tipo kit/repuesto, precio final y relaciones referenciales).
- [ ] 4.7 Registrar las nuevas rutas y agregarlas al menú de navegación del layout protegido.
- [ ] 4.8 Verificar que las pruebas del grupo 4 pasen verde.

## 5. Verificación Final de Calidad y Cierre

- [ ] 5.1 Ejecutar suite completa de backend (`make test`, `make check` en Django).
- [ ] 5.2 Ejecutar suite completa de frontend (`npm run test`, `npm run typecheck`, `npm run lint`).
- [ ] 5.3 Validar cobertura de código y actualización de la documentación OpenAPI.
- [ ] 5.4 Ejecutar el chequeo final del monorepo (`make audit`) asegurando que el cambio está 100% completo, probado y refactorizado antes de continuar.
