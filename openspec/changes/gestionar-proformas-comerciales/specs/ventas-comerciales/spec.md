## ADDED Requirements

### Requirement: Origen proforma conservado y venta editable

La **venta de repuestos** creada por conversión SHALL identificar como origen la **proforma** y conservar su vínculo único durante toda su vida. SHALL copiar inicialmente cliente y líneas, y permitir ajustar productos y cantidades en borrador con las reglas ordinarias de ventas, sin alterar la oferta ni habilitar otra conversión. El origen SHALL NOT cambiarse mediante edición genérica ni asociarse simultáneamente a mantenimiento. Una venta vaciada SHALL conservar su vínculo y SHALL NOT confirmarse sin líneas ni eliminarse para liberar la conversión. Corregir o anular posteriormente la venta SHALL NOT reactivar la oferta. Trazabilidad: proposal D6 y alcance aprobado; RN-PRO-005/006/008; RF-PRO-007/009; RF-VEN-002; CU-011.

#### Scenario: Cliente acepta una parte
- **DADO** una oferta convertida con los productos A y B
- **CUANDO** el Vendedor retira B y agrega un producto activo C al borrador
- **ENTONCES** SHALL conservarse la oferta por A y B y su vínculo con una única venta por A y C, cuyos precios provienen del catálogo.

#### Scenario: Venta queda sin líneas
- **DADO** una venta de origen proforma en borrador
- **CUANDO** se retiran todas sus líneas
- **ENTONCES** SHALL conservarse el borrador y el vínculo y rechazarse confirmación, eliminación o nueva conversión de la oferta.

#### Scenario: Intento de cambiar el origen
- **DADO** una venta de origen proforma
- **CUANDO** se intenta reemplazar su oferta o asignarle una orden de mantenimiento mediante edición ordinaria
- **ENTONCES** SHALL rechazarse sin modificar el vínculo ni generar reservas.

#### Scenario: Anulación posterior de la venta
- **DADO** una venta confirmada de origen proforma que satisface las reglas de anulación comercial
- **CUANDO** el Administrador la anula por la acción autorizada
- **ENTONCES** SHALL aplicarse la corrección comercial existente y conservarse la proforma convertida con su vínculo, sin permitir una segunda conversión.

### Requirement: Revisión de diferencias entre oferta y venta

La conversión SHALL recalcular precios, impuestos y disponibilidad con valores actuales y presentar las diferencias respecto de lo emitido. Antes de confirmar SHALL mostrarse la comparación de productos, cantidades, precios, impuestos y totales de la oferta original y la venta actual, incluyendo líneas retiradas o agregadas, sin reescribir la oferta. La confirmación SHALL usar exclusivamente el **precio final de catálogo**, la tarifa efectiva y disponibilidad del momento y exigir revisión vigente. La fecha de vencimiento de la oferta SHALL NOT garantizar precios ni sustituir la fecha efectiva de venta. Tras convertir válidamente, vencer la oferta SHALL NOT invalidar el borrador generado. Confirmar y cobrar SHALL seguir siendo acciones independientes. Trazabilidad: proposal D1/D4/D6; DP-025/026/027; RN-PRO-004; RF-PRO-008; RF-VEN-005/006; CU-011/012.

#### Scenario: Precio distinto al cotizado
- **DADO** una oferta emitida a 10.00 por unidad y catálogo actual a 12.00
- **CUANDO** se convierte a venta
- **ENTONCES** SHALL mostrarse 10.00 como valor cotizado y 12.00 como valor actual, con sus totales, sin confirmar automáticamente ni ofrecer precio manual.

#### Scenario: Cambia la tarifa
- **DADO** una oferta con una tarifa histórica y otra tarifa comercial vigente al convertir
- **CUANDO** se revisa la venta generada
- **ENTONCES** SHALL mostrarse el desglose actual y su diferencia con la oferta conservada, manteniendo el precio final de catálogo.

#### Scenario: Conversión sin disponibilidad suficiente
- **DADO** una oferta válida por 3 unidades y disponibilidad actual 1
- **CUANDO** se convierte
- **ENTONCES** SHALL crearse el borrador con aviso de insuficiencia y SHALL rechazarse su confirmación por 3 unidades mientras persista esa disponibilidad, sin efectos parciales.

#### Scenario: Nuevo cambio después de revisar
- **DADO** una venta de origen proforma revisada con precio 12.00 y catálogo actualizado luego a 13.00
- **CUANDO** se intenta confirmar con la revisión anterior
- **ENTONCES** SHALL exigirse revisar 13.00 sin número, salida ni deuda.

#### Scenario: Vence la oferta después de convertir
- **DADO** una proforma convertida válidamente antes de vencer y su venta pendiente
- **CUANDO** se confirma esa venta después de la fecha de vigencia original
- **ENTONCES** SHALL poder confirmarse si satisface las reglas actuales de venta, sin reactivar ni recalcular la oferta histórica.

#### Scenario: Confirmación y cobro independientes
- **DADO** una venta de origen proforma revisada, con condición contado y disponibilidad suficiente
- **CUANDO** se confirma
- **ENTONCES** SHALL asignarse número COM-VEN, conservarse valores históricos, generarse salida e importe exigible atómicamente sin crear un pago ni autorización fiscal, y ofrecerse después el cobro habitual.

## MODIFIED Requirements

### Requirement: Autorización comercial por acción

El sistema SHALL exigir usuario activo y sesión vigente para toda acción. Administrador y Vendedor SHALL poder consultar, crear, editar y confirmar ventas directas y de origen proforma según `ventas.ver`, `ventas.crear` y `ventas.confirmar`, y consultar y confirmar ventas vinculadas. Un Encargado del taller sin rol comercial SHALL poder consultar únicamente las ventas vinculadas a órdenes, con número, estado, condición, líneas, totales, pagado, saldo y estado de pago, sin costos, historial detallado de pagos ni acciones comerciales. SHALL NOT consultar, crear, editar ni confirmar ventas directas ni de origen proforma. Preparar líneas de una venta vinculada SHALL exigir `ventas.preparar_vinculada` y SHALL realizarse únicamente desde la orden. La unión de roles SHALL aplicarse. Toda acción SHALL validar autorización en el servidor, incluso al repetir una solicitud; costos y valoración SHALL limitarse al Administrador. Trazabilidad: CT-001; RN-SEG-001…007; actores-y-roles §3.4; RF-VEN-005; RF-TAL-010/012.

Trazabilidad adicional: proposal D6; RF-VEN-002; RF-PRO-007/008/009; CU-011.

#### Scenario: Vendedor confirma una venta autorizada
- **DADO** un Vendedor activo con sesión vigente y una venta válida
- **CUANDO** solicita confirmarla
- **ENTONCES** el sistema SHALL permitir la acción y aplicar todas las validaciones comerciales.

#### Scenario: Encargado sin rol comercial intenta acceder
- **DADO** un usuario con solo el rol Encargado del taller
- **CUANDO** consulta, crea, modifica o confirma una venta directa por acceso directo, o confirma una venta vinculada
- **ENTONCES** el sistema SHALL denegar la acción sin revelar datos ni producir efectos.

#### Scenario: Encargado consulta la venta vinculada de una orden
- **DADO** un usuario con solo el rol Encargado del taller y una venta vinculada a una orden
- **CUANDO** la consulta desde la orden
- **ENTONCES** SHALL recibir su número, estado, condición, líneas, totales, pagado y saldo, sin costos, historial detallado de pagos ni acciones de confirmación o cobro.

#### Scenario: Roles acumulados y costos restringidos
- **DADO** un usuario Vendedor y Encargado del taller sin rol Administrador
- **CUANDO** consulta una venta comercial autorizada
- **ENTONCES** SHALL recibir precios de venta e importes comerciales, pero no costos históricos ni valoración, tampoco en enlaces, errores o datos anidados.

#### Scenario: Sesión invalidada antes de confirmar
- **DADO** un borrador abierto por un usuario cuya sesión dejó de ser válida
- **CUANDO** intenta confirmarlo o repetir una confirmación anterior
- **ENTONCES** SHALL rechazarse sin ejecutar efectos ni revelar el resultado protegido.

#### Scenario: Acceso a venta de origen proforma
- **DADO** una venta en borrador creada desde una proforma
- **CUANDO** un Vendedor o un Encargado sin rol comercial intenta abrirla
- **ENTONCES** SHALL permitirse al Vendedor y denegarse al Encargado, sin que el vínculo conceda permisos adicionales.


### Requirement: Borradores directos sin efectos económicos

Una **venta de repuestos** SHALL pertenecer exclusivamente al **RUC comercial** y referenciar un cliente registrado conforme a DP-008. Sus líneas SHALL identificar productos y cantidades enteras positivas de presentaciones completas, con valor y unidad. SHALL permitirse preparar y editar un borrador directo o de origen proforma sin modificar existencia, reservas, costo, deuda ni numeración. Solo el borrador de una venta vinculada a un mantenimiento SHALL reservar disponibilidad por sus líneas, conforme a `repuestos-del-mantenimiento`; tampoco reduce existencia, ni crea costo, deuda o numeración. Confirmar SHALL exigir cliente válido y al menos una línea; SHALL rechazarse servicios, cantidades fraccionarias, cero o negativas y productos inactivos. Los kits SHALL venderse intactos, sin descontar componentes. Trazabilidad: DP-008/009/010/012; RN-FIS-002/005/006; RN-VEN-001/002/004; RF-VEN-001/002/005; CU-012/018.

Trazabilidad adicional: proposal D6; RF-VEN-002; RF-PRO-007/008/009; CU-011.

#### Scenario: Guardar y editar un borrador
- **DADO** un cliente registrado y un producto disponible
- **CUANDO** se guarda o modifica un borrador de venta directa
- **ENTONCES** SHALL conservar sus datos sin reservar ni descontar inventario, crear deuda o consumir un número definitivo.

#### Scenario: Borrador vinculado reserva sin descontar
- **DADO** una orden registrada y un producto con existencia 5
- **CUANDO** se agregan 2 unidades a su venta vinculada
- **ENTONCES** la reserva del producto SHALL ser 2 y su existencia SHALL seguir en 5, sin deuda ni número.

#### Scenario: Confirmación incompleta o con cantidad inválida
- **DADO** un borrador sin cliente, sin líneas o con una cantidad cero, negativa o fraccionaria
- **CUANDO** se solicita confirmarlo
- **ENTONCES** SHALL rechazarse indicando los datos inválidos, sin efectos parciales.

#### Scenario: Desactivación de producto después de preparar la venta
- **DADO** un producto agregado al borrador y desactivado antes de confirmar
- **CUANDO** se solicita la confirmación
- **ENTONCES** SHALL rechazarse e identificarse la línea afectada, conservando el borrador para corrección.

#### Scenario: Intento de mezclar servicios o entidad artesanal
- **DADO** una venta directa o vinculada
- **CUANDO** se intenta agregar un servicio o asignar la entidad artesanal
- **ENTONCES** SHALL rechazarse sin crear una operación económica mixta.

#### Scenario: Venta de un kit completo
- **DADO** un kit registrado como producto vendible
- **CUANDO** se confirma su venta de una unidad
- **ENTONCES** SHALL descontarse solo esa unidad del kit, sin desarmarlo ni descontar sus componentes.

#### Scenario: Editar cantidades sin cambiar la oferta original
- **DADO** una venta de origen proforma con 3 unidades del producto A y una unidad de B
- **CUANDO** el Vendedor cambia A a 2 unidades y retira B
- **ENTONCES** SHALL modificarse solo el borrador de venta, conservando la proforma original, su vínculo único y la ausencia de reservas, salidas, deuda y número de venta.


### Requirement: Consulta comercial y comprobante interno accesibles

El sistema SHALL ofrecer lista y detalle autorizados con número, cliente, origen (directo, proforma con su número, o mantenimiento con el número de la orden), fecha, total y estados independientes; filtros por cliente, fecha, estado y origen, y paginación estable. Los borradores vinculados SHALL poder filtrarse para que el Vendedor identifique los repuestos pendientes de confirmar. El detalle SHALL enlazar pagos, correcciones, origen de movimientos y, en las vinculadas, la orden de origen según permisos. El **documento interno** imprimible SHALL identificar RUC comercial, cliente, líneas, desglose, número, estado y, cuando exista, la orden de origen, y declarar que no constituye factura electrónica autorizada por el SRI. Su encabezado SHALL mostrar el **logotipo** vigente de la entidad comercial junto al nombre del emisor o, si la entidad no tiene logotipo, solo el nombre del emisor; SHALL NOT mostrar el logotipo de la entidad artesanal ni el de Tallkit como marca del emisor. La experiencia SHALL conservar entradas ante errores, explicar efectos antes de confirmar y permitir navegación por teclado. Trazabilidad: RF-VEN-002/015/016; RF-AUD-004; UI-053…055/058; RNF-USA; DP-018; RN-FIS-009; propuesta `logotipos-por-ruc` §7–8.

Trazabilidad adicional: proposal D6; RF-VEN-002; RF-PRO-007/008/009; CU-011.

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

#### Scenario: Filtrar ventas originadas por proformas
- **DADO** ventas directas, de mantenimiento y de proformas
- **CUANDO** un Vendedor filtra por origen proforma
- **ENTONCES** SHALL recibir solo esas ventas, con el número de oferta y navegación autorizada al documento original.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
