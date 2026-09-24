# patrones-de-pantalla-frontend Specification

## Purpose
Definir composiciones reutilizables para listas, fichas, formularios, editores, diálogos, estados de contenido y notificaciones de la interfaz Tallkit.

## Requirements

### Requirement: PPF-01 Patrón de lista
Toda pantalla de consulta de registros SHALL componerse de:
- encabezado con título, contexto breve y acción principal de creación cuando el usuario tenga permiso;
- franja de búsqueda y filtros con etiquetas claras y acción para limpiarlos;
- panel con una tabla densa cuyo encabezado permanece visible;
- conteo de resultados y paginación del servidor.

Cada fila SHALL mostrar su estado mediante texto y distintivo, y ofrecer sus acciones según estado y permiso. Al volver desde una ficha, la lista SHALL conservar búsqueda, filtros, orden y página.

**Trazabilidad:** `RNF-USA-002`, `RNF-USA-006`, `RNF-USA-011`; sección 4 de `interfaz-y-navegacion.md`; tablero «Lista de ventas» de la maqueta Tallkit.

#### Scenario: Consulta con filtros y regreso desde la ficha
- **GIVEN** una lista con un filtro de estado aplicado, un texto de búsqueda y la página 3 abierta
- **WHEN** el usuario abre la ficha de un registro y vuelve a la lista
- **THEN** la lista SHALL mostrar el mismo filtro, el mismo texto, el mismo orden y la página 3

#### Scenario: Usuario sin permiso de creación
- **WHEN** un usuario sin permiso para crear abre la lista
- **THEN** SHALL NOT ver la acción principal de creación, y la lista y sus filtros SHALL seguir disponibles

#### Scenario: Importes y códigos en la tabla
- **WHEN** la tabla muestra importes, cantidades, códigos o números internos
- **THEN** los importes y cantidades SHALL alinearse a la derecha con cifras de ancho uniforme, y los códigos y números internos SHALL usar la tipografía monoespaciada

### Requirement: PPF-02 Patrón de ficha de detalle
La ficha de un registro SHALL presentar:
- un control para volver al origen;
- un resumen superior con la identificación principal (por ejemplo placa, código o número interno) y el estado;
- el contenido en bloques con título;
- en escritorio, una columna lateral con las acciones disponibles y los datos relacionados.

Las acciones SHALL depender del estado del registro y de los permisos que entrega el servidor.

**Trazabilidad:** `RNF-USA-006`, `RNF-USA-010`; secciones 6 y 9 de `interfaz-y-navegacion.md`; tablero «Ficha de vehículo».

#### Scenario: Ficha con acciones según estado
- **GIVEN** una venta confirmada y otra anulada
- **WHEN** el usuario abre cada ficha
- **THEN** SHALL ver en cada una solo las acciones que la sección 9 de `interfaz-y-navegacion.md` admite para su estado y que sus permisos autorizan

#### Scenario: Ficha en pantalla estrecha
- **WHEN** la ficha se abre en tableta o teléfono
- **THEN** la columna lateral SHALL reubicarse debajo del resumen o del contenido sin ocultar ninguna acción disponible

### Requirement: PPF-03 Formulario por secciones en página completa
Los formularios con secciones o con más de unos cuatro campos simples SHALL presentarse en página completa. Hoy son los de producto, cliente, vehículo, proveedor y configuración del taller, y los editores de ingreso y de venta.

Cada sección SHALL tener título y una explicación breve. Los campos obligatorios SHALL marcarse antes de enviar y los opcionales SHALL indicarlo. Una barra de acciones SHALL permanecer visible con la acción principal a la derecha.

**Trazabilidad:** `RNF-USA-004`, `RNF-USA-005`, `RNF-USA-007`; sección 5 de `interfaz-y-navegacion.md`; decisión 12 del proposal; tablero «Nuevo producto».

#### Scenario: Envío con varios errores
- **WHEN** el usuario guarda un formulario con dos campos inválidos
- **THEN** cada error SHALL aparecer junto a su campo con su corrección, un resumen SHALL aparecer al inicio y los valores ingresados SHALL conservarse

#### Scenario: Abandono con cambios sin guardar
- **GIVEN** un formulario con valores modificados y sin guardar
- **WHEN** el usuario intenta salir de la página
- **THEN** la interfaz SHALL advertir de los cambios y SHALL permitir seguir editando o descartar

#### Scenario: Doble envío
- **WHEN** el usuario activa guardar mientras un envío anterior sigue en proceso
- **THEN** la acción SHALL mostrarse en proceso y SHALL NOT enviar una segunda solicitud

### Requirement: PPF-04 Formulario corto en modal
Los formularios de hasta unos cuatro campos simples y sin secciones SHALL presentarse en un modal sobre la pantalla de origen, sin navegar a otra página. También SHALL presentarse en modal un formulario sin secciones que, en página completa, dejaría la mayor parte del espacio vacío. Hoy son los de marca de vehículo, marca de producto, categoría de producto, unidad de medida, servicio, ajuste de inventario y usuario, este último con sus datos y la selección de roles.

El modal SHALL tener:
- título y contexto breve;
- control de cierre;
- cuerpo con los campos;
- pie con Cancelar y la acción principal a la derecha.

Cuando el formulario lo permita, el pie SHALL ofrecer también «Guardar y crear otro». Al guardar, el modal SHALL cerrarse, la lista de origen SHALL reflejar el cambio y SHALL mostrarse una notificación temporal.

Los paneles laterales (drawer) SHALL NOT usarse para crear ni editar.

**Trazabilidad:** decisiones 6 y 12 del proposal y decisión del usuario sobre el formulario de usuario (aprobación de specs, 2026-09-21); `RNF-USA-004`, `RNF-USA-005`, `RNF-USA-007`; tablero «Formulario corto en modal».

#### Scenario: Crear una marca sin salir de la lista
- **GIVEN** la lista de marcas de vehículo abierta con permiso de creación
- **WHEN** el usuario elige «Nueva marca», escribe el nombre y guarda
- **THEN** el modal SHALL cerrarse, la lista SHALL mostrar la nueva marca y SHALL aparecer una notificación temporal de creación

#### Scenario: Guardar y crear otro
- **WHEN** el usuario elige «Guardar y crear otro» con datos válidos
- **THEN** el registro SHALL guardarse, el modal SHALL permanecer abierto con los campos vacíos y el foco SHALL volver al primer campo

#### Scenario: Cerrar con cambios sin guardar
- **GIVEN** un modal con valores modificados
- **WHEN** el usuario pulsa Escape, el control de cierre o Cancelar
- **THEN** la interfaz SHALL advertir de los cambios y SHALL permitir seguir editando o descartar, sin perder los valores antes de esa elección

#### Scenario: Crear un usuario en modal
- **GIVEN** la lista de usuarios abierta por un **Administrador**
- **WHEN** elige crear un usuario
- **THEN** SHALL abrirse un modal con la identificación de acceso, los nombres, los apellidos, el correo opcional y la selección de roles, y SHALL NOT navegarse a otra página

#### Scenario: Error del servidor dentro del modal
- **WHEN** el servidor rechaza el guardado por un dato corregible
- **THEN** el modal SHALL permanecer abierto, el error SHALL aparecer junto al campo afectado y SHALL NOT mostrarse una notificación de éxito

### Requirement: PPF-05 Editor de documento con vista previa
Los editores de documentos económicos SHALL mostrar el formulario y una vista previa del documento interno como hoja imprimible. Hoy son la venta directa y el ingreso de mercadería.

La tabla de líneas SHALL:
- editarse fila por fila, sin tarjetas por línea;
- mostrar código, descripción y cantidad;
- mostrar precio, impuesto y total solo como valores del servidor, con guion cuando todavía no se han calculado.

El total de la operación SHALL estar visible junto a las acciones. La vista previa SHALL indicar que es un borrador, que el número está pendiente de confirmación y que el documento interno no constituye una factura electrónica autorizada por el SRI.

**Trazabilidad:** `DP-004`, `DP-017`, `DP-018`, `DP-025`, `DP-026`; `RNF-USA-010`, `RNF-USA-012`; secciones 7.1 y 11 de `interfaz-y-navegacion.md`; tablero «Nueva venta».

#### Scenario: Importe aún no calculado
- **WHEN** una línea tiene producto pero el servidor todavía no devolvió sus importes
- **THEN** precio, impuesto y total SHALL mostrarse con guion y SHALL NOT mostrarse ceros ni valores calculados por la interfaz

#### Scenario: Vista previa sin habilitar la confirmación
- **WHEN** la vista previa del borrador se actualiza con valores completos
- **THEN** la confirmación SHALL seguir requiriendo guardar el borrador y revisar la versión guardada

#### Scenario: Sin descuentos ni precio editable
- **WHEN** el usuario edita una línea de venta
- **THEN** SHALL NOT existir un campo de descuento ni un campo para editar precio o impuesto

#### Scenario: Existencias en la línea
- **WHEN** el editor muestra las existencias del producto elegido
- **THEN** SHALL mostrar la cantidad disponible y el estado «Agotado» cuando sea cero, y SHALL NOT clasificarla como baja mediante un umbral no decidido

### Requirement: PPF-06 Diálogos de confirmación
Las acciones de la sección 8.1 de `interfaz-y-navegacion.md` SHALL confirmarse en un diálogo. El diálogo SHALL:
- nombrar el objeto y su número interno cuando exista;
- indicar la entidad fiscal cuando la acción sea económica;
- explicar el efecto en el cuerpo;
- exigir el motivo cuando corresponda;
- mostrar los valores revisados por el servidor antes de habilitar la acción.

El botón principal SHALL usar un texto breve que nombre la acción, por ejemplo «Confirmar venta», «Registrar cobro» o «Anular venta». Las acciones destructivas SHALL usar el tratamiento de peligro, y la salida segura SHALL nombrarse con claridad, por ejemplo «Conservar venta».

**Trazabilidad:** `RNF-USA-003`, `RNF-USA-006`; sección 8.1 de `interfaz-y-navegacion.md` actualizada por la decisión 10; `DP-027`, `DP-028`; tablero «Diálogos de ventas».

#### Scenario: Confirmar una venta revisada
- **GIVEN** un borrador guardado cuya revisión del servidor está lista
- **WHEN** el usuario abre «Revisar y confirmar»
- **THEN** el diálogo SHALL mostrar base, impuesto y total del servidor, el efecto en existencias por producto y que el cobro se registra aparte, y SHALL habilitar «Confirmar venta»

#### Scenario: Revisión pendiente o rechazada
- **WHEN** la revisión del servidor no está lista o informa que no se puede confirmar
- **THEN** la acción principal SHALL permanecer deshabilitada y el diálogo SHALL explicar el motivo

#### Scenario: Anulación sin motivo
- **WHEN** el usuario intenta anular sin escribir el motivo
- **THEN** el diálogo SHALL mostrar el error junto al campo de motivo y SHALL NOT enviar la anulación

### Requirement: PPF-07 Estados de contenido
Cada panel que consulta datos SHALL distinguir, dentro del propio panel y sin reemplazar la página, los estados:
- **Carga:** con marcadores de posición.
- **Vacío inicial:** explica qué hacer y ofrece la acción de creación si hay permiso.
- **Sin resultados:** ofrece limpiar filtros.
- **Error:** conserva lo escrito y ofrece reintentar.
- **Sin permiso:** indica qué rol lo concede.

Ningún estado SHALL mostrar datos inventados.

**Trazabilidad:** `RNF-USA-004`, `RNF-USA-006`; sección 4 de `interfaz-y-navegacion.md`; tablero «Estados».

#### Scenario: Lista vacía frente a búsqueda sin resultados
- **WHEN** una lista no tiene registros y, en otro momento, un filtro no devuelve resultados
- **THEN** el primer caso SHALL invitar a crear el primer registro y el segundo SHALL ofrecer limpiar filtros

#### Scenario: Fallo recuperable
- **WHEN** la consulta de un panel falla por un error recuperable
- **THEN** el panel SHALL explicar el fallo y ofrecer «Reintentar», y el resto de la página SHALL seguir operable

### Requirement: PPF-08 Notificación temporal
La confirmación de una acción terminada SHALL comunicarse mediante una notificación temporal (toast) abajo a la derecha. Son acciones terminadas crear, guardar, confirmar, cobrar, activar o desactivar. La notificación SHALL:
- durar 6 segundos;
- pausarse mientras el puntero está encima o el foco está en ella;
- cerrarse con su control o con Escape;
- incluir un enlace «Ver» cuando exista un documento o registro al que ir.

Se SHALL mostrar hasta tres a la vez, con la más reciente abajo. Las notificaciones SHALL anunciarse sin mover el foco y SHALL NOT reemplazar los errores ni las advertencias que exigen actuar, que permanecen en línea. Las franjas de éxito persistentes SHALL NOT usarse para confirmar acciones terminadas.

**Trazabilidad:** decisiones 7 y 13 del proposal; sección 8.2 de `interfaz-y-navegacion.md`; `RNF-USA-004`, `RNF-USA-006`, `RNF-USA-007`; tableros «Toast sobre una lista» y «Toasts: variantes y reglas».

#### Scenario: Registro actualizado
- **WHEN** el usuario guarda cambios en un producto
- **THEN** SHALL aparecer una notificación temporal abajo a la derecha que nombra el producto, SHALL desaparecer sola a los 6 segundos y el foco SHALL permanecer donde estaba

#### Scenario: Pausa y cierre
- **WHEN** el usuario coloca el puntero sobre la notificación o la enfoca y luego pulsa Escape
- **THEN** la notificación SHALL permanecer visible mientras tenga el puntero o el foco y SHALL cerrarse al pulsar Escape

#### Scenario: Error de guardado
- **WHEN** una acción falla por un dato corregible o un conflicto
- **THEN** SHALL NOT mostrarse una notificación temporal de éxito y el error SHALL mostrarse junto al campo o panel afectado

#### Scenario: Notificaciones acumuladas
- **WHEN** se completan cuatro acciones en menos de 6 segundos
- **THEN** SHALL verse como máximo tres notificaciones, la más reciente abajo, y la más antigua SHALL retirarse primero

#### Scenario: Notificación en teléfono
- **WHEN** la notificación aparece en un ancho de teléfono
- **THEN** SHALL ocupar el ancho disponible sobre la barra de acciones sin tapar su acción principal
