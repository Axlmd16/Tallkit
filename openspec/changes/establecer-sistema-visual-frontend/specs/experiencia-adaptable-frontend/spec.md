## ADDED Requirements

### Requirement: Interfaz utilizable en los dispositivos objetivo
La aplicación SHALL ser utilizable desde 360 px de ancho hasta pantallas de escritorio. El contenido, los formularios y las acciones esenciales SHALL adaptarse al espacio disponible sin producir desplazamiento horizontal de la página completa.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-002`, `RNF-COM-001`, `RNF-COM-002`; secciones 2 y 10 de `interfaz-y-navegacion.md`.

#### Scenario: Operación en computadora
- **WHEN** un usuario accede desde una pantalla de escritorio
- **THEN** SHALL disponer de navegación persistente, contenido con ancho legible y una composición de superficies que aproveche el espacio sin dispersar la información

#### Scenario: Operación en tableta
- **WHEN** un usuario cambia entre orientación vertical y horizontal en una tableta
- **THEN** la navegación, el contenido y las acciones SHALL reorganizarse sin perder información ni requerir recargar la pantalla

#### Scenario: Operación en teléfono
- **WHEN** un usuario accede desde un ancho de 360 px
- **THEN** SHALL poder completar los flujos esenciales mediante una sola columna y sin que un control quede fuera del área visible de la página

### Requirement: Navegación lateral adaptable y autorizada
La navegación principal SHALL presentarse como barra lateral completa en escritorio, como barra lateral compacta cuando el ancho de tableta lo requiera y como panel temporal en teléfono. En todos los tamaños SHALL conservar la ruta activa, el acceso a inicio, la identidad del usuario y únicamente las opciones permitidas por sus roles.

**Trazabilidad:** `CT-001`, `RNF-SEG-003`, `RNF-USA-001`, `RNF-USA-007`; sección 2 de `interfaz-y-navegacion.md`.

#### Scenario: Cambio de tamaño con una ruta activa
- **WHEN** la interfaz cambia entre escritorio, tableta y teléfono mientras una pantalla está abierta
- **THEN** SHALL conservar la ruta activa y SHALL mostrar su posición dentro de la navegación disponible

#### Scenario: Navegación compacta en tableta
- **WHEN** el ancho disponible no permite mostrar simultáneamente iconos y etiquetas sin comprimir el contenido
- **THEN** la barra lateral SHALL reducirse a una variante compacta cuyos controles conserven nombre accesible y estado activo reconocible

#### Scenario: Navegación en teléfono
- **WHEN** un usuario abre la navegación temporal en teléfono y elige una opción
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
Los formularios SHALL agrupar campos por significado y usar una columna en teléfono. En pantallas amplias SHALL poder distribuirse en más de una columna o presentarse en un panel lateral únicamente cuando se conserve el orden de lectura. Las etiquetas, ayudas, obligatoriedad y errores SHALL permanecer asociados con sus controles en todos los tamaños.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-004`, `RNF-USA-005`, `RNF-USA-007`; sección 5 de `interfaz-y-navegacion.md`; patrones de formulario y panel lateral de la referencia aprobada.

#### Scenario: Formulario con errores en teléfono
- **WHEN** un usuario envía desde teléfono un formulario con varios datos inválidos
- **THEN** SHALL recibir un resumen comprensible y errores próximos a los campos correspondientes sin perder los valores ingresados

#### Scenario: Reorganización de columnas
- **WHEN** un formulario pasa de dos columnas a una por reducción del ancho
- **THEN** el orden visual y el orden de navegación por teclado SHALL conservar una secuencia lógica

### Requirement: Paneles laterales y diálogos adaptables
Los formularios breves, detalles o acciones contextuales SHALL poder presentarse en un panel lateral sobre el contenido en pantallas amplias. Cuando el ancho no permita mantener simultáneamente el panel y el contenido de forma legible, el panel SHALL ocupar el ancho disponible o SHALL convertirse en un diálogo adecuado al dispositivo, sin perder datos ni contexto.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-004`, `RNF-USA-005`, `RNF-USA-007`, `RNF-USA-008`; secciones 5, 8 y 10 de `interfaz-y-navegacion.md`; patrones de panel y diálogo de la referencia aprobada.

#### Scenario: Formulario lateral en escritorio
- **WHEN** un usuario abre una creación o edición contextual en una pantalla amplia
- **THEN** SHALL conservar visible el contexto de origen detrás de un panel lateral claramente delimitado

#### Scenario: Formulario contextual en teléfono
- **WHEN** la misma creación o edición se abre en un ancho de teléfono
- **THEN** SHALL usar el ancho disponible, mantener accesibles el cierre y la acción principal y SHALL permitir volver al contexto de origen sin perder su estado

### Requirement: Listas y tablas adaptables con filas elevadas
En escritorio y tableta, las listas operativas SHALL poder presentar cada registro como una fila blanca elevada y redondeada, manteniendo encabezados o alineación de columnas que permitan comparar los datos. En teléfono SHALL mostrar la identificación, el dato principal, el estado y la acción prioritaria; la información secundaria SHALL estar disponible mediante detalle, expansión o desplazamiento controlado dentro de la región de datos, sin causar desplazamiento horizontal de toda la página.

**Trazabilidad:** `RNF-USA-002`, `RNF-REN-005`; sección 4 de `interfaz-y-navegacion.md`; patrón de listas de la referencia aprobada.

#### Scenario: Lista extensa en teléfono
- **WHEN** una lista con varias columnas se presenta en un ancho de 360 px
- **THEN** SHALL mantener visibles los datos prioritarios y la acción principal, y SHALL ofrecer un modo accesible de consultar los demás datos

#### Scenario: Lista tabular en escritorio
- **WHEN** existe espacio suficiente para las columnas relevantes
- **THEN** cada registro SHALL poder usar una superficie elevada sin perder la alineación entre filas, los encabezados ni la comparación visual de valores

#### Scenario: Contenido largo en una fila
- **WHEN** un nombre, correo, identificador o estado excede el espacio previsto
- **THEN** SHALL ajustarse, truncarse con acceso al valor completo o redistribuirse sin solapar acciones ni romper la página

### Requirement: Acceso adaptable
La pantalla de acceso SHALL presentar formulario y composición visual complementaria en dos regiones cuando el ancho sea suficiente. En teléfono SHALL priorizar el formulario y SHALL poder reubicar, simplificar u omitir la composición sin ocultar campos, errores o acciones.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-004`, `RNF-USA-007`, `RNF-USA-008`; `UI-001`; patrón de acceso de la referencia aprobada.

#### Scenario: Acceso en pantalla amplia
- **WHEN** el ancho permite mostrar dos regiones legibles
- **THEN** SHALL mostrar el formulario y la composición complementaria sin que esta reduzca la claridad de la autenticación

#### Scenario: Acceso en teléfono
- **WHEN** la pantalla de acceso se presenta a 360 px
- **THEN** el formulario SHALL ocupar la región principal y todos sus campos, errores y acciones SHALL permanecer visibles y operables

### Requirement: Operación completa mediante teclado
La navegación, los formularios, los filtros, las listas interactivas, los menús, los paneles y los diálogos esenciales SHALL poder operarse mediante teclado con un orden lógico y un indicador de foco claramente visible que no quede cubierto por elementos persistentes.

**Trazabilidad:** `RNF-USA-007`, `RNF-USA-008`; secciones 2, 4, 5 y 10 de `interfaz-y-navegacion.md`.

#### Scenario: Recorrido sin puntero
- **WHEN** un usuario recorre una pantalla usando únicamente el teclado
- **THEN** SHALL alcanzar cada control operativo en el mismo orden lógico en que se presenta visualmente y SHALL identificar cuál tiene el foco

#### Scenario: Apertura y cierre de un panel o diálogo
- **WHEN** un usuario abre un panel o diálogo mediante teclado
- **THEN** el foco SHALL entrar al elemento superpuesto, SHALL permanecer en sus controles mientras esté abierto y SHALL regresar al control de origen al cerrarlo

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
Cada superficie modificada SHALL verificarse al menos en 360 px, 768 px, 1024 px y 1440 px, incluyendo contenido realista, estados de carga, vacío, error y datos largos cuando correspondan.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-002`, `RNF-COM-001`, `RNF-COM-002`; sección 13 de `interfaz-y-navegacion.md`.

#### Scenario: Revisión de una superficie modificada
- **WHEN** una pantalla queda preparada para integrar el cambio
- **THEN** SHALL existir evidencia de que sus flujos esenciales no presentan pérdida de contenido, solapamientos ni desplazamiento horizontal de página en los cuatro tamaños representativos
