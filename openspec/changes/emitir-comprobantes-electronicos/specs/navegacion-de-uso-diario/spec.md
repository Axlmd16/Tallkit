## MODIFIED Requirements

### Requirement: Facturas antes de la emisión real

La entrada «Facturas» SHALL mostrar las preparaciones locales de factura y el estado de su **referencia fiscal** para los negocios que el usuario pueda consultar según sus permisos (`fiscal.comercial.ver`, `fiscal.artesanal.ver`). Cada fila SHALL identificar el negocio por su nombre comercial (o razón social), el número interno de la operación, el número fiscal del comprobante cuando haya sido asignado, el cliente, el total, la fecha, el estado local (`borrador`, `preparada`, `cancelada`), el estado de emisión (`no_solicitada`, `pendiente`, `en_proceso`, `error_temporal`, `autorizada`, `no_autorizada`) y la marca visible del ambiente (*Pruebas*).

La lista SHALL poder filtrarse por negocio, por estado local y por estado de emisión. Cuando la entidad fiscal tenga activa la emisión en pruebas y el usuario posea el permiso de emisión del negocio (`fiscal.comercial.emitir` o `fiscal.artesanal.emitir`), la fila y el detalle SHALL ofrecer:

- la acción **«Facturar»** cuando la preparación esté `preparada` (formato 4) y la referencia fiscal esté en `no_solicitada`;
- la acción **«Consultar estado»** (nunca reenviar) cuando la referencia fiscal esté `en_proceso` (`NOR-001`);
- la acción **«Reintentar envío»** cuando la referencia fiscal esté en `pendiente` o `error_temporal` dentro de la vigencia diaria en `America/Guayaquil`.

Mientras la emisión real en producción no esté habilitada (`DP-034`, regla 8), ninguna fila ni texto SHALL presentar una preparación no enviada como emitida, ni un comprobante emitido en ambiente de pruebas como factura autorizada de producción con validez tributaria. Un usuario SHALL ver y operar únicamente las filas de los negocios autorizados a sus roles, y la lista SHALL NOT incluir un total conjunto.

Trazabilidad: `DP-034`, reglas 4, 5 y 8; `DP-036`, reglas 3 y 8; `RN-FIS-008`, `RN-FIS-009`; `RF-FIS-002`, `RF-FIS-008`, `RF-FIS-009`; `NOR-001`; `preparacion-y-seguimiento-fiscal`; `emision-de-comprobantes-electronicos`; propuesta `emitir-comprobantes-electronicos` §A.6 y §B.3/7.

#### Scenario: Preparaciones y emisiones de ambos negocios con acciones según estado
- **DADO** una preparación del negocio comercial en `no_solicitada`, una del negocio artesanal `en_proceso` y otra artesanal `autorizada` en ambiente de pruebas, y una usuaria con permisos en ambos negocios
- **CUANDO** abre «Facturas»
- **ENTONCES** SHALL ver cada fila con su negocio, su estado local, su estado de emisión y el aviso de ambiente de pruebas, ofreciendo «Facturar» en la no solicitada (si su entidad está activa), «Consultar estado» sin reenvío en la que está en proceso y ninguna suma conjunta entre negocios.

#### Scenario: Usuario con permiso sobre un solo negocio
- **DADO** un usuario que solo puede consultar y emitir en el negocio artesanal
- **CUANDO** abre «Facturas» o intenta filtrar/emitir sobre el negocio comercial por la API
- **ENTONCES** SHALL ver y operar únicamente las filas del negocio artesanal, y el servidor SHALL rechazar cualquier consulta o acción sobre el negocio comercial.
