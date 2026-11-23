## MODIFIED Requirements

### Requirement: Establecimientos y puntos fiscales con vigencia e historia

El Administrador SHALL gestionar establecimientos y puntos de emisión por entidad, preservando códigos de tres dígitos ASCII y ceros iniciales; `000` SHALL rechazarse para ambos. SHALL impedirse duplicar un establecimiento dentro de una entidad o un punto dentro de su establecimiento. La dirección del establecimiento será obligatoria para preparar. Un ámbito usado SHALL conservar identidad e historia y deshabilitarse prospectivamente; nunca SHALL reasignarse a otro RUC ni renombrarse para reutilizar números. Los códigos no prueban registro ante el SRI.

Una entidad puede tener varios puntos activos, pero SHALL existir un **punto predeterminado** para preparar:

- si hay un único punto activo en un establecimiento activo, SHALL usarse automáticamente;
- si hay varios, el Administrador SHALL designar uno;
- sin designación determinable, la preparación SHALL bloquearse con un impedimento dirigido al Administrador.

El punto predeterminado SHALL pertenecer a la misma entidad y estar activo. Designarlo SHALL NOT afectar preparaciones completadas.

Cada punto de emisión SHALL permitir al Administrador declarar si es un **punto exclusivo para modalidad electrónica** (`NOR-007`, de modo que no se utilice simultáneamente en el Facturador gratuito del SRI ni en otro sistema) y registrar o consultar el **último secuencial autorizado** portable de ese punto.

La configuración de emisión se administra por **entidad fiscal** de forma independiente (`DP-034`, regla 4): cada entidad conserva su estado de activación de emisión (*Inactiva* o *Activa en pruebas*), su adaptador configurado y su ambiente objetivo (*Pruebas* `1` o *Producción* `2`). En esta entrega (cambio 3), conforme a `DP-034` regla 8, el único ambiente activable SHALL ser *Pruebas* (`1`) con el adaptador simulado; la interfaz y la API SHALL mostrar el ambiente actual por entidad y SHALL rechazar todo intento de activar o seleccionar el ambiente de *Producción* (`2`) explicando que la emisión real se habilita en el cambio 4 tras cumplir las condiciones de activación. Activar la emisión en pruebas para una entidad SHALL exigir que su perfil del emisor esté en estado *Lista para preparación local*, que exista punto predeterminado exclusivo y que no afecte el estado de activación de la otra entidad fiscal.

Trazabilidad: propuesta §1/2, P4; propuesta de simplificación B8/B12, R1/R2; propuesta `emitir-comprobantes-electronicos` §B.4 y §B.6; `DP-006`; `DP-018`; `DP-034`, reglas 3, 4 y 8; `RN-FIS-008`, `RN-FIS-012`, `RN-FIS-017`; `RF-ACC-012`; `RF-FIS-003`, `RF-FIS-013`; `NOR-007`; ficha técnica SRI, tabla 1.

#### Scenario: Códigos con ceros iniciales y punto único predeterminado
- **DADO** una entidad con establecimiento `001` y un único punto activo `001` o `002`
- **CUANDO** se registra el punto y se prepara una operación de esa entidad
- **ENTONCES** SHALL conservarse el código con ceros iniciales (`001-001` o `001-002`) sin compartirlo con la otra entidad y SHALL usarse automáticamente como punto predeterminado cuando sea el único activo.

#### Scenario: Varios puntos sin designación o designación cruzada inválida
- **DADO** una entidad con varios puntos activos sin ninguno designado como predeterminado, o un intento de designar un punto de la otra entidad fiscal
- **CUANDO** se revisa una preparación o el Administrador intenta guardar la designación cruzada
- **ENTONCES** la preparación SHALL bloquearse indicando al Administrador que designe el punto predeterminado, y la designación cruzada SHALL rechazarse sin cambios.

#### Scenario: Activación independiente en ambiente de pruebas por entidad fiscal
- **DADO** la entidad artesanal con perfil *Lista para preparación local*, punto predeterminado exclusivo y último secuencial inicial declarado, y la entidad comercial aún en *Falta completar*
- **CUANDO** el Administrador activa la emisión en ambiente de *Pruebas* para la entidad artesanal
- **ENTONCES** la entidad artesanal SHALL quedar activa para emitir en pruebas con el adaptador simulado mientras la entidad comercial permanece inactiva y sigue confirmando ventas y cobros internos con normalidad.

#### Scenario: Rechazo de activación en producción o sin punto exclusivo
- **DADO** un Administrador que intenta seleccionar o activar el ambiente de *Producción* (`2`), o activar la emisión sin declarar el uso exclusivo del punto predeterminado
- **CUANDO** envía el comando administrativo de configuración
- **ENTONCES** el servidor SHALL rechazarlo explicando la condición incumplida o que la emisión real en producción no está habilitada en esta entrega (`DP-034`, regla 8), sin modificar la configuración vigente.
