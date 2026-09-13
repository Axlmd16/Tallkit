# autorizacion-y-navegacion Specification

## Purpose
Exigir permisos vigentes en el servidor y adaptar la navegación a la sesión autorizada.
## Requirements
### Requirement: Autenticación obligatoria para funciones internas
Toda función interna de negocio SHALL exigir una sesión vigente de un **Usuario** activo, salvo los recursos técnicos declarados expresamente públicos. Trazabilidad: `RN-SEG-001`, `RF-ACC-001`, `RNF-SEG-002`.

#### Scenario: Acceso anónimo a una función interna
- **WHEN** una persona sin sesión vigente solicita una función interna
- **THEN** el sistema SHALL rechazar el acceso y SHALL NOT ejecutar ni revelar la operación solicitada

#### Scenario: Acceso a un recurso expresamente público
- **WHEN** una persona sin sesión consulta un recurso técnico declarado público
- **THEN** el sistema MAY responder sin conceder acceso a ninguna función interna de negocio

### Requirement: Autorización obligatoria en el backend
El backend SHALL comprobar el permiso específico de cada acción protegida y SHALL denegar por defecto toda acción no concedida por los roles del usuario, independientemente de lo mostrado por la interfaz. Trazabilidad: `RN-SEG-004`, `RN-SEG-007`, `RF-ACC-008`, `RNF-SEG-003`.

#### Scenario: Acción permitida por el rol
- **WHEN** un usuario autenticado solicita una acción concedida por al menos uno de sus roles
- **THEN** el backend SHALL permitir que la acción continúe hacia sus demás validaciones

#### Scenario: Llamada directa sin permiso
- **WHEN** un usuario intenta invocar directamente una acción que ninguno de sus roles concede
- **THEN** el backend SHALL denegarla y SHALL NOT cambiar datos

#### Scenario: Acción sin regla de permiso definida
- **WHEN** una función interna no tiene una concesión explícita para los roles del usuario
- **THEN** el backend SHALL denegar el acceso por defecto

### Requirement: Unión de permisos de varios roles
Los permisos efectivos de un usuario SHALL ser la unión de los permisos fijos de todos sus **Roles**, sin que un rol elimine los permisos concedidos por otro. Trazabilidad: `CT-001`, `RN-SEG-003`, `RF-ACC-007`.

#### Scenario: Usuario con roles Vendedor y Encargado del taller
- **WHEN** un usuario tiene simultáneamente los roles **Vendedor** y **Encargado del taller**
- **THEN** sus permisos efectivos SHALL incluir las concesiones fijas de ambos roles

#### Scenario: Retiro de uno de varios roles
- **WHEN** el Administrador retira un rol y el usuario conserva otro
- **THEN** el sistema SHALL retirar únicamente los permisos que ya no estén concedidos por ninguno de sus roles

### Requirement: Aplicación oportuna de cambios de seguridad
Los controles del backend SHALL usar la asignación vigente de estado y roles. La desactivación de un usuario, el restablecimiento de su contraseña o la reducción de sus roles SHALL invalidar todas sus sesiones activas. Trazabilidad: decisiones aprobadas en la propuesta; `RN-SEG-006`, `RF-ACC-004`, `RF-ACC-005`, `RF-ACC-008`.

#### Scenario: Uso de una sesión después de reducir roles
- **WHEN** un Administrador retira un rol a un usuario que tenía una sesión activa
- **THEN** esa sesión SHALL quedar invalidada y el usuario SHALL autenticarse nuevamente con sus permisos vigentes

#### Scenario: Uso de una sesión después de desactivar la cuenta
- **WHEN** se intenta reutilizar una sesión perteneciente a un usuario desactivado
- **THEN** el backend SHALL rechazarla y SHALL NOT ejecutar acciones protegidas

### Requirement: Navegación conforme a permisos
La interfaz SHALL mostrar módulos, enlaces y acciones únicamente cuando los permisos efectivos del usuario los habiliten, y SHALL mantener disponible el cierre de sesión para todo usuario autenticado. Trazabilidad: `RF-ACC-008`, `UI-002`, principios 1 y 2 de `interfaz-y-navegacion.md`.

#### Scenario: Navegación de un Vendedor
- **WHEN** un usuario autenticado tiene únicamente el rol Vendedor
- **THEN** la interfaz SHALL mostrar solo la navegación y acciones concedidas a ese rol y SHALL ocultar la administración de usuarios

#### Scenario: Navegación con varios roles
- **WHEN** un usuario autenticado reúne varios roles
- **THEN** la interfaz SHALL mostrar la unión de los módulos y acciones permitidos por esos roles

#### Scenario: Permiso retirado durante el uso
- **WHEN** una sesión es invalidada debido a una reducción de roles
- **THEN** la interfaz SHALL abandonar la experiencia autenticada y SHALL solicitar un nuevo inicio de sesión

### Requirement: Denegación comprensible sin filtración
Una denegación SHALL comunicar que el usuario no puede realizar la acción sin revelar datos protegidos, reglas internas innecesarias ni detalles de infraestructura. Trazabilidad: `RNF-SEG-007`, `RNF-USA-004`.

#### Scenario: Consulta de un recurso no autorizado
- **WHEN** un usuario autenticado intenta consultar un recurso para el cual no tiene permiso
- **THEN** el sistema SHALL informar la denegación sin incluir el contenido protegido ni detalles internos

