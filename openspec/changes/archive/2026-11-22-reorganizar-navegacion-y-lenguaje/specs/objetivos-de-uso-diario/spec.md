## MODIFIED Requirements

### Requirement: Usuaria diaria como referencia de diseño

Las pantallas y los recorridos de uso diario SHALL diseñarse y evaluarse para la **usuaria diaria**: la persona que atiende cada día en el taller, sin conocimientos contables, con los roles Administrador, Vendedor y Encargado del taller. Esta referencia SHALL NOT crear roles ni permisos: los permisos SHALL seguir derivándose de los roles fijos y acumulables, y el servidor SHALL seguir decidiéndolos. Las opciones de uso poco frecuente SHALL agruparse en «Ajustes», según `navegacion-de-uso-diario`.

Trazabilidad: `DP-036`, regla 1; `CT-001`; `actores-y-roles.md` §4 y §5; `RNF-SEG-003`; propuesta §A.

#### Scenario: Evaluar un recorrido
- **DADO** un cambio que diseña o modifica un recorrido de uso diario
- **CUANDO** se evalúa antes de aprobarlo
- **ENTONCES** SHALL evaluarse con los tres roles acumulados de la usuaria diaria y en lenguaje que no exija conocimientos contables.

#### Scenario: Usuario con un solo rol
- **DADO** un usuario que solo tiene el rol Vendedor
- **CUANDO** intenta una acción reservada al Administrador o al Encargado del taller
- **ENTONCES** el servidor SHALL rechazarla igual que antes de esta decisión.
