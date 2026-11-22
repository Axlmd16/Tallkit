## MODIFIED Requirements

### Requirement: Bloques separados por RUC y documento

El detalle de la orden SHALL presentar dos bloques económicos separados, identificados por el nombre comercial de cada negocio (o su razón social como respaldo): **Repuestos** (entidad comercial) y **Servicios** (entidad artesanal). Cada bloque SHALL listar sus documentos vinculados, incluidos los anulados y los reemplazados, con número, estado del documento, condición, total, pagado, saldo, estado de pago y, cuando corresponda, la relación de reemplazo o anulación. Los importes SHALL provenir del servidor. Cada documento SHALL ofrecer, según permisos, su propia acción de cobro rotulada con su emisor.

Además, la orden SHALL ofrecer el acceso único **«Cobrar y facturar»** conforme a `DP-036` regla 2, siempre que presente los dos importes por separado, registre operaciones, cobros y facturas independientes por negocio y limite las acciones a los negocios que el usuario puede operar. SHALL NOT existir ninguna acción que reparta dinero en silencio entre los dos RUC ni un pago único aplicado a la orden como conjunto.

Trazabilidad: `DP-036` reglas 2 y 3; `DP-037`; RN-FIS-008/009; RF-TAL-012; RF-PAG-010; UI-075; `interfaz-y-navegacion.md` §6.6.

#### Scenario: Orden con repuestos y servicios
- **DADO** una orden con la venta `COM-VEN-000031` por USD 40,00 sin pagos y la operación `ART-SER-000004` por USD 60,00 con un pago de USD 60,00
- **CUANDO** un Administrador o la usuaria diaria consulta el resumen
- **ENTONCES** SHALL ver `COM-VEN-000031` en el bloque comercial con saldo USD 40,00 y estado pendiente y `ART-SER-000004` en el bloque artesanal con saldo USD 0,00 y estado pagado, cada uno con su propia acción de cobro cuando corresponda, y el acceso «Cobrar y facturar» que muestra ambos negocios por separado.

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
