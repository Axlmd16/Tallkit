## MODIFIED Requirements

### Requirement: Navegación lateral adaptable y autorizada
La navegación principal SHALL presentarse:
- **Escritorio, desde 1280 px:** barra lateral grafito de unos 264 px con el logotipo, los grupos de navegación vigentes, cada opción con icono y etiqueta, y la opción activa con fondo destacado y una barra de acento cobre. Al pie SHALL mostrarse el motivo del tacómetro como decoración, sin interferir con las opciones ni anunciarse a las tecnologías de asistencia.
- **Tableta, de 768 a 1279 px:** barra compacta grafito de iconos con nombre accesible, ayuda emergente y el mismo tratamiento de la opción activa.
- **Teléfono, por debajo de 768 px:** panel temporal que se abre desde la barra superior.

En todos los tamaños SHALL conservar el logotipo Tallkit, la ruta activa, el acceso a inicio, la identidad del usuario y únicamente las opciones permitidas por sus roles. Las entradas y los grupos del menú SHALL ser los vigentes hasta U4.

**Trazabilidad:** `CT-001`, `RNF-SEG-003`, `RNF-USA-001`, `RNF-USA-007`; `DP-036`, reglas 1 y 6; decisión D3 de la propuesta; `DESIGN.md`, «Marco»; secciones 2 y 10 de `interfaz-y-navegacion.md`.

#### Scenario: Cambio de tamaño con una ruta activa
- **WHEN** la interfaz cambia entre escritorio, tableta y teléfono mientras una pantalla está abierta
- **THEN** SHALL conservar la ruta activa y mostrar su posición dentro de la navegación disponible

#### Scenario: Navegación desplegada en escritorio
- **WHEN** un usuario accede desde un ancho de 1280 px o más
- **THEN** SHALL ver cada opción permitida con su icono y su etiqueta en la barra grafito, y la opción activa con fondo destacado y barra de acento cobre, reconocible también sin el color

#### Scenario: Navegación compacta en tableta
- **WHEN** el ancho está entre 768 y 1279 px
- **THEN** la barra lateral SHALL reducirse a iconos cuyos controles conservan nombre accesible, ayuda emergente, estado activo reconocible y un objetivo táctil de al menos 44 px

#### Scenario: Navegación en teléfono
- **WHEN** un usuario abre la navegación temporal en teléfono y elige una opción
- **THEN** SHALL llegar a la pantalla seleccionada y el panel SHALL cerrarse sin bloquear el contenido

#### Scenario: Navegación según permisos
- **WHEN** un **Vendedor** o **Encargado del taller** utiliza cualquier dispositivo
- **THEN** SHALL ver únicamente las áreas autorizadas por sus permisos efectivos, con la misma política aplicada en escritorio

### Requirement: Listas y tablas adaptables
En escritorio y tableta, las listas operativas SHALL presentarse como una tabla contenida en un panel, con filas separadas por líneas finas, cabecera de columnas visible sobre fondo suave, columnas de ancho estable y alineación que permita comparar valores. La altura de fila y el espacio interior SHALL seguir la escala de `DESIGN.md`, sin la densidad compacta de la dirección anterior. En tableta SHALL priorizar las columnas esenciales y agrupar los filtros secundarios bajo un control «Filtros». En teléfono cada registro SHALL mostrarse como una fila de dos líneas con identificación, dato principal, estado y total, sin tarjetas grandes. La información secundaria SHALL quedar disponible en la ficha, sin desplazamiento horizontal de la página.

**Trazabilidad:** `RNF-USA-002`, `RNF-REN-005`; `DP-036`, regla 6; `DESIGN.md`, «Patrones»; secciones 4 y 10 de `interfaz-y-navegacion.md`.

#### Scenario: Lista extensa en teléfono
- **WHEN** una lista con varias columnas se presenta en un ancho de 360 px
- **THEN** cada fila SHALL mostrar identificación, dato principal, estado y total en dos líneas, y SHALL abrir la ficha para consultar el resto

#### Scenario: Lista tabular en escritorio
- **WHEN** existe espacio suficiente para las columnas relevantes
- **THEN** la tabla SHALL mostrar cabeceras, columnas alineadas, importes con cifras de ancho uniforme y filas sin sombras por registro

#### Scenario: Escala mayor en anchos intermedios
- **DADO** una tabla con muchas columnas en 1024 o 1280 px
- **CUANDO** se muestra con la escala de letra nueva
- **ENTONCES** SHALL priorizar columnas o redistribuirlas sin desplazamiento horizontal de la página y sin solapar acciones

#### Scenario: Contenido largo en una fila
- **WHEN** un nombre, correo, identificador o estado excede el espacio previsto
- **THEN** SHALL truncarse con acceso al valor completo o redistribuirse, sin solapar acciones ni romper la página

### Requirement: Navegación y densidad en reemplazo

La densidad de esta spec queda resuelta por la dirección «Grafito y cobre» desde este cambio. La navegación agrupada por área de trabajo sigue **en reemplazo** por `DP-036`, regla 5: U4 reorganiza el menú y hasta entonces sigue vigente. Los requisitos de tamaños de pantalla, teclado, controles táctiles, movimiento, modales y permisos de la navegación SHALL seguir vigentes sin cambio.

Trazabilidad: `DP-036`, reglas 5, 6 y 8; `interfaz-y-navegacion.md` §2.1 y §2.2; `docs/cambios-pendientes.md`, U3 y U4.

#### Scenario: Menú antes de U4
- **DADO** U4 sin archivar
- **CUANDO** un cambio agrega una entrada a la navegación
- **ENTONCES** SHALL ubicarla en los grupos vigentes y respetar los permisos efectivos.

#### Scenario: Requisito de accesibilidad
- **DADO** el requisito de controles táctiles de al menos 44 px o el de operación con teclado
- **CUANDO** se reorganiza la navegación o se cambia la escala visual
- **ENTONCES** SHALL seguir cumpliéndose.
