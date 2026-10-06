# ventas-comerciales Specification

## Purpose
Registrar ventas de repuestos del RUC comercial, directas, vinculadas a un mantenimiento u originadas en una proforma, con borrador, revisión y confirmación idempotente; conservar historia, costos de salida cuando existan, reglas de autorización y comprobante navegable.
## Requirements
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

### Requirement: Precios vigentes sin modificación libre ni descuentos

El **precio final de catálogo** SHALL ser el precio aplicado de la venta para todos los roles, en USD y con hasta dos decimales; SHALL NOT aceptarse precio negociado, descuento ni sustitución manual del impuesto en la venta. La selección tributaria SHALL proceder del producto y resolverse en el ámbito comercial. Una variación relevante de precio, impuesto, líneas o condición después de revisar SHALL exigir nueva revisión explícita antes de confirmar; cambiar la configuración no cambia automáticamente el precio final de catálogo. Trazabilidad: DP-004/017; RN-CAT-007/016; RF-VEN-003/005/014; propuesta, recomendaciones 1/2.

#### Scenario: Precio cambia después de la revisión
- **DADO** un borrador revisado con precio 10.00 y un cambio de catálogo a 12.00
- **CUANDO** se intenta confirmar con la revisión anterior
- **ENTONCES** SHALL requerirse revisar 12.00 y los totales actuales, sin confirmar ni descontar existencia.

#### Scenario: Administrador intenta cambiar el precio en la venta
- **DADO** un Administrador que prepara una venta
- **CUANDO** envía un precio distinto al de catálogo o un descuento, incluso de valor cero
- **ENTONCES** SHALL rechazarse la entrada; el cambio de precio del catálogo SHALL seguir su función administrativa independiente.

### Requirement: Desglose decimal por línea y vigencia de confirmación

El sistema SHALL calcular con decimales: total de línea = cantidad × precio final; base = total / (1 + tarifa/100), redondeada a centavos con HALF_UP; impuesto = total − base. Los totales de documento SHALL sumar las líneas ya calculadas. La fecha operativa SHALL ser la fecha efectiva de confirmación asignada por el sistema en America/Guayaquil, sin retrofecha; SHALL existir configuración comercial, bodega, serie y una vigencia tributaria única por selección. Ausencia de configuración SHALL NOT significar tarifa cero. Los datos inválidos o excesos de escala SHALL rechazarse sin redondearlos silenciosamente. Trazabilidad: DP-017; RN-FIS-010; RF-VEN-003/005; RNF-INT-006/008; configuración-operativa-y-fiscal; propuesta, recomendación 1.

#### Scenario: Desglose con tarifa de ejemplo
- **DADO** una tarifa configurada de prueba de 15% y dos unidades a 11.50
- **CUANDO** se calculan los importes de la línea
- **ENTONCES** SHALL resultar total 23.00, base 20.00 e impuesto 3.00; la tarifa del ejemplo SHALL NOT convertirse en predeterminada legal.

#### Scenario: Redondeo de medio centavo
- **DADO** una tarifa de prueba de 20% y una línea de total 0.03
- **CUANDO** se desglosa la línea
- **ENTONCES** SHALL resultar base 0.03 e impuesto 0.00 mediante HALF_UP, conservando el total 0.03.

#### Scenario: Totales suman líneas redondeadas
- **DADO** dos líneas distintas de total 0.03 cada una y tarifa de prueba de 20%
- **CUANDO** se calculan los totales del documento
- **ENTONCES** SHALL resultar base 0.06, impuesto 0.00 y total 0.06, sin recalcular el impuesto globalmente.

#### Scenario: Falta configuración aplicable
- **DADO** que falta entidad, bodega, serie o vigencia única para alguna línea
- **CUANDO** se solicita confirmar
- **ENTONCES** SHALL rechazarse con explicación corregible sin número, movimientos ni saldo.

#### Scenario: Confirmación cruza un cambio de día o tarifa
- **DADO** un borrador revisado antes de entrar en vigor otra tarifa
- **CUANDO** se intenta confirmar después del cambio efectivo en America/Guayaquil
- **ENTONCES** SHALL resolverse la tarifa del momento efectivo y requerirse nueva revisión del desglose cambiado.

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

### Requirement: Numeración e idempotencia de escrituras comerciales

Los borradores SHALL NOT consumir números; la confirmación SHALL usar la serie activa del ámbito de ventas comerciales, inicialmente COM-VEN, conforme a configuración. Las escrituras SHALL identificar el intento lógico y rechazar su reutilización con contenido incompatible; repetir un intento compatible SHALL devolver el resultado existente. Confirmar una misma venta, incluso con otro identificador de intento, SHALL NOT duplicar su número, salida o deuda. La asignación concurrente SHALL ser única y los números confirmados SHALL conservarse tras anulaciones. Trazabilidad: DP-006; RF-VEN-006…008; RF-AUD-006; RNF-INT-003/004; configuración-operativa-y-fiscal.

#### Scenario: Repetir creación después de perder la respuesta
- **DADO** un intento de creación de borrador ya procesado
- **CUANDO** se repite con igual identidad y contenido
- **ENTONCES** SHALL devolverse el mismo borrador sin crear otro.

#### Scenario: Reconfirmar una venta con otra identidad de intento
- **DADO** una venta confirmada
- **CUANDO** se repite su confirmación compatible con otra identidad de intento
- **ENTONCES** SHALL devolverse la venta existente sin duplicar efectos.

#### Scenario: Reutilizar intento con otra entrada
- **DADO** una escritura comercial ya procesada
- **CUANDO** se reutiliza su identidad con contenido incompatible
- **ENTONCES** SHALL responder conflicto, sin ocultar la incompatibilidad ni ejecutar nuevos efectos.

#### Scenario: Confirmaciones concurrentes con suficiente inventario
- **DADO** dos ventas distintas válidas y suficiente disponibilidad
- **CUANDO** se confirman simultáneamente
- **ENTONCES** SHALL recibir números comerciales distintos y consecutivos de la serie activa, sin invadir ART-SER.

#### Scenario: Ediciones concurrentes del borrador
- **DADO** dos usuarios que editaron la misma versión de un borrador
- **CUANDO** intentan guardar cambios incompatibles
- **ENTONCES** SHALL conservarse un resultado válido y rechazarse la edición obsoleta, sin sobrescribir silenciosamente lo guardado.

### Requirement: Historia y estados independientes

La venta SHALL distinguir borrador, confirmada y anulada. Una operación confirmada SHALL conservar cliente, entidad, productos, cantidades, precios, impuesto, totales y costo histórico aunque cambien datos maestros. SHALL NOT editarse ni eliminarse mediante acciones ordinarias; sus correcciones SHALL seguir la capacidad de correcciones de ventas. Estado de venta, **estado de pago**, documento interno y futura facturación SHALL ser independientes. Trazabilidad: DP-017/018; RN-VEN-006/007; RF-VEN-004/009/010; RF-AUD-003/004.

#### Scenario: Cambian datos maestros después de vender
- **DADO** una venta confirmada
- **CUANDO** cambian nombre del cliente, producto, datos fiscales, precio, tarifa o costo actual
- **ENTONCES** SHALL conservarse la información histórica de la venta y su comprobante.

#### Scenario: Intento de edición destructiva
- **DADO** una venta confirmada o anulada
- **CUANDO** cualquier rol intenta editar sus importes, cantidades, cliente o estado mediante edición genérica, o eliminarla
- **ENTONCES** SHALL rechazarse y conservarse la historia.

#### Scenario: Venta confirmada aún no cobrada
- **DADO** una venta de total positivo sin pagos
- **CUANDO** finaliza su confirmación
- **ENTONCES** SHALL mostrarse confirmada y pendiente de pago, con documento interno confirmado y sin autorización del SRI.

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

### Requirement: Venta vinculada protegida frente a acciones ordinarias

Una venta vinculada a un mantenimiento SHALL conservar de forma inmutable su orden de origen, el RUC comercial y el cliente de la orden. Mientras esté en borrador, sus líneas SHALL modificarse únicamente mediante las acciones de repuestos de la orden. Las acciones ordinarias de edición de ventas SHALL rechazar cambios de cliente, entidad, origen o líneas, y la eliminación o el descarte del borrador. El borrador vinculado SHALL eliminarse únicamente cuando se retira su última línea desde la orden, conforme a `repuestos-del-mantenimiento`, o mediante la limpieza explícita de borradores vacíos. La condición contado o crédito SHALL elegirse en la confirmación por un usuario con `ventas.confirmar`. Después de confirmarse, la venta vinculada SHALL seguir las reglas de historia inmutable, cobro y consulta de cualquier venta, y SHALL NOT eliminarse. Las ventas directas SHALL conservar su comportamiento sin cambios. Trazabilidad: RN-TAL-012; RN-VEN-006; RF-TAL-011; RF-VEN-002; propuesta de integración P5/P7; propuesta A1.

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
- **ENTONCES** SHALL comportarse como antes de esta entrega, sin reservas ni vínculos de mantenimiento, y SHALL NOT eliminarse aunque quede sin líneas.

### Requirement: Acceso fiscal comercial sin cambiar la confirmación de venta

Administrador y Vendedor SHALL poder acceder desde una venta confirmada a su preparación fiscal, solicitudes y evidencias vinculadas, según los permisos de cada capacidad. La acción de inicio SHALL llamarse «Preparar datos fiscales», y una preparación completada SHALL mostrarse como «Preparación local» y «Pendiente de emisión». Ningún texto SHALL presentarla como factura emitida, autorizada, enviada o aprobada por el SRI.

La consulta SHALL distinguir **documento interno**, **estado de pago**, preparación local y evidencia externa no verificada. El comprobante interno SHALL conservar número, historia y la advertencia de que no constituye factura electrónica autorizada. Un Encargado sin rol comercial SHALL conservar exclusivamente su consulta limitada de ventas vinculadas y SHALL NOT acceder por ella a expedientes fiscales, XML ni acciones fiscales comerciales.

Trazabilidad: propuesta P1/P2 y Modified Capabilities; propuesta de simplificación A6; DP-018/029; RN-FIS-009; RF-VEN-015; spec principal de ventas, autorización por acción.

#### Scenario: Venta confirmada sin preparación
- **DADO** una venta confirmada consultada por un Vendedor
- **CUANDO** abre el apartado fiscal
- **ENTONCES** SHALL mostrarse sin preparación y ofrecer «Preparar datos fiscales», sin sugerir una autorización pendiente ya solicitada.

#### Scenario: Venta con preparación completada
- **DADO** una venta confirmada con preparación local completada
- **CUANDO** el Vendedor abre su ficha
- **ENTONCES** SHALL verse «Preparación local · Pendiente de emisión» sin la palabra «factura emitida» ni «autorizada».

#### Scenario: Evidencia importada vinculada
- **DADO** una venta con un XML externo archivado y vinculado
- **CUANDO** el Vendedor consulta su situación fiscal
- **ENTONCES** SHALL ver identidad, origen externo y condición no verificada, y descargar únicamente la evidencia a la que tenga acceso, sin sustituir el número interno.

#### Scenario: Encargado intenta seguir enlace fiscal comercial
- **DADO** un Encargado que puede consultar el resumen de una venta vinculada
- **CUANDO** intenta abrir su XML o preparación comercial sin rol adicional
- **ENTONCES** SHALL denegarse conservando el acceso limitado al resumen económico autorizado.

### Requirement: Independencia comercial durante la preparación fiscal

Confirmar, cobrar, devolver o anular una venta SHALL conservar sus requisitos existentes. La falta de perfil fiscal adicional, certificado o integración SHALL NOT bloquear una confirmación interna válida ni producir llamadas externas. Las correcciones comerciales SHALL mantenerse visibles para el seguimiento fiscal sin emitir documentos ni modificar evidencias. La incorporación de esta capacidad SHALL NOT preparar automáticamente ventas previas ni cambiar su historia. Trazabilidad: propuesta P2; DP-017/018/027/028; RN-CON-002/007/010.

#### Scenario: Confirmación sin configuración fiscal adicional
- **DADO** una venta que cumple la configuración interna pero tiene perfil electrónico incompleto
- **CUANDO** el Vendedor confirma
- **ENTONCES** SHALL confirmarse conforme a las reglas comerciales, sin autorización fiscal ni número fiscal productivo y sin ocultar los pendientes al entrar en preparación.

#### Scenario: Despliegue sobre ventas históricas
- **DADO** ventas confirmadas antes de disponer del módulo fiscal
- **CUANDO** se habilita esta capacidad
- **ENTONCES** SHALL conservarse su estado y no crearse intenciones, facturas ni cobros retrospectivos.

### Requirement: Limpieza explícita de borradores vinculados vacíos

El sistema SHALL ofrecer una acción operativa explícita para eliminar los borradores vinculados que ya estén vacíos, sin líneas ni reservas activas. Por omisión SHALL solo informar cuáles eliminaría, con la venta y la orden de cada uno. SHALL eliminarlos únicamente con una confirmación expresa, y SHALL auditar cada eliminación. SHALL NOT eliminar ventas confirmadas o anuladas, borradores directos ni borradores vinculados con líneas. Repetirla SHALL ser seguro y no producir efectos adicionales. SHALL NOT ejecutarse automáticamente mediante migraciones. Trazabilidad: RN-CON-007; propuesta A1.

#### Scenario: Informe sin cambios por omisión
- **DADO** un borrador vinculado vacío de la orden `ART-OT-000001` y un borrador directo vacío
- **CUANDO** se ejecuta la limpieza sin confirmación
- **ENTONCES** SHALL informar únicamente el borrador vinculado vacío y SHALL NOT eliminar nada.

#### Scenario: Limpieza confirmada
- **DADO** el mismo estado
- **CUANDO** se ejecuta la limpieza con confirmación expresa
- **ENTONCES** SHALL eliminarse solo el borrador vinculado vacío, con su evento de auditoría, y una segunda ejecución SHALL informar que no hay nada por limpiar.

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

