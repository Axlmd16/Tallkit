## MODIFIED Requirements

### Requirement: PPF-06 Diálogos de confirmación
Las acciones de la sección 8.1 de `interfaz-y-navegacion.md` ejecutadas fuera de «Cobrar y facturar» SHALL confirmarse en un diálogo. El diálogo SHALL:
- nombrar el objeto y su número interno cuando exista;
- indicar la entidad fiscal cuando la acción sea económica;
- explicar el efecto en el cuerpo;
- exigir el motivo cuando corresponda;
- mostrar los valores revisados por el servidor antes de habilitar la acción.

El botón principal SHALL usar un texto breve que nombre la acción, por ejemplo «Confirmar venta», «Registrar cobro» o «Anular venta». Las acciones destructivas SHALL usar el tratamiento de peligro, y la salida segura SHALL nombrarse con claridad, por ejemplo «Conservar venta».

**Excepción en «Cobrar y facturar» (`DP-036`, regla 2):** dentro de la pantalla «Cobrar y facturar», la propia pantalla SHALL actuar como confirmación única de las acciones que agrupa (confirmar operación/venta, registrar cobros independientes, preparar facturas locales y, si se marcó, cerrar el mantenimiento), mostrando el nombre de cada negocio, el efecto y los valores revisados por el servidor, sin exigir un diálogo adicional por cada paso.

**Trazabilidad:** `DP-036` regla 2; `DP-037`; `RNF-USA-003`, `RNF-USA-006`; sección 8.1 de `interfaz-y-navegacion.md`; `DP-027`, `DP-028`; tablero «Diálogos de ventas».

#### Scenario: Confirmar una venta revisada fuera de «Cobrar y facturar»
- **GIVEN** un borrador guardado cuya revisión del servidor está lista en el editor tradicional de venta
- **WHEN** el usuario abre «Revisar y confirmar»
- **THEN** el diálogo SHALL mostrar base, impuesto y total del servidor, el efecto en existencias por producto y que el cobro se registra aparte, y SHALL habilitar «Confirmar venta»

#### Scenario: Confirmación única dentro de «Cobrar y facturar»
- **GIVEN** la pantalla «Cobrar y facturar» con los valores revisados del servidor y los dos negocios visibles
- **WHEN** el usuario activa «Cobrar y facturar»
- **THEN** la ejecución SHALL iniciarse directamente sin abrir diálogos adicionales por cada documento o cobro

#### Scenario: Revisión pendiente o rechazada
- **WHEN** la revisión del servidor no está lista o informa que no se puede confirmar
- **THEN** la acción principal SHALL permanecer deshabilitada y el diálogo o pantalla SHALL explicar el motivo

#### Scenario: Anulación sin motivo
- **WHEN** el usuario intenta anular sin escribir el motivo
- **THEN** el diálogo SHALL mostrar el error junto al campo de motivo y SHALL NOT enviar la anulación

### Requirement: Patrones en reemplazo

Todos los patrones de esta spec, incluido el ajuste de `PPF-06` para «Cobrar y facturar», SHALL regir plenamente con la dirección «Grafito y cobre». Las acciones de la sección 8.1 fuera de «Cobrar y facturar» (como anulaciones, devoluciones y reaperturas) SHALL conservar su diálogo de confirmación de `PPF-06`.

Trazabilidad: `DP-036`, reglas 2 y 6; `DP-037`; `RNF-USA-003`; `interfaz-y-navegacion.md` §8.1; `docs/cambios-pendientes.md`, U3 y U6.

#### Scenario: Confirmación fuera de «Cobrar y facturar»
- **DADO** una anulación, una devolución u otra acción de la sección 8.1 fuera de «Cobrar y facturar»
- **CUANDO** se ejecuta
- **ENTONCES** SHALL seguir confirmándose con el diálogo de `PPF-06`.
