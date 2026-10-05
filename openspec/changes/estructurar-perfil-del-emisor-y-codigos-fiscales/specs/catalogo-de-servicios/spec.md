## MODIFIED Requirements

### Requirement: Ficha persistente de servicio referencial

Un **Servicio** SHALL exigir nombre no vacío, **precio referencial**, estado y selección tributaria artesanal; descripción SHALL ser opcional y el estado inicial activo. SHALL NOT pedirse un código a quien lo registra: el sistema SHALL asignar al crearlo un **código de servicio** visible, único e inmutable, con el prefijo `SRV-` y un número correlativo de al menos seis dígitos completados con ceros, de modo que nunca supere los 25 caracteres. La asignación SHALL ocurrir en la misma transacción que el alta y ser segura ante altas concurrentes; un alta fallida SHALL NOT dejar un servicio sin código. El código SHALL NOT reutilizarse aunque el servicio se desactive, SHALL NOT aceptarse ni modificarse desde una alta o edición, y SHALL mostrarse en la ficha, en el listado y en la búsqueda. Los servicios existentes SHALL recibir su código una sola vez, en orden de creación, conservando su identidad. SHALL poder crearse, consultarse y editarse conservando identidad. El nombre SHALL quitar espacios exteriores; nombres iguales no SHALL convertirse en restricción de unicidad no prevista en proposal. Cambios del catálogo SHALL NOT alterar valores de servicios ya aplicados a mantenimientos. El **precio aplicado** en una futura operación podrá diferir sin modificar el referencial. Trazabilidad: RN-CAT-008/009; RF-CAT-010/011; DP-020; CU-016; UI-034/035; propuesta de estructurar-perfil-del-emisor-y-codigos-fiscales §C.13 y D3.

#### Scenario: Alta mínima
- **GIVEN** un usuario autorizado y una definición tributaria artesanal
- **WHEN** crea un servicio con nombre y precio sin descripción ni código
- **THEN** SHALL persistirse activo con un código asignado por el sistema y recuperarse al consultar su ficha

#### Scenario: Nombre vacío
- **GIVEN** una alta o edición
- **WHEN** el nombre solo contiene espacios
- **THEN** SHALL rechazarse indicando el campo y conservando los datos anteriores

#### Scenario: Edición referencial
- **GIVEN** un servicio ya referenciado
- **WHEN** se cambia nombre, descripción o precio
- **THEN** SHALL conservarse su identidad y los valores históricos de servicios aplicados

#### Scenario: Nombres coincidentes
- **GIVEN** un servicio llamado Diagnóstico
- **WHEN** se registra otro servicio válido con igual nombre
- **THEN** SHALL conservarse como registro distinto sin imponer unicidad de nombre

#### Scenario: Código asignado al crear
- **GIVEN** un catálogo cuyo último código de servicio es `SRV-000011`
- **WHEN** un usuario autorizado crea un servicio válido
- **THEN** SHALL persistirse con el código `SRV-000012`, visible en su ficha y en el listado

#### Scenario: Intento de enviar o cambiar el código
- **GIVEN** un servicio con código `SRV-000012`
- **WHEN** una alta o una edición incluye un código elegido por el usuario
- **THEN** SHALL rechazarse con un error asociado al campo, sin crear ni modificar el servicio

#### Scenario: Altas concurrentes
- **GIVEN** dos altas válidas de servicios distintos procesadas a la vez
- **WHEN** ambas se confirman
- **THEN** cada servicio SHALL tener un código diferente y no SHALL existir códigos repetidos

#### Scenario: Servicios existentes
- **GIVEN** un catálogo con servicios creados antes de existir el código
- **WHEN** se aplica el cambio
- **THEN** cada uno SHALL tener un código único asignado en orden de creación, sin alterar su nombre, precio, estado ni los servicios ya aplicados a mantenimientos

#### Scenario: Servicio desactivado
- **GIVEN** un servicio con código `SRV-000005` que se desactiva
- **WHEN** se crea otro servicio
- **THEN** SHALL NOT recibir `SRV-000005`

#### Scenario: Búsqueda por código
- **GIVEN** un servicio con código `SRV-000012`
- **WHEN** se busca « srv-000012 »
- **THEN** SHALL localizarse ese servicio

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
