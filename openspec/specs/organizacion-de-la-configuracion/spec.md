# organizacion-de-la-configuracion Specification

## Purpose
Organizar la configuración del taller, exclusiva del Administrador, como una hoja de consulta con navegación de secciones accesible y enlazable (*Entidades fiscales*, *Bodega*, *Impuestos*, *Series y numeración* y *Facturación electrónica*), edición en modales y resumen de pendientes, sin cambiar el comportamiento de las áreas existentes y separando la numeración interna de la configuración fiscal electrónica por entidad.
## Requirements
### Requirement: Reorganización sin cambio funcional de las áreas existentes

Salvo la nueva presentación en modo de consulta y la ubicación en secciones, *Entidades fiscales*, *Bodega*, *Impuestos* y *Series y numeración* SHALL conservar exactamente sus validaciones, permisos, datos, acciones y resultados actuales. La reorganización SHALL NOT cambiar modelos, migraciones, endpoints ni reglas de esas áreas.

*Bodega* SHALL presentarse como una ficha breve con el nombre y el estado de la bodega única. *Impuestos* SHALL presentar una tabla compacta agrupada por entidad fiscal, con las vigencias en orden cronológico. *Series y numeración* SHALL presentar una tabla agrupada por entidad fiscal, con códigos y números en tipografía monoespaciada.

*Series y numeración* SHALL contener únicamente las series internas (COM-ING, COM-PRO, COM-VEN, ART-SER y sus sustitutas) y SHALL NOT mostrar establecimientos, puntos ni secuenciales fiscales. *Facturación electrónica* SHALL NOT mostrar series internas.

Los errores y confirmaciones de una acción SHALL mostrarse dentro del modal o de la sección que la originó, y SHALL NOT aparecer en otra sección. Cada sección SHALL conservar su estado al cambiar a otra y volver, incluidos las subsecciones visitadas y los datos pendientes. Un modal abierto SHALL impedir cambiar de sección hasta cerrarlo.

Trazabilidad: propuesta §6–8 y C14 del cambio `simplificar-flujo-fiscal-y-configuracion-centralizada`; DP-001; DP-006; RF-ACC-010…012; spec `configuracion-operativa-y-fiscal`.

#### Scenario: Editar una entidad fiscal
- **DADO** la sección *Entidades fiscales*
- **CUANDO** el Administrador edita la razón social de la entidad comercial desde su modal
- **ENTONCES** SHALL aplicarse la misma validación y resultado que antes del rediseño.

#### Scenario: Error de impuestos dentro de su sección
- **DADO** un intento fallido de registrar una vigencia tributaria solapada en *Impuestos*
- **CUANDO** se muestra el error en su modal
- **ENTONCES** el error SHALL pertenecer al modal de *Impuestos*, SHALL NOT aparecer en otra sección y las demás secciones SHALL quedar inaccesibles hasta cerrar el modal.

#### Scenario: Estado conservado al volver a una sección
- **DADO** *Facturación electrónica* con la subsección *Formas de pago SRI* abierta para la entidad artesanal
- **CUANDO** el Administrador cambia a *Bodega* y regresa
- **ENTONCES** SHALL encontrar la misma entidad y la misma subsección, sin haberse reiniciado.

#### Scenario: Numeración interna separada
- **DADO** una entidad con serie COM-VEN y punto fiscal `001-001`
- **CUANDO** el Administrador consulta *Series y numeración*
- **ENTONCES** SHALL ver COM-VEN en el grupo de la entidad comercial y no el punto `001-001`.

#### Scenario: Series agrupadas por entidad
- **DADO** las series iniciales de V1
- **CUANDO** el Administrador consulta *Series y numeración*
- **ENTONCES** SHALL ver COM-ING, COM-PRO y COM-VEN bajo la entidad comercial y ART-SER bajo la entidad artesanal, cada grupo identificado por su ámbito, su razón social y su placa de RUC.

### Requirement: Subsecciones de facturación electrónica

La sección *Facturación electrónica* SHALL mostrar de forma permanente un botón «Preparación local» cuyo detalle, disponible con el puntero, el foco o un toque y siempre como descripción accesible, contiene el aviso «Configuración para preparación local. La emisión electrónica todavía no está habilitada.» Cada subsección SHALL presentarse con el mismo encabezado y estilo que las demás secciones de la configuración: título con su nombre completo, descripción breve, acciones a la derecha como botones rectos, filas etiqueta–valor o tablas con estados de punto y texto, y acciones de fila como enlaces de acción. Contendrá, por entidad fiscal seleccionada, estas subsecciones:

1. *Perfil tributario*
2. *Establecimientos y puntos de emisión*
3. *Impuestos y catálogo SRI*
4. *Formas de pago SRI*
5. *Certificado electrónico*

Las subsecciones SHALL presentarse como elementos anidados bajo *Facturación electrónica* en la misma navegación de secciones, visibles cuando esa sección está activa, con nombres breves e inequívocos: *Perfil tributario*, *Puntos de emisión*, *Impuestos SRI*, *Formas de pago* y *Certificado*. El título de cada subsección SHALL conservar su nombre completo. SHALL NOT usarse una segunda barra de subpestañas dentro del contenido desde 1024 px. Por debajo de 1024 px, las subsecciones SHALL presentarse en una barra horizontal propia al inicio del contenido de la sección.

Cada subsección SHALL mostrar en la navegación un indicador mínimo del estado de la entidad seleccionada, con texto accesible:

- un marcador de completo, si no le corresponde ninguna causa pendiente;
- un marcador y el número de pendientes, si le corresponden causas;
- *Opcional* para *Certificado* cuando no tiene advertencias, o *Revisar* cuando las tiene.

La entidad fiscal SHALL elegirse mediante una barra de pestañas rectas con línea inferior, con el mismo tratamiento que la navegación de secciones, ubicada al inicio de la sección. Cada pestaña SHALL mostrar el nombre y el tono de su ámbito, su razón social y un marcador de estado con texto accesible (*Sin configurar*, pendientes, *Requiere revisión* o *Lista*). La pestaña seleccionada SHALL distinguirse sin depender solo del color, y la placa de RUC de la entidad seleccionada SHALL mostrarse en la misma fila, alineada a la derecha.

El estado SHALL comunicarse sin franjas ni bloques de aviso a todo el ancho, para no saturar la pantalla:

- las causas de la subsección actual y las que no puedan atribuirse a ninguna subsección SHALL resumirse en un botón de advertencia en las acciones del encabezado, con su número y nombre accesible, del mismo alto y esquina que los demás botones; su detalle SHALL desplegarse con el puntero, el foco o un toque, y cerrarse con Escape;
- cada causa del estado fiscal SHALL atribuirse a la subsección donde se resuelve;
- las advertencias independientes, como las del certificado, SHALL mostrarse solo en su subsección y SHALL NOT cambiar el estado.

Los estados de declaraciones, puntos, correspondencias y formas de pago SHALL mostrarse con marcador de forma y texto, como en las demás secciones. El certificado SHALL presentarse en filas etiqueta–valor con su vigencia evaluada localmente, y su formulario SHALL abrirse en un modal amplio con los campos agrupados por pasos, atajos de duración y una vista previa que se actualiza al escribir.

Cada subsección SHALL describirse con una frase breve. Las explicaciones técnicas, códigos, versiones, fuentes y el ambiente SHALL quedar en los modales o en «Información avanzada», plegada.

El comportamiento de cada subsección SHALL ser el definido en `configuracion-operativa-y-fiscal`. Cada formulario técnico SHALL incluir ayuda contextual; ningún campo SHALL pedir un código técnico sin explicación.

Al cambiar de entidad, las cinco subsecciones SHALL reemplazar por completo sus datos, formularios, estados, errores y advertencias por los de la nueva entidad. SHALL NOT conservarse valores, borradores de formulario ni resultados de la entidad anterior. Mientras se cargan los datos de la nueva entidad, SHALL NOT mostrarse datos de la anterior como si le pertenecieran.

Trazabilidad: propuesta §9 y R2; propuesta B7–B12 y C13 del cambio `simplificar-flujo-fiscal-y-configuracion-centralizada`; DP-018; UI-019.

#### Scenario: Subsecciones visibles
- **DADO** la sección *Facturación electrónica* con la entidad artesanal seleccionada en una pantalla de 1440 px
- **CUANDO** el Administrador la consulta
- **ENTONCES** SHALL ver la barra de pestañas de las dos entidades con la placa de RUC, el encabezado *Perfil tributario* con su descripción y el botón «Preparación local» con el aviso permanente y, en la navegación de secciones, las cinco subsecciones anidadas con nombres breves y los estados de la entidad artesanal únicamente, sin franjas de estado a todo el ancho.

#### Scenario: Estado atribuido a su subsección
- **DADO** la entidad artesanal con varios puntos activos y ninguno designado
- **CUANDO** el Administrador consulta *Facturación electrónica*
- **ENTONCES** *Puntos de emisión* SHALL indicar un pendiente en la navegación, las demás subsecciones sin causas SHALL indicar completo u *Opcional*, y al abrir *Establecimientos y puntos de emisión* su encabezado SHALL mostrar el botón de advertencia con esa causa en su detalle.

#### Scenario: Causa no atribuible
- **DADO** una causa del estado fiscal que no corresponde a ninguna subsección conocida
- **CUANDO** se muestra *Facturación electrónica*
- **ENTONCES** la causa SHALL aparecer en el detalle del botón de advertencia del encabezado y SHALL contarse como pendiente.

#### Scenario: Entidad sin configurar
- **DADO** una entidad fiscal sin perfil guardado ni certificado
- **CUANDO** el Administrador abre *Facturación electrónica*
- **ENTONCES** su opción del selector SHALL indicar *Sin configurar*, SHALL NOT mostrarse una franja de estado ni el aviso del certificado fuera de *Certificado*, y *Perfil tributario* SHALL mostrar sus condiciones con botones visibles para declararlas.

#### Scenario: Cambio de entidad comercial a artesanal
- **DADO** la sección *Facturación electrónica* con la entidad comercial seleccionada, cuyos establecimientos, correspondencias y formas habilitadas se están mostrando
- **CUANDO** el Administrador selecciona la opción de la entidad artesanal
- **ENTONCES** SHALL mostrarse únicamente el perfil, los establecimientos y puntos, las correspondencias tributarias, las formas de pago, el certificado y los estados de subsección de la entidad artesanal, sin conservar datos de la comercial.

#### Scenario: Formulario abierto al cambiar de entidad
- **DADO** un modal de correspondencia tributaria con datos sin guardar para la entidad comercial
- **CUANDO** el Administrador lo cierra descartando los cambios y selecciona la entidad artesanal
- **ENTONCES** ningún guardado posterior SHALL aplicar esos datos a la entidad artesanal.

#### Scenario: Error de una entidad
- **DADO** un error visible al añadir un punto de emisión a la entidad comercial
- **CUANDO** el Administrador cambia a la entidad artesanal
- **ENTONCES** ese error SHALL NOT mostrarse como si perteneciera a la entidad artesanal.

#### Scenario: Subsecciones en teléfono
- **DADO** un ancho de 360 px
- **CUANDO** el Administrador abre *Facturación electrónica*
- **ENTONCES** SHALL ver la barra de subsecciones al inicio del contenido, desplazable internamente, con los estados de cada subsección en texto.

### Requirement: Acceso exclusivo del Administrador a la configuración

Solo el Administrador SHALL acceder a la página de configuración y a sus pestañas. El permiso de preparar datos fiscales SHALL NOT otorgar acceso a la configuración. Un Vendedor o un Encargado del taller que abra la dirección, incluida la de una pestaña, SHALL recibir la denegación vigente sin ver datos. El backend SHALL seguir validando cada acción de configuración.

Trazabilidad: propuesta C15; CT-001; spec `autorizacion-y-navegacion`.

#### Scenario: Vendedor con enlace directo
- **DADO** un Vendedor que puede preparar datos fiscales comerciales
- **CUANDO** abre el enlace directo a *Facturación electrónica*
- **ENTONCES** SHALL denegarse el acceso sin mostrar perfil, puntos ni catálogos.

#### Scenario: Encargado sin acceso
- **DADO** un Encargado del taller sin rol Administrador
- **CUANDO** navega por el menú
- **ENTONCES** SHALL NOT ver el acceso a la configuración.


### Requirement: Navegación de secciones de la configuración

La página de configuración SHALL presentar sus secciones en una sola hoja de trabajo, sin una tarjeta independiente por sección ni por registro, en este orden:

1. *Entidades fiscales*
2. *Bodega*
3. *Impuestos*
4. *Series y numeración*
5. *Facturación electrónica*

Desde 1024 px de ancho, la navegación de secciones SHALL mostrarse como una lista vertical a la izquierda, dentro de la misma hoja. Por debajo de 1024 px SHALL mostrarse como una barra horizontal sobre el contenido. Cada elemento SHALL mostrar un icono, su nombre y un indicador breve:

- *Entidades fiscales*, *Bodega*, *Impuestos* y *Series y numeración*: el número de registros vigentes de la sección.
- *Facturación electrónica*: el número de pendientes cuando existan, con texto accesible que los identifique como pendientes.

Desde 768 px de ancho, la hoja SHALL ocupar exactamente el alto disponible de la ventana bajo el encabezado de la página, y su altura SHALL NOT variar al cambiar de sección; el contenido que exceda ese alto SHALL desplazarse dentro de la hoja. La descripción del encabezado de la página SHALL ser una frase breve que en escritorio quepa en una sola línea.

La sección activa SHALL distinguirse mediante una marca lateral o inferior, un fondo suave y un peso de texto mayor, sin depender solo del color. La sección inicial SHALL ser *Entidades fiscales*, salvo navegación directa a otra.

El título de la sección de los dos RUC SHALL ser «Entidades fiscales» y SHALL NOT usarse «Identidades fiscales». Los nombres de las secciones y su organización son cambios de presentación; SHALL NOT alterar el comportamiento, los datos ni los permisos de las áreas.

Trazabilidad: propuesta §1–2 y R2–R3; DP-001; RNF-USA-004/005/006; UI-013; spec `sistema-visual-frontend` («Jerarquía mediante lienzo y superficies elevadas»).

#### Scenario: Apertura sin indicación en escritorio
- **DADO** un Administrador en una pantalla de 1440 px
- **CUANDO** abre la configuración sin indicar sección
- **ENTONCES** SHALL ver a la izquierda la lista vertical con las cinco secciones y *Entidades fiscales* marcada como actual, y a la derecha los datos de los dos RUC.

#### Scenario: Cambio de sección
- **DADO** la sección *Entidades fiscales* activa
- **CUANDO** el Administrador selecciona *Series y numeración*
- **ENTONCES** SHALL mostrarse la tabla de series internas, SHALL ocultarse el contenido de las demás secciones y *Series y numeración* SHALL quedar marcada como actual.

#### Scenario: Indicador de pendientes
- **DADO** que la entidad artesanal no tiene punto de emisión predeterminado determinable
- **CUANDO** el Administrador observa la navegación de secciones
- **ENTONCES** *Facturación electrónica* SHALL mostrar su número de pendientes con un marcador y un texto accesible, y las demás secciones SHALL mostrar su número de registros.

#### Scenario: Altura estable de la hoja
- **DADO** un Administrador en una pantalla de 1440 × 900 px con *Entidades fiscales* activa
- **CUANDO** cambia a *Bodega*, que tiene menos contenido
- **ENTONCES** la hoja SHALL conservar la misma altura, extendida hasta el borde inferior de la ventana.

#### Scenario: Pantalla de tableta
- **DADO** un ancho de 900 px
- **CUANDO** se abre la configuración
- **ENTONCES** la navegación de secciones SHALL mostrarse como barra horizontal sobre el contenido, sin desplazamiento horizontal de la página completa.

### Requirement: Accesibilidad y navegación directa de las secciones

La navegación de secciones SHALL ser una región de navegación con nombre accesible, formada por enlaces. El enlace de la sección actual, y el de la subsección actual cuando exista, SHALL indicar su posición mediante el estado de página actual para las tecnologías de asistencia. Cada enlace SHALL poder alcanzarse con Tab y activarse con Intro, en el mismo orden en que se presenta visualmente, con un indicador de foco visible.

La sección seleccionada SHALL reflejarse en la dirección de la página mediante el parámetro `tab`, y la subsección de *Facturación electrónica* mediante el parámetro `seccion`. Así se conservan los enlaces directos existentes y la restauración al recargar o volver. Una indicación desconocida de sección SHALL abrir *Entidades fiscales*, y una desconocida de subsección SHALL abrir *Perfil tributario*.

En pantallas estrechas, la barra horizontal SHALL desplazarse internamente conservando etiquetas completas y legibles. SHALL NOT reducir el texto a un tamaño ilegible ni abreviarlo de forma ambigua, y el elemento actual SHALL quedar visible dentro de la barra. Cada elemento SHALL ofrecer un área activable de al menos 44 × 44 px CSS en dispositivos táctiles.

Trazabilidad: propuesta R3; RNF-USA-004/005/007/011; spec `experiencia-adaptable-frontend` («Operación completa mediante teclado», «Controles táctiles adecuados»).

#### Scenario: Recorrido con teclado
- **DADO** el foco en el enlace *Bodega*
- **CUANDO** el usuario pulsa Tab y después Intro
- **ENTONCES** SHALL enfocarse *Impuestos*, SHALL mostrarse su contenido y su enlace SHALL anunciarse como la página actual.

#### Scenario: Enlace directo a una subsección
- **DADO** un enlace a la configuración con `tab=facturacion` y `seccion=puntos`
- **CUANDO** el Administrador lo abre o recarga la página
- **ENTONCES** SHALL mostrarse *Facturación electrónica* con la subsección *Establecimientos y puntos de emisión* marcada como actual.

#### Scenario: Indicación desconocida
- **DADO** un enlace con `tab=otra`
- **CUANDO** el Administrador lo abre
- **ENTONCES** SHALL mostrarse *Entidades fiscales* como sección actual.

#### Scenario: Pantalla estrecha
- **DADO** un teléfono de 360 px de ancho
- **CUANDO** se abre la configuración
- **ENTONCES** todas las secciones SHALL ser alcanzables, mediante desplazamiento interno de la barra si no caben, con etiquetas legibles y sin que la página completa se desplace horizontalmente.

### Requirement: Resumen del estado de la configuración

El encabezado de la página SHALL mostrar un resumen textual del estado de la configuración en lugar de la insignia «Sistema operativo»:

- sin causas pendientes en ninguna entidad fiscal, SHALL indicar que la configuración no tiene pendientes;
- con causas pendientes, SHALL indicar su número y la sección *Facturación electrónica*, con un enlace que abra la subsección donde se resuelve la primera causa pendiente.

Solo SHALL contarse como pendientes las causas del estado de la configuración fiscal. Las advertencias independientes, como el certificado sin declarar o vencido, SHALL NOT contarse como pendientes. El resumen SHALL NOT afirmar validación, habilitación ni declaración ante el SRI. Mientras el estado se consulta, SHALL mostrar un marcador de carga. Si la consulta falla, SHALL indicar que el estado no pudo evaluarse, sin presentar la configuración como al día.

Trazabilidad: propuesta §3 y R4; DP-018; spec `configuracion-operativa-y-fiscal` («Perfil fiscal adicional sin alterar la configuración operativa»); PPF-07.

#### Scenario: Configuración sin pendientes
- **DADO** las dos entidades en estado *Lista para preparación local*, una de ellas con el certificado sin declarar
- **CUANDO** el Administrador abre la configuración
- **ENTONCES** el resumen SHALL indicar que no hay pendientes y SHALL NOT contar la advertencia del certificado.

#### Scenario: Pendiente enlazado
- **DADO** la entidad artesanal con la causa de punto predeterminado sin designar
- **CUANDO** el Administrador activa el enlace del resumen
- **ENTONCES** SHALL abrirse *Facturación electrónica* con la entidad artesanal seleccionada y la subsección *Establecimientos y puntos de emisión* como actual.

#### Scenario: Estado no disponible
- **DADO** que la consulta del estado fiscal falla
- **CUANDO** se muestra el encabezado
- **ENTONCES** el resumen SHALL indicar que el estado no pudo evaluarse y SHALL NOT indicar que la configuración está al día.

### Requirement: Consulta primero y edición en modal

Cada sección SHALL mostrar primero sus datos en modo de consulta: filas etiqueta–valor separadas por líneas finas, o tablas compactas. Los formularios SHALL abrirse solo mediante una acción explícita con un texto que la nombre, por ejemplo «Editar», «Declarar», «Editar prefijo» o «Añadir punto de emisión». Cada formulario SHALL presentarse en un modal conforme a PPF-04.

SHALL NOT editarse en línea dentro de la ficha ni en paneles laterales. SHALL NOT mostrarse mensajes de guardado automático. Al guardar, el modal SHALL cerrarse, la consulta SHALL reflejar el cambio y SHALL mostrarse una notificación temporal. Un error corregible SHALL mantener el modal abierto con el error junto a su campo.

Las ayudas extensas SHALL presentarse dentro del modal, junto al campo afectado o en un apartado plegable «¿Por qué se solicita?». No SHALL ocupar de forma permanente la vista de consulta. Los datos técnicos, como códigos oficiales, versiones de catálogo y fuentes, SHALL agruparse en un apartado «Información avanzada» plegado por defecto, sin dejar de estar disponibles.

Trazabilidad: propuesta §4 y R1; PPF-04, PPF-07 y PPF-08; RNF-USA-004/005/006; spec `configuracion-operativa-y-fiscal` («Correspondencias tributarias explícitas y versionadas»).

#### Scenario: Consultar sin editar
- **DADO** un Administrador en *Entidades fiscales*
- **CUANDO** revisa los datos de las dos entidades
- **ENTONCES** SHALL verlos como texto de consulta y SHALL NOT ver campos de formulario hasta activar «Editar».

#### Scenario: Editar una entidad en modal
- **DADO** la ficha de la entidad comercial
- **CUANDO** el Administrador activa «Editar», cambia la razón social y guarda
- **ENTONCES** el modal SHALL cerrarse, la ficha SHALL mostrar la nueva razón social y SHALL aparecer una notificación temporal.

#### Scenario: Error corregible al guardar
- **DADO** el modal de edición de una entidad
- **CUANDO** el servidor rechaza un RUC repetido
- **ENTONCES** el modal SHALL permanecer abierto con el error junto al RUC y SHALL NOT mostrarse una notificación de éxito.

#### Scenario: Información avanzada plegada
- **DADO** la subsección *Impuestos y catálogo SRI* con correspondencias registradas
- **CUANDO** el Administrador la abre
- **ENTONCES** SHALL ver el nombre comprensible de cada correspondencia, y el código oficial solo al desplegar «Información avanzada».

### Requirement: Entidades fiscales en fichas de consulta paralelas

La sección *Entidades fiscales* SHALL mostrar las dos entidades en paralelo desde 1280 px y apiladas por debajo de ese ancho, separadas por una línea y no por tarjetas. Cada entidad SHALL mostrar:

- su ámbito, con nombre, icono y tono propios;
- su razón social destacada;
- su RUC en una placa de RUC;
- filas de consulta con nombre comercial (o «Sin nombre comercial»), el uso que corresponde a su ámbito y el estado de facturación electrónica con su causa en texto;
- el número de series internas activas, con un enlace a *Series y numeración*.

Cada entidad SHALL ofrecer una sola acción «Editar».

El estado de facturación electrónica SHALL usar los nombres vigentes (*Sin configurar*, *Falta completar*, *Requiere revisión*, *Lista para preparación local*). Cuando no esté listo, SHALL enlazar a la subsección que resuelve su primera causa.

Trazabilidad: propuesta §5; CT-001; separación fiscal confirmada; RN-FIS-001…005; RF-ACC-010; spec `sistema-visual-frontend` («Estados y ámbitos comprensibles sin depender del color»).

#### Scenario: Entidades en escritorio
- **DADO** un ancho de 1280 px
- **CUANDO** el Administrador abre *Entidades fiscales*
- **ENTONCES** SHALL ver la entidad comercial y la artesanal lado a lado, cada una con su ámbito, su razón social, su placa de RUC y sus filas de consulta.

#### Scenario: Entidad con configuración incompleta
- **DADO** la entidad artesanal en estado *Falta completar* por falta de punto predeterminado
- **CUANDO** el Administrador consulta su ficha
- **ENTONCES** SHALL ver «Falta completar» con la causa en texto y un enlace a *Establecimientos y puntos de emisión*.

#### Scenario: Entidades en teléfono
- **DADO** un ancho de 360 px
- **CUANDO** el Administrador abre *Entidades fiscales*
- **ENTONCES** las dos entidades SHALL mostrarse apiladas en una columna, cada una con su acción «Editar» visible.

### Requirement: Perfil tributario presentado por condición

La subsección *Perfil tributario* SHALL presentar las seis condiciones (régimen tributario, obligación de llevar contabilidad, contribuyente especial, agente de retención, RIMPE y calificación artesanal) en una tabla de consulta. Cada fila SHALL mostrar la condición, su declaración (*Sin declarar*, *Aplica* o *No aplica*) con texto y marcador, su detalle y su fecha de inicio de vigencia, o un guion cuando falten.

Cada fila SHALL ofrecer una acción que abra un modal para esa condición: «Declarar» si está sin declarar y «Editar» en los demás casos. El modal SHALL mostrar solo los campos que corresponden a la declaración elegida, la ayuda contextual de la condición y el apartado plegable «¿Por qué se solicita?».

Guardar una condición SHALL conservar sin cambios las demás condiciones y el certificado, y SHALL aplicar el control de revisión vigente del perfil. Si otro guardado cambió el perfil entretanto, SHALL rechazarse el guardado con una explicación del conflicto dentro del modal, sin sobrescribir los datos del otro guardado.

Trazabilidad: propuesta §10; spec `configuracion-operativa-y-fiscal` («Perfil fiscal adicional sin alterar la configuración operativa»); RNF-INT-003…005; PPF-04.

#### Scenario: Declarar una condición
- **DADO** un perfil con *Agente de retención* sin declarar
- **CUANDO** el Administrador activa «Declarar», elige *No aplica*, completa fundamento y vigencia y guarda
- **ENTONCES** la fila SHALL mostrar *No aplica* con su vigencia y las otras cinco condiciones SHALL conservar sus valores.

#### Scenario: Campos según la declaración
- **DADO** el modal de *Calificación artesanal*
- **CUANDO** el Administrador cambia la declaración de *Sin declarar* a *Aplica*
- **ENTONCES** SHALL mostrarse el número de calificación, el fundamento y la vigencia, cada uno con su ayuda.

#### Scenario: Conflicto de revisión
- **DADO** dos administradores con el mismo perfil abierto
- **CUANDO** el segundo guarda una condición después de que el primero guardó otra
- **ENTONCES** el segundo guardado SHALL rechazarse con una explicación dentro del modal y SHALL conservarse la condición guardada por el primero.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
