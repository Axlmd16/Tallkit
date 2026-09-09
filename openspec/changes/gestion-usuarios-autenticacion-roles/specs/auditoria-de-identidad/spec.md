## ADDED Requirements

### Requirement: Registro de eventos administrativos de identidad
El sistema SHALL registrar el resultado de crear, editar, activar o desactivar un **Usuario**, cambiar sus **Roles** y restablecer sus credenciales. Cada evento SHALL conservar fecha y hora, usuario actor, acción, tipo e identificador del objeto afectado, resultado y motivo cuando corresponda. Trazabilidad: `RN-SEG-005`, `RF-ACC-009`, `RF-AUD-001`, `RF-AUD-005`, `RNF-AUD-001`.

#### Scenario: Cambio administrativo exitoso
- **WHEN** un **Administrador** modifica los roles de un usuario
- **THEN** el sistema SHALL registrar al actor, la cuenta afectada, la acción, el resultado exitoso y el momento del cambio

#### Scenario: Cambio administrativo rechazado
- **WHEN** una modificación de usuario es rechazada por una validación o permiso
- **THEN** el sistema SHALL registrar el intento y su resultado fallido sin afirmar que el cambio ocurrió

### Requirement: Registro de eventos de autenticación y seguridad
El sistema SHALL registrar inicios y cierres de sesión, fallos repetidos de autenticación, aplicación del límite de intentos, cambios de contraseña, restablecimientos y denegaciones críticas de autorización. Trazabilidad: `RNF-SEG-006`, `RNF-AUD-004`, `CU-001`, `CU-002`.

#### Scenario: Inicio de sesión exitoso
- **WHEN** un usuario inicia sesión correctamente
- **THEN** el sistema SHALL registrar el usuario, el resultado y el momento del acceso

#### Scenario: Fallos repetidos de autenticación
- **WHEN** varios intentos fallidos activan el límite de acceso
- **THEN** el sistema SHALL registrar el evento sospechoso sin almacenar la contraseña ni atribuirlo a una cuenta no confirmada

#### Scenario: Denegación crítica por falta de permiso
- **WHEN** un usuario intenta ejecutar directamente una acción administrativa que no tiene concedida
- **THEN** el sistema SHALL registrar la denegación con la identidad autenticada, la acción solicitada y el resultado

### Requirement: Exclusión de secretos y datos innecesarios
Los eventos de auditoría y registros técnicos SHALL NOT almacenar contraseñas actuales, anteriores o temporales, secretos de sesión ni datos personales innecesarios para explicar la acción. Trazabilidad: `RNF-SEG-001`, `RNF-SEG-006`, `RNF-MAN-010`, `RNF-AUD-001`.

#### Scenario: Auditoría de un restablecimiento
- **WHEN** un Administrador restablece la contraseña de un usuario
- **THEN** el evento SHALL indicar que ocurrió el restablecimiento y SHALL NOT contener la contraseña anterior, nueva o temporal

#### Scenario: Auditoría de un acceso fallido
- **WHEN** el sistema registra un intento de acceso fallido
- **THEN** el evento SHALL NOT conservar el valor presentado como contraseña

### Requirement: Inmutabilidad operativa de la auditoría
Los eventos de auditoría SHALL NOT poder editarse ni eliminarse mediante funciones ordinarias de la aplicación. Una corrección administrativa SHALL producir un evento adicional y SHALL NOT sobrescribir el anterior. Trazabilidad: `RF-AUD-003`, `RNF-AUD-002`.

#### Scenario: Intento de editar un evento
- **WHEN** un usuario intenta modificar un evento de auditoría existente mediante una función ordinaria
- **THEN** el sistema SHALL rechazar la operación y SHALL conservar el evento original

### Requirement: Consulta autorizada de actividad
Solo el Administrador SHALL poder consultar la auditoría de identidad y SHALL poder filtrarla por usuario, período, acción, tipo de objeto, identificador y resultado. Las fechas SHALL mostrarse en la zona horaria `America/Guayaquil`. Trazabilidad: `RF-ACC-009`, `UI-018`, `RNF-AUD-005`.

#### Scenario: Consulta filtrada por un Administrador
- **WHEN** un Administrador filtra los eventos por usuario, período y resultado
- **THEN** el sistema SHALL mostrar únicamente los eventos coincidentes en la zona horaria del negocio

#### Scenario: Consulta por un usuario no autorizado
- **WHEN** un Vendedor o Encargado del taller intenta consultar la auditoría de identidad
- **THEN** el sistema SHALL denegar el acceso y SHALL NOT revelar eventos
