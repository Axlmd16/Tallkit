## ADDED Requirements

### Requirement: Dirección visual en reemplazo

La dirección **Tallkit · Banco de trabajo** de esta spec queda **en reemplazo** por `DP-036`, regla 6: neutros en capas, densidad alta, tipografía contenida y radios contenidos. Sigue vigente hasta archivar U3. La dirección nueva SHALL escribirse solo al aprobar el prototipo de U2 y SHALL aplicarse solo mediante U3, que decide qué requisitos de esta spec se conservan.

Trazabilidad: `DP-036`, reglas 6 y 8; `docs/analisis-del-sistema.md` §6.4 y §8.4; `docs/cambios-pendientes.md`, U2 y U3.

#### Scenario: Pantalla modificada antes de U3
- **DADO** un cambio que modifica una pantalla antes de archivar U3
- **CUANDO** se diseña o se aplica
- **ENTONCES** SHALL seguir los requisitos vigentes de esta spec.

#### Scenario: Dirección nueva sin prototipo aprobado
- **DADO** una propuesta de paleta, tipografía o tokens nuevos sin el prototipo de U2 aprobado
- **CUANDO** se intenta incorporarla
- **ENTONCES** SHALL NOT reemplazar esta spec.
