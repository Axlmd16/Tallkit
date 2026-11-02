# catalogo-visual-reutilizable Specification

## Purpose
Documentar y demostrar de forma aislada los componentes y patrones reutilizables del sistema visual Tallkit, con procedencia, variantes, criterios de aceptación y validación adaptable verificables.

## Requirements

### Requirement: CVR-01 Procedencia verificable y cobertura del catálogo

El catálogo SHALL documentar cada componente y patrón Tallkit con:
- un identificador estable;
- el tablero de la maqueta que lo origina, o la indicación de que es una adaptación del proyecto;
- los tokens que usa;
- sus variantes y estados;
- las pantallas que lo consumen.

SHALL cubrir los fundamentos, los componentes compartidos y los patrones de `patrones-de-pantalla-frontend`. SHALL NOT atribuir un componente a una plantilla de terceros.

Trazabilidad: decisión 1 del proposal; RNF-MAN-003/005; sistema-visual-frontend.

#### Scenario: Consulta de procedencia

- **GIVEN** un componente del catálogo
- **WHEN** el revisor consulta su ficha
- **THEN** encuentra el tablero de la maqueta o la adaptación que lo justifica, sus variantes, sus tokens y sus criterios de aceptación

#### Scenario: Componente sin tablero en la maqueta

- **GIVEN** un componente necesario que la maqueta no dibuja
- **WHEN** se registra su ficha
- **THEN** se identifica como adaptación del proyecto construida con los tokens Tallkit

### Requirement: CVR-02 Identidad visual y recursos locales

El catálogo SHALL usar exclusivamente los tokens, la tipografía IBM Plex y la iconografía del sistema Tallkit, servidos desde la instalación local. Los contenidos de demostración SHALL ser neutrales o datos ficticios del taller identificados como ejemplo, y SHALL NOT contener marcas, logotipos, ilustraciones, fotografías ni textos de plantillas de terceros.

Trazabilidad: RNF-USA-006/008/009, RNF-DIS-001; sistema-visual-frontend.

#### Scenario: Demostración sin contenido de terceros

- **GIVEN** un patrón del catálogo
- **WHEN** se muestra su ejemplo
- **THEN** usa la identidad Tallkit con contenido de ejemplo y no muestra recursos ni datos de la plantilla retirada

#### Scenario: Red local sin Internet

- **GIVEN** el catálogo disponible localmente
- **WHEN** se bloquean las solicitudes externas
- **THEN** las fuentes, los iconos, los controles y las superficies permanecen disponibles

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

El catálogo SHALL mostrar:
- la navegación desplegada de escritorio, la compacta de tableta y el panel de teléfono, con selección activa;
- la barra superior;
- las composiciones de lista, ficha, formulario por secciones, modal y editor con vista previa.

La navegación SHALL recibir únicamente las opciones que le suministra el consumidor y SHALL NOT decidir permisos ni destinos de negocio.

Trazabilidad: RNF-USA-001/002/007; experiencia-adaptable-frontend; patrones-de-pantalla-frontend.

#### Scenario: Variantes de navegación

- **GIVEN** opciones de ejemplo y una selección activa
- **WHEN** se alterna entre navegación desplegada, compacta y de teléfono
- **THEN** se conservan la selección y el nombre accesible de cada opción, y el panel de teléfono se cierra al elegir una

#### Scenario: Composición estrecha

- **GIVEN** una ficha con columna lateral
- **WHEN** el espacio deja de permitir dos regiones legibles
- **THEN** el contenido se reorganiza sin perder información ni ocultar acciones

### Requirement: CVR-05 Controles y formularios accesibles

El catálogo SHALL incluir:
- acciones principales, secundarias, discretas, destructivas y de peligro sólido;
- botones de icono con ayuda emergente;
- campo con etiqueta, ayuda, obligatoriedad y error;
- entrada, selector, casilla, búsqueda, entrada multilínea, contraseña, fecha e importe con moneda;
- combobox con resultados flotantes;
- selección segmentada, pestañas y etiquetas removibles.

Los estados disponible, enfocado, seleccionado, deshabilitado, inválido y procesando SHALL ser distinguibles y poder probarse de forma aislada.

Trazabilidad: RNF-USA-004/006/007/008/011; patrones-de-pantalla-frontend PPF-03 y PPF-04.

#### Scenario: Campo inválido sin pérdida de valor

- **GIVEN** un campo con contenido y un error de ejemplo
- **WHEN** se muestra su estado inválido
- **THEN** conserva el valor y asocia etiqueta, ayuda y mensaje de error de forma accesible

#### Scenario: Acción ocupada o deshabilitada

- **GIVEN** un botón procesando o deshabilitado
- **WHEN** se intenta activarlo repetidamente
- **THEN** no vuelve a ejecutar su acción y comunica su estado

#### Scenario: Combobox mediante teclado

- **GIVEN** un combobox con resultados de ejemplo
- **WHEN** se usa únicamente el teclado
- **THEN** se puede abrir, recorrer con flechas, elegir con Enter y cerrar con Escape, y se reconocen el foco y la opción activa

### Requirement: CVR-06 Tarjetas, tablas y listas

El catálogo SHALL mostrar:
- paneles con cabecera;
- tablas contenidas con encabezado visible, filas compactas, orden, paginación, acciones por fila y menú contextual;
- filas compactas de teléfono;
- estados con marcador;
- las piezas del taller: placa, código de repuesto, existencias e importes.

Los datos, la selección, el orden y la página SHALL venir del consumidor. El catálogo SHALL NOT definir reglas de consulta, paginación remota ni estados de negocio.

Trazabilidad: RNF-USA-002/006/007/011; interfaz-y-navegacion, sección 4; sistema-visual-frontend, «Piezas visuales propias del taller».

#### Scenario: Fila con datos largos y acciones

- **GIVEN** filas de ejemplo con textos extensos y acciones
- **WHEN** se reduce la pantalla a 360 px
- **THEN** se conservan los datos prioritarios y las acciones, con acceso al resto y sin desbordamiento horizontal de la página

#### Scenario: Selección y paginación controladas

- **GIVEN** una tabla con varias páginas de ejemplo
- **WHEN** se cambia el orden o la página
- **THEN** la demostración comunica el cambio, conserva los encabezados e impide avanzar fuera de los límites suministrados

### Requirement: CVR-07 Superposiciones y confirmaciones

El catálogo SHALL ofrecer:
- modal de formulario corto;
- diálogo de confirmación con revisión;
- diálogo de registro de dinero;
- diálogo de acción destructiva;
- menú contextual;
- notificación temporal con sus variantes y su pila.

Cada superposición modal SHALL tener nombre accesible, foco inicial, contención de foco, fondo no interactivo y retorno al disparador. Cerrar con cambios SHALL exigir la decisión explícita de seguir editando o descartar. El catálogo SHALL NOT ofrecer paneles laterales de edición.

Trazabilidad: RNF-USA-003/005/007/008; patrones-de-pantalla-frontend PPF-04, PPF-06 y PPF-08; experiencia-adaptable-frontend.

#### Scenario: Cierre de superposición

- **GIVEN** un modal abierto mediante teclado
- **WHEN** se cierra con Escape o con su control de cierre
- **THEN** desaparece y el foco vuelve al disparador sin dejar bloqueado el desplazamiento de la página

#### Scenario: Aviso de edición local

- **GIVEN** un modal con valores de ejemplo modificados
- **WHEN** se solicita cerrarlo
- **THEN** ofrece seguir editando o descartar, sin perder valores antes de la elección

#### Scenario: Notificaciones de ejemplo

- **GIVEN** la demostración de notificaciones temporales
- **WHEN** se generan cuatro seguidas
- **THEN** se ven como máximo tres, la más reciente abajo, y cada una se pausa al pasar el puntero

### Requirement: CVR-09 Estados y layouts de autenticación neutrales

El catálogo SHALL mostrar como estados diferentes la carga con marcadores de posición, el vacío inicial, sin resultados, el error recuperable y sin permiso. SHALL mostrar la composición de acceso con la marca Tallkit, sin registro público, acceso social ni recuperación real.

Trazabilidad: CT-001; RNF-USA-004/006/008; patrones-de-pantalla-frontend PPF-07; sistema-visual-frontend.

#### Scenario: Consulta sin resultados y error

- **GIVEN** una lista de demostración con filtros
- **WHEN** se alterna entre sin resultados y error
- **THEN** el primer estado ofrece limpiar filtros y el segundo reintentar, sin confundirlos con una lista vacía inicial

#### Scenario: Composición de acceso

- **GIVEN** el ejemplo de acceso
- **WHEN** se activa su botón
- **THEN** solo aparece retroalimentación local, sin autenticar, registrar personas ni enviar correo

### Requirement: CVR-10 Validación adaptable y accesible

Cada variante SHALL poder revisarse a 360, 768, 1024, 1280 y 1440 px, con textos largos y estados relevantes. SHALL cumplir:
- controles táctiles de al menos 44 × 44 px y 8 px de separación activable;
- foco visible;
- contraste AA evaluado;
- estados redundantes al color;
- movimiento reducido.

La densidad de escritorio SHALL NOT justificar recortes, texto ilegible ni controles inoperables.

Trazabilidad: RNF-USA-001/002/006/007/008; RNF-COM-001/002; experiencia-adaptable-frontend.

#### Scenario: Dispositivo táctil y textos largos

- **GIVEN** una variante con puntero grueso y contenido extenso
- **WHEN** se revisa en los cinco anchos objetivo
- **THEN** conserva objetivos táctiles, lectura, acciones y foco, sin solapamientos ni desplazamiento horizontal de página

#### Scenario: Movimiento reducido

- **GIVEN** una preferencia de movimiento reducido
- **WHEN** se abre una variante o aparece una notificación
- **THEN** presenta el estado final sin animaciones no esenciales

### Requirement: CVR-11 Página interna de demostración y validación directa

La página interna SHALL permitir localizar cada pieza por identificador y familia, seleccionar variantes o estados y uno de los anchos 360, 768, 1024, 1280 o 1440 px, consultar su tablero de origen, sus criterios de aceptación y sus diferencias conocidas, y restablecer ejemplos deterministas. El catálogo SHALL apoyar la validación directa del usuario en la aplicación. Las capturas son opcionales; cuando se generen, SHALL permanecer fuera del repositorio conforme a AGENTS.md.

Trazabilidad: RNF-MAN-003/005; sistema-visual-frontend, «Validación visual contra la maqueta Tallkit».

#### Scenario: Reproducción de un ejemplo

- **GIVEN** un identificador de componente, variante, estado y tamaño registrados
- **WHEN** otro revisor abre el ejemplo y lo restablece
- **THEN** obtiene la misma composición y puede consultar su tablero de origen, sus criterios de aceptación y sus diferencias conocidas

#### Scenario: Validación directa sin paquete de evidencias

- **GIVEN** los ejemplos deterministas y las pantallas funcionales disponibles
- **WHEN** el usuario decide revisarlos directamente
- **THEN** puede validar el resultado sin que el sistema exija generar capturas comparativas
