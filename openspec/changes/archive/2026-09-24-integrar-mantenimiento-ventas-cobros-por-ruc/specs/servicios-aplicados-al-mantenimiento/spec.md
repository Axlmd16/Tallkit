# Servicios aplicados al mantenimiento — delta de documentación artesanal

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24 con P3 y P4; DP-017/018/020; RN-TAL-009/010; RF-TAL-006/007/008; UI-072/075/077; spec principal `servicios-aplicados-al-mantenimiento`; nueva capacidad `operacion-artesanal-de-servicios`. Las líneas de servicio siguen siendo la fuente de verdad mientras no se documentan. Una vez documentadas, quedan bloqueadas y sus valores económicos históricos pertenecen a la operación artesanal.

## MODIFIED Requirements

### Requirement: Editar y retirar líneas mientras la intervención esté abierta

Mientras la intervención de una línea esté abierta y la orden no esté finalizada, un usuario con `mantenimientos.gestionar` SHALL poder cambiar su cantidad o retirarla, siempre que la línea no esté documentada en una operación artesanal vigente. Cambiar el precio aplicado SHALL exigir además `mantenimientos.cambiar_precio_servicio`. Retirar una línea SHALL quitarla del total y SHALL registrarse en la auditoría. Las líneas de una intervención ya finalizada SHALL NOT editarse ni retirarse, tampoco con la orden reabierta. Una línea documentada en una operación vigente SHALL NOT editarse ni retirarse en ningún estado de la orden, para ningún rol; el rechazo SHALL identificar la operación. Si esa operación se anula, la línea SHALL volver a ser editable según el estado de su intervención y de la orden. Cada modificación SHALL exigir la versión vigente de la orden y SHALL rechazarse como conflicto si la orden cambió, se finalizó o la línea se documentó mientras tanto. Trazabilidad: RN-TAL-003/018; RF-TAL-005/006/008; P2 de la séptima entrega; propuesta P4/P5.

#### Scenario: Cambiar la cantidad
- **DADO** una línea no documentada con precio aplicado de USD 12,50 y cantidad 1 en una orden registrada
- **CUANDO** se cambia la cantidad a 3
- **ENTONCES** el subtotal SHALL ser USD 37,50 y el total de la orden SHALL recalcularse en el servidor.

#### Scenario: Cantidad inválida
- **DADO** una línea de servicio
- **CUANDO** se ingresa una cantidad de 0, −1 o 1,5
- **ENTONCES** el sistema SHALL rechazarla con un error de campo.

#### Scenario: Retirar una línea
- **DADO** una orden registrada con dos líneas no documentadas
- **CUANDO** un usuario autorizado retira una de ellas
- **ENTONCES** el total SHALL incluir solo la línea restante.

#### Scenario: Modificar líneas de una orden finalizada
- **DADO** una orden finalizada
- **CUANDO** se intenta agregar, editar o retirar una línea
- **ENTONCES** el sistema SHALL rechazarlo indicando que la orden debe reabrirse.

#### Scenario: Modificar una línea documentada
- **DADO** una orden registrada con «Alineación» documentada en `ART-SER-000004`
- **CUANDO** un Administrador intenta cambiar su cantidad o su precio aplicado, o retirarla
- **ENTONCES** el sistema SHALL rechazarlo identificando `ART-SER-000004` y la línea SHALL conservar sus valores.

#### Scenario: Documentación y edición simultáneas
- **DADO** un usuario que confirma la operación artesanal de una orden mientras otro cambia el precio aplicado de una línea pendiente
- **CUANDO** ambas solicitudes se procesan
- **ENTONCES** SHALL aplicarse una sola en un orden coherente, y la operación confirmada SHALL contener exactamente los valores de las líneas en el momento de confirmar que fueron revisados; en otro caso SHALL exigir una nueva revisión.

### Requirement: Subtotales y total calculados por el servidor

El servidor SHALL calcular el subtotal de cada línea como cantidad × precio aplicado, en decimal exacto y en USD con dos decimales. SHALL calcular el total de servicios de la orden como la suma de los subtotales de sus intervenciones. Los importes enviados por el cliente para subtotales o totales SHALL ignorarse. El total SHALL identificarse como «total de servicios de la orden» y SHALL NOT presentarse como saldo por cobrar, deuda o factura. Cada línea SHALL indicar si está pendiente de documentar o documentada, y en ese caso el número de su operación artesanal. El desglose de base e impuesto, el saldo y los pagos SHALL mostrarse únicamente en la operación artesanal confirmada y en su vista previa, calculados con la configuración tributaria vigente, sin tarifas fijadas en el código. La selección tributaria conservada en cada línea SHALL ser la que use la operación artesanal. Trazabilidad: DP-017/018; RF-TAL-007; RN-TAL-010; propuesta P3/P4.

#### Scenario: Precisión decimal
- **DADO** las líneas 3 × USD 0,10 y 1 × USD 19,99
- **CUANDO** el servidor calcula el total
- **ENTONCES** los subtotales SHALL ser USD 0,30 y USD 19,99 y el total SHALL ser exactamente USD 20,29.

#### Scenario: Total manipulado por el cliente
- **DADO** una solicitud que envía un subtotal o un total diferente
- **CUANDO** el servidor la procesa
- **ENTONCES** SHALL conservar y devolver los valores que calculó.

#### Scenario: Presentación del total
- **DADO** el detalle de una orden con una línea documentada en `ART-SER-000004` y otra pendiente
- **CUANDO** se muestra la sección de servicios
- **ENTONCES** SHALL rotularse el total como total de servicios de la orden, cada línea SHALL indicar su estado de documentación, y el saldo y los impuestos SHALL mostrarse solo en la operación artesanal.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
