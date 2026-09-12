## ADDED Requirements

<!-- Aprobado por el usuario al solicitar commit y continuación a diseño el 2026-09-11. Fuente: proposal aprobado y registrado en master, revisión DP-008 del 2026-09-11. GIVEN/WHEN/THEN equivalen a Dado/Cuando/Entonces; el contenido normativo está en español. -->

### Requirement: Registro compartido de clientes con datos mínimos
El sistema SHALL permitir registrar un **Cliente** persona natural o jurídica con nombre o razón social, tipo de identificación, identificación y teléfono obligatorios. Email y dirección SHALL ser opcionales durante el registro y la edición. El cliente SHALL poder existir sin vehículos y SHALL conservar una única identidad compartida por ambos RUC. Trazabilidad: `DP-008` Cliente (revisión 2026-09-11), `RN-FIS-004`, `RN-CLI-001`, `RF-CLI-001`, `UI-022`.

#### Scenario: Persona natural sin email ni dirección
- **GIVEN** un usuario autorizado y una identificación no registrada
- **WHEN** registra una persona natural con nombre, tipo, identificación y teléfono, sin email, dirección ni vehículos
- **THEN** el sistema SHALL guardar el cliente y SHALL permitir consultar la misma ficha desde ambas actividades del taller

#### Scenario: Persona jurídica con razón social
- **GIVEN** un usuario autorizado y una identificación no registrada
- **WHEN** registra una persona jurídica con razón social, RUC de 13 caracteres y teléfono
- **THEN** el sistema SHALL aceptar el registro sin exigir un nombre personal, email ni dirección

#### Scenario: Falta de un dato obligatorio
- **GIVEN** un formulario de cliente autorizado
- **WHEN** falta el nombre o razón social, tipo de identificación, identificación o teléfono, o alguno contiene únicamente espacios
- **THEN** el sistema SHALL rechazar el registro, señalar cada campo faltante y SHALL NOT crear una ficha parcial

### Requirement: Identificación obligatoria y validada
El sistema SHALL admitir exclusivamente CI de exactamente 10 caracteres o RUC de exactamente 13 caracteres y SHALL comprobarlo tanto en la interfaz como en el servidor. SHALL conservar ceros iniciales y SHALL NOT admitir clientes sin identificación en V1. Esta capacidad SHALL NOT consultar servicios externos ni exigir datos fiscales propios de una futura emisión de comprobantes. Trazabilidad: `DP-008` Cliente revisada, `RF-CLI-001/003`, propuesta aprobada.

#### Scenario: Longitudes válidas
- **GIVEN** un cliente nuevo con los demás campos válidos
- **WHEN** se presenta una CI de 10 caracteres o un RUC de 13 caracteres
- **THEN** la longitud SHALL ser aceptada y los ceros iniciales SHALL conservarse

#### Scenario: Identificación inválida enviada directamente
- **GIVEN** una solicitud autorizada que no utiliza el formulario
- **WHEN** presenta un tipo distinto de CI/RUC o una identificación de longitud diferente de la exigida para su tipo
- **THEN** el servidor SHALL rechazarla sin registrar ni modificar el cliente

#### Scenario: Datos opcionales informados
- **GIVEN** un cliente con datos mínimos válidos
- **WHEN** informa un email con formato inválido
- **THEN** el sistema SHALL señalar el error de email y conservar los datos ingresados para corregirlo o dejar ese campo vacío

### Requirement: Unicidad de identidad y advertencias de coincidencia
El sistema SHALL normalizar los espacios exteriores de la identificación y SHALL impedir repetir la combinación de tipo y número, incluyendo clientes inactivos. SHALL ofrecer acceso a la ficha existente cuando el usuario tenga permiso de consulta. Las coincidencias de nombre o teléfono SHALL advertirse antes de confirmar, pero SHALL NOT bloquear por sí solas ni fusionar fichas. Trazabilidad: `RN-CLI-002`, `RF-CLI-003/012`, `CU-004`, `RNF-INT-005`.

#### Scenario: Identificación ya utilizada por un cliente inactivo
- **GIVEN** un cliente inactivo con CI «0123456789»
- **WHEN** se intenta crear otro con CI « 0123456789 »
- **THEN** el sistema SHALL rechazar el duplicado y ofrecer la ficha existente, indicando su estado inactivo

#### Scenario: Identificación duplicada al editar
- **GIVEN** dos clientes distintos
- **WHEN** se edita uno para utilizar el tipo y número de identificación del otro
- **THEN** el sistema SHALL rechazar el cambio y conservar ambas fichas anteriores

#### Scenario: Mismo teléfono sin identificación duplicada
- **GIVEN** un cliente registrado con un teléfono compartido
- **WHEN** se registra otro con el mismo teléfono y una identificación distinta válida
- **THEN** el sistema SHALL advertir la coincidencia y permitir confirmar una ficha independiente

#### Scenario: Creaciones concurrentes de la misma identidad
- **GIVEN** dos usuarios autorizados y una identificación todavía libre
- **WHEN** ambos intentan registrarla simultáneamente
- **THEN** SHALL existir una sola ficha y el otro intento SHALL recibir un error de duplicado sin cambios parciales

### Requirement: Consulta y búsqueda de clientes
El sistema SHALL permitir consultar fichas y buscar por coincidencias parciales de nombre o razón social, identificación y teléfono, con filtros de estado, paginación, conteo y limpieza de filtros. La ficha SHALL mostrar los vehículos de propiedad actual y permitir abrirlos según permisos; volver a la lista SHALL conservar el contexto de búsqueda. Trazabilidad: `RF-CLI-002/006`, `CU-004`, `UI-020/021`, `RNF-REN-005`, `RNF-USA-011`.

#### Scenario: Búsqueda por cada dato disponible
- **GIVEN** varios clientes registrados
- **WHEN** un usuario autorizado busca un fragmento de nombre, identificación o teléfono y filtra por estado
- **THEN** el sistema SHALL devolver únicamente las coincidencias del criterio y estado seleccionados, con paginación y conteo

#### Scenario: Consulta de vehículos desde cliente
- **GIVEN** un cliente propietario actual de dos vehículos y antiguo propietario de otro
- **WHEN** se consulta su ficha
- **THEN** SHALL mostrarse los dos vehículos actuales, incluidos sus estados, sin presentar el antiguo como propiedad vigente

#### Scenario: Ficha sin vehículos
- **GIVEN** un cliente sin vehículos
- **WHEN** se consulta su ficha
- **THEN** SHALL mostrarse un estado vacío comprensible y la acción de registrar vehículo únicamente si el usuario tiene permiso

### Requirement: Edición y ciclo activo de clientes
Los usuarios con permiso SHALL poder editar datos sin cambiar la identidad interna ni documentos históricos. Solo el **Administrador** SHALL poder desactivar y reactivar clientes mediante una acción explícita con confirmación comprensible. Desactivar SHALL conservar ficha y relaciones, impedir su selección para nuevas asociaciones u operaciones y mantener la consulta; SHALL NOT desactivar automáticamente sus vehículos. Reactivar SHALL recuperar la misma ficha sin permitir duplicados. Trazabilidad: `RF-CLI-004/005`, `RN-CLI-008`, `RNF-DAT-003`, `CU-004`.

#### Scenario: Edición válida
- **GIVEN** un cliente registrado
- **WHEN** un usuario autorizado corrige su teléfono y deja vacíos email y dirección
- **THEN** SHALL conservarse la identidad del cliente y SHALL guardarse la corrección sin exigir los campos opcionales

#### Scenario: Desactivación con vehículos asociados
- **GIVEN** un cliente activo propietario de vehículos
- **WHEN** el Administrador confirma su desactivación
- **THEN** SHALL quedar inactivo y consultable, sus relaciones y los estados de sus vehículos SHALL conservarse, y SHALL quedar excluido de nuevas selecciones de propietario

#### Scenario: Reactivación de la misma ficha
- **GIVEN** un cliente inactivo
- **WHEN** el Administrador confirma su reactivación
- **THEN** SHALL recuperar disponibilidad con la misma identidad y vehículos, sin crear otro registro

#### Scenario: Repetición de una transición ya aplicada
- **GIVEN** un cliente ya inactivo
- **WHEN** se repite la misma solicitud de desactivación
- **THEN** SHALL permanecer inactivo sin duplicar la transición ni su evento exitoso

### Requirement: Permisos de clientes y protección de sesión
El servidor SHALL exigir sesión vigente y comprobar permisos por acción. Administrador, Vendedor y Encargado del taller SHALL poder consultar, crear y editar clientes; solo Administrador SHALL poder desactivar y reactivar. La interfaz SHALL adaptar navegación y acciones a la unión de permisos vigente y SHALL NOT sustituir el control del servidor. Trazabilidad: `CT-001`, `RN-SEG-001…007`, `actores-y-roles.md` §3.2, specs de identidad.

#### Scenario: Operación permitida a los tres roles
- **GIVEN** un usuario con cualquiera de los tres roles y sesión vigente
- **WHEN** consulta, crea o edita un cliente válido
- **THEN** el sistema SHALL permitir la acción conforme a sus demás validaciones

#### Scenario: Desactivación directa sin permiso
- **GIVEN** un Vendedor o Encargado del taller sin rol Administrador
- **WHEN** intenta desactivar o reactivar un cliente directamente
- **THEN** el servidor SHALL denegar la acción sin cambios y la interfaz SHALL mantener ocultos esos controles

#### Scenario: Sesión invalidada
- **GIVEN** una sesión invalidada por desactivación de usuario o reducción de roles
- **WHEN** intenta consultar o cambiar clientes
- **THEN** SHALL exigirse nueva autenticación sin revelar fichas ni aplicar cambios

### Requirement: Auditoría y errores de clientes
Altas, ediciones y transiciones exitosas SHALL conservar **Usuario**, momento, acción, objetivo y resultado en auditoría inmutable, confirmada junto con el cambio. Los rechazos relevantes por permisos o validación SHALL registrar el resultado fallido sin afirmar éxito. Solo Administrador SHALL consultar los eventos. Los errores SHALL mantener el formato uniforme del sistema, correlación y mensajes de negocio, sin secretos ni datos personales innecesarios. El **Contrato OpenAPI** SHALL describir entradas obligatorias/opcionales, estados, permisos y errores. Trazabilidad: `RF-AUD-001/003/005`, `RNF-AUD-001…005`, `RNF-MAN-009/010`, propuesta.

#### Scenario: Cambio y evento confirmados juntos
- **GIVEN** una edición autorizada de cliente
- **WHEN** el cambio se confirma
- **THEN** SHALL existir un evento consultable por el Administrador con actor, acción, objetivo, fecha en la zona del negocio y resultado exitoso

#### Scenario: Fallo al conservar auditoría exitosa
- **GIVEN** una escritura autorizada de cliente
- **WHEN** falla el registro de su evento de éxito
- **THEN** SHALL rechazarse la operación completa sin dejar la ficha modificada

#### Scenario: Rechazo comprensible y documentado
- **GIVEN** una solicitud que duplica identificación
- **WHEN** se rechaza
- **THEN** SHALL devolverse un error uniforme y correlacionable que identifique el conflicto sin trazas internas, y el contrato SHALL documentar esa respuesta

### Requirement: Experiencia de clientes adaptable al sistema visual
Listas, fichas y formularios SHALL reutilizar exclusivamente el sistema visual vigente, con campos obligatorios identificados, errores asociados, conservación de valores, aviso de cambios sin guardar y prevención de doble envío. SHALL distinguir carga, vacío y error recuperable, permitir teclado y foco visible y conservar las acciones autorizadas a 360, 768, 1024 y 1440 px sin desbordamiento horizontal de página. Trazabilidad: specs visuales, `RNF-USA-001…009/011`, `UI-020…022`.

#### Scenario: Registro con error en teléfono
- **GIVEN** una pantalla de 360 px
- **WHEN** se intenta guardar un cliente sin teléfono
- **THEN** SHALL mostrarse el error asociado conservando los demás valores y SHALL poder corregirse y guardarse mediante controles visibles sin desplazamiento horizontal de página

#### Scenario: Consulta fallida frente a lista vacía
- **GIVEN** una búsqueda de clientes
- **WHEN** la consulta falla
- **THEN** SHALL mostrarse un error recuperable con reintento, diferenciado del estado de búsqueda sin coincidencias

#### Scenario: Revisión en dispositivos y teclado
- **GIVEN** cada uno de los anchos 360, 768, 1024 y 1440 px
- **WHEN** se recorre lista, ficha y formulario únicamente con teclado
- **THEN** todas las acciones autorizadas SHALL ser alcanzables, con foco visible y retorno al origen al cerrar una superposición

### Requirement: Condición previa a la aplicación
La aplicación de esta capacidad SHALL comenzar únicamente después de verificar y cerrar los cambios `gestion-usuarios-autenticacion-roles` y `establecer-sistema-visual-frontend`, incluida su aceptación visual requerida. Las pruebas técnicas SHALL NOT sustituir esa aceptación. Trazabilidad: instrucción y propuesta aprobadas el 2026-09-11.

#### Scenario: Dependencia aún abierta
- **GIVEN** que uno de los dos cambios sigue sin verificación o cierre requerido
- **WHEN** se evalúa iniciar la implementación de clientes y vehículos
- **THEN** SHALL detenerse `apply` y explicarse la dependencia pendiente; la aprobación de esta spec SHALL NOT declarar cerrado el otro cambio
