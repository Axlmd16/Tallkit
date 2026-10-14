## Context

El sistema Sys-Inventario requiere un módulo fundamental para gestionar los catálogos del negocio. Este cambio introduce la gestión de Productos, Servicios, Proveedores y sus catálogos auxiliares (Categorías, Marcas, Unidades, Presentaciones). Esta es una funcionalidad de base requerida antes de poder implementar flujos operativos de inventario, ventas y taller.

Actualmente, el backend de Django cuenta con las apps `identity`, `customer_registry` y `workshop_configuration`. No existe aún la estructura para catálogos y abastecimiento.

## Goals / Non-Goals

**Goals:**
- Diseñar el esquema de base de datos para `Producto`, `Servicio`, `Proveedor` y los catálogos auxiliares respetando el modelo de dominio.
- Definir la estructura de las apps de Django para acomodar estas entidades.
- Asegurar que la edición de entidades preserva la integridad de los datos históricos en el futuro (ej. desactivación lógica en lugar de borrado físico).
- Habilitar los endpoints RESTful protegidos por permisos del rol Administrador y con visibilidad segmentada (ej. Vendedores ven precios, no costos).

**Non-Goals:**
- Implementar el Kardex, entradas o salidas de inventario.
- Implementar la funcionalidad de ventas o mantenimientos.
- Gestionar multibodega.
- Diseñar catálogos públicos accesibles sin autenticación.

## Decisions

### 1. Estructura de Módulos (Apps de Django)
- **Decisión:** Se crearán dos nuevas apps en el backend: `catalog` y `purchasing`.
- **Rationale:** 
  - `catalog`: Contendrá los modelos de `ProductCategory`, `ProductBrand`, `MeasurementUnit`, `ProductPresentation`, `Product`, `ProductCompatibility`, y `Service`. Estas entidades pertenecen al contexto de negocio de "Catálogos". Nota: `VehicleBrand` ya existe en la app `customer_registry` y será reutilizado para las compatibilidades.
  - `purchasing`: Contendrá el modelo `Provider`. Aunque se solicita como parte de los "catálogos", en el dominio el Proveedor pertenece al contexto de "Abastecimiento" (junto con Ingresos de Mercadería y Devoluciones a Proveedor). Ubicarlo en `purchasing` desde el inicio facilita el agrupamiento cohesivo a futuro.
- **Alternativas:** Crear una única app `catalog` para todo, lo cual mezclaría el dominio de abastecimiento con las definiciones de productos.

### 2. Eliminación Lógica (Soft Deletion)
- **Decisión:** Los catálogos principales (`Product`, `Service`, `Provider`) usarán un campo booleano `is_active` (default `True`). Los endpoints de listado estándar filtrarán para devolver solo elementos activos, permitiendo a los administradores incluirlos opcionalmente mediante parámetros de búsqueda.
- **Rationale:** Según las especificaciones y el modelo de dominio, los registros no se eliminan físicamente (para preservar la integridad de datos históricos en Kardex y ventas).

### 3. Modelado de Precio y Costo
- **Decisión:** 
  - `Product` incluirá `final_price` (DecimalField) para la venta. No contendrá `cost` directamente en esta iteración ya que el costo (Costo Promedio Ponderado) se mantendrá actualizado mediante ingresos en el modelo de Inventario/Posición.
  - `Service` incluirá `referential_price` (DecimalField).
  - Ambos campos usarán precisión de `max_digits=12, decimal_places=4` en base de datos para prevenir problemas de redondeo, aunque la interfaz de usuario muestre 2 decimales.
- **Rationale:** Cumple con la regla de negocio de evitar punto flotante binario y permite escalar a cálculos fiscales con 4 decimales requeridos en Ecuador.

### 4. Permisos y Visibilidad
- **Decisión:** Los endpoints en `/api/v1/catalog/` y `/api/v1/purchasing/` requerirán autenticación. Las operaciones de escritura requerirán el rol `ADMINISTRATOR`. Las operaciones de lectura de productos estarán abiertas a `VENDEDOR` y `ENCARGADO_TALLER`, pero un serializer dinámico o endpoints separados asegurarán que campos sensibles (como un eventual costo promedio) no se expongan.
- **Rationale:** El backend es la única fuente de verdad para la autorización y la protección de los datos comerciales.

### 5. Consistencia Arquitectónica (Estructura de Archivos)
- **Decisión:** Se mantendrá la estructura actual de monolito modular basada en capas (layered architecture).
  - **Backend (`catalog`, `purchasing`)**: 
    - `models.py`: Definición de modelos ORM.
    - `domain/`: Reglas de dominio puras, enumeraciones y validadores (`validation.py`).
    - `application/`: Casos de uso, servicios y consultas (`products.py`, `services.py`, `queries.py`).
    - `api/`: Capa de presentación REST (DRF), conteniendo `serializers.py`, `views.py` y enrutadores (`urls.py`).
  - **Frontend**: 
    - `src/features/catalog/` y `src/features/purchasing/`: Contendrán la lógica de estado y llamadas a API (`api.ts`, `queries.ts`, `types.ts`).
    - `src/pages/`: Contendrán las vistas (UI) de cada entidad (`products/`, `services/`, `providers/`).
- **Rationale:** Garantiza predictibilidad para los desarrolladores, facilita el mantenimiento y respeta los patrones ya establecidos en módulos como `customer_registry` y `workshop_configuration`.

## Risks / Trade-offs

- **[Risk]** Alta acoplamiento con futuras tablas de inventario y ventas.
  → **Mitigation**: Mantener `Product` libre de campos calculados dependientes (como `stock` actual) directamente en la tabla principal; se obtendrán mediante joins, subqueries o modelos relacionados (`InventoryPosition`) en el futuro.
- **[Risk]** Duplicidad de registros por parte del usuario (ej. dos proveedores "Repuestos S.A." y "Repuestos SA").
  → **Mitigation**: Validaciones de unicidad en identificaciones (donde estén presentes) y uso de búsqueda sin distinción de mayúsculas y acentos (`unaccent` en PostgreSQL) en la interfaz.

## Migration Plan

1. Crear las apps `catalog` y `purchasing` en Django.
2. Definir los modelos y generar las migraciones iniciales (`makemigrations`).
3. Implementar los serializers y ModelViewSets.
4. Desarrollar componentes React para la gestión de catálogos en el frontend.
5. Ejecutar despliegue estándar; no hay migración de datos complejos requerida ya que son tablas nuevas.

## Open Questions

- ¿La compatibilidad con `VehicleBrand` requerirá modelo y año específicos a futuro, o solo la marca es suficiente para V1? Se asumirá que la relación es simple `Product` -> `VehicleBrand` (many-to-many) como indica el requerimiento base para V1.
