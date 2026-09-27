## MODIFIED Requirements

### Requirement: Consulta comercial y comprobante interno accesibles

El sistema SHALL ofrecer lista y detalle autorizados con número, cliente, origen (directo o mantenimiento, con el número de la orden), fecha, total y estados independientes; filtros por cliente, fecha, estado y origen, y paginación estable. Los borradores vinculados SHALL poder filtrarse para que el Vendedor identifique los repuestos pendientes de confirmar. El detalle SHALL enlazar pagos, correcciones, origen de movimientos y, en las vinculadas, la orden de origen según permisos. El **documento interno** imprimible SHALL identificar RUC comercial, cliente, líneas, desglose, número, estado y, cuando exista, la orden de origen, y declarar que no constituye factura electrónica autorizada por el SRI. Su encabezado SHALL mostrar el **logotipo** vigente de la entidad comercial junto al nombre del emisor o, si la entidad no tiene logotipo, solo el nombre del emisor; SHALL NOT mostrar el logotipo de la entidad artesanal ni el de Tallkit como marca del emisor. La experiencia SHALL conservar entradas ante errores, explicar efectos antes de confirmar y permitir navegación por teclado. Trazabilidad: RF-VEN-002/015/016; RF-AUD-004; UI-053…055/058; RNF-USA; DP-018; RN-FIS-009; propuesta `logotipos-por-ruc` §7–8.

#### Scenario: Filtrar ventas y abrir detalle
- **DADO** ventas de varios clientes, fechas y estados
- **CUANDO** un usuario autorizado combina filtros y recorre páginas sin cambios concurrentes
- **ENTONCES** SHALL obtener únicamente coincidencias sin duplicados u omisiones y abrir su detalle conservando el contexto de consulta.

#### Scenario: Vendedor encuentra repuestos pendientes de confirmar
- **DADO** ventas directas y dos ventas vinculadas en borrador de órdenes distintas
- **CUANDO** un Vendedor filtra por origen mantenimiento y estado borrador
- **ENTONCES** SHALL obtener solo las dos ventas vinculadas, cada una con el número de su orden de origen.

#### Scenario: Imprimir una venta anulada
- **DADO** una venta anulada consultable por el actor
- **CUANDO** solicita su comprobante
- **ENTONCES** SHALL conservar número y valores originales, indicar anulación y ámbito comercial, incluir el aviso de documento no autorizado por el SRI y omitir costos internos.

#### Scenario: Error durante captura accesible
- **DADO** un borrador con líneas capturadas
- **CUANDO** una validación rechaza guardar o confirmar
- **ENTONCES** SHALL conservarse la entrada para corregirla y comunicarse el error en el campo o acción correspondiente, accesible por teclado y sin repetir efectos.

#### Scenario: Comprobante con logotipo comercial
- **DADO** la entidad comercial con logotipo y la artesanal con otro logotipo
- **CUANDO** un Vendedor abre o imprime el comprobante de una venta confirmada
- **ENTONCES** el encabezado SHALL mostrar el logotipo comercial y el nombre del emisor, y SHALL NOT mostrar el logotipo artesanal.

#### Scenario: Comprobante sin logotipo comercial
- **DADO** la entidad comercial sin logotipo
- **CUANDO** se abre el comprobante de una venta
- **ENTONCES** el encabezado SHALL mostrar solo el nombre del emisor, sin espacio vacío reservado ni isotipo de Tallkit.

#### Scenario: Encargado consulta una venta vinculada
- **DADO** un Encargado del taller con acceso limitado a la venta vinculada de su orden
- **CUANDO** abre su comprobante
- **ENTONCES** SHALL ver el logotipo comercial en el encabezado sin obtener acceso adicional a datos comerciales o fiscales.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
