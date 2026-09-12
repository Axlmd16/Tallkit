## ADDED Requirements

<!-- Aprobado por el usuario al solicitar commit y continuación a diseño el 2026-09-11. Fuente: proposal aprobado y registrado en master, revisión DP-008 del 2026-09-11. GIVEN/WHEN/THEN equivalen a Dado/Cuando/Entonces; el contenido normativo está en español. -->

### Requirement: Consulta y administración autorizada de marcas
Los tres roles SHALL poder consultar marcas de vehículo. Administrador y Encargado del taller SHALL poder crearlas y editarlas. Solo Administrador SHALL poder desactivarlas y reactivarlas. El servidor SHALL comprobar cada permiso con sesión vigente y la interfaz SHALL adaptar acciones a la unión de roles, sin permisos personalizados. Trazabilidad: `DP-008` Marcas (2026-09-11), propuesta aprobada, `CT-001`, `UI-033`.

#### Scenario: Consulta por los tres roles
- **GIVEN** un usuario con cualquiera de los tres roles
- **WHEN** consulta las marcas
- **THEN** SHALL acceder a sus nombres y estados sin recibir acciones que no le correspondan

#### Scenario: Crear y editar por Encargado del taller
- **GIVEN** un Encargado del taller con sesión vigente
- **WHEN** crea una marca con nombre o corrige su nombre
- **THEN** SHALL guardarse el cambio y quedar disponible en las consultas pertinentes

#### Scenario: Escritura directa por Vendedor
- **GIVEN** un usuario con solo rol Vendedor
- **WHEN** intenta crear, editar, desactivar o reactivar una marca directamente
- **THEN** el servidor SHALL denegar la acción sin cambios

#### Scenario: Baja solicitada por Encargado del taller
- **GIVEN** un usuario Encargado del taller sin rol Administrador
- **WHEN** intenta desactivar o reactivar una marca
- **THEN** SHALL denegarse y esas acciones SHALL permanecer ocultas en su interfaz

#### Scenario: Sesión sin autorización vigente
- **GIVEN** una sesión ausente o invalidada
- **WHEN** se consulta o modifica el catálogo
- **THEN** SHALL exigirse autenticación sin devolver el catálogo ni aplicar cambios

### Requirement: Catálogo de marcas separado y utilizable
La marca de vehículo SHALL pertenecer a un catálogo administrable separado de las marcas de producto y SHALL exigir nombre no vacío. Crear una marca SHALL permitir seleccionarla en el registro de vehículos sin introducir catálogos de productos ni integraciones externas. Editar su nombre SHALL conservar su identidad y referencias. Trazabilidad: `DP-008` Vehículo/Marcas, `RN-CAT-003`, modelo conceptual, propuesta.

#### Scenario: Marca faltante durante el registro
- **GIVEN** que no está disponible la marca necesaria y el usuario puede crear marcas
- **WHEN** registra la marca con un nombre válido
- **THEN** SHALL poder seleccionarla al completar el vehículo, sin crear una marca de producto

#### Scenario: Nombre vacío
- **GIVEN** una creación o edición autorizada
- **WHEN** el nombre está vacío o contiene únicamente espacios
- **THEN** SHALL rechazarse la operación y señalarse el campo sin cambios parciales

#### Scenario: Corrección de nombre referenciado
- **GIVEN** una marca utilizada por vehículos
- **WHEN** un usuario autorizado corrige su nombre
- **THEN** SHALL conservarse la identidad de la marca y los vehículos SHALL seguir asociados a ella

### Requirement: Desactivación y reactivación sin pérdida de referencias
El Administrador SHALL poder desactivar y reactivar marcas mediante acciones explícitas y confirmadas. Una marca inactiva SHALL permanecer consultable en vehículos que ya la referencian y SHALL NOT poder elegirse en registros nuevos ni como sustitución de marca. La desactivación SHALL NOT borrar ni desactivar vehículos. Reactivar SHALL recuperar la misma identidad. Trazabilidad: `DP-008` Marcas revisada, `RNF-DAT-003`, propuesta.

#### Scenario: Desactivar marca utilizada
- **GIVEN** una marca activa referenciada por vehículos
- **WHEN** el Administrador confirma la desactivación
- **THEN** SHALL quedar inactiva, los vehículos y sus asociaciones SHALL conservarse y la marca SHALL excluirse de nuevas selecciones

#### Scenario: Selección directa de marca inactiva
- **GIVEN** una marca inactiva
- **WHEN** se intenta registrar un vehículo con ella mediante una solicitud directa
- **THEN** el servidor SHALL rechazar la selección sin registrar el vehículo

#### Scenario: Editar otros datos conservando marca inactiva
- **GIVEN** un vehículo que ya referencia una marca desactivada
- **WHEN** se corrige el color sin cambiar la marca
- **THEN** SHALL poder guardarse la corrección sin exigir sustituir la referencia existente

#### Scenario: Reactivar marca
- **GIVEN** una marca inactiva
- **WHEN** el Administrador confirma su reactivación
- **THEN** SHALL volver a estar disponible para selección con la misma identidad

### Requirement: Auditoría y errores de marcas
Las altas, ediciones y cambios de estado SHALL registrar actor, momento, acción, objetivo y resultado, conjuntamente con el cambio exitoso. Las denegaciones relevantes SHALL registrar el intento sin afirmar éxito. Solo Administrador SHALL consultar esos eventos inmutables. Los errores SHALL usar el formato uniforme del sistema y el **Contrato OpenAPI** SHALL documentar campos, estados y permisos aprobados. Trazabilidad: `RF-AUD-001/003/005`, `RNF-AUD-001…005`, `RNF-MAN-009/010`, propuesta.

#### Scenario: Baja auditada
- **GIVEN** una marca activa
- **WHEN** el Administrador confirma su baja
- **THEN** SHALL conservarse un evento que identifique actor, marca, desactivación y resultado con fecha en la zona horaria del negocio

#### Scenario: Fallo al guardar el evento
- **GIVEN** una modificación autorizada
- **WHEN** no se puede registrar la auditoría exitosa
- **THEN** SHALL rechazarse toda la operación sin dejar la marca modificada

#### Scenario: Rechazo de permisos consultable
- **GIVEN** una escritura de marcas intentada por Vendedor
- **WHEN** se deniega
- **THEN** SHALL registrarse la denegación y devolverse un error uniforme documentado, sin otorgar al Vendedor consulta de auditoría

### Requirement: Experiencia de catálogo adaptable
Las consultas y formularios de marcas SHALL usar exclusivamente el sistema visual existente, con nombre y estado claros, acciones autorizadas, carga, vacío, error recuperable, conservación de valores y prevención de doble envío. SHALL funcionar con teclado y foco visible a 360, 768, 1024 y 1440 px sin desbordamiento de página. Trazabilidad: `UI-033`, `RNF-USA-001…009`, specs visuales.

#### Scenario: Formulario de marca en teléfono
- **GIVEN** un usuario autorizado a crear marcas y un ancho de 360 px
- **WHEN** recibe un error al guardar
- **THEN** SHALL conservar el nombre ingresado, mostrar la corrección o reintento pertinente y mantener accesibles los controles y el foco

#### Scenario: Catálogo sin marcas disponibles
- **GIVEN** que no existen marcas activas
- **WHEN** se abre la selección de marca de vehículo
- **THEN** SHALL mostrarse un estado vacío claro y acceso a crear una marca únicamente a quienes tienen permiso
