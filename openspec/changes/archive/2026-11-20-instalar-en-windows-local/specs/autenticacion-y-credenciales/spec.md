# autenticacion-y-credenciales Delta Specification

## MODIFIED Requirements

### Requirement: Consulta y expiración de la sesión
El sistema SHALL permitir conocer si la sesión actual continúa autenticada y SHALL impedir que una sesión ausente, vencida por tiempo absoluto, vencida por inactividad configurable o invalidada ejecute acciones protegidas. Trazabilidad: `RF-ACC-001`, `RF-ACC-002`, `CU-001`, `RNF-SEG-002`, `DA-003`.

#### Scenario: Consulta de una sesión vigente
- **WHEN** un usuario consulta una sesión autenticada vigente dentro del plazo de actividad e inactividad configurado
- **THEN** el sistema SHALL informar que está autenticado y SHALL identificar al usuario sin exponer datos sensibles

#### Scenario: Sesión expirada durante una acción o por inactividad
- **WHEN** una sesión supera el tiempo máximo de duración o permanece inactiva más allá del umbral configurable antes de ejecutar una acción protegida
- **THEN** el sistema SHALL exigir una nueva autenticación y SHALL NOT ejecutar la acción pendiente
