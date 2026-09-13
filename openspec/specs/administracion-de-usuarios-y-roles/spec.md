# administracion-de-usuarios-y-roles Specification

## Purpose
Definir el ciclo de usuarios y la asignación acumulable de los tres roles fijos, preservando identidad e historial.
## Requirements
### Requirement: Catálogo fijo de roles
V1 SHALL disponer únicamente de los **Roles** **Administrador**, **Vendedor** y **Encargado del taller**; sus permisos SHALL ser fijos y el sistema SHALL NOT permitir crear, editar o eliminar roles ni asignar permisos personalizados a un usuario. Trazabilidad: `CT-001`, `RN-SEG-002`, `RN-SEG-003`, `RF-ACC-006`, `UI-011`.

#### Scenario: Consulta de roles disponibles
- **WHEN** un Administrador consulta los roles asignables
- **THEN** el sistema SHALL mostrar exactamente los tres roles de V1 con sus permisos fijos

#### Scenario: Intento de crear un rol adicional
- **WHEN** un usuario intenta registrar un rol distinto de los tres permitidos
- **THEN** el sistema SHALL rechazar la operación y el catálogo de roles SHALL permanecer sin cambios

### Requirement: Creación de usuarios
El **Administrador** SHALL poder crear un **Usuario** con una identificación de acceso única, datos básicos, estado y uno o más de los tres roles permitidos. Todo usuario SHALL conservar al menos un rol, incluso mientras esté inactivo. Trazabilidad: `RN-SEG-003`, `RF-ACC-005`, `RF-ACC-007`, `CU-002`, `UI-011`.

#### Scenario: Creación válida con varios roles
- **WHEN** un Administrador crea un usuario con identificación única y asigna los roles Vendedor y Encargado del taller
- **THEN** el sistema SHALL crear una sola cuenta con ambos roles y SHALL registrar la acción administrativa

#### Scenario: Identificación de acceso repetida
- **WHEN** un Administrador intenta crear un usuario con una identificación de acceso ya utilizada
- **THEN** el sistema SHALL rechazar la creación y SHALL indicar que debe utilizar una identificación diferente

#### Scenario: Usuario sin roles
- **WHEN** un Administrador intenta guardar un usuario sin ninguno de los tres roles
- **THEN** el sistema SHALL rechazar la operación y SHALL NOT crear ni actualizar la cuenta

### Requirement: Consulta y búsqueda de usuarios
El Administrador SHALL poder consultar y buscar usuarios por identificación o datos básicos, filtrar por estado y rol, y distinguir sus roles y estado actuales. Trazabilidad: `RF-ACC-005`, `UI-010`.

#### Scenario: Filtro por estado y rol
- **WHEN** un Administrador filtra los usuarios activos que tienen el rol Vendedor
- **THEN** el sistema SHALL mostrar únicamente las cuentas que cumplen ambos criterios

#### Scenario: Consulta por un usuario no autorizado
- **WHEN** un usuario sin `usuarios.ver` intenta consultar la lista de usuarios
- **THEN** el sistema SHALL denegar la consulta y SHALL NOT revelar datos de las cuentas

### Requirement: Edición y asignación acumulable de roles
El Administrador SHALL poder editar los datos permitidos y asignar o retirar roles, y los permisos efectivos SHALL corresponder a la unión de los roles conservados. Trazabilidad: `CT-001`, `RN-SEG-003`, `RF-ACC-005`, `RF-ACC-007`, `CU-002`.

#### Scenario: Adición de un segundo rol
- **WHEN** un Administrador agrega el rol Encargado del taller a un usuario Vendedor
- **THEN** la cuenta SHALL conservar ambos roles y sus permisos efectivos SHALL incluir los permisos fijos de los dos

#### Scenario: Retiro de un rol conservando otro
- **WHEN** un Administrador retira uno de los roles de un usuario que conserva al menos otro
- **THEN** el sistema SHALL guardar la nueva asignación, SHALL retirar los permisos correspondientes e SHALL invalidar sus sesiones activas

#### Scenario: Asignación de un rol no permitido
- **WHEN** se intenta asignar un rol personalizado o distinto de los tres roles de V1
- **THEN** el sistema SHALL rechazar la modificación y SHALL conservar la asignación anterior

### Requirement: Activación y desactivación sin pérdida de historial
El Administrador SHALL poder activar o desactivar usuarios. Desactivar una cuenta SHALL impedir nuevos accesos, SHALL invalidar sus sesiones activas y SHALL conservar su identidad como autora de acciones históricas. Trazabilidad: `RN-SEG-006`, `RF-ACC-005`, `CU-002`, `RNF-DAT-003`.

#### Scenario: Desactivación de un usuario
- **WHEN** un Administrador desactiva un usuario activo
- **THEN** el sistema SHALL invalidar sus sesiones, SHALL impedir nuevos accesos y SHALL conservar la autoría de sus acciones anteriores

#### Scenario: Reactivación de un usuario
- **WHEN** un Administrador reactiva una cuenta que conserva al menos un rol permitido
- **THEN** el usuario SHALL poder volver a autenticarse con una credencial vigente

### Requirement: Conservación de un Administrador activo
El sistema SHALL impedir toda desactivación o reasignación de roles que deje al sistema sin al menos un Administrador activo. Trazabilidad: decisión aprobada en la propuesta; protección operativa de `ACT-001` y `RF-ACC-005` a `RF-ACC-007`.

#### Scenario: Desactivación del último Administrador
- **WHEN** se intenta desactivar la única cuenta activa que tiene el rol Administrador
- **THEN** el sistema SHALL rechazar la operación y SHALL explicar que primero debe habilitarse otro Administrador

#### Scenario: Retiro del rol al último Administrador
- **WHEN** se intenta retirar el rol Administrador de la única cuenta activa que lo posee
- **THEN** el sistema SHALL rechazar la modificación y SHALL conservar la asignación anterior

#### Scenario: Cambio cuando existe otro Administrador
- **WHEN** se desactiva o retira el rol a un Administrador y existe otra cuenta activa con ese rol
- **THEN** el sistema SHALL permitir el cambio si se cumplen las demás validaciones

