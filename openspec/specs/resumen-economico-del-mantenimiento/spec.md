# resumen-economico-del-mantenimiento Specification

## Purpose
Presentar por separado los documentos de repuestos (RUC comercial) y de servicios (RUC artesanal) de una orden, distinguiendo lo pendiente de documentar de las obligaciones confirmadas, con un total combinado solo informativo y visibilidad según el rol.
## Requirements
### Requirement: Bloques separados por RUC y documento

El detalle de la orden SHALL presentar dos bloques económicos separados: **Repuestos — RUC comercial** y **Servicios — RUC artesanal**. Cada bloque SHALL listar sus documentos vinculados, incluidos los anulados y los reemplazados, con número, estado del documento, condición, total, pagado, saldo, estado de pago y, cuando corresponda, la relación de reemplazo o anulación. Los importes SHALL provenir del servidor. Cada documento SHALL ofrecer, según permisos, su propia acción de cobro rotulada con su emisor. SHALL NOT existir una acción de cobro de la orden en conjunto. Trazabilidad: RN-FIS-008/009; RF-TAL-012; RF-PAG-010; UI-075.

#### Scenario: Orden con repuestos y servicios
- **DADO** una orden con la venta `COM-VEN-000031` por USD 40,00 sin pagos y la operación `ART-SER-000004` por USD 60,00 con un pago de USD 60,00
- **CUANDO** un Administrador consulta el resumen
- **ENTONCES** SHALL ver `COM-VEN-000031` en el bloque comercial con saldo USD 40,00 y estado pendiente y `ART-SER-000004` en el bloque artesanal con saldo USD 0,00 y estado pagado, cada uno con su propia acción de cobro cuando corresponda.

#### Scenario: Orden con solo servicios
- **DADO** una orden sin repuestos y con una operación artesanal confirmada
- **CUANDO** se consulta el resumen
- **ENTONCES** el bloque comercial SHALL indicar que no hay repuestos y SHALL NOT mostrar documentos vacíos.

#### Scenario: Orden con solo repuestos
- **DADO** una orden cuyas líneas de servicio tienen precio aplicado USD 0,00 y con una venta vinculada confirmada
- **CUANDO** se consulta el resumen
- **ENTONCES** el bloque artesanal SHALL indicar que no hay importe de servicios por documentar y SHALL NOT mostrar una operación de total cero.

#### Scenario: Documentos históricos
- **DADO** una orden con una operación artesanal anulada, su operación de reemplazo y dos ventas vinculadas confirmadas
- **CUANDO** se consulta el resumen
- **ENTONCES** SHALL mostrarse los cuatro documentos, la anulación con su motivo y el vínculo de reemplazo, sin sumar el documento anulado a los saldos.

### Requirement: Pendiente de documentar frente a obligaciones confirmadas

Cada bloque SHALL distinguir los importes pendientes de documentar de las obligaciones confirmadas. En repuestos, el importe pendiente es el total estimado de la venta vinculada abierta, rotulado como reservado y sin descontar inventario. En servicios, es el total de las líneas iniciales no documentadas, rotulado como pendiente de confirmar. Los importes pendientes SHALL NOT sumarse a los saldos ni presentarse como deuda. Una línea SHALL contarse una sola vez: como pendiente o dentro de su documento vigente. Trazabilidad: DP-021; RN-VEN-002; propuesta P4.

#### Scenario: Evitar el doble conteo
- **DADO** una orden con servicios documentados por USD 60,00 y una línea nueva no documentada de USD 15,00
- **CUANDO** se consulta el bloque artesanal
- **ENTONCES** SHALL mostrar USD 60,00 confirmados en su operación y USD 15,00 pendientes de documentar, sin presentar USD 75,00 como saldo.

### Requirement: Total combinado solo informativo

El resumen SHALL poder mostrar un total combinado de repuestos y servicios únicamente como dato informativo, rotulado de forma explícita como suma de documentos de dos RUC distintos, que no constituye una deuda única, un saldo cobrable ni una factura. Ese total SHALL mostrarse solo a usuarios autorizados para consultar ambos bloques. SHALL NOT existir un saldo combinado ni una acción asociada a ese total. Trazabilidad: RN-FIS-008/009; invariante 2; RF-PAG-009.

#### Scenario: Presentación del total combinado
- **DADO** un Administrador que consulta una orden con documentos en ambos RUC
- **CUANDO** se muestra el resumen
- **ENTONCES** el total combinado SHALL aparecer como informativo, separado de los saldos por documento y sin acción de cobro.

#### Scenario: Usuario con visibilidad de un solo bloque
- **DADO** un Encargado del taller sin rol comercial
- **CUANDO** consulta el resumen de una orden
- **ENTONCES** SHALL ver el bloque artesanal completo y, en el bloque comercial, solo la información permitida de las ventas vinculadas, sin acción de cobro comercial ni total combinado.

### Requirement: Visibilidad por rol en el resumen

El bloque artesanal SHALL mostrarse a quien tenga `servicios_economicos.ver`. El bloque comercial SHALL mostrarse a quien tenga `ventas.ver`, incluido el Encargado del taller en su forma restringida a las ventas vinculadas a la orden: número, estado, condición, líneas, totales, pagado, saldo y estado de pago, sin historial detallado de pagos, sin costos ni acciones comerciales. Un Vendedor sin rol de taller SHALL acceder solo a la vista restringida de la orden de origen descrita en `ordenes-de-mantenimiento`, sin el bloque artesanal. Trazabilidad: actores-y-roles §3.4/§3.5; CT-001.

#### Scenario: Vendedor abre la orden de origen
- **DADO** un Vendedor que consulta una venta vinculada
- **CUANDO** abre su orden de origen
- **ENTONCES** SHALL ver número, estado, cliente, vehículo y repuestos de la orden, y SHALL NOT ver servicios, importes artesanales, diagnóstico ni fotografías.
