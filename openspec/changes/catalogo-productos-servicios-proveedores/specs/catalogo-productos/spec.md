## ADDED Requirements

### Requirement: Registro de catálogos auxiliares de productos
El sistema DEBE permitir registrar, buscar y listar categorías de producto, marcas de producto, unidades de medida y presentaciones.

#### Scenario: Registro exitoso de una categoría
- **WHEN** el administrador o usuario autorizado registra una nueva categoría con nombre único
- **THEN** la categoría se guarda correctamente y está disponible para la creación de productos

#### Scenario: Categoría duplicada
- **WHEN** el administrador intenta registrar una categoría con un nombre que ya existe
- **THEN** el sistema rechaza la operación y muestra un error de validación

### Requirement: Registro y edición de productos
El sistema DEBE permitir registrar productos con código único, nombre, categoría, marca de producto, presentación, unidad de medida, precio final, estado e indicación de si es un kit comprado. La edición NO DEBE modificar líneas históricas de documentos confirmados.

#### Scenario: Creación de un producto básico
- **WHEN** el administrador registra un producto completando todos los campos obligatorios
- **THEN** el sistema asigna el código único y guarda el producto en estado activo

#### Scenario: Prevención de edición destructiva
- **WHEN** el administrador modifica el precio final de un producto existente
- **THEN** el producto se actualiza para futuras operaciones
- **AND** los precios registrados en ventas y proformas históricas se mantienen inalterados

### Requirement: Activación y desactivación de productos
El sistema DEBE permitir activar y desactivar productos sin eliminarlos físicamente, preservando su visibilidad en operaciones históricas.

#### Scenario: Desactivación de un producto
- **WHEN** el administrador desactiva un producto activo
- **THEN** el producto cambia su estado a inactivo
- **AND** deja de estar disponible para su selección en nuevas proformas y ventas
- **AND** permanece visible en el historial y Kardex

### Requirement: Visibilidad de costos de productos
El sistema DEBE mostrar existencias a todos los roles operativos, pero los costos DEBEN ser visibles únicamente para el rol Administrador.

#### Scenario: Consulta de catálogo por un Vendedor
- **WHEN** un usuario con rol Vendedor consulta el catálogo de productos
- **THEN** el sistema muestra los precios finales y existencias
- **AND** no incluye los costos ni valorización en la interfaz ni en la respuesta de la API

### Requirement: Búsqueda y filtrado de productos
El sistema DEBE permitir buscar y filtrar productos por código, nombre, categoría, marca de producto, marca de vehículo compatible, estado y disponibilidad.

#### Scenario: Filtrado combinado
- **WHEN** el usuario filtra por una categoría específica y estado "activo"
- **THEN** el sistema retorna únicamente los productos que cumplen con ambos criterios

### Requirement: Compatibilidad referencial con vehículos
El sistema DEBERÍA permitir asociar marcas de vehículo a un producto como información de referencia para facilitar la búsqueda, sin que esta relación bloquee una venta a un vehículo de otra marca.

#### Scenario: Registro de compatibilidad referencial
- **WHEN** el administrador asocia la marca "Toyota" a un producto de repuesto
- **THEN** el producto aparece al filtrar por compatibilidad con Toyota
- **AND** el sistema permite vender dicho repuesto a un vehículo de cualquier otra marca sin bloquear la operación
