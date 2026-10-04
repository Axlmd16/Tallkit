## ADDED Requirements

### Requirement: Venta de productos sin costo registrado

La ausencia de costo SHALL NOT impedir vender. Confirmar una venta con un producto **sin costo registrado** SHALL registrar la salida de **Kardex** y conservar el costo histórico de esa línea como ausente, distinto de un costo cero, sin inventar un valor ni usar el precio de venta. Precio, base, impuesto, total, importe exigible, disponibilidad, numeración y atomicidad SHALL comportarse igual que en cualquier otra venta. El costo ausente SHALL permanecer histórico: registrar después un costo para el producto SHALL NOT completar ni reescribir ventas ya confirmadas. El margen de una línea con costo ausente SHALL considerarse no calculable y SHALL NOT presentarse como si el costo fuera cero. La condición SHALL ser visible solo para el Administrador; Vendedor y Encargado del taller SHALL NOT recibir indicación alguna sobre costos. Trazabilidad: DP-017; RN-INV-007/008; RF-VEN-004/006; RF-CAT-005; RF-REP-013; spec `existencias-y-ajustes-de-inventario`; proposal D1 y R1.

#### Scenario: Venta de un producto sin costo registrado
- **DADO** un producto sin costo registrado con 5 unidades y una venta revisada de 2 unidades
- **CUANDO** se confirma la venta
- **ENTONCES** SHALL quedar confirmada con su número, total e importe exigible habituales, existencia 3 y costo histórico de la línea ausente.

#### Scenario: Venta mixta
- **DADO** una venta con el producto A valorado a promedio 2.000000 y el producto B sin costo registrado
- **CUANDO** se confirma
- **ENTONCES** SHALL conservarse costo histórico 2.000000 en la línea de A y costo ausente en la de B, en una sola confirmación atómica.

#### Scenario: Costo registrado después de vender
- **DADO** una venta confirmada con una línea de costo ausente
- **CUANDO** el producto recibe después una entrada con costo
- **ENTONCES** la línea vendida SHALL conservar su costo ausente sin recalcularse.

#### Scenario: El Vendedor no percibe la ausencia de costo
- **DADO** un Vendedor sin Administrador
- **CUANDO** confirma o consulta una venta con un producto sin costo registrado
- **ENTONCES** SHALL operar y ver la venta igual que cualquier otra, sin avisos ni campos sobre costos.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
