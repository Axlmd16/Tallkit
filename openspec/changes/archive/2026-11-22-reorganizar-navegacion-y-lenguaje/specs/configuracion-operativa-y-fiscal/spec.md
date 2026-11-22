## ADDED Requirements

### Requirement: Nombre comercial solicitado en la configuración inicial

La configuración inicial SHALL pedir el nombre comercial de cada entidad fiscal junto a su razón social, explicando que es el nombre con el que se identificará el negocio en las pantallas. El nombre comercial SHALL seguir siendo opcional: si se deja vacío, el sistema SHALL guardar su ausencia y las pantallas SHALL identificar el negocio por su razón social. El Administrador SHALL poder completarlo o cambiarlo después desde «Ajustes», y un cambio SHALL aplicarse a las pantallas sin alterar documentos, recibos ni facturas ya preparados, que conservan el nombre de su instantánea.

Trazabilidad: `DP-036`, regla 3; `RN-FIS-009`; `docs/cambios-pendientes.md`, U1 («nombre comercial opcional, se mantiene») y U4; propuesta, decisión 5; `lenguaje-visible-de-uso-diario`.

#### Scenario: Configuración inicial con nombre comercial
- **DADO** un Administrador que completa la configuración inicial
- **CUANDO** escribe el nombre comercial de una entidad y guarda
- **ENTONCES** SHALL guardarse y las pantallas SHALL mostrar ese nombre para el negocio.

#### Scenario: Nombre comercial vacío
- **DADO** una entidad cuyo nombre comercial se deja vacío
- **CUANDO** se guarda la configuración y se abre una pantalla del negocio
- **ENTONCES** SHALL aceptarse sin error y SHALL mostrarse su razón social.

#### Scenario: Cambio posterior
- **DADO** una entidad con documentos ya preparados
- **CUANDO** el Administrador cambia su nombre comercial
- **ENTONCES** las pantallas SHALL mostrar el nombre nuevo y los documentos preparados SHALL conservar el de su instantánea.
