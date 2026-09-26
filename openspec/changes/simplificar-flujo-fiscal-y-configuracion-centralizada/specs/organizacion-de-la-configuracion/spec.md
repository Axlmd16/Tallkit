## ADDED Requirements

### Requirement: Configuración organizada en pestañas

La página de configuración SHALL organizarse en cinco pestañas, en este orden:

1. *Entidades fiscales*
2. *Bodega*
3. *Impuestos*
4. *Series y numeración*
5. *Facturación electrónica*

Seguirá el patrón visual y de navegación de las pestañas de las fichas de mantenimiento. La pestaña activa SHALL distinguirse claramente sin depender solo del color. La pestaña inicial SHALL ser *Entidades fiscales*, salvo navegación directa a otra.

El título de la sección de los dos RUC SHALL ser «Entidades fiscales» y SHALL NOT usarse «Identidades fiscales», para no confundirlo con la identidad fiscal de ensayo. Este cambio y los nombres de las pestañas son cambios de etiqueta y organización; SHALL NOT alterar el comportamiento, los datos ni los permisos de las áreas.

Trazabilidad: propuesta C13, R5; DP-001; RNF-USA-004/005/006; `interfaz-y-navegacion.md`; spec `patrones-de-pantalla-frontend`.

#### Scenario: Apertura sin indicación
- **DADO** un Administrador
- **CUANDO** abre la configuración sin indicar pestaña
- **ENTONCES** SHALL verse activa *Entidades fiscales* con la configuración de los dos RUC, y las otras cuatro pestañas disponibles.

#### Scenario: Cambio de pestaña
- **DADO** la pestaña *Entidades fiscales* activa
- **CUANDO** el Administrador selecciona *Series y numeración*
- **ENTONCES** SHALL mostrarse el panel de series internas y ocultarse los demás paneles.

### Requirement: Accesibilidad y navegación directa de las pestañas

Cada pestaña SHALL tener relación accesible con su panel (rol de pestaña, estado seleccionado y panel etiquetado por su pestaña). SHALL poder recorrerse con las flechas izquierda y derecha, Inicio y Fin, y SHALL poder activarse con el teclado.

La pestaña seleccionada SHALL reflejarse en la dirección de la página para permitir enlaces directos y restaurarse al recargar o volver. Una indicación de pestaña desconocida SHALL abrir *Entidades fiscales*. En pantallas pequeñas, las pestañas SHALL permanecer accesibles sin desbordar horizontalmente la página. Si no caben, la barra de pestañas SHALL desplazarse internamente conservando etiquetas completas y legibles; SHALL NOT reducirse el texto a un tamaño ilegible ni abreviarse de forma ambigua. La pestaña activa SHALL quedar visible dentro de esa barra.

Trazabilidad: propuesta C13; RNF-USA-004/005/011; spec `experiencia-adaptable-frontend`.

#### Scenario: Navegación con teclado
- **DADO** el foco en la pestaña *Bodega*
- **CUANDO** el usuario pulsa la flecha derecha y después Fin
- **ENTONCES** SHALL enfocarse y activarse primero *Impuestos* y después *Facturación electrónica*.

#### Scenario: Enlace directo
- **DADO** un enlace a la configuración con la pestaña *Facturación electrónica*
- **CUANDO** el Administrador lo abre o recarga la página
- **ENTONCES** SHALL mostrarse activa *Facturación electrónica*.

#### Scenario: Pantalla estrecha
- **DADO** un teléfono de 360 px de ancho
- **CUANDO** se abre la configuración
- **ENTONCES** todas las pestañas SHALL ser alcanzables, mediante desplazamiento interno de la barra si no caben, con etiquetas legibles y sin que la página completa se desplace horizontalmente.

### Requirement: Reorganización sin cambio funcional de las áreas existentes

Salvo el cambio de etiquetas y la ubicación en pestañas, las pestañas *Entidades fiscales*, *Bodega*, *Impuestos* y *Series y numeración* SHALL conservar exactamente sus formularios, validaciones, permisos, datos, acciones y resultados actuales. La reorganización SHALL NOT cambiar modelos, migraciones, endpoints ni reglas de esas áreas.

*Series y numeración* SHALL contener únicamente las series internas (COM-ING, COM-PRO, COM-VEN, ART-SER y sus sustitutas) y SHALL NOT mostrar establecimientos, puntos ni secuenciales fiscales. *Facturación electrónica* SHALL NOT mostrar series internas.

Los errores y confirmaciones de una acción SHALL mostrarse dentro del panel de la pestaña que la originó, y un error persistente SHALL seguir visible al volver a ella mientras no se resuelva.

Trazabilidad: propuesta C14; DP-006; RF-ACC-010…012; spec `configuracion-operativa-y-fiscal`.

#### Scenario: Editar una entidad fiscal
- **DADO** la pestaña *Entidades fiscales*
- **CUANDO** el Administrador edita la razón social de la entidad comercial
- **ENTONCES** SHALL aplicarse la misma validación y resultado que antes de la reorganización.

#### Scenario: Error en impuestos al cambiar de pestaña
- **DADO** un intento fallido de registrar una vigencia tributaria solapada en *Impuestos*
- **CUANDO** el Administrador cambia a *Bodega* y regresa a *Impuestos*
- **ENTONCES** el error SHALL seguir visible en *Impuestos* y SHALL NOT aparecer en otra pestaña.

#### Scenario: Numeración interna separada
- **DADO** una entidad con serie COM-VEN y punto fiscal `001-001`
- **CUANDO** el Administrador consulta *Series y numeración*
- **ENTONCES** SHALL ver COM-VEN y no el punto `001-001`.

### Requirement: Subsecciones de facturación electrónica

La pestaña *Facturación electrónica* SHALL mostrar de forma permanente el aviso «Configuración para preparación local. La emisión electrónica todavía no está habilitada.» Contendrá, por entidad fiscal seleccionada, estas subsecciones:

1. *Perfil tributario*
2. *Establecimientos y puntos de emisión*
3. *Impuestos y catálogo SRI*
4. *Formas de pago SRI*
5. *Certificado electrónico*

El comportamiento de cada subsección SHALL ser el definido en `configuracion-operativa-y-fiscal`. Cada formulario técnico SHALL incluir ayuda contextual; ningún campo SHALL pedir un código técnico sin explicación.

La entidad fiscal seleccionada SHALL indicarse de forma visible (razón social y RUC) en toda la pestaña. Al cambiar de entidad, las cinco subsecciones SHALL reemplazar por completo sus datos, formularios, estados, errores y advertencias por los de la nueva entidad. SHALL NOT conservarse valores, borradores de formulario ni resultados de la entidad anterior. Mientras se cargan los datos de la nueva entidad, SHALL NOT mostrarse datos de la anterior como si le pertenecieran.

Trazabilidad: propuesta B7–B12, C13; DP-018.

#### Scenario: Subsecciones visibles
- **DADO** la pestaña *Facturación electrónica* con la entidad artesanal seleccionada
- **CUANDO** el Administrador la consulta
- **ENTONCES** SHALL ver el aviso permanente y las cinco subsecciones con los datos de esa entidad únicamente.

#### Scenario: Cambio de entidad comercial a artesanal
- **DADO** la pestaña *Facturación electrónica* con la entidad comercial seleccionada, cuyos establecimientos, correspondencias y formas habilitadas se están mostrando
- **CUANDO** el Administrador selecciona la entidad artesanal
- **ENTONCES** SHALL mostrarse únicamente el perfil, los establecimientos y puntos, las correspondencias tributarias, las formas de pago y el certificado de la entidad artesanal, sin conservar datos de la comercial.

#### Scenario: Formulario abierto al cambiar de entidad
- **DADO** un formulario de correspondencia tributaria con datos sin guardar para la entidad comercial
- **CUANDO** el Administrador cambia a la entidad artesanal
- **ENTONCES** el formulario SHALL cerrarse o reiniciarse, y ningún guardado posterior SHALL aplicar esos datos a la entidad artesanal.

#### Scenario: Error de una entidad
- **DADO** un error visible al añadir un punto de emisión a la entidad comercial
- **CUANDO** el Administrador cambia a la entidad artesanal
- **ENTONCES** ese error SHALL NOT mostrarse como si perteneciera a la entidad artesanal.

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

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
