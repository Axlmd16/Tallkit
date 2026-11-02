## MODIFIED Requirements

### Requirement: Costos de Kardex según autorización

Los tres roles SHALL consultar cantidades mediante `inventario.ver`. Solo Administrador con `inventario.ver_valorizacion` SHALL recibir costo unitario aplicado, valor de entrada/salida, promedio y saldo valorizado, incluida la precisión y residuos necesarios para explicar la conciliación. Resúmenes, datos de origen y errores SHALL aplicar la misma restricción. La consulta histórica SHALL usar cantidades, unidades, costos y valores conservados en el movimiento, no recalcularlos con el catálogo actual. Un movimiento sin costo SHALL presentarse al Administrador como sin costo registrado, distinto de un costo cero, y los saldos valorizados de ese tramo SHALL indicarse como no disponibles en lugar de mostrarse en cero. La regularización producida por la primera entrada con costo SHALL ser visible y trazable para el Administrador. Trazabilidad: RF-CAT-005; RF-INV-008; RN-INV-007; RN-CON-002; actores-y-roles §3.3; proposal R1 y R3.

#### Scenario: Kardex administrativo valorizado
- **GIVEN** un Administrador autorizado y movimientos con costos históricos
- **WHEN** consulta el Kardex
- **THEN** SHALL recibir los valores aplicados y saldos valorizados conciliables, incluidos residuos de agotamiento

#### Scenario: Kardex operativo sin filtración
- **GIVEN** un Vendedor o Encargado sin Administrador
- **WHEN** consulta Kardex, resúmenes o detalle de un movimiento
- **THEN** SHALL recibir cantidades y saldos autorizados sin campos económicos, datos privados del proveedor ni importes ocultos en referencias o errores

#### Scenario: Cambio posterior del catálogo
- **GIVEN** un movimiento registrado antes de cambiar nombre, unidad o precio del producto
- **WHEN** se consulta la fila histórica
- **THEN** SHALL conservar su identificación y unidad aplicadas y no recalcular costos con el catálogo vigente

#### Scenario: Movimiento sin costo registrado
- **GIVEN** un producto sin costo registrado con una entrada de 5 unidades y una salida de 2
- **WHEN** el Administrador consulta su Kardex
- **THEN** SHALL ver cantidades y saldos 5 y 3, con costo y valor indicados como sin costo registrado y no como cero

#### Scenario: Regularización visible
- **GIVEN** un producto sin costo registrado que recibe su primera entrada con costo
- **WHEN** el Administrador consulta el Kardex
- **THEN** SHALL identificarse en esa entrada el valor asignado a las unidades previas, y los movimientos anteriores SHALL permanecer sin costo

### Requirement: Acceso al origen y correcciones enlazadas

Cada movimiento SHALL identificar una referencia interna trazable de su operación y, cuando esté autorizado, permitir abrir el documento de origen. Abrir una entrada o compra SHALL exigir `ingresos.ver`; consultar sus cantidades en Kardex SHALL NOT concederlo. El Vendedor, que posee `ingresos.ver`, SHALL abrir el origen de una entrada recibiendo productos, cantidades, usuario y estado, sin costos ni valores. Las compensaciones SHALL enlazar el movimiento original y viceversa. Los datos privados del proveedor SHALL permanecer restringidos al Administrador. Trazabilidad: RN-INV-002/012; RF-INV-008/010; RN-SEG-007; CU-008/015; proposal R3 y R4.

#### Scenario: Administrador abre la entrada
- **GIVEN** un movimiento de entrada y un Administrador con permisos
- **WHEN** abre su origen
- **THEN** SHALL mostrarse el documento real con su estado, número, costos y movimientos relacionados

#### Scenario: Vendedor abre la entrada
- **GIVEN** un Vendedor sin Administrador y un movimiento de entrada
- **WHEN** abre su origen
- **THEN** SHALL mostrarse la entrada con productos, cantidades, usuario y estado, sin costos, valores ni datos privados del proveedor

#### Scenario: Encargado intenta abrir la entrada
- **GIVEN** un Encargado del taller con `inventario.ver` y sin `ingresos.ver`
- **WHEN** intenta acceder directamente al documento de una entrada
- **THEN** SHALL denegarse sin revelar la entrada, el proveedor o costos; la interfaz SHALL conservar únicamente la referencia interna autorizada

#### Scenario: Navegación entre compensación y original
- **GIVEN** un movimiento corregido y su compensación
- **WHEN** se consulta cualquiera de ellos
- **THEN** SHALL identificarse el vínculo y sentido de la corrección sin ocultar la operación original
