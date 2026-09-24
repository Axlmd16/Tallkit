## ADDED Requirements

<!-- Aprobado por el usuario al solicitar commit y continuación a diseño el 2026-09-11. Fuente: proposal aprobado y registrado en master, revisión DP-008 del 2026-09-11. GIVEN/WHEN/THEN equivalen a Dado/Cuando/Entonces; el contenido normativo está en español. -->

### Requirement: Registro de vehículos con datos mínimos
El sistema SHALL registrar un **Vehículo** con placa, marca, modelo y un **Cliente** propietario obligatorios. Color, año y VIN SHALL ser opcionales. El propietario SHALL ser un cliente registrado y activo y la marca SHALL estar disponible para nuevas selecciones. V1 SHALL NOT registrar vehículos sin placa. Trazabilidad: `DP-008` Vehículo revisada, `RF-CLI-006/007`, `RNF-DAT-003`, `UI-025`.

#### Scenario: Alta sin datos opcionales
- **GIVEN** un usuario autorizado, un cliente activo y una marca activa
- **WHEN** registra placa, marca, modelo y propietario sin color, año ni VIN
- **THEN** SHALL crearse el vehículo asociado a ese único propietario y visible desde ambas fichas

#### Scenario: Datos obligatorios ausentes
- **GIVEN** un intento de registro autorizado
- **WHEN** falta placa, marca, modelo o propietario, o un texto obligatorio contiene solo espacios
- **THEN** el servidor y la interfaz SHALL rechazar el registro e identificar los datos faltantes sin crear un vehículo parcial

#### Scenario: Propietario no disponible
- **GIVEN** un cliente inexistente o inactivo
- **WHEN** se intenta asignarlo como propietario de un nuevo vehículo
- **THEN** el sistema SHALL rechazar la asociación sin crear el vehículo

### Requirement: Normalización y unicidad de placa y VIN
El sistema SHALL normalizar espacios exteriores y diferencias de mayúsculas/minúsculas de placa y VIN, conservarlos como identificadores textuales e impedir duplicados incluso entre vehículos inactivos o históricos. Un VIN ausente SHALL NOT impedir registrar varios vehículos. La validación SHALL aplicarse también al editar y bajo concurrencia. Trazabilidad: `RN-CLI-006`, `RF-CLI-008/012`, `CU-005`, `RNF-INT-005`.

#### Scenario: Placa equivalente existente
- **GIVEN** un vehículo inactivo de placa «ABC-1234»
- **WHEN** se intenta registrar otro con « abc-1234 »
- **THEN** SHALL rechazarse el duplicado y ofrecerse consultar la ficha existente con su estado

#### Scenario: VIN repetido con placa diferente
- **GIVEN** un vehículo con VIN informado
- **WHEN** se registra otro con placa diferente y el mismo VIN normalizado
- **THEN** SHALL rechazarse el duplicado sin alterar el vehículo existente

#### Scenario: Vehículos sin VIN
- **GIVEN** dos registros con placas distintas válidas y los demás datos obligatorios
- **WHEN** ambos se registran sin VIN
- **THEN** SHALL aceptarse ambos sin considerar la ausencia de VIN un duplicado

#### Scenario: Edición o alta concurrente duplicada
- **GIVEN** dos solicitudes autorizadas que intentan asignar una misma placa libre a vehículos diferentes
- **WHEN** se procesan simultáneamente
- **THEN** solo una SHALL confirmarse y la otra SHALL recibir un conflicto sin efectos parciales

### Requirement: Consulta de vehículos y propietario
Los tres roles SHALL poder buscar vehículos principalmente por placa, también por VIN o cliente, filtrar por estado y consultar resultados paginados. La ficha SHALL mostrar marca, modelo, datos opcionales disponibles, estado, propietario actual y períodos de propiedad, con acceso autorizado a la ficha del propietario. SHALL NOT mostrar mantenimientos ni saldos ficticios. Trazabilidad: `RF-CLI-006/007`, `CU-005`, `UI-023…025`, propuesta.

#### Scenario: Búsqueda parcial de placa
- **GIVEN** varios vehículos con diferentes placas y estados
- **WHEN** se busca un fragmento de placa y se filtra por estado
- **THEN** SHALL mostrarse únicamente coincidencias con el estado seleccionado, paginadas y con acceso a sus fichas

#### Scenario: Consulta del propietario desde vehículo
- **GIVEN** un Vendedor con sesión vigente y un vehículo registrado
- **WHEN** abre su ficha y la del propietario
- **THEN** SHALL poder consultar los datos del propietario actual sin recibir acciones de edición de vehículos

### Requirement: Cambio de propietario con períodos conservados
Administrador y Encargado del taller SHALL poder cambiar explícitamente el propietario a otro cliente activo. La operación SHALL cerrar el período vigente y abrir el nuevo conjuntamente, conservar exactamente un propietario actual y los períodos anteriores, y actualizar las consultas de ambos clientes. SHALL NOT reconstruir ni editar retrospectivamente períodos ni modificar documentos históricos. Trazabilidad: `DM-003` V1, `RN-CLI-005/007/009`, `RF-CLI-009`, spec principal de dominio.

#### Scenario: Transferencia válida
- **GIVEN** un vehículo del cliente A y otro cliente activo B
- **WHEN** un usuario autorizado confirma el cambio a B
- **THEN** SHALL cerrarse el período de A y abrirse el de B, aparecer en los vehículos actuales de B y dejar de figurar como actual de A, conservando el período de A

#### Scenario: Nuevo propietario inválido
- **GIVEN** un vehículo con propietario vigente
- **WHEN** se intenta transferir a un cliente inactivo o inexistente
- **THEN** SHALL rechazarse la transferencia y conservarse el período y propietario anteriores

#### Scenario: Repetición hacia el propietario actual
- **GIVEN** un vehículo cuyo propietario ya es B
- **WHEN** se repite una solicitud de asignación a B
- **THEN** SHALL mantenerse el período vigente sin crear períodos ni eventos de transferencia duplicados

#### Scenario: Transferencias concurrentes
- **GIVEN** dos cambios simultáneos de propietario para el mismo vehículo
- **WHEN** se procesan
- **THEN** los cambios confirmados SHALL tener un orden consistente, sin períodos solapados ni más de un propietario actual; cualquier rechazo SHALL conservar íntegramente el último estado confirmado

### Requirement: Edición y estados del vehículo
Administrador y Encargado del taller SHALL poder editar datos del vehículo; cambiar propietario SHALL conservar el comportamiento explícito de transferencia. Solo Administrador SHALL poder desactivar o reactivar con confirmación. Un vehículo inactivo SHALL conservar identidad, propietario y períodos, permanecer consultable y quedar excluido de nuevas operaciones. No SHALL existir eliminación física ordinaria. Trazabilidad: `RF-CLI-010`, `RN-CLI-008`, `RNF-DAT-003`.

#### Scenario: Corrección de datos opcionales
- **GIVEN** un vehículo registrado
- **WHEN** un usuario autorizado corrige el modelo y elimina el color opcional
- **THEN** SHALL guardarse el cambio conservando identidad, placa si no se modifica y períodos de propiedad

#### Scenario: Desactivación y consulta
- **GIVEN** un vehículo activo
- **WHEN** el Administrador confirma su desactivación
- **THEN** SHALL quedar inactivo sin perder propietario ni períodos y SHALL seguir consultable por los tres roles

#### Scenario: Reactivación
- **GIVEN** un vehículo inactivo
- **WHEN** el Administrador confirma su reactivación
- **THEN** SHALL reactivarse la misma ficha sin duplicar placa, VIN ni períodos; la activación SHALL NOT reactivar automáticamente su cliente o marca

### Requirement: Autorización de vehículos
El servidor SHALL exigir sesión vigente y permisos de los roles aprobados: consulta para los tres; creación, edición y transferencia para Administrador y Encargado del taller; desactivación y reactivación solo para Administrador. La interfaz SHALL reflejar la unión de permisos y ocultar acciones no concedidas. Trazabilidad: `CT-001`, `actores-y-roles.md` §3.2, specs de identidad.

#### Scenario: Gestión por Encargado del taller
- **GIVEN** un Encargado del taller con sesión vigente
- **WHEN** crea, edita o transfiere un vehículo válido
- **THEN** el sistema SHALL permitir la acción, sin habilitarle desactivación ni reactivación

#### Scenario: Escritura directa de Vendedor
- **GIVEN** un usuario con solo rol Vendedor
- **WHEN** intenta crear, editar o transferir un vehículo mediante una solicitud directa
- **THEN** SHALL denegarse sin cambios, aunque pueda consultar el mismo vehículo

#### Scenario: Unión de roles
- **GIVEN** un usuario con roles Vendedor y Encargado del taller
- **WHEN** solicita editar un vehículo
- **THEN** SHALL permitirse por su permiso acumulado, conservando la prohibición de desactivar sin Administrador

#### Scenario: Solicitud sin sesión vigente
- **GIVEN** una sesión ausente, vencida o invalidada
- **WHEN** solicita consultar o modificar vehículos
- **THEN** SHALL exigirse autenticación sin revelar contenido ni ejecutar cambios

### Requirement: Auditoría y contrato de vehículos
Altas, ediciones, transferencias y transiciones SHALL registrar actor, momento, acción, vehículo y resultado; las transferencias SHALL identificar las referencias de propietarios anterior y nuevo sin copiar contactos innecesarios. Cambio y evento exitoso SHALL confirmarse conjuntamente. Los rechazos relevantes SHALL distinguirse de éxitos. Solo Administrador SHALL consultar auditoría inmutable. Los errores SHALL seguir el formato uniforme y correlación del sistema y el contrato SHALL documentar campos, permisos y errores. Trazabilidad: `RF-AUD-001/003/005`, `RNF-AUD-001…005`, `RNF-MAN-009/010`.

#### Scenario: Auditoría de transferencia
- **GIVEN** una transferencia válida
- **WHEN** se confirma
- **THEN** SHALL registrarse quién transfirió, cuándo, qué vehículo y las referencias anterior y nueva, sin registrar teléfono, email o dirección de los propietarios

#### Scenario: Fallo durante la transferencia
- **GIVEN** un cambio de propietario autorizado
- **WHEN** falla la conservación del período nuevo o del evento exitoso
- **THEN** SHALL conservarse el propietario y período anteriores sin transferencia parcial

#### Scenario: Error de placa documentado
- **GIVEN** una solicitud con placa duplicada
- **WHEN** el servidor la rechaza
- **THEN** SHALL devolver un error uniforme asociado al conflicto, documentado en el contrato y sin exponer detalles internos

### Requirement: Experiencia adaptable de vehículos
La interfaz SHALL reutilizar el sistema visual vigente para búsqueda, lista, ficha y formulario, distinguir opcionales de obligatorios y conservar entradas ante errores. SHALL ofrecer carga, vacío, reintento, cambios sin guardar, controles sin doble envío y confirmaciones con objeto y consecuencia. SHALL funcionar a 360, 768, 1024 y 1440 px con teclado, foco y acciones independientes de hover. Trazabilidad: specs visuales, `RNF-USA-001…009/011`, `UI-023…025`.

#### Scenario: Transferencia en pantalla estrecha
- **GIVEN** un usuario autorizado en un ancho de 360 px
- **WHEN** abre la acción de cambiar propietario
- **THEN** SHALL identificar el vehículo, propietario actual y nuevo, y confirmar o cancelar con controles accesibles sin desbordamiento de página

#### Scenario: Formulario con errores
- **GIVEN** un formulario con modelo y propietario informados
- **WHEN** el servidor rechaza una placa duplicada
- **THEN** SHALL conservar los valores, asociar el error a la placa y ofrecer la ficha coincidente según permisos
