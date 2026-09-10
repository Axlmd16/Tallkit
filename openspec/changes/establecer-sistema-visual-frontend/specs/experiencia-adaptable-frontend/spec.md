## ADDED Requirements

### Requirement: Interfaz utilizable en los dispositivos objetivo
La aplicación SHALL ser utilizable desde 360 px de ancho hasta pantallas de escritorio. El contenido, los formularios y las acciones esenciales SHALL adaptarse al espacio disponible sin producir desplazamiento horizontal de la página completa.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-002`, `RNF-COM-001`, `RNF-COM-002`; secciones 2 y 10 de `interfaz-y-navegacion.md`.

#### Scenario: Operación en computadora
- **WHEN** un usuario accede desde una pantalla de escritorio
- **THEN** SHALL disponer de navegación persistente, contenido con ancho legible y espacio suficiente para consultar o editar información operativa

#### Scenario: Operación en tableta
- **WHEN** un usuario cambia entre orientación vertical y horizontal en una tableta
- **THEN** la navegación, el contenido y las acciones SHALL reorganizarse sin perder información ni requerir recargar la pantalla

#### Scenario: Operación en teléfono
- **WHEN** un usuario accede desde un ancho de 360 px
- **THEN** SHALL poder completar los flujos esenciales mediante una sola columna y sin que un control quede fuera del área visible de la página

### Requirement: Navegación adaptable y autorizada
La navegación principal SHALL ser lateral y directamente accesible en escritorio, SHALL poder contraerse cuando el espacio sea limitado y SHALL ofrecer un panel compacto en teléfono. En todos los tamaños SHALL conservar la ubicación actual, el acceso a inicio, la identidad del usuario y las opciones permitidas por sus roles.

**Trazabilidad:** `CT-001`, `RNF-SEG-003`, `RNF-USA-001`, `RNF-USA-007`; sección 2 de `interfaz-y-navegacion.md`.

#### Scenario: Cambio de tamaño con una ruta activa
- **WHEN** la interfaz cambia entre escritorio, tableta y teléfono mientras una pantalla está abierta
- **THEN** SHALL conservar la ruta activa y SHALL mostrar su posición dentro de la navegación disponible

#### Scenario: Navegación en teléfono
- **WHEN** un usuario abre la navegación compacta en teléfono y elige una opción
- **THEN** SHALL llegar a la pantalla seleccionada y el panel SHALL cerrarse sin bloquear el contenido

#### Scenario: Navegación según permisos
- **WHEN** un **Vendedor** o **Encargado del taller** utiliza cualquier dispositivo
- **THEN** SHALL ver únicamente las áreas autorizadas por sus permisos efectivos, con la misma política aplicada en escritorio

### Requirement: Acciones esenciales accesibles en cada tamaño
Las acciones principales y críticas SHALL permanecer visibles o encontrarse mediante un mecanismo explícito y predecible en computadora, tableta y teléfono. Ninguna acción crítica SHALL depender exclusivamente de pasar el puntero sobre un elemento.

**Trazabilidad:** `RNF-USA-002`, `RNF-USA-003`, `RNF-USA-007`; secciones 4, 8 y 10 de `interfaz-y-navegacion.md`.

#### Scenario: Acción principal en pantalla estrecha
- **WHEN** una pantalla con acciones se presenta en teléfono
- **THEN** su acción principal SHALL permanecer identificable y las acciones adicionales SHALL estar disponibles mediante controles visibles y accesibles

#### Scenario: Dispositivo sin puntero preciso
- **WHEN** una persona utiliza una pantalla táctil
- **THEN** SHALL poder descubrir y ejecutar cada acción necesaria sin depender de estados de hover

### Requirement: Controles táctiles adecuados
Todo control interactivo utilizado en los flujos esenciales SHALL ofrecer un área activable de al menos 44 por 44 píxeles CSS en dispositivos táctiles. Los controles adyacentes SHALL mantener separación suficiente para reducir activaciones accidentales.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-007`, `RNF-USA-008`.

#### Scenario: Acciones adyacentes en tableta o teléfono
- **WHEN** dos o más controles interactivos aparecen juntos en un dispositivo táctil
- **THEN** cada uno SHALL cumplir el tamaño mínimo y SHALL mantener al menos 8 píxeles CSS de separación activable respecto de los demás

### Requirement: Formularios adaptables y comprensibles
Los formularios SHALL agrupar campos por significado y usar una columna en teléfono. En pantallas amplias SHALL poder distribuirse en más de una columna únicamente cuando se conserve el orden de lectura. Las etiquetas, ayudas, obligatoriedad y errores SHALL permanecer asociados con sus controles en todos los tamaños.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-004`, `RNF-USA-005`, `RNF-USA-007`; sección 5 de `interfaz-y-navegacion.md`.

#### Scenario: Formulario con errores en teléfono
- **WHEN** un usuario envía desde teléfono un formulario con varios datos inválidos
- **THEN** SHALL recibir un resumen comprensible y errores próximos a los campos correspondientes sin perder los valores ingresados

#### Scenario: Reorganización de columnas
- **WHEN** un formulario pasa de dos columnas a una por reducción del ancho
- **THEN** el orden visual y el orden de navegación por teclado SHALL conservar una secuencia lógica

### Requirement: Listas y tablas adaptables
Las listas tabulares SHALL mostrar en teléfono la identificación, el dato principal, el estado y la acción prioritaria. La información secundaria SHALL estar disponible mediante detalle, expansión o desplazamiento controlado dentro de la región de datos, sin causar desplazamiento horizontal de toda la página.

**Trazabilidad:** `RNF-USA-002`, `RNF-REN-005`; sección 4 de `interfaz-y-navegacion.md`.

#### Scenario: Lista extensa en teléfono
- **WHEN** una tabla con varias columnas se presenta en un ancho de 360 px
- **THEN** SHALL mantener visibles los datos prioritarios y la acción principal, y SHALL ofrecer un modo accesible de consultar los demás datos

#### Scenario: Tabla ancha en escritorio
- **WHEN** existe espacio suficiente para las columnas relevantes
- **THEN** la información SHALL conservar una disposición tabular que facilite comparar filas sin convertir cada registro en una tarjeta aislada

### Requirement: Operación completa mediante teclado
La navegación, los formularios, los filtros, las tablas interactivas, los menús y los diálogos esenciales SHALL poder operarse mediante teclado con un orden lógico y un indicador de foco claramente visible que no quede cubierto por elementos persistentes.

**Trazabilidad:** `RNF-USA-007`, `RNF-USA-008`; secciones 2, 4, 5 y 10 de `interfaz-y-navegacion.md`.

#### Scenario: Recorrido sin puntero
- **WHEN** un usuario recorre una pantalla usando únicamente el teclado
- **THEN** SHALL alcanzar cada control operativo en el mismo orden lógico en que se presenta visualmente y SHALL identificar cuál tiene el foco

#### Scenario: Apertura y cierre de un diálogo
- **WHEN** un usuario abre un diálogo mediante teclado
- **THEN** el foco SHALL entrar al diálogo, SHALL permanecer en sus controles mientras esté abierto y SHALL regresar al control de origen al cerrarlo

### Requirement: Movimiento discreto y reducible
Las transiciones SHALL comunicar cambios de estado o ubicación sin retrasar la operación. La interfaz SHALL respetar la preferencia del sistema para reducir movimiento y SHALL mantener visible el estado final sin animaciones no esenciales.

**Trazabilidad:** `RNF-USA-008`; principios de accesibilidad y adaptación de `interfaz-y-navegacion.md`.

#### Scenario: Preferencia de movimiento reducido
- **WHEN** el dispositivo indica que la persona prefiere movimiento reducido
- **THEN** la interfaz SHALL omitir animaciones no esenciales y SHALL presentar directamente el estado final de cada elemento

#### Scenario: Retroalimentación de una interacción
- **WHEN** un usuario abre un panel, cambia un filtro o confirma una acción
- **THEN** cualquier transición SHALL explicar el cambio sin impedir una interacción posterior ni prolongar artificialmente la espera

### Requirement: Verificación en tamaños representativos
Cada superficie modificada SHALL verificarse al menos en 360 px, un tamaño de tableta y un tamaño de escritorio, incluyendo contenido realista, estados de carga, vacío, error y datos largos cuando correspondan.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-002`, `RNF-COM-001`, `RNF-COM-002`; sección 13 de `interfaz-y-navegacion.md`.

#### Scenario: Revisión de una superficie modificada
- **WHEN** una pantalla queda preparada para integrar el cambio
- **THEN** SHALL existir evidencia de que sus flujos esenciales no presentan pérdida de contenido, solapamientos ni desplazamiento horizontal de página en los tres tamaños representativos
