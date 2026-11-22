## MODIFIED Requirements

### Requirement: Objetivos de rapidez por tarea

El sistema SHALL permitir completar estas tareas dentro del número de acciones indicado. Son **objetivos provisionales**, estimados por el titular a partir del análisis del 2026-11-01 y verificados al cerrar U6 con el método `RNF-USA-016`.

| Requisito | Tarea | Línea base | Objetivo |
|---|---|---:|---:|
| `RNF-USA-013` | Servicio simple, cobrado, con su factura solicitada/preparada y la orden cerrada | 25 | 8 a 10 |
| `RNF-USA-014` | Venta de mostrador, cobrada y con su factura solicitada/preparada | 16 | 5 a 6 |
| `RNF-USA-015` | Mantenimiento con un servicio y un repuesto, cobrado, con sus dos facturas solicitadas/preparadas y la orden cerrada | 47 | 12 a 14 |

Al verificar U6, el conteo real de cada tarea SHALL registrarse con evidencia paso a paso conforme a `RNF-USA-016`, incluyendo la preselección automática del vehículo cuando el cliente tiene uno solo y el flujo «Cobrar y facturar» desde mantenimiento y desde venta rápida. Si alguna tarea supera su rango objetivo, la diferencia SHALL registrarse y presentarse al titular para decidir si ajusta el objetivo o el recorrido antes de archivar. No SHALL exigirse una observación previa con la usuaria diaria ni una comparación con el Facturador del SRI: el titular las declaró no necesarias el 2026-11-12.

Trazabilidad: `DP-036`, regla 7; `DP-037`; `docs/analisis-del-sistema.md` §3, §8.3 y anexo; `docs/cambios-pendientes.md`, U2 y U6.

#### Scenario: Comprobación al cerrar U6
- **DADO** U6 aplicado y las tres tareas medidas con el método `RNF-USA-016`
- **CUANDO** se verifica el cambio
- **ENTONCES** cada tarea SHALL quedar dentro de su objetivo, o la diferencia SHALL registrarse y presentarse al titular antes de archivar.

#### Scenario: Cliente con un solo vehículo al abrir un mantenimiento
- **DADO** un cliente registrado con un único vehículo
- **CUANDO** la usuaria diaria elige al cliente o su placa al abrir un mantenimiento
- **ENTONCES** el sistema SHALL preseleccionar ese vehículo automáticamente sin requerir un clic adicional de selección de vehículo.

#### Scenario: Programar sin observación previa
- **DADO** U3, U4, U5 o U6 sin una observación registrada con la usuaria diaria
- **CUANDO** se aprueba o se aplica el cambio
- **ENTONCES** la falta de esa observación SHALL NOT bloquearlo.
