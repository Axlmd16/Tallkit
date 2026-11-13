## MODIFIED Requirements

### Requirement: Objetivos de rapidez por tarea

El sistema SHALL permitir completar estas tareas dentro del número de acciones indicado. Son **objetivos provisionales**, estimados por el titular a partir del análisis del 2026-11-01.

| Requisito | Tarea | Hoy | Objetivo |
|---|---|---:|---:|
| `RNF-USA-013` | Servicio simple, cobrado, con su factura solicitada y la orden cerrada | 25 | 8 a 10 |
| `RNF-USA-014` | Venta de mostrador, cobrada y con su factura solicitada | 16 | 5 a 6 |
| `RNF-USA-015` | Mantenimiento con un servicio y un repuesto, cobrado, con sus dos facturas solicitadas y la orden cerrada | 47 | 12 a 14 |

Los objetivos SHALL comprobarse al cerrar U6, que también acorta el registro de la orden, de sus servicios y de sus repuestos. Hasta entonces SHALL constar como aprobados y todavía no implementados. No SHALL exigirse una observación previa con la usuaria diaria ni una comparación con el Facturador del SRI: el titular las declaró no necesarias el 2026-11-12.

Trazabilidad: `DP-036`, regla 7; `docs/analisis-del-sistema.md` §3, §8.3 y anexo; `docs/cambios-pendientes.md`, U2; propuesta de `renovar-sistema-visual`.

#### Scenario: Comprobación al cerrar U6
- **DADO** U6 aplicado y las tres tareas medidas con el método vigente
- **CUANDO** se verifica el cambio
- **ENTONCES** cada tarea SHALL quedar dentro de su objetivo, o la diferencia SHALL registrarse y presentarse al titular, que decide si ajusta el objetivo o el recorrido antes de archivar.

#### Scenario: Requisito sin implementar
- **DADO** U6 todavía sin archivar
- **CUANDO** se consulta la trazabilidad de `RNF-USA-013` a `RNF-USA-015`
- **ENTONCES** SHALL constar como aprobados y pendientes de U6, y SHALL NOT constar como cumplidos.

#### Scenario: Programar sin observación previa
- **DADO** U3, U4, U5 o U6 sin una observación registrada con la usuaria diaria
- **CUANDO** se aprueba o se aplica el cambio
- **ENTONCES** la falta de esa observación SHALL NOT bloquearlo.

## REMOVED Requirements

### Requirement: Comprobación con la usuaria diaria
**Reason**: El titular declaró no necesarias la observación con la usuaria diaria y la comparación con el Facturador del SRI el 2026-11-12, después de que la usuaria revisara y aprobara el prototipo de U2 (`docs/cambios-pendientes.md`, U2).
**Migration**: Los objetivos de `RNF-USA-013` a `RNF-USA-015` se comprueban al cerrar U6 con el método de `RNF-USA-016`, según «Objetivos de rapidez por tarea».
