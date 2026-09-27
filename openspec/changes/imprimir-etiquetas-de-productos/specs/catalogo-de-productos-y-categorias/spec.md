## ADDED Requirements

### Requirement: Selección de productos para imprimir etiquetas

La lista de productos SHALL permitir a todo usuario con `productos.ver` seleccionar uno o varios resultados mediante casillas y abrir «Imprimir etiquetas». La selección SHALL conservarse al recorrer páginas mientras la búsqueda y los filtros no cambien. La interfaz SHALL ofrecer además «Todos los del filtro actual», que representa exactamente la búsqueda, categoría, estado, marca de producto y marca de vehículo vigentes, incluidos inactivos cuando el filtro los incluya.

Cambiar la búsqueda o cualquier filtro SHALL limpiar la selección manual para evitar productos ocultos; si existe una selección, la interfaz SHALL avisarlo antes de aplicar el cambio. La ficha SHALL ofrecer «Imprimir etiquetas» para ese producto, activo o inactivo. Estas acciones SHALL estar disponibles para Administrador, Vendedor y Encargado del taller y SHALL NOT requerir permisos de gestión del catálogo. Trazabilidad: `productos.ver`; CT-001; RF-CAT-004; UI-030/031; PPF-01/02; propuesta.

#### Scenario: Selección manual en varias páginas
- **DADO** un usuario con `productos.ver` y un filtro sin cambios
- **CUANDO** selecciona dos productos en una página y otro en la siguiente
- **ENTONCES** SHALL poder abrir la preparación con los tres productos una sola vez y en el orden en que fueron seleccionados.

#### Scenario: Todos los resultados filtrados
- **DADO** una búsqueda y filtros que coinciden con productos de varias páginas
- **CUANDO** el usuario elige «Todos los del filtro actual»
- **ENTONCES** SHALL prepararse un lote con cada coincidencia exactamente una vez, sin incluir productos ajenos al filtro.

#### Scenario: Cambio de filtro con selección
- **DADO** productos seleccionados manualmente
- **CUANDO** el usuario confirma un cambio de búsqueda o filtro
- **ENTONCES** SHALL limpiarse la selección y la lista SHALL mostrar el nuevo resultado sin conservar productos ocultos.

#### Scenario: Imprimir desde la ficha
- **DADO** un producto consultable, incluso inactivo
- **CUANDO** el usuario activa «Imprimir etiquetas» desde su ficha
- **ENTONCES** SHALL abrirse la preparación con ese único producto y una copia inicial.

#### Scenario: Acceso sin sesión o sin permiso
- **DADO** una sesión ausente o sin `productos.ver`
- **CUANDO** se intenta obtener directamente un lote para etiquetas
- **ENTONCES** SHALL denegarse la consulta sin devolver datos de productos.

### Requirement: Proyección completa del filtro para etiquetas

El sistema SHALL ofrecer una lectura de solo consulta que acepte los mismos criterios válidos de búsqueda, categoría, estado, marca de producto y marca de vehículo de la lista y devuelva, con orden estable, todos los productos coincidentes necesarios para las etiquetas: identificador, código interno, nombre, código del fabricante y marca de producto. La lectura SHALL aplicar `productos.ver`, SHALL rechazar filtros inválidos de forma corregible y SHALL devolver un conjunto vacío cuando no haya coincidencias.

La lectura SHALL obtener el conjunto en una sola operación lógica y SHALL NOT depender de que el cliente recorra la paginación ordinaria. SHALL NOT devolver precio, costo, impuesto, existencia, disponibilidad ni datos no usados por la etiqueta, y SHALL NOT escribir, bloquear para edición ni auditar una impresión. Trazabilidad: RF-CAT-004; RNF-REN-005/006; RNF-SEG-002/003; propuesta R1.

#### Scenario: Proyección mínima y ordenada
- **DADO** varios productos que coinciden con el filtro
- **CUANDO** un usuario autorizado solicita los datos para etiquetas
- **ENTONCES** SHALL recibir cada coincidencia una vez, en el mismo orden estable del listado, con solo los campos requeridos.

#### Scenario: Filtro inválido
- **CUANDO** se solicita la proyección con un identificador de categoría inválido o un estado desconocido
- **ENTONCES** SHALL rechazarse la consulta con un error corregible y sin devolver un conjunto parcial.

#### Scenario: Sin coincidencias
- **CUANDO** ningún producto coincide con el filtro válido
- **ENTONCES** SHALL devolverse un conjunto vacío y la interfaz SHALL impedir abrir una preparación sin productos.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
