# autenticacion-y-credenciales Specification

## Purpose
Establecer acceso por sesión, cierre, cambio de contraseña y restablecimiento administrativo seguro.
## Requirements
### Requirement: Inicio de sesión de un usuario activo
El sistema SHALL permitir que un **Usuario** activo inicie sesión con credenciales válidas y SHALL rechazar credenciales incorrectas o cuentas inactivas mediante un mensaje que no revele cuál condición falló. Trazabilidad: `RN-SEG-001`, `RF-ACC-001`, `CU-001`, `UI-001`, `RNF-SEG-002`, `RNF-SEG-007`.

#### Scenario: Inicio de sesión válido
- **WHEN** un usuario activo presenta sus credenciales válidas
- **THEN** el sistema SHALL crear una sesión autenticada y SHALL devolver la identidad necesaria para iniciar su experiencia autorizada

#### Scenario: Credenciales incorrectas
- **WHEN** se presenta un identificador desconocido o una contraseña incorrecta
- **THEN** el sistema SHALL rechazar el acceso con un mensaje genérico y SHALL NOT revelar si la cuenta existe

#### Scenario: Cuenta inactiva
- **WHEN** un usuario inactivo presenta credenciales que anteriormente eran válidas
- **THEN** el sistema SHALL rechazar el acceso con el mismo mensaje genérico usado para credenciales incorrectas

### Requirement: Protección de la autenticación por sesión
El sistema SHALL autenticar mediante sesión, SHALL proteger las operaciones que cambian estado contra solicitudes falsificadas y SHALL limitar el inicio de sesión a cinco intentos por minuto conforme al ADR-0003. Trazabilidad: `RNF-SEG-004` a `RNF-SEG-006`, `CU-001`, ADR-0003.

#### Scenario: Solicitud de acceso sin protección requerida
- **WHEN** un cliente intenta iniciar sesión sin la protección requerida para una escritura autenticada por sesión
- **THEN** el sistema SHALL rechazar la solicitud y SHALL NOT crear una sesión

#### Scenario: Límite de intentos de acceso
- **WHEN** un origen supera cinco intentos de inicio de sesión dentro de un minuto
- **THEN** el sistema SHALL limitar los intentos posteriores del período y SHALL registrar el evento sin almacenar contraseñas

### Requirement: Consulta y expiración de la sesión
El sistema SHALL permitir conocer si la sesión actual continúa autenticada y SHALL impedir que una sesión ausente, vencida o invalidada ejecute acciones protegidas. Trazabilidad: `RF-ACC-001`, `RF-ACC-002`, `CU-001`, `RNF-SEG-002`.

#### Scenario: Consulta de una sesión vigente
- **WHEN** un usuario consulta una sesión autenticada vigente
- **THEN** el sistema SHALL informar que está autenticado y SHALL identificar al usuario sin exponer datos sensibles

#### Scenario: Sesión expirada durante una acción
- **WHEN** una sesión expira antes de ejecutar una acción protegida
- **THEN** el sistema SHALL exigir una nueva autenticación y SHALL NOT ejecutar la acción pendiente

### Requirement: Cierre de sesión
El sistema SHALL permitir cerrar la sesión actual, SHALL invalidarla en el servidor y SHALL impedir su reutilización. Trazabilidad: `RF-ACC-002`, `CU-001`.

#### Scenario: Cierre de una sesión vigente
- **WHEN** un usuario autenticado cierra su sesión
- **THEN** el sistema SHALL invalidar esa sesión y una solicitud protegida posterior con ella SHALL ser rechazada

#### Scenario: Repetición del cierre
- **WHEN** se repite el cierre de una sesión que ya no está vigente
- **THEN** el sistema SHALL mantenerla cerrada y SHALL NOT crear efectos adicionales

### Requirement: Cambio de la propia contraseña
Un usuario autenticado SHALL poder cambiar su contraseña presentando la contraseña actual y una nueva contraseña válida; el sistema SHALL conservar únicamente su representación protegida y SHALL registrar el cambio sin registrar ninguna contraseña. Trazabilidad: `RF-ACC-003`, `RNF-SEG-001`, `RNF-MAN-010`.

#### Scenario: Cambio de contraseña válido
- **WHEN** un usuario presenta correctamente su contraseña actual y una nueva contraseña válida
- **THEN** el sistema SHALL aceptar la nueva contraseña, SHALL rechazar la anterior para accesos futuros y SHALL registrar el cambio

#### Scenario: Contraseña actual incorrecta
- **WHEN** un usuario intenta cambiar su contraseña sin confirmar correctamente la actual
- **THEN** el sistema SHALL rechazar el cambio y la credencial vigente SHALL permanecer sin alteración

### Requirement: Restablecimiento administrativo temporal
El **Administrador** SHALL poder restablecer la contraseña de otro usuario sin conocer la anterior. El sistema SHALL invalidar sus sesiones activas, SHALL generar una credencial temporal, SHALL mostrarla una sola vez al Administrador y SHALL exigir al usuario sustituirla en su siguiente acceso. V1 SHALL NOT enviar la credencial por correo o mensajería. Trazabilidad: `RF-ACC-004`, `CU-002`, `UI-010`, propuesta aprobada.

#### Scenario: Restablecimiento de contraseña
- **WHEN** un Administrador restablece la contraseña de un usuario
- **THEN** el sistema SHALL invalidar las sesiones de ese usuario, SHALL mostrar una sola vez una credencial temporal y SHALL marcar pendiente el cambio obligatorio

#### Scenario: Primer acceso con credencial temporal
- **WHEN** un usuario inicia sesión correctamente con una credencial temporal vigente
- **THEN** el sistema SHALL permitir únicamente consultar o cerrar su sesión y establecer una nueva contraseña antes de acceder a otras funciones internas

#### Scenario: Credencial temporal sustituida
- **WHEN** el usuario establece una nueva contraseña válida después del restablecimiento
- **THEN** el sistema SHALL invalidar la credencial temporal y SHALL habilitar el acceso correspondiente a sus permisos

#### Scenario: Usuario sin permiso intenta restablecer
- **WHEN** un usuario que no es Administrador intenta restablecer la contraseña de otra cuenta
- **THEN** el sistema SHALL denegar la operación y SHALL NOT modificar credenciales ni sesiones

