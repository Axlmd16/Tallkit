# proformas-comerciales Specification

## Purpose
Cotizar productos del RUC comercial con precios finales de catálogo, con o sin cliente registrado: borrador editable, emisión numerada COM-PRO con historia inmutable, vigencia calculada, anulación, nuevas ofertas vinculadas, impreso para el cliente y conversión única y atómica en una venta en borrador, sin reservar inventario ni crear deuda.
## Requirements
### Requirement: Autorización de proformas por acción

El sistema SHALL exigir usuario activo y sesión vigente y SHALL autorizar en el servidor cada consulta, impresión y escritura, incluidos reintentos. Administrador y Vendedor SHALL consultar e imprimir con `proformas.ver`, crear, copiar, editar borradores y emitir con `proformas.gestionar`, anular con `proformas.anular` y convertir con `proformas.convertir`. La conversión SHALL exigir también permiso para crear ventas. El Encargado del taller sin rol comercial SHALL NOT acceder a proformas. La unión de roles SHALL aplicarse sin exponer costos al Vendedor. Trazabilidad: CT-001; actores-y-roles §3.4; RF-PRO-001/002/006/007/010; RNF-SEG-002/003/009.

#### Scenario: Acciones comerciales autorizadas
- **DADO** un Administrador o Vendedor activo con sesión vigente
- **CUANDO** solicita una acción de proformas correspondiente a su permiso
- **ENTONCES** el sistema SHALL permitirla si satisface las validaciones del documento.

#### Scenario: Acceso directo sin rol comercial
- **DADO** un usuario con solo el rol Encargado del taller
- **CUANDO** intenta consultar, imprimir, crear, emitir, anular o convertir una proforma por acceso directo
- **ENTONCES** el sistema SHALL rechazarlo sin revelar el documento ni producir efectos.

#### Scenario: Roles acumulados sin acceso a costos
- **DADO** un usuario Vendedor y Encargado del taller sin rol Administrador
- **CUANDO** consulta una proforma
- **ENTONCES** SHALL acceder a sus valores comerciales sin recibir costos ni valoración de inventario.

#### Scenario: Reintento después de perder autorización
- **DADO** una emisión anterior y una sesión invalidada o un permiso retirado
- **CUANDO** el usuario repite la solicitud
- **ENTONCES** SHALL denegarse el acceso sin revelar el resultado protegido ni repetir efectos.

### Requirement: Borradores de oferta comercial sin efectos definitivos

Una **proforma** SHALL pertenecer solo al **RUC comercial** y usar productos del catálogo en cantidades enteras positivas de presentaciones completas. El cliente SHALL ser opcional: puede cotizarse a quien no está registrado; si se indica, SHALL ser un cliente registrado conforme a DP-008 (ajuste aprobado por el usuario el 2026-10-06 durante la aplicación). SHALL permitir editar su borrador; para emitir SHALL exigir al menos una línea, productos activos, vigencia válida y, si tiene cliente, que esté activo. SHALL rechazar servicios, otra entidad fiscal y cantidades cero, negativas o fraccionarias. Ninguna acción sobre la oferta SHALL reservar o descontar existencia, generar Kardex, deuda, pagos o retenciones. Un kit SHALL cotizarse como producto intacto. Trazabilidad: DP-004/008/009/010/012; RN-PRO-001/002/003; RF-PRO-001/002/004; CU-010.

#### Scenario: Preparar y corregir el borrador
- **DADO** un cliente registrado y productos activos
- **CUANDO** el Vendedor guarda y después edita las cantidades del borrador
- **ENTONCES** SHALL conservarse la captura sin número definitivo, reserva, movimiento ni saldo.

#### Scenario: Emitir una oferta incompleta
- **DADO** un borrador sin líneas o con un cliente que dejó de ser válido
- **CUANDO** se solicita emitirlo
- **ENTONCES** SHALL rechazarse indicando los datos pendientes, sin consumir número.

#### Scenario: Cotizar sin cliente registrado
- **DADO** una persona que no está registrada como cliente y productos activos
- **CUANDO** el Vendedor guarda y emite la proforma sin cliente
- **ENTONCES** SHALL emitirse con su número y sus importes, sin datos de cliente en la oferta ni en el impreso.

#### Scenario: Línea incompatible
- **DADO** un borrador comercial
- **CUANDO** se intenta guardar un servicio, otra entidad fiscal o una cantidad cero, negativa o fraccionaria
- **ENTONCES** SHALL rechazarse sin guardar parcialmente la modificación.

#### Scenario: Producto desactivado antes de emitir
- **DADO** un producto que se desactivó después de incluirlo en el borrador
- **CUANDO** se solicita emitir
- **ENTONCES** SHALL rechazarse e identificarse la línea que debe corregirse, conservando el borrador.

#### Scenario: Cotizar un kit
- **DADO** un kit del catálogo
- **CUANDO** se cotiza una unidad
- **ENTONCES** SHALL figurar una unidad del kit sin desarmarlo ni afectar sus componentes.

#### Scenario: Intento de cobrar una oferta
- **DADO** una proforma emitida
- **CUANDO** se intenta registrar un pago, anticipo o retención sobre ella
- **ENTONCES** SHALL rechazarse sin crear hechos de cobranza ni saldo.

### Requirement: Precios de catálogo y cálculo de la oferta

La proforma SHALL obtener exclusivamente el **precio final de catálogo**, en USD y con hasta dos decimales, y la selección tributaria comercial del producto. SHALL NOT aceptar precio manual, descuento incluso cero ni sustitución manual del impuesto. Los importes SHALL calcularse con decimales: total de línea = cantidad × precio final; base = total / (1 + tarifa/100), redondeada a centavos HALF_UP; impuesto = total − base; totales = suma de líneas redondeadas. La tarifa SHALL resolverse para el día de emisión en America/Guayaquil; la ausencia de configuración SHALL NOT equivaler a tarifa cero. Antes de emitir SHALL revisarse los valores actuales y exigirse nueva revisión si cambian líneas, precios, impuestos o vigencia. Trazabilidad: proposal D1 y alcance aprobado; DP-004/017/025/026; RN-PRO-004; RF-PRO-003; RNF-INT-006/008.

#### Scenario: Precio manual enviado por un Administrador
- **DADO** un producto con precio de catálogo 10.00
- **CUANDO** un Administrador intenta cotizarlo a 9.00 o enviar un descuento, incluso cero
- **ENTONCES** SHALL rechazarse sin modificar el borrador ni el catálogo.

#### Scenario: Desglose inclusivo de la oferta
- **DADO** dos unidades a 11.50 y una tarifa configurada de prueba de 15 %
- **CUANDO** se calcula la proforma
- **ENTONCES** SHALL obtenerse total 23.00, base 20.00 e impuesto 3.00, sin convertir la tarifa de prueba en valor legal predeterminado.

#### Scenario: Redondeo y suma por línea
- **DADO** dos líneas distintas de total 0.03 cada una y tarifa de prueba de 20 %
- **CUANDO** se calcula la proforma
- **ENTONCES** SHALL resultar base 0.06, impuesto 0.00 y total 0.06, sin recalcular el impuesto globalmente.

#### Scenario: Cambio posterior a la revisión
- **DADO** una oferta revisada y un cambio de precio o tarifa antes de emitir
- **CUANDO** se intenta emitir con la revisión anterior
- **ENTONCES** SHALL requerirse revisar los valores actuales sin emitir ni asignar número.

#### Scenario: Configuración tributaria ausente
- **DADO** una línea sin vigencia tributaria comercial aplicable
- **CUANDO** se solicita emitir
- **ENTONCES** SHALL informarse el impedimento sin asumir exención ni emitir parcialmente.

### Requirement: Vigencia y estados de la oferta

La proforma SHALL distinguir borrador, vigente, vencida, convertida y anulada. La emisión SHALL usar fecha asignada por el sistema y sugerir vencimiento a fecha de emisión más 7 días; el Vendedor SHALL poder ajustar la fecha antes de emitir, nunca a un día anterior a la emisión. SHALL permanecer vigente hasta el final de la fecha indicada en America/Guayaquil y vencida desde el inicio del día siguiente, sin depender de que alguien abra su ficha. Una convertida o anulada SHALL conservar ese estado al pasar la fecha. SHALL NOT reactivarse una vencida o anulada. Administrador y Vendedor SHALL poder anular una oferta no convertida mediante acción explícita, conservando historia y número si existe. Trazabilidad: proposal D2 y alcance aprobado; RN-PRO-007/008; RF-PRO-005/006/011; modelo de dominio §7; CU-010.

#### Scenario: Fecha sugerida y ajuste
- **DADO** una emisión prevista el 6 de octubre de 2026
- **CUANDO** se prepara su vigencia
- **ENTONCES** SHALL sugerirse el 13 de octubre de 2026 y permitirse ajustar la fecha antes de emitir.

#### Scenario: Límite del vencimiento
- **DADO** una oferta emitida con vigencia hasta el 13 de octubre de 2026
- **CUANDO** se evalúa a las 23:59:59 de ese día y a las 00:00:00 del siguiente en America/Guayaquil
- **ENTONCES** SHALL resultar vigente en el primer momento y vencida en el segundo, sin intervención manual.

#### Scenario: Emisión posterior a la fecha elegida
- **DADO** un borrador cuya vigencia elegida es anterior al día actual
- **CUANDO** se solicita emitir
- **ENTONCES** SHALL requerirse corregir la fecha sin emitir ni consumir número.

#### Scenario: Anular y conservar historia
- **DADO** una proforma vigente o vencida no convertida
- **CUANDO** un actor autorizado confirma su anulación
- **ENTONCES** SHALL quedar anulada conservando número, contenido y trazabilidad, sin efecto de inventario ni cobranza.

#### Scenario: Estado terminal conservado
- **DADO** una proforma convertida o anulada
- **CUANDO** transcurre su fecha de vigencia
- **ENTONCES** SHALL conservar su estado y SHALL NOT permitir reactivación ni nueva conversión.

### Requirement: Emisión numerada e historia inmutable

Emitir SHALL asignar número comercial conforme a DP-006, inicialmente `COM-PRO-000001`, y conservar emisor, cliente, productos, cantidades, precio, base, tarifa, impuesto, total, emisión, vigencia y disponibilidad informativa de ese momento. Contenido y número emitidos SHALL permanecer inmutables aunque cambien datos maestros; solo SHALL permitirse transiciones explícitas autorizadas. Una emisión SHALL completar número, historia, estado y auditoría juntos o no producir ninguno de esos efectos. Los borradores SHALL NOT consumir secuenciales y la anulación SHALL NOT liberarlos. Trazabilidad: proposal D1/D3; DP-006/017/018; RF-PRO-005/010; configuración-operativa-y-fiscal; RNF-INT-001/003/009.

#### Scenario: Emisión válida
- **DADO** un borrador revisado y configuración comercial válida
- **CUANDO** se emite
- **ENTONCES** SHALL recibir un número único de proformas y conservar su contenido histórico en estado vigente, sin número de venta ni efectos económicos.

#### Scenario: Cambio de datos maestros
- **DADO** una proforma emitida
- **CUANDO** cambian cliente, emisor, producto, precio o tarifa
- **ENTONCES** su consulta histórica e impresión SHALL conservar los datos emitidos sin recalcularlos.

#### Scenario: Edición de documento emitido
- **DADO** una proforma vigente, vencida, convertida o anulada
- **CUANDO** se intenta modificar su contenido o borrarla mediante una edición ordinaria
- **ENTONCES** SHALL rechazarse conservando la oferta y ofreciendo crear una nueva vinculada cuando corresponda.

#### Scenario: Falla durante emisión
- **DADO** un borrador válido
- **CUANDO** falla un efecto de emisión antes de completar la acción
- **ENTONCES** SHALL conservarse el borrador sin número asignado, historia emitida ni auditoría de éxito parciales.

#### Scenario: Falta serie activa
- **DADO** una oferta válida sin serie comercial de proformas activa
- **CUANDO** se solicita emitir
- **ENTONCES** SHALL rechazarse sin usar la serie de ventas ni la artesanal.

### Requirement: Disponibilidad informativa sin reserva

SHALL permitirse cotizar productos activos aun con disponibilidad insuficiente o cero. La captura SHALL mostrar disponibilidad actual, calculada como existencia menos reservas vigentes, y advertir la insuficiencia sin bloquear la oferta. La emisión SHALL conservar esa información y su momento de referencia para la consulta interna; la consulta actual SHALL distinguirse de la histórica. La disponibilidad es información interna del local: el documento que se entrega al cliente SHALL NOT mostrarla (ajuste aprobado el 2026-10-06). Trazabilidad: proposal D4/D5; DP-012; RN-PRO-002/004; RF-PRO-004/010.

#### Scenario: Ofertar por encima de disponibilidad
- **DADO** existencia 5 y reservas vigentes de 4 unidades de un producto
- **CUANDO** se cotizan y emiten 3 unidades
- **ENTONCES** SHALL permitirse mostrando disponibilidad 1 y aviso de insuficiencia, conservando existencia 5 y reserva 4.

#### Scenario: Stock cambia después de emitir
- **DADO** una proforma emitida cuando había disponibilidad 1 y ahora hay 6
- **CUANDO** se consulta o imprime
- **ENTONCES** SHALL conservarse la referencia histórica 1 en la consulta interna de la oferta, cualquier consulta actual SHALL identificarse separadamente como 6 y el impreso para el cliente SHALL NOT mostrar ninguna de las dos.

### Requirement: Nueva oferta vinculada con valores actuales

Para cambiar una oferta emitida o retomar una vencida o anulada SHALL crearse una nueva proforma en borrador vinculada al original, sin reactivarlo ni sobrescribirlo. SHALL copiarse cliente y líneas como punto de partida, revalidar sus datos y obtener precios, impuestos y disponibilidad actuales; SHALL requerirse corregir referencias inactivas antes de emitir. La nueva oferta SHALL tener identidad propia, nueva vigencia y su propio número al emitir. Trazabilidad: proposal D2/D3; RN-PRO-007/008; RF-PRO-011; CU-010.

#### Scenario: Retomar una vencida con otro precio
- **DADO** una proforma vencida a 10.00 y un precio actual de 12.00
- **CUANDO** se crea una nueva vinculada
- **ENTONCES** SHALL crearse un borrador con precio actual 12.00, nueva vigencia y vínculo visible, conservando vencida la oferta original a 10.00.

#### Scenario: Cambiar cantidades de una emitida
- **DADO** una oferta emitida por 3 unidades
- **CUANDO** el usuario prepara una nueva vinculada por 2 unidades
- **ENTONCES** SHALL conservarse la original por 3 y editarse solo el nuevo borrador, cuyo número propio se asignará al emitir.

### Requirement: Conversión única y atómica a venta

Solo una oferta emitida vigente, no anulada y no convertida SHALL originar una venta nueva en borrador. La venta SHALL exigir un cliente registrado y activo: el de la oferta o, si la oferta no tiene, el que se elija al convertir, sin modificar la oferta emitida. SHALL copiar cliente y líneas y revalidando datos, precios, impuestos y disponibilidad actuales. La disponibilidad insuficiente SHALL advertirse sin impedir crear el borrador; la confirmación de venta SHALL exigir disponibilidad suficiente. Venta creada, vínculo único, estado convertida y auditoría SHALL completarse juntos o ninguno. SHALL NOT confirmarse ni cobrarse automáticamente. Un segundo intento distinto SHALL NOT crear otra venta y SHALL indicar la existente; repetir el mismo intento compatible SHALL recuperar el resultado. Trazabilidad: proposal D6; RN-PRO-004/005/006/007; RF-PRO-007/008/009; CU-011; RNF-INT-001/004/009.

#### Scenario: Conversión válida
- **DADO** una proforma vigente con cliente y productos válidos
- **CUANDO** el usuario solicita convertirla
- **ENTONCES** SHALL crearse una única venta comercial en borrador con cliente y líneas copiados, vínculo visible y oferta convertida, sin reserva, salida, deuda, cobro ni número de venta.

#### Scenario: Convertir una oferta sin cliente
- **DADO** una proforma vigente emitida sin cliente
- **CUANDO** se solicita convertir sin elegir cliente y después eligiendo uno registrado
- **ENTONCES** el primer intento SHALL rechazarse sin crear venta y el segundo SHALL crear la venta para ese cliente, conservando la oferta sin cliente y enlazada a la venta.

#### Scenario: Oferta no convertible
- **DADO** una proforma en borrador, vencida, anulada o ya convertida
- **CUANDO** se solicita una nueva conversión
- **ENTONCES** SHALL rechazarse sin crear otra venta e indicarse la existente cuando esté convertida.

#### Scenario: Referencia desactivada al convertir
- **DADO** una proforma vigente cuyo cliente o producto dejó de ser válido
- **CUANDO** se solicita convertir
- **ENTONCES** SHALL informarse qué referencia debe resolverse sin crear venta parcial ni marcar la oferta como convertida.

#### Scenario: Fallo de creación de la venta
- **DADO** una oferta convertible
- **CUANDO** falla la acción antes de completarse
- **ENTONCES** SHALL permanecer sin convertir y no existir venta, vínculo ni auditoría de éxito parciales.

#### Scenario: Conversiones simultáneas
- **DADO** dos usuarios que convierten la misma oferta vigente
- **CUANDO** ambas solicitudes compiten
- **ENTONCES** SHALL existir como máximo una venta vinculada y el otro intento SHALL informar la conversión existente sin duplicarla.

#### Scenario: Conversión compite con anulación o vencimiento
- **DADO** una oferta vigente al iniciar la interacción
- **CUANDO** la anulación se completa antes de convertir o se alcanza el día siguiente a su vigencia antes de ejecutar la conversión
- **ENTONCES** SHALL rechazarse la conversión sin venta; si la conversión se completó primero, SHALL rechazarse la anulación sin romper el vínculo.

### Requirement: Reintentos y ediciones concurrentes de proformas

Crear, copiar, guardar, emitir, anular y convertir SHALL reconocer el intento lógico: reintentos compatibles SHALL recuperar el resultado sin duplicar efectos y reutilizarlo con contenido diferente SHALL producir conflicto. Emitir de nuevo el mismo documento SHALL NOT asignar otro número aun con otra identidad de intento. Ediciones obsoletas SHALL NOT sobrescribir cambios ajenos. Las emisiones simultáneas de ofertas diferentes SHALL recibir números distintos del ámbito comercial de proformas. Las acciones SHALL conservar autor, momento, documento y vínculos sin registrar datos personales innecesarios. Trazabilidad: DP-006; RF-AUD-001…004/006; RNF-INT-003/004; proposal alcance aprobado.

#### Scenario: Respuesta de creación perdida
- **DADO** un intento de crear o copiar ya completado cuya respuesta se perdió
- **CUANDO** se repite con la misma identidad y contenido
- **ENTONCES** SHALL devolverse el mismo borrador sin crear una segunda oferta.

#### Scenario: Reemisión del mismo documento
- **DADO** una proforma emitida cuya respuesta se perdió
- **CUANDO** se repite la emisión compatible incluso con otra identidad de intento
- **ENTONCES** SHALL recuperarse el documento emitido con el mismo número e historia.

#### Scenario: Identidad de intento incompatible
- **DADO** un intento completado con unas líneas
- **CUANDO** se reutiliza su identidad enviando otras cantidades
- **ENTONCES** SHALL responder conflicto sin reemplazar ni repetir el resultado previo.

#### Scenario: Guardado obsoleto
- **DADO** dos usuarios que editaron la misma versión de un borrador
- **CUANDO** el segundo guarda después del primero
- **ENTONCES** SHALL rechazarse el cambio obsoleto y conservarse la edición guardada para revisión.

#### Scenario: Emisiones independientes simultáneas
- **DADO** dos ofertas diferentes listas para emitir y serie activa COM-PRO
- **CUANDO** se emiten simultáneamente
- **ENTONCES** SHALL recibir números distintos y consecutivos de esa serie sin consumir COM-VEN ni ART-SER.

### Requirement: Consulta e impresión de cotizaciones

SHALL ofrecerse listado con número cuando exista, cliente, emisión, vigencia, total y estado, búsqueda por número o cliente, filtros de estado y navegación a detalle, ofertas relacionadas y venta generada según permisos. El detalle SHALL mostrar acciones acordes al estado. La proforma emitida SHALL disponer de vista A4 imprimible y guardable como PDF mediante el navegador, con datos y logo comercial cuando exista, cliente, número, vigencia, líneas con el código del producto, el **código del fabricante** y la **marca del producto**, cantidades, precios, base, impuestos y total históricos. El encabezado SHALL presentarse como membrete: con logo comercial, el logo SHALL mostrarse a mayor tamaño y SHALL NOT repetirse por separado el nombre del local que ya forma parte del logotipo; junto al tipo de documento y su número SHALL mostrarse el RUC, la dirección, el teléfono y el correo históricos del emisor, con el rótulo de cada dato aunque esté vacío cuando el emisor no lo tenga (ajuste aprobado por el usuario el 2026-10-15). Es el documento que se entrega al cliente: SHALL titularse «Proforma», SHALL NOT presentarse como factura y SHALL NOT incluir disponibilidad, avisos de insuficiencia, leyendas internas ni la mención del sistema (ajuste aprobado por el usuario el 2026-10-06 durante la aplicación, que sustituye la leyenda de cotización interna y la disponibilidad impresa de la versión anterior de este requisito). Un borrador SHALL distinguirse de una oferta emitida y no inventar número; las ofertas vencidas, convertidas o anuladas SHALL mostrar su estado al pie; el estado vigente SHALL NOT rotularse en el documento, porque es información del sistema (ajuste aprobado por el usuario el 2026-10-15, que sustituye el título «Cotización» y el rótulo de estado en el encabezado). SHALL NOT imprimir costos ni usar la identidad artesanal. Trazabilidad: proposal D5; DP-018; RF-PRO-010; UI-050…052; RNF-USA-006/010/012.

#### Scenario: Buscar y navegar
- **DADO** varias ofertas de clientes diferentes, incluida una convertida
- **CUANDO** el Vendedor busca por cliente y estado convertida
- **ENTONCES** SHALL ver las coincidencias y poder abrir la oferta y su venta vinculada.

#### Scenario: Impresión comercial completa
- **DADO** una oferta emitida con logo comercial y una línea sin disponibilidad suficiente
- **CUANDO** el usuario abre la impresión A4 o guarda como PDF desde el navegador
- **ENTONCES** SHALL obtener los datos históricos, logo comercial, vigencia, códigos de producto y de fabricante, marca e importes legibles, con las descripciones extensas repartidas en varias líneas, sin disponibilidad, avisos internos, costos, contenido recortado ni identificación de factura.

#### Scenario: Membrete sin nombre repetido
- **DADO** una oferta vigente emitida con logo comercial y emisor sin teléfono ni correo registrados
- **CUANDO** se consulta o imprime su vista A4
- **ENTONCES** SHALL mostrarse el logo ampliado sin el nombre del local escrito aparte, «Proforma N.º» con su número sin rótulo de estado, el RUC y la dirección del emisor, y los rótulos de teléfono y correo vacíos; si el logo no carga SHALL mostrarse el nombre en su lugar.

#### Scenario: Emisor sin logo
- **DADO** una oferta emitida sin logo comercial
- **CUANDO** se imprime
- **ENTONCES** SHALL mostrarse el nombre y datos del emisor sin sustituirlos por logo artesanal ni reservar un hueco vacío.

#### Scenario: Imprimir después de anular o vencer
- **DADO** una oferta anulada o vencida
- **CUANDO** se imprime
- **ENTONCES** SHALL conservar sus valores originales e indicar claramente el estado actual y su vigencia original.

#### Scenario: Captura accesible y error recuperable
- **DADO** un usuario que captura una oferta con teclado o desde una pantalla de 360 px
- **CUANDO** una validación rechaza guardar
- **ENTONCES** SHALL conservarse la entrada, identificarse el error junto al campo o acción y mantenerse accesibles las acciones sin depender solo del color ni desbordar horizontalmente el formulario principal.
