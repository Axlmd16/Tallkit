## ADDED Requirements

### Requirement: Navegación y densidad en reemplazo

La navegación agrupada por área de trabajo y las filas compactas de esta spec quedan **en reemplazo** por `DP-036`, reglas 5 y 6: U4 reorganiza el menú y U3 decide la densidad, y hasta entonces siguen vigentes. Los requisitos de tamaños de pantalla, teclado, controles táctiles, movimiento, modales y permisos de la navegación SHALL seguir vigentes sin cambio.

Trazabilidad: `DP-036`, reglas 5, 6 y 8; `interfaz-y-navegacion.md` §2.1 y §2.2; `docs/cambios-pendientes.md`, U3 y U4.

#### Scenario: Menú antes de U4
- **DADO** U4 sin archivar
- **CUANDO** un cambio agrega una entrada a la navegación
- **ENTONCES** SHALL ubicarla en los grupos vigentes y respetar los permisos efectivos.

#### Scenario: Requisito de accesibilidad
- **DADO** el requisito de controles táctiles de al menos 44 px o el de operación con teclado
- **CUANDO** se reorganiza la navegación o se cambia la densidad
- **ENTONCES** SHALL seguir cumpliéndose.
