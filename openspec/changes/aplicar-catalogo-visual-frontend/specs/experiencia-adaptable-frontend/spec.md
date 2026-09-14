## MODIFIED Requirements

### Requirement: Navegación lateral adaptable y autorizada
La navegación principal SHALL presentarse como barra lateral desplegada de 218 px en escritorio amplio, usando el grupo `4:233`, el fondo `4:234` y la selección activa `4:329` del frame Dashboard `4:2`. En tableta SHALL usar la variante compacta de 80 px del frame `4:344`, y en teléfono SHALL presentarse como panel temporal. En todos los tamaños SHALL conservar la ruta activa, el acceso a inicio, la identidad del usuario y únicamente las opciones permitidas por sus roles. El cambio de variante SHALL NOT modificar destinos, permisos ni el contenido funcional de la página.

Los breakpoints no proceden de Figma: para esta aplicación, escritorio amplio SHALL corresponder a 1280 px o más, tableta a un ancho desde 768 px y menor de 1280 px, y teléfono a menos de 768 px.

**Trazabilidad:** `CT-001`, `RNF-SEG-003`, `RNF-USA-001`, `RNF-USA-007`; secciones 2 y 10 de `interfaz-y-navegacion.md`; frames `4:2` y `4:344`; elección explícita del usuario del 2026-09-14.

#### Scenario: Navegación desplegada en escritorio amplio
- **GIVEN** una ventana de al menos 1280 px de ancho
- **WHEN** un usuario accede a una pantalla autenticada
- **THEN** SHALL ver una barra lateral blanca de 218 px con icono y etiqueta de cada destino autorizado, identidad de la aplicación, usuario actual y cierre de sesión
- **AND** el contenido principal SHALL comenzar después de la barra con una separación equivalente a la composición de `4:2`

#### Scenario: Cambio de tamaño con una ruta activa
- **WHEN** la interfaz cambia entre escritorio amplio, tableta y teléfono mientras una pantalla está abierta
- **THEN** SHALL conservar la ruta activa y SHALL mostrar su posición dentro de la navegación disponible

#### Scenario: Navegación compacta en tableta
- **GIVEN** una ventana desde 768 px y menor de 1280 px
- **WHEN** no existe espacio suficiente para mantener etiquetas y contenido legibles simultáneamente
- **THEN** la barra lateral SHALL usar la variante compacta de 80 px y sus controles SHALL conservar nombre accesible y estado activo reconocible

#### Scenario: Navegación en teléfono
- **GIVEN** una ventana menor de 768 px
- **WHEN** un usuario abre la navegación temporal y elige una opción
- **THEN** SHALL llegar a la pantalla seleccionada y el panel SHALL cerrarse sin bloquear el contenido

#### Scenario: Navegación según permisos
- **WHEN** un **Vendedor** o **Encargado del taller** utiliza cualquier dispositivo
- **THEN** SHALL ver únicamente las áreas autorizadas por sus permisos efectivos, con la misma política aplicada en escritorio

#### Scenario: Texto largo en la navegación desplegada
- **GIVEN** un nombre de aplicación, usuario, rol u opción de navegación más largo que el espacio disponible
- **WHEN** se muestra la barra lateral desplegada
- **THEN** el contenido SHALL permanecer legible o truncado con acceso a su valor completo y SHALL NOT solaparse con iconos, acciones ni el área principal

[Referencia terminológica](spec-glossary-reference.md).
