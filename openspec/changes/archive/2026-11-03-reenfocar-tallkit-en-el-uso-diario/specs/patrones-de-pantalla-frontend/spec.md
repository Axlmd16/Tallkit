## ADDED Requirements

### Requirement: Patrones en reemplazo

Los patrones de esta spec quedan **en reemplazo** por `DP-036`, regla 6, y SHALL seguir vigentes hasta archivar U3, que decide cuáles se conservan. `PPF-06` se ajusta además en U6: la pantalla «Cobrar y facturar» SHALL valer como confirmación de lo que contiene, sin un diálogo adicional por cada acción.

Trazabilidad: `DP-036`, reglas 2, 6 y 8; `RNF-USA-003`; `interfaz-y-navegacion.md` §8.1; `docs/cambios-pendientes.md`, U3 y U6.

#### Scenario: Patrón usado antes de su reemplazo
- **DADO** una pantalla nueva o modificada antes de archivar U3
- **CUANDO** usa una lista, una ficha, un formulario o un diálogo
- **ENTONCES** SHALL seguir el patrón vigente de esta spec.

#### Scenario: Confirmación fuera de «Cobrar y facturar»
- **DADO** una anulación, una devolución u otra acción de la sección 8.1 fuera de «Cobrar y facturar»
- **CUANDO** se ejecuta, aun después de U6
- **ENTONCES** SHALL seguir confirmándose con el diálogo de `PPF-06`.
