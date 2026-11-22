## MODIFIED Requirements

### Requirement: Navegación lateral adaptable y autorizada
La navegación principal SHALL presentarse:
- **Escritorio, desde 1280 px:** barra lateral grafito de unos 264 px con el logotipo, las nueve entradas de `navegacion-de-uso-diario`, cada una con icono y etiqueta, y la opción activa con fondo destacado y una barra de acento cobre. Al pie SHALL mostrarse el motivo del tacómetro como decoración, sin interferir con las opciones ni anunciarse a las tecnologías de asistencia.
- **Tableta, de 768 a 1279 px:** barra compacta grafito de iconos con nombre accesible, ayuda emergente y el mismo tratamiento de la opción activa.
- **Teléfono, por debajo de 768 px:** panel temporal que se abre desde la barra superior.

En todos los tamaños SHALL conservar el logotipo Tallkit, la ruta activa, el acceso a inicio, la identidad del usuario y únicamente las opciones permitidas por sus roles. Las entradas SHALL ser las de `navegacion-de-uso-diario`, sin grupos plegables.

**Trazabilidad:** `CT-001`, `RNF-SEG-003`, `RNF-USA-001`, `RNF-USA-007`; `DP-036`, reglas 1 y 6; decisión D3 de la propuesta; `DESIGN.md`, «Marco»; secciones 2 y 10 de `interfaz-y-navegacion.md`; `navegacion-de-uso-diario`.

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

### Requirement: Navegación y densidad en reemplazo

La densidad de esta spec queda resuelta por la dirección «Grafito y cobre». La navegación agrupada por área de trabajo queda reemplazada por el menú de nueve entradas de `navegacion-de-uso-diario` (`DP-036`, regla 1). Los requisitos de tamaños de pantalla, teclado, controles táctiles, movimiento, modales y permisos de la navegación SHALL seguir vigentes sin cambio.

Trazabilidad: `DP-036`, reglas 1, 6 y 8; `interfaz-y-navegacion.md` §2.1 y §2.2; `docs/cambios-pendientes.md`, U3 y U4.

#### Scenario: Entrada nueva en el menú
- **DADO** un cambio posterior que agrega una pantalla a la navegación
- **CUANDO** se define su ubicación
- **ENTONCES** SHALL ubicarse dentro de una de las nueve entradas vigentes y respetar los permisos efectivos, salvo que un cambio apruebe una entrada nueva.

#### Scenario: Requisito de accesibilidad
- **DADO** el requisito de controles táctiles de al menos 44 px o el de operación con teclado
- **CUANDO** se reorganiza la navegación o se cambia la escala visual
- **ENTONCES** SHALL seguir cumpliéndose.
