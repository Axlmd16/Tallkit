# objetivos-de-uso-diario Specification

## Purpose
TBD - created by archiving change reenfocar-tallkit-en-el-uso-diario. Update Purpose after archive.
## Requirements
### Requirement: Usuaria diaria como referencia de diseño

Las pantallas y los recorridos de uso diario SHALL diseñarse y evaluarse para la **usuaria diaria**: la persona que atiende cada día en el taller, sin conocimientos contables, con los roles Administrador, Vendedor y Encargado del taller. Esta referencia SHALL NOT crear roles ni permisos: los permisos SHALL seguir derivándose de los roles fijos y acumulables, y el servidor SHALL seguir decidiéndolos. Las opciones de uso poco frecuente SHALL agruparse en «Ajustes» cuando se reorganice la navegación (U4).

Trazabilidad: `DP-036`, regla 1; `CT-001`; `actores-y-roles.md` §4 y §5; `RNF-SEG-003`; propuesta §A.

#### Scenario: Evaluar un recorrido
- **DADO** un cambio que diseña o modifica un recorrido de uso diario
- **CUANDO** se evalúa antes de aprobarlo
- **ENTONCES** SHALL evaluarse con los tres roles acumulados de la usuaria diaria y en lenguaje que no exija conocimientos contables.

#### Scenario: Usuario con un solo rol
- **DADO** un usuario que solo tiene el rol Vendedor
- **CUANDO** intenta una acción reservada al Administrador o al Encargado del taller
- **ENTONCES** el servidor SHALL rechazarla igual que antes de esta decisión.

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

### Requirement: Método para contar acciones

`RNF-USA-016`: las acciones SHALL contarse con el mismo método de la línea base, para que las cifras sean comparables:

- se parte del Inicio con la sesión iniciada;
- el cliente ya está registrado, con su correo y, en las tareas de taller, con un solo vehículo;
- los catálogos y la configuración fiscal están completos;
- cada clic, cada campo escrito y cada elección en una lista cuentan como una acción, y escribir un campo cuenta una sola vez sin importar su longitud;
- las ventanas de confirmación, los cambios de pestaña y los regresos a otra pantalla cuentan como acciones;
- la tarea termina cuando las facturas quedan solicitadas y, en las tareas de taller, la orden queda finalizada.

Mientras la emisión real no esté habilitada, «factura solicitada» SHALL significar que la solicitud quedó registrada en el sistema, sin presentarse como autorizada.

Trazabilidad: `DP-036`, regla 7; `docs/analisis-del-sistema.md` §2 y anexo; `DP-034`, regla 8; `RF-FIS-002`.

#### Scenario: Recorrido con una acción omitida en el conteo
- **DADO** un recorrido que pide confirmar en una ventana o cambiar de pestaña
- **CUANDO** se cuentan sus acciones
- **ENTONCES** esas acciones SHALL sumarse al total, igual que en la línea base.

#### Scenario: Cliente sin correo o con varios vehículos
- **DADO** un cliente sin correo guardado o con más de un vehículo
- **CUANDO** se mide una tarea
- **ENTONCES** la medición SHALL registrarse aparte y SHALL NOT compararse con los objetivos, que suponen el caso habitual.

### Requirement: Rapidez sin omitir reglas

Ningún objetivo de rapidez SHALL alcanzarse omitiendo una regla vigente. Un recorrido que cumpla los objetivos mezclando entidades fiscales, uniendo cobros o facturas, aceptando stock negativo, saltándose un permiso o un dato exigido por el SRI, o presentando una factura como autorizada sin estarlo SHALL considerarse incumplido.

Trazabilidad: `DP-036`, reglas 2 y 7; `DP-002`, `DP-013`, `DP-034`, `DP-035`; invariantes 1, 2, 6 y 17 del modelo de dominio.

#### Scenario: Atajo que rompe una regla
- **DADO** un recorrido que logra 8 acciones registrando un solo pago para servicios y repuestos
- **CUANDO** se verifica contra los objetivos
- **ENTONCES** SHALL marcarse como incumplido aunque el conteo esté dentro del objetivo.
