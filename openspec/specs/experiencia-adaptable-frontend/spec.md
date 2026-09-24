# experiencia-adaptable-frontend Specification

## Purpose
Garantizar operación adaptable y accesible en computadora, tableta y teléfono.
## Requirements

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
La navegación principal SHALL presentarse:
- **Escritorio, desde 1280 px:** barra lateral desplegada con iconos y etiquetas, agrupada por área de trabajo.
- **Tableta, de 768 a 1279 px:** barra compacta de iconos con nombre accesible y ayuda emergente.
- **Teléfono, por debajo de 768 px:** panel temporal que se abre desde la barra superior.

En todos los tamaños SHALL conservar el logotipo Tallkit, la ruta activa, el acceso a inicio, la identidad del usuario y únicamente las opciones permitidas por sus roles.

**Trazabilidad:** `CT-001`, `RNF-SEG-003`, `RNF-USA-001`, `RNF-USA-007`; secciones 2 y 10 de `interfaz-y-navegacion.md` actualizadas; tableros «Lista de ventas», «Tableta · Ventas» y «Teléfono · Ventas».

#### Scenario: Cambio de tamaño con una ruta activa
- **WHEN** la interfaz cambia entre escritorio, tableta y teléfono mientras una pantalla está abierta
- **THEN** SHALL conservar la ruta activa y mostrar su posición dentro de la navegación disponible

#### Scenario: Navegación desplegada en escritorio
- **WHEN** un usuario accede desde un ancho de 1280 px o más
- **THEN** SHALL ver cada opción permitida con su icono y su etiqueta, agrupadas por área, y la opción activa con el tratamiento de selección

#### Scenario: Navegación compacta en tableta
- **WHEN** el ancho está entre 768 y 1279 px
- **THEN** la barra lateral SHALL reducirse a iconos cuyos controles conservan nombre accesible, ayuda emergente y estado activo reconocible

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
Los formularios SHALL agrupar campos por significado y usar una columna en teléfono. En pantallas amplias los formularios en página SHALL poder presentar cada sección con su título a la izquierda y sus campos en una o dos columnas a la derecha, conservando el orden de lectura. Los formularios cortos SHALL presentarse en modal según `patrones-de-pantalla-frontend`. Las etiquetas, las ayudas, la obligatoriedad y los errores SHALL permanecer asociados con sus controles en todos los tamaños. Las barras de acciones fijas SHALL NOT tapar el contenido ni el teclado del dispositivo.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-004`, `RNF-USA-005`, `RNF-USA-007`; secciones 5 y 10 de `interfaz-y-navegacion.md`; tablero «Nuevo producto».

#### Scenario: Formulario con errores en teléfono
- **WHEN** un usuario envía desde teléfono un formulario con varios datos inválidos
- **THEN** SHALL recibir un resumen comprensible y errores próximos a los campos correspondientes sin perder los valores ingresados

#### Scenario: Reorganización de columnas
- **WHEN** un formulario pasa de dos columnas a una por reducción del ancho
- **THEN** el orden visual y el orden de navegación por teclado SHALL conservar una secuencia lógica

#### Scenario: Barra de acciones con teclado en pantalla
- **WHEN** el teclado virtual se abre en teléfono sobre un campo cercano al final del formulario
- **THEN** el campo enfocado SHALL permanecer visible y la barra de acciones SHALL NOT taparlo

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
La navegación, los formularios, los filtros, las listas interactivas, los menús, los modales, los diálogos y las notificaciones SHALL poder operarse mediante teclado, con un orden lógico y un indicador de foco claramente visible que no quede cubierto por elementos persistentes.

**Trazabilidad:** `RNF-USA-007`, `RNF-USA-008`; secciones 2, 4, 5 y 10 de `interfaz-y-navegacion.md`.

#### Scenario: Recorrido sin puntero
- **WHEN** un usuario recorre una pantalla usando únicamente el teclado
- **THEN** SHALL alcanzar cada control operativo en el mismo orden lógico en que se presenta visualmente y SHALL identificar cuál tiene el foco

#### Scenario: Apertura y cierre de un modal o diálogo
- **WHEN** un usuario abre un modal o diálogo mediante teclado
- **THEN** el foco SHALL entrar al elemento superpuesto, SHALL permanecer en sus controles mientras esté abierto y SHALL regresar al control de origen al cerrarlo

#### Scenario: Notificación temporal y foco
- **WHEN** aparece una notificación temporal mientras el usuario escribe en un campo
- **THEN** el foco SHALL permanecer en el campo, y la notificación SHALL poder alcanzarse con el teclado y cerrarse con Escape

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
Cada superficie modificada SHALL verificarse al menos en 360 px, 768 px, 1024 px, 1280 px y 1440 px, con contenido realista, estados de carga, vacío, error y datos largos cuando correspondan.

**Trazabilidad:** `RNF-USA-001`, `RNF-USA-002`, `RNF-COM-001`, `RNF-COM-002`; sección 13 de `interfaz-y-navegacion.md`.

#### Scenario: Revisión de una superficie modificada
- **WHEN** una pantalla queda preparada para integrar el cambio
- **THEN** SHALL existir evidencia de que sus flujos esenciales no presentan pérdida de contenido, solapamientos ni desplazamiento horizontal de página en los cinco tamaños representativos

### Requirement: Modales y diálogos adaptables
Los formularios cortos y las confirmaciones SHALL presentarse en modales centrados de ancho contenido, entre 420 y 480 px en escritorio, con fondo oscurecido, título, control de cierre y pie de acciones. En un ancho de teléfono el modal SHALL ocupar el ancho disponible, mantener visibles el cierre y la acción principal y permitir desplazar su cuerpo sin desplazar la página de fondo. Cerrar un modal SHALL devolver al usuario al mismo punto de la pantalla de origen, con su estado intacto.

**Trazabilidad:** decisiones 6 y 14 del proposal; `RNF-USA-001`, `RNF-USA-004`, `RNF-USA-005`, `RNF-USA-007`; tableros «Formulario corto en modal» y «Diálogos de ventas».

#### Scenario: Modal en escritorio
- **WHEN** un usuario abre la creación de una marca en una pantalla amplia
- **THEN** SHALL ver el modal centrado sobre la lista de origen, que permanece visible detrás del fondo oscurecido

#### Scenario: Modal en teléfono
- **WHEN** el mismo modal se abre en un ancho de 360 px
- **THEN** SHALL usar el ancho disponible, sus campos, errores, cierre y acción principal SHALL ser operables y la página de fondo SHALL NOT desplazarse

#### Scenario: Retorno al contexto de origen
- **GIVEN** una lista filtrada y desplazada hasta la mitad
- **WHEN** el usuario abre y cierra un modal
- **THEN** la lista SHALL conservar sus filtros, su página y su posición de desplazamiento

### Requirement: Listas y tablas adaptables
En escritorio y tableta, las listas operativas SHALL presentarse como una tabla contenida en un panel, con filas compactas separadas por líneas finas, encabezado de columnas visible y alineación que permita comparar valores. En tableta SHALL priorizar las columnas esenciales y agrupar los filtros secundarios bajo un control «Filtros». En teléfono cada registro SHALL mostrarse como una fila compacta de dos líneas con identificación, dato principal, estado y total, sin tarjetas grandes. La información secundaria SHALL quedar disponible en la ficha, sin desplazamiento horizontal de la página.

**Trazabilidad:** `RNF-USA-002`, `RNF-REN-005`; secciones 4 y 10 de `interfaz-y-navegacion.md`; tableros «Lista de ventas», «Tableta · Ventas» y «Teléfono · Ventas».

#### Scenario: Lista extensa en teléfono
- **WHEN** una lista con varias columnas se presenta en un ancho de 360 px
- **THEN** cada fila SHALL mostrar identificación, dato principal, estado y total en dos líneas, y SHALL abrir la ficha para consultar el resto

#### Scenario: Lista tabular en escritorio
- **WHEN** existe espacio suficiente para las columnas relevantes
- **THEN** la tabla SHALL mostrar encabezados, alineación uniforme de importes y filas compactas sin sombras por registro

#### Scenario: Contenido largo en una fila
- **WHEN** un nombre, correo, identificador o estado excede el espacio previsto
- **THEN** SHALL truncarse con acceso al valor completo o redistribuirse, sin solapar acciones ni romper la página
