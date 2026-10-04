## MODIFIED Requirements

### Requirement: Valoración por promedio ponderado y conservación de valor

Entradas con costo SHALL sumar cantidad y valor inventariable y actualizar el **costo promedio ponderado** a seis decimales HALF_UP. El valor previo SHALL conservar los residuos de redondeo trazables; la representación redondeada del promedio SHALL NOT sustituir ni destruir valor acumulado. Las salidas SHALL conservar el promedio vigente sin revalorar movimientos anteriores; el último egreso que agote stock SHALL absorber el residuo pendiente para dejar cantidad y valor cero. La carga inicial y el ajuste de entrada SHALL seguir exigiendo costo y valorar cantidad × costo inventariable informado a seis decimales. La entrada de stock con costo SHALL aportar cantidad × costo unitario informado, sin impuestos; las compras anteriores SHALL conservar el valor inventariable con que se confirmaron.

Una entrada sin costo SHALL aumentar la existencia sin modificar el promedio: SHALL valorarse al promedio vigente del producto o, si su existencia es cero, al último promedio conocido. Si el producto nunca tuvo promedio, SHALL quedar **sin costo registrado**: su existencia SHALL carecer de valor, estado distinto de un valor cero, y sus movimientos SHALL registrarse sin costo. Un producto SHALL estar completamente valorado o completamente sin costo registrado, nunca en parte. La primera entrada con costo de un producto sin costo registrado SHALL valorar a ese costo también las unidades existentes, dejando constancia trazable de esa regularización en la misma operación y sin reescribir movimientos anteriores. Un reingreso cuyo costo histórico de salida esté ausente SHALL tratarse como entrada sin costo. El Administrador SHALL poder identificar los productos sin costo registrado; el valor total del inventario SHALL excluirlos e indicar cuántos quedan fuera, sin presentarlos como cero. La consulta monetaria podrá mostrar centavos, distinguiéndolos de la precisión de costos, pero SHALL ser reproducible desde los movimientos. Trazabilidad: RN-INV-005…007; RNF-INT-006/007; RF-INV-003/007; proposal D1, R1 y R2.

#### Scenario: Promedio ponderado de una entrada
- **GIVEN** 10 unidades con valor 20.00 y una entrada de 5 con valor inventariable 20.00
- **WHEN** se confirma la entrada
- **THEN** SHALL resultar cantidad 15, valor 40.00 y promedio 2.666667 sin modificar precios de venta

#### Scenario: Agotamiento con residuo
- **GIVEN** 3 unidades con valor total 1.000000 y promedio 0.333333
- **WHEN** salen las tres unidades en operaciones sucesivas de una unidad
- **THEN** SHALL valorarse las dos primeras en 0.333333 cada una y la última en 0.333334, quedando cantidad y valor cero

#### Scenario: Entrada posterior a agotamiento
- **GIVEN** un producto agotado con cantidad y valor cero
- **WHEN** ingresa 2 unidades con valor 7.00
- **THEN** SHALL resultar promedio 3.500000 sin arrastrar valor de existencias antiguas

#### Scenario: Valor histórico de una salida
- **GIVEN** una salida valorada con el promedio vigente y una entrada posterior que cambia el promedio
- **WHEN** se consulta la salida anterior
- **THEN** SHALL conservar su costo y valor originales sin aplicar el nuevo promedio

#### Scenario: Entrada sin costo con promedio vigente
- **GIVEN** 10 unidades con valor 20.00 y promedio 2.000000
- **WHEN** se confirma una entrada de 5 unidades sin costo
- **THEN** SHALL resultar cantidad 15, valor 30.00 y promedio 2.000000

#### Scenario: Entrada sin costo tras agotamiento
- **GIVEN** un producto agotado cuyo último promedio conocido fue 3.500000
- **WHEN** se confirma una entrada de 2 unidades sin costo
- **THEN** SHALL resultar cantidad 2, valor 7.00 y promedio 3.500000

#### Scenario: Producto que nunca tuvo costo
- **GIVEN** un producto sin movimientos previos
- **WHEN** se confirma una entrada de 5 unidades sin costo
- **THEN** SHALL resultar existencia 5 y el producto SHALL quedar sin costo registrado, sin valor ni promedio cero

#### Scenario: Primera entrada con costo regulariza
- **GIVEN** un producto sin costo registrado con 5 unidades
- **WHEN** se confirma una entrada de 5 unidades a costo 2.00
- **THEN** SHALL resultar cantidad 10, valor 20.00 y promedio 2.000000, con la regularización de las 5 unidades previas trazable en esa operación y sin modificar movimientos anteriores

#### Scenario: Valor total con productos sin costo
- **GIVEN** un producto valorado en 40.00 y otro sin costo registrado con 8 unidades
- **WHEN** el Administrador consulta el valor del inventario
- **THEN** SHALL mostrarse 40.00 e indicarse que un producto queda fuera por no tener costo registrado

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
