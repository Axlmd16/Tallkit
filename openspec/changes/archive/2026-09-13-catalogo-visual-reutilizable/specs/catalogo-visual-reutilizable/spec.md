## ADDED Requirements

### Requirement: CVR-01 Procedencia verificable y cobertura del catálogo

El catálogo SHALL documentar cada componente y variante con identificador estable, fuente estructurada, frame y node ID, tokens, estado de evidencia, relación con piezas existentes y prioridad. SHALL cubrir los patrones reutilizables de los 22 frames de la matriz de diseño. Una variante sin evidencia explícita SHALL identificarse como adaptación requerida por el proyecto y SHALL NOT atribuirse a un nodo inventado.

Trazabilidad: petición actual; RNF-MAN-003/005; sistema-visual-frontend, referencias estructuradas.

#### Scenario: Consulta de procedencia

- **GIVEN** un componente del catálogo
- **WHEN** el revisor consulta su ficha
- **THEN** encuentra su fuente Figma verificable o la indicación explícita de adaptación del proyecto, sus variantes y criterios de aceptación

#### Scenario: Referencia insuficiente

- **GIVEN** una variante móvil o estado sin propiedades estructuradas disponibles
- **WHEN** se registra su ficha
- **THEN** se distingue lo observado de lo recomendado, sin presentar capturas o inferencias como tokens de Figma

### Requirement: CVR-02 Identidad visual y recursos locales

El catálogo SHALL conservar paleta, dimensiones, tipografía, geometría y elevaciones verificadas para cada patrón, salvo adaptaciones documentadas exigidas por las specs aprobadas. SHALL usar recursos esenciales locales y SHALL NOT contener marca, logotipos, ilustraciones, fotografías, personas, productos, textos ni datos de la plantilla. Los contenidos de demostración SHALL ser neutrales y explícitamente sintéticos.

Trazabilidad: RNF-USA-006/008/009, RNF-DIS-001, sistema-visual-frontend; petición actual.

#### Scenario: Demostración sin contenido de la plantilla

- **GIVEN** una composición derivada de un frame
- **WHEN** se muestra en el catálogo
- **THEN** conserva sus patrones visuales con contenido neutral y no muestra recursos o datos excluidos

#### Scenario: Red local sin Internet

- **GIVEN** el catálogo disponible localmente
- **WHEN** se bloquean solicitudes externas
- **THEN** las fuentes, iconos, controles y superficies permanecen disponibles sin depender de URLs temporales de Figma

### Requirement: CVR-03 Aislamiento de la aplicación funcional

El catálogo SHALL ser una superficie exclusiva de desarrollo y prueba, sin enlaces desde la navegación funcional y sin disponibilidad en la entrega productiva. Sus interacciones SHALL limitarse a estado local de demostración. SHALL NOT modificar rutas actuales, permisos, API, autenticación, datos persistidos o resultados de Usuarios, Auditoría, Login, Clientes, Vehículos ni otras páginas existentes. La incorporación de un componente SHALL conservar el comportamiento y apariencia de sus consumidores actuales.

Trazabilidad: CT-001; RNF-SEG-002/003/005; RNF-MAN-001; ADR-0001/0003; petición actual.

#### Scenario: Interacción de demostración

- **GIVEN** un ejemplo de formulario, calendario, tablero o conversación
- **WHEN** se activa una acción en el catálogo
- **THEN** solo cambia su estado local y no se envían solicitudes de negocio ni se navega a una ruta funcional

#### Scenario: Entrega productiva

- **GIVEN** una compilación para producción
- **WHEN** se solicita la ubicación del catálogo o se inspeccionan sus recursos
- **THEN** no se muestra la demostración ni se incluyen sus fixtures o entrada ejecutable

#### Scenario: Componentes actuales protegidos

- **GIVEN** una variante nueva disponible en el catálogo
- **WHEN** se recorren las páginas actuales
- **THEN** conservan apariencia, rutas, validaciones y permisos anteriores sin adoptar automáticamente la variante nueva

### Requirement: CVR-04 Navegación y composición reutilizables

El catálogo SHALL mostrar navegación expandida y plegada observadas en Figma, navegación móvil como adaptación, selección activa, cabeceras, barras de herramientas y composiciones de dashboard, lista-detalle, formulario y vista previa. La navegación SHALL recibir únicamente opciones suministradas por el consumidor y SHALL NOT decidir permisos o destinos de negocio.

Trazabilidad: RNF-USA-001/002/007; experiencia-adaptable-frontend; frames 4:344, 4:2, 4:2803, 4:4239.

#### Scenario: Variantes de navegación

- **GIVEN** opciones neutrales y una selección activa
- **WHEN** se alterna entre navegación expandida, plegada y móvil
- **THEN** se conserva la selección y el nombre accesible de cada opción, y el panel móvil se cierra al elegir una

#### Scenario: Composición estrecha

- **GIVEN** una vista con contenido y panel auxiliar
- **WHEN** el espacio deja de permitir dos regiones legibles
- **THEN** el contenido se reorganiza sin perder información ni ocultar controles

### Requirement: CVR-05 Controles y formularios accesibles

El catálogo SHALL incluir acciones primarias, secundarias, discretas y destructivas; botones con icono y agrupaciones; campo con etiqueta, ayuda y error; entrada, selector, checkbox, búsqueda, entrada multilínea, contraseña y control de fecha; pestañas y selección segmentada. Los estados disponibles, enfocados, seleccionados, deshabilitados, inválidos y procesando SHALL ser distinguibles y probables aisladamente. Los estados no observados SHALL conservar la semántica aprobada del proyecto.

Trazabilidad: RNF-USA-004/006/007/008/011; patrones de formulario vigentes; frames 4:3258, 4:4981, 4:5816, 4:8584 y 4:7725.

#### Scenario: Campo inválido sin pérdida de valor

- **GIVEN** un campo con contenido neutral y error de ejemplo
- **WHEN** se muestra su estado inválido
- **THEN** conserva el valor y asocia etiqueta, ayuda y mensaje de error de forma accesible

#### Scenario: Acción ocupada o deshabilitada

- **GIVEN** un botón procesando o deshabilitado
- **WHEN** se intenta activarlo repetidamente
- **THEN** no vuelve a ejecutar su acción y comunica su estado

#### Scenario: Selección mediante teclado

- **GIVEN** pestañas, un menú o selector en la demostración
- **WHEN** se usa únicamente el teclado
- **THEN** se puede abrir, recorrer, seleccionar y cerrar conforme al rol del control y reconocer el foco y la selección

### Requirement: CVR-06 Tarjetas, tablas y listas

El catálogo SHALL mostrar superficies, tarjetas métricas y de detalle, avatares neutrales y grupos, tablas de filas separadas y tablas contenidas, listas adaptables, paginación, badges, acciones de fila y menú contextual. Los datos, selección, orden y página SHALL ser suministrados por el consumidor; el catálogo SHALL NOT definir reglas de consulta, paginación remota ni estados de negocio.

Trazabilidad: RNF-USA-002/006/007/011; interfaz-y-navegacion, sección 4; frames 4:2, 4:660, 4:1140, 4:1635, 4:2803, 4:4567, 4:6241.

#### Scenario: Fila con datos largos y acciones

- **GIVEN** filas neutrales con textos extensos y acciones
- **WHEN** se reduce la pantalla a 360 px
- **THEN** se conservan datos prioritarios y acciones, con acceso al resto sin desbordamiento horizontal de la página

#### Scenario: Selección y paginación controladas

- **GIVEN** una tabla con selección parcial y varias páginas neutrales
- **WHEN** se cambia selección, orden o página
- **THEN** la demostración comunica el cambio, conserva encabezados comprensibles e impide avanzar fuera de los límites suministrados

### Requirement: CVR-07 Superposiciones y confirmaciones

El catálogo SHALL ofrecer detalle lateral no modal, **Drawer**, modal central y composiciones de confirmación y resultado. Cada superposición modal SHALL tener nombre accesible, foco inicial, contención de foco, fondo no interactivo y retorno al disparador; cerrar SHALL conservar o descartar cambios solo mediante la decisión local explícita correspondiente. El detalle no modal SHALL NOT bloquear la navegación del contenido vecino.

Trazabilidad: RNF-USA-003/005/007/008; experiencia-adaptable-frontend; frames 4:2803, 4:3258, 4:4981, 4:5816, 4:9302, 4:9333.

#### Scenario: Cierre de superposición

- **GIVEN** un modal abierto mediante teclado
- **WHEN** se cierra con Escape o su control de cierre
- **THEN** desaparece y el foco vuelve al disparador sin dejar bloqueado el desplazamiento de la página

#### Scenario: Aviso de edición local

- **GIVEN** un drawer con valores de demostración modificados
- **WHEN** se solicita cerrarlo
- **THEN** ofrece continuar editando o descartar, sin perder valores antes de la elección

#### Scenario: Superposición sin controles y superposiciones anidadas

- **GIVEN** un modal sin controles o una confirmación sobre un drawer
- **WHEN** se recorre mediante teclado
- **THEN** el foco permanece en la superficie modal superior, con destino inicial válido, y al cerrar se restablece la superficie anterior

### Requirement: CVR-08 Patrones visuales especializados sin negocio

El catálogo SHALL demostrar contenedores y representaciones de línea/área, anillo, barras, leyendas y progreso; calendario mensual, anual, diario y compacto; cronograma; tablero con columnas y tarjetas; lista de conversación, burbujas y composición de entrada. SHALL usar series y fechas neutrales suministradas y proporcionar alternativa textual accesible para gráficos. SHALL NOT implementar agenda, mensajería, asignación de trabajos, facturación, cálculos económicos ni persistencia.

Trazabilidad: petición actual; RNF-MAN-001/002; RNF-USA-001/006/007/008; frames 4:2246, 4:3637, 4:3942, 4:5455, 4:6577, 4:7438 y gráficos de 4:2/4:2803/4:4567.

#### Scenario: Serie neutral y sin datos

- **GIVEN** un gráfico con serie sintética o sin serie
- **WHEN** se alterna el ejemplo
- **THEN** muestra la representación y su alternativa textual o un estado vacío explícito sin inventar resultados del taller

#### Scenario: Fecha seleccionada y cambio de vista

- **GIVEN** una fecha neutral seleccionada
- **WHEN** se cambia entre calendario mensual, anual y diario
- **THEN** conserva el contexto de fecha, distingue selección y fecha actual y no crea eventos reales

#### Scenario: Tablero y conversación aislados

- **GIVEN** ejemplos neutrales de tablero y conversación
- **WHEN** se activan sus controles
- **THEN** solo se demuestran selección y composición local, sin envío real, carga de archivos ni modificación de tareas del taller

### Requirement: CVR-09 Estados y layouts de autenticación neutrales

El catálogo SHALL mostrar carga, vacío, error recuperable, éxito y sin resultados como estados diferentes. SHALL mostrar composiciones de acceso corta y extensa, recuperación y confirmación derivadas de los frames, sin registro público, login social ni recuperación real. SHALL NOT reutilizar las ilustraciones del diálogo existente en esos ejemplos.

Trazabilidad: CT-001; RNF-USA-004/006/008; sistema-visual-frontend; frames 4:8584, 4:7725, 4:9302, 4:9333.

#### Scenario: Consulta sin resultados y error

- **GIVEN** una lista de demostración con filtros
- **WHEN** se alterna entre sin resultados y error
- **THEN** el primer estado ofrece limpiar filtros y el segundo reintentar, sin confundirlos con una lista vacía inicial

#### Scenario: Composiciones de acceso

- **GIVEN** el ejemplo de formulario corto, extenso o resultado
- **WHEN** se activa su botón
- **THEN** solo aparece retroalimentación neutral local sin autenticar, registrar personas o enviar correo

### Requirement: CVR-10 Validación adaptable y accesible

Cada variante SHALL poder revisarse a 360, 768, 1024 y 1440 px, con textos largos y estados relevantes; controles táctiles de al menos 44 × 44 px y 8 px de separación activable conforme a la spec vigente; foco visible, contraste AA evaluado, estados redundantes al color y movimiento reducido. La fidelidad al desktop SHALL NOT justificar recortes, texto ilegible o controles inoperables.

Trazabilidad: RNF-USA-001/002/006/007/008; RNF-COM-001/002; experiencia-adaptable-frontend.

#### Scenario: Dispositivo táctil y textos largos

- **GIVEN** una variante con puntero grueso y contenido extenso
- **WHEN** se revisa en los cuatro anchos objetivo
- **THEN** conserva objetivos táctiles, lectura, acciones y foco sin solapamientos ni scroll horizontal de página

#### Scenario: Movimiento reducido

- **GIVEN** una preferencia de movimiento reducido
- **WHEN** se abre o cambia una variante
- **THEN** presenta el estado final sin animaciones no esenciales

### Requirement: CVR-11 Página interna de demostración y aceptación por fases

La página interna SHALL permitir localizar cada pieza por identificador y familia, seleccionar variantes y estados, consultar fuentes y restablecer ejemplos deterministas. Cada fase SHALL entregar pruebas y capturas comparativas al tamaño nativo del frame o recorte equivalente, con adaptaciones y regiones excluidas explícitas. Los resultados técnicos SHALL NOT sustituir la aceptación visual humana. Las referencias y capturas generadas SHALL permanecer fuera del repositorio conforme a AGENTS.md.

Trazabilidad: RNF-MAN-003/005; aceptación visual de sistema-visual-frontend; petición actual.

#### Scenario: Reproducción de un ejemplo

- **GIVEN** un identificador de componente, variante, estado y viewport registrados
- **WHEN** otro revisor abre el ejemplo y lo restablece
- **THEN** obtiene la misma composición neutral y puede consultar sus referencias y diferencias conocidas

#### Scenario: Diferencia visual detectada

- **GIVEN** una comparación con desviaciones no justificadas
- **WHEN** las pruebas unitarias y de accesibilidad pasan
- **THEN** la fase conserva la diferencia abierta y no se declara visualmente aceptada hasta corregirla o recibir aceptación explícita de la adaptación

[Referencia terminológica](spec-glossary-reference.md).
