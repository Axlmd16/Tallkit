## Why

El negocio necesita definir y administrar los bienes y servicios que ofrece, así como los proveedores que los suministran, para poder operar los flujos de inventario, taller y comerciales. Actualmente no existe una implementación funcional del catálogo de productos, servicios y proveedores que respete las decisiones confirmadas y el modelo de dominio para la versión 1 (V1).

## What Changes

- Incorporar la administración de **Productos**, abarcando su código, nombre, categoría, marca, presentación, unidad de medida, precio final, estado (activo/inactivo) y la distinción de kits comprados frente a piezas sueltas (`RN-CAT-001…014`, `RF-CAT-001…016`, `DP-009`, `DP-010`).
- Incorporar la administración de **Servicios** para el RUC artesanal, con su nombre, precio referencial y estado activo/inactivo.
- Incorporar la administración de **Proveedores**, requiriendo nombre obligatoriamente y permitiendo identificación y contacto opcionales para compras ocasionales (`DP-011`).
- Reutilizar el catálogo de **Marcas de Vehículos** existente en `customer_registry` para asignar compatibilidades referenciales a los repuestos.
- Establecer permisos segmentados: solo el **Administrador** puede crear o editar catálogos; el **Vendedor** y **Encargado de Taller** solo pueden consultarlos en modo de lectura.

### Fuera de alcance

- Gestión de inventario físico (Kardex, reservas, disponibilidad, costo promedio). Los productos se crean sin costo ni stock inicial.
- Flujos de abastecimiento (ingresos de mercadería, devoluciones a proveedor).
- Flujos comerciales y de taller (ventas, proformas, mantenimientos).
- Integración de catálogos con la facturación electrónica del SRI (clasificación tributaria definitiva).

### Dependencias y riesgos

- Depende de la autenticación y autorización (roles) ya implementadas en `identity`.
- Es un prerrequisito funcional crítico para los futuros módulos de `inventario` (Kardex) y `ventas`/`taller`.
- Existe el riesgo de duplicación de datos (ej. proveedores con nombres similares). Se mitigará con validaciones estrictas y soft-deletion (`is_active`).

## Capabilities

### New Capabilities

- `catalogo-productos`: Gestión de productos, categorías, marcas de producto, unidades de medida, presentaciones y compatibilidades vehiculares referenciales.
- `catalogo-servicios`: Gestión del catálogo de servicios con sus precios referenciales para el área artesanal.
- `catalogo-proveedores`: Gestión del catálogo de proveedores para respaldar los ingresos de mercadería.

### Modified Capabilities

- Ninguna capacidad existente se modifica.

## Impact

- **Backend (Django/DRF)**: Nuevas fronteras funcionales (`catalog`, `purchasing`) respetando el monolito modular. Nuevos modelos con soft-deletion, validaciones estrictas a nivel de base de datos (CHECK constraints) e índices por estado activo.
- **Frontend (React)**: Nuevas pantallas administrativas integradas en el layout existente, reutilizando `Shared UI` (DataTables, Modal forms).
- **Calidad**: Requiere pruebas unitarias e integración comprobando las restricciones de unicidad, el soft-deletion y el acceso basado en roles.
