## MODIFIED Requirements

### Requirement: Estados del producto y separación de inventario

Producto SHALL poder desactivarse y reactivarse mediante acciones explícitas, conservando identidad y relaciones. Los inactivos SHALL permanecer consultables y SHALL excluirse de selecciones nuevas. Repetir un estado ya alcanzado SHALL ser inocuo. El catálogo SHALL NOT permitir eliminación ordinaria ni aceptar escrituras de existencias, reservas, costos o movimientos; tampoco SHALL mostrar cantidades ficticias, producir compras, documentos o relaciones de proveedor único. La lista y la ficha de productos SHALL mostrar la **existencia real** de solo lectura, tomada del inventario, a quien tenga el permiso de consultar inventario. La respuesta del catálogo SHALL NOT incluir existencias: SHALL obtenerse mediante una lectura del inventario protegida por ese permiso; sin él, el servidor SHALL rechazar esa lectura y la interfaz SHALL NOT pedirla ni mostrar su columna. La existencia SHALL mostrarse sin costos, promedio ni valoración, y un producto sin movimientos SHALL mostrar existencia cero, nunca un valor inventado. Trazabilidad: RN-CAT-002; RF-CAT-003; DP-001/002/012; DP-030; DP-036, regla 1; modelo-dominio-taller; `existencias-y-ajustes-de-inventario`; propuesta, decisión 6.

#### Scenario: Desactivación y selección
- **GIVEN** un producto activo
- **WHEN** se confirma su baja
- **THEN** SHALL conservarse consultable con sus relaciones y excluirse de nuevas selecciones

#### Scenario: Reactivación válida
- **GIVEN** un producto inactivo con categoría activa
- **WHEN** se confirma su reactivación
- **THEN** SHALL recuperar su identidad y disponibilidad de selección

#### Scenario: Estado repetido
- **GIVEN** un producto ya inactivo
- **WHEN** se repite su desactivación
- **THEN** SHALL conservarse sin efectos adicionales

#### Scenario: Escritura de stock o costo
- **GIVEN** un usuario incluso Administrador
- **WHEN** intenta enviar stock, costo promedio o costo de referencia mediante el catálogo
- **THEN** SHALL rechazarse explícitamente sin cambiar cantidades ni costos

#### Scenario: Eliminación ordinaria
- **GIVEN** un producto o auxiliar persistido
- **WHEN** se intenta eliminarlo físicamente por la interfaz de catálogo
- **THEN** SHALL denegarse conservando identidad y referencias

#### Scenario: Existencia en la lista y la ficha
- **GIVEN** un producto con existencia 12 en inventario y un usuario con permiso de consultar inventario
- **WHEN** abre la lista o la ficha de productos
- **THEN** SHALL ver 12 como existencia, sin costo ni valoración, y el mismo dato SHALL coincidir con el inventario.

#### Scenario: Usuario sin permiso de inventario
- **GIVEN** un usuario sin permiso para consultar inventario
- **WHEN** abre la lista de productos o consulta directamente la lectura de existencias por la API
- **THEN** la lectura SHALL rechazarse, la respuesta del catálogo SHALL NOT incluir existencias y la pantalla SHALL NOT mostrar su columna.
