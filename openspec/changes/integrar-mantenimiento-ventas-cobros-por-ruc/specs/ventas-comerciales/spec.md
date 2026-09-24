# Ventas comerciales — delta de ventas vinculadas a mantenimientos

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24 con P5 y P7; DP-012/021/025…027; RN-FIS-007; RN-TAL-011/012/014; RF-VEN-002/016; RF-TAL-010/011; CU-012/018; actores-y-roles §3.4 (`ventas.ver` restringido para el Encargado, `ventas.preparar_vinculada`); spec principal `ventas-comerciales`; nueva capacidad `repuestos-del-mantenimiento`. Las ventas pueden originarse de forma directa o vinculadas a un mantenimiento. Ambas usan el mismo mecanismo de venta; las directas conservan su comportamiento.

## MODIFIED Requirements

### Requirement: Autorización comercial por acción

El sistema SHALL exigir usuario activo y sesión vigente para toda acción. Administrador y Vendedor SHALL poder consultar, crear, editar y confirmar ventas directas según `ventas.ver`, `ventas.crear` y `ventas.confirmar`, y consultar y confirmar ventas vinculadas. Un Encargado del taller sin rol comercial SHALL poder consultar únicamente las ventas vinculadas a órdenes, con número, estado, condición, líneas, totales, pagado, saldo y estado de pago, sin costos, historial detallado de pagos ni acciones comerciales. SHALL NOT consultar, crear, editar ni confirmar ventas directas. Preparar líneas de una venta vinculada SHALL exigir `ventas.preparar_vinculada` y SHALL realizarse únicamente desde la orden. La unión de roles SHALL aplicarse. Toda acción SHALL validar autorización en el servidor, incluso al repetir una solicitud; costos y valoración SHALL limitarse al Administrador. Trazabilidad: CT-001; RN-SEG-001…007; actores-y-roles §3.4; RF-VEN-005; RF-TAL-010/012.

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

### Requirement: Borradores directos sin efectos económicos

Una **venta de repuestos** SHALL pertenecer exclusivamente al **RUC comercial** y referenciar un cliente registrado conforme a DP-008. Sus líneas SHALL identificar productos y cantidades enteras positivas de presentaciones completas, con valor y unidad. SHALL permitirse preparar y editar un borrador directo sin modificar existencia, reservas, costo, deuda ni numeración. Solo el borrador de una venta vinculada a un mantenimiento SHALL reservar disponibilidad por sus líneas, conforme a `repuestos-del-mantenimiento`; tampoco reduce existencia, ni crea costo, deuda o numeración. Confirmar SHALL exigir cliente válido y al menos una línea; SHALL rechazarse servicios, cantidades fraccionarias, cero o negativas y productos inactivos. Los kits SHALL venderse intactos, sin descontar componentes. Trazabilidad: DP-008/009/010/012; RN-FIS-002/005/006; RN-VEN-001/002/004; RF-VEN-001/002/005; CU-012/018.

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

### Requirement: Confirmación indivisible y disponibilidad protegida

Confirmar SHALL revalidar datos, autorización y disponibilidad; asignar número, conservar historia, registrar salidas de **Kardex** con costo de salida e importe exigible y auditar el éxito como una sola acción atómica. La disponibilidad SHALL calcularse como existencia menos las reservas vigentes de otras ventas vinculadas abiertas. Una venta vinculada SHALL poder usar sus propias reservas y SHALL consumirlas en la misma acción, sin liberarlas antes. Una venta directa SHALL NOT consumir unidades reservadas por un mantenimiento. SHALL NOT producirse existencia o disponibilidad negativa. Las salidas SHALL respetar la valoración vigente y sus residuos sin revalorar movimientos anteriores; una venta SHALL NOT usar ajustes manuales como sustituto. Trazabilidad: DP-001/002/012/017; RN-INV-007/008/013/014/016; RF-VEN-004…008; RNF-INT-001/002/009; spec `existencias-y-ajustes-de-inventario`.

#### Scenario: Confirmación válida con varios productos
- **DADO** un borrador revisado con disponibilidad suficiente en todas sus líneas
- **CUANDO** se confirma
- **ENTONCES** SHALL quedar confirmada una venta con número, historia, salidas, importe exigible y auditoría coherentes, sin crear un pago ni autorización fiscal.

#### Scenario: Una línea carece de disponibilidad
- **DADO** una venta con dos productos y disponibilidad insuficiente en uno
- **CUANDO** se confirma
- **ENTONCES** SHALL rechazarse toda la venta, sin descontar el otro producto ni consumir numeración.

#### Scenario: Dos ventas compiten por la última unidad
- **DADO** una sola unidad disponible y dos ventas de esa unidad
- **CUANDO** se confirman simultáneamente
- **ENTONCES** SHALL confirmarse como máximo una; la otra SHALL informar insuficiencia sin número, deuda ni salida parcial.

#### Scenario: Venta directa frente a unidades reservadas
- **DADO** un producto con existencia 3, de las cuales 2 están reservadas por una orden
- **CUANDO** se confirma una venta directa de 2 unidades
- **ENTONCES** SHALL rechazarse informando disponibilidad 1, sin número, salida ni cambio en la reserva.

#### Scenario: La venta vinculada consume su propia reserva
- **DADO** un producto con existencia 2, reservado 2 por la venta vinculada que se confirma
- **CUANDO** se confirma esa venta
- **ENTONCES** SHALL aceptarse, la existencia SHALL quedar en 0 y la reserva SHALL quedar consumida, sin reserva residual.

#### Scenario: Falla un efecto de confirmación
- **DADO** una venta válida
- **CUANDO** falla cualquier efecto antes de completar la confirmación
- **ENTONCES** SHALL conservarse el borrador con sus reservas y revertirse número, historia confirmada, salidas, consumo de reservas, saldo y auditoría de éxito de ese intento.

### Requirement: Consulta comercial y comprobante interno accesibles

El sistema SHALL ofrecer lista y detalle autorizados con número, cliente, origen (directo o mantenimiento, con el número de la orden), fecha, total y estados independientes; filtros por cliente, fecha, estado y origen, y paginación estable. Los borradores vinculados SHALL poder filtrarse para que el Vendedor identifique los repuestos pendientes de confirmar. El detalle SHALL enlazar pagos, correcciones, origen de movimientos y, en las vinculadas, la orden de origen según permisos. El **documento interno** imprimible SHALL identificar RUC comercial, cliente, líneas, desglose, número, estado y, cuando exista, la orden de origen, y declarar que no constituye factura electrónica autorizada por el SRI. La experiencia SHALL conservar entradas ante errores, explicar efectos antes de confirmar y permitir navegación por teclado. Trazabilidad: RF-VEN-002/015/016; RF-AUD-004; UI-053…055/058; RNF-USA; DP-018.

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

## ADDED Requirements

### Requirement: Venta vinculada protegida frente a acciones ordinarias

Una venta vinculada a un mantenimiento SHALL conservar de forma inmutable su orden de origen, el RUC comercial y el cliente de la orden. Mientras esté en borrador, sus líneas SHALL modificarse únicamente mediante las acciones de repuestos de la orden; las acciones ordinarias de edición de ventas SHALL rechazar cambios de cliente, entidad, origen o líneas, y la eliminación o el descarte del borrador. La condición contado o crédito SHALL elegirse en la confirmación por un usuario con `ventas.confirmar`. Después de confirmarse, la venta vinculada SHALL seguir las reglas de historia inmutable, cobro y consulta de cualquier venta. Las ventas directas SHALL conservar su comportamiento sin cambios. Trazabilidad: RN-TAL-012; RF-TAL-011; RF-VEN-002; propuesta P5/P7.

#### Scenario: Editar una venta vinculada desde el recurso ordinario
- **DADO** una venta vinculada en borrador
- **CUANDO** un Vendedor intenta cambiar su cliente, agregar o quitar líneas o eliminarla mediante la edición ordinaria de ventas
- **ENTONCES** el sistema SHALL rechazarlo explicando que sus líneas se gestionan desde la orden, sin modificar la venta ni sus reservas.

#### Scenario: Confirmar una venta vinculada eligiendo crédito
- **DADO** una venta vinculada en borrador revisada
- **CUANDO** un Vendedor la confirma con condición crédito
- **ENTONCES** SHALL confirmarse con esa condición, conservando su orden de origen, sin registrar pagos.

#### Scenario: Venta directa conserva su comportamiento
- **DADO** una venta directa en borrador sin relación con órdenes
- **CUANDO** un Vendedor la edita, la confirma y la cobra
- **ENTONCES** SHALL comportarse como antes de esta entrega, sin reservas ni vínculos de mantenimiento.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
