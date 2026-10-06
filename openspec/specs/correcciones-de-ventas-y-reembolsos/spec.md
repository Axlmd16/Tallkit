# correcciones-de-ventas-y-reembolsos Specification

## Purpose
Corregir ventas comerciales sin borrar historia: corrección y anulación de pagos, devoluciones parciales con aptitud del producto para reingresar al inventario, reembolsos, anulación conservadora bloqueada por movimientos posteriores y auditoría navegable de cada corrección.
## Requirements
### Requirement: Autorización y revisión explícita de correcciones

Solo Administrador activo y autenticado SHALL anular ventas, registrar devoluciones y reembolsos. Cada corrección SHALL exigir motivo no vacío, venta de origen comercial y revisión de efectos sobre cantidades, importe exigible, pagos y reembolsos. Preparar, revisar o cancelar la captura SHALL NOT producir esos efectos. Si cambian los datos relevantes después de revisar, SHALL exigirse revisión actualizada. Vendedor y Encargado del taller sin Administrador SHALL NOT ejecutar estas acciones, incluso mediante solicitudes directas o reintentos. Trazabilidad: RN-SEG-004/005/007; actores-y-roles §3.4; RF-VEN-011/012; RF-AUD-002; CU-014/015.

#### Scenario: Administrador revisa sin confirmar
- **DADO** una venta confirmada corregible
- **CUANDO** el Administrador prepara una devolución y revisa su efecto sin confirmarla
- **ENTONCES** SHALL visualizar la corrección prevista sin modificar inventario, exigible ni dinero.

#### Scenario: Corrección sin autorización
- **DADO** un usuario Vendedor o Encargado del taller sin rol Administrador
- **CUANDO** intenta anular, devolver o reembolsar una venta
- **ENTONCES** SHALL denegarse sin efectos ni información restringida.

#### Scenario: Corrección sin motivo
- **DADO** un Administrador y una operación corregible
- **CUANDO** intenta confirmar una corrección con motivo vacío o solo espacios
- **ENTONCES** SHALL rechazarse e indicarse el motivo requerido.

#### Scenario: Efecto revisado queda obsoleto
- **DADO** una devolución revisada antes de registrarse otro pago o devolución de la venta
- **CUANDO** se intenta confirmar usando aquella revisión
- **ENTONCES** SHALL requerirse una revisión actualizada sin aplicar la corrección anterior.

### Requirement: Anulación total conservadora de una venta

Una **anulación** SHALL conservar la venta, sus líneas, número e historia, dejar exigible cero y compensar sus efectos como una acción atómica. SHALL admitirse únicamente para una venta directa confirmada sin devoluciones previas, sin anulación anterior y cuando cada salida siga siendo el último efecto de inventario de su producto y pueda restituirse exactamente cantidad y valoración previas sin negativos. Una venta vinculada a un mantenimiento SHALL NOT anularse: el intento SHALL bloquearse explicando que sus repuestos se consideran utilizados en el vehículo y que su corrección requiere un procedimiento de devolución o nota de crédito ajeno a la orden, sin ofrecer una acción que lo simule. Si existen movimientos posteriores, SHALL bloquearse explicando la dependencia; una devolución física real SHALL seguir su flujo propio y SHALL NOT inventarse para sortear el bloqueo. SHALL NOT completarse con pagos sin tratamiento trazable. Reabrir, finalizar o consultar una orden SHALL NOT anular sus ventas vinculadas. Trazabilidad: RF-VEN-011; RN-VEN-006/016; RN-INV-011/012; RN-TAL-013; CU-015; propuesta de ventas, recomendación 4; propuesta P5.

#### Scenario: Anular una venta sin cobros ni dependencias
- **DADO** una venta directa confirmada sin pagos ni devoluciones y cuyas salidas son los últimos efectos de sus productos
- **CUANDO** el Administrador confirma su anulación con motivo y revisión vigente
- **ENTONCES** SHALL quedar anulada, con exigible cero, cantidades y valoración previas restituidas mediante movimientos vinculados y número original conservado.

#### Scenario: Un producto tiene movimiento posterior
- **DADO** una venta de varios productos y un movimiento posterior en uno de ellos
- **CUANDO** se solicita anular la venta
- **ENTONCES** SHALL rechazarse toda la anulación identificando la dependencia, sin compensar los otros productos ni reescribir movimientos.

#### Scenario: Anulación después de devolución parcial
- **DADO** una venta que ya tiene devolución confirmada
- **CUANDO** se solicita anularla totalmente
- **ENTONCES** SHALL rechazarse y conservarse la venta con sus correcciones; cualquier devolución adicional SHALL limitarse a lo aún devolvible.

#### Scenario: Repetir una anulación completada
- **DADO** una venta ya anulada
- **CUANDO** se repite su anulación compatible
- **ENTONCES** SHALL devolverse el resultado existente sin otros movimientos, reembolsos o cambios de numeración.

#### Scenario: Anulación de una venta vinculada bloqueada
- **DADO** una venta vinculada confirmada, con o sin pagos, cuyas salidas son los últimos efectos de sus productos
- **CUANDO** el Administrador solicita anularla
- **ENTONCES** SHALL rechazarse explicando que sus repuestos se consideran utilizados, sin restituir inventario, modificar pagos ni cambiar la orden.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).

### Requirement: Tratamiento de pagos al anular la venta

La anulación SHALL distinguir pagos registrados erróneamente de dinero realmente recibido. Un pago inexistente en la realidad SHALL poder corregirse mediante la capacidad de pagos con motivo; el dinero recibido SHALL exigir **reembolso** efectivo trazable, sin borrar o anular ficticiamente el ingreso. Al completar la anulación, el conjunto de venta, compensaciones, tratamiento de pagos y auditoría SHALL quedar coherente y sin saldo ni exceso pendiente; confirmar la anulación SHALL NOT afirmar un desembolso que el Administrador no haya registrado expresamente. El tratamiento del dinero SHALL permanecer asociado a la misma venta comercial. Trazabilidad: RN-VEN-016/019; RF-VEN-011; RF-PAG-008; CU-015; modelo de dominio §8; propuesta, recomendación 4.

#### Scenario: Anulación con dinero recibido y sin devolución registrada
- **DADO** una venta cobrable anulable con 100.00 efectivamente recibidos
- **CUANDO** se intenta completar su anulación sin registrar el tratamiento de ese dinero
- **ENTONCES** SHALL bloquearse conservando la venta confirmada y sus pagos, sin marcar un reembolso ficticio.

#### Scenario: Anulación con reembolso efectivo expresamente registrado
- **DADO** una venta de 100.00 cobrada, anulable y sin devoluciones previas
- **CUANDO** el Administrador completa su anulación registrando expresamente el desembolso efectivo de 100.00 y su medio real como parte de la corrección
- **ENTONCES** SHALL conservarse el cobro original, el reembolso vinculado y la anulación con exigible, saldo y exceso cero, sin pagos huérfanos ni doble desembolso registrado.

#### Scenario: Pago erróneo ya corregido
- **DADO** una venta anulable cuyo único pago fue anulado por registro erróneo con su motivo e historia
- **CUANDO** se confirma la anulación de la venta
- **ENTONCES** SHALL conservarse la corrección del pago y SHALL NOT inventarse un reembolso de dinero que no se recibió.

### Requirement: Devolución limitada a líneas y cantidades originales

Una **devolución** SHALL referenciar una venta confirmada no anulada y sus líneas originales, con cantidades enteras positivas de presentaciones completas. La suma de devoluciones válidas de una línea SHALL NOT exceder su cantidad vendida; repetir una línea dentro de una solicitud SHALL NOT eludir ese límite. El Administrador SHALL indicar aptitud para reventa para cada cantidad devuelta, pudiendo distinguir cantidades aptas y no aptas de la misma línea. Confirmar SHALL conservar el original y sus estados independientes, reducir el exigible con importes históricos y producir solo los reingresos aptos. SHALL NOT tratarse como edición de venta o ajuste manual. Trazabilidad: DP-009/014; RN-VEN-015/020; RF-VEN-012/013; CU-014.

#### Scenario: Devolución parcial con aptitud mixta
- **DADO** una línea de cinco unidades sin devoluciones
- **CUANDO** el Administrador devuelve tres, declara dos aptas y una no apta, con motivo
- **ENTONCES** SHALL corregirse económicamente tres unidades, reingresar solo dos y quedar dos todavía devolvibles, conservando la venta original.

#### Scenario: Devolver más que la cantidad restante
- **DADO** cinco unidades vendidas y tres ya devueltas
- **CUANDO** se intenta devolver tres adicionales, incluso repartidas en entradas repetidas de la misma línea
- **ENTONCES** SHALL rechazarse toda la solicitud sin devolución, reingreso ni reducción del exigible.

#### Scenario: Línea ajena o venta no elegible
- **DADO** una devolución con línea de otra venta, origen artesanal, venta en borrador o anulada
- **CUANDO** se intenta confirmarla
- **ENTONCES** SHALL rechazarse sin alterar ninguna operación.

#### Scenario: Cantidad o inspección inválida
- **DADO** una devolución preparada con cantidad cero, negativa, fraccionaria o sin clasificación de aptitud
- **CUANDO** se intenta confirmarla
- **ENTONCES** SHALL rechazarse con error de los datos afectados y sin efectos parciales.

### Requirement: Importes históricos y conservación de centavos

La devolución SHALL usar precio final, base, tarifa e impuesto históricos de la línea, sin aplicar catálogo o tarifas actuales. El total devuelto SHALL corresponder al precio histórico por cantidad. Para devoluciones parciales, la base acumulada devuelta SHALL ser la proporción de la base histórica según cantidad acumulada devuelta, redondeada a centavos HALF_UP; la nueva devolución SHALL tomar la diferencia respecto de la base ya devuelta y calcular impuesto por diferencia con su total. La última devolución SHALL absorber el residuo para agotar exactamente los importes históricos. Los importes acumulados SHALL NOT superar los originales ni producir exigible negativo. Trazabilidad: DP-014/017; RN-VEN-015; RF-VEN-012/013/017; RNF-INT-006; propuesta, recomendación 1.

#### Scenario: Precio y tarifa cambiaron después de vender
- **DADO** una venta histórica con total 23.00 por dos unidades, base 20.00 e impuesto 3.00
- **CUANDO** se devuelve una unidad tras cambiar precio y tarifa del catálogo
- **ENTONCES** SHALL corregirse total 11.50, base 10.00 e impuesto 1.50 sin usar los valores actuales.

#### Scenario: Devoluciones sucesivas absorben el residuo
- **DADO** tres unidades vendidas con total 0.15, base 0.13 e impuesto 0.02
- **CUANDO** se devuelven sucesivamente una, otra y la última unidad
- **ENTONCES** SHALL corresponder bases 0.04, 0.05 y 0.04, impuestos 0.01, 0.00 y 0.01, y totales 0.05 cada vez; la suma SHALL recuperar exactamente los importes originales.

#### Scenario: Devolución total sin cobros
- **DADO** una venta de 100.00 sin pagos ni devoluciones previas
- **CUANDO** se devuelve toda su cantidad
- **ENTONCES** SHALL quedar exigible y saldo cero sin reembolso, conservando la venta confirmada y la devolución vinculada en lugar de convertirla silenciosamente en anulada.

### Requirement: Reingreso apto al costo de salida histórico

Solo cantidades declaradas aptas SHALL reingresar mediante un nuevo movimiento trazable al costo y valor históricos de la salida correspondiente, sin aplicar costo actual ni reescribir movimientos previos. Las entradas aptas SHALL integrarse en la valoración vigente como nuevas entradas; la historia de salidas SHALL permanecer intacta. La asignación parcial del valor histórico SHALL conservar sus residuos y nunca devolver más valor que el atribuible a la cantidad original. Una devolución SHALL poder operar sobre productos después desactivados sin reactivarlos. Los movimientos posteriores SHALL impedir una reversión exacta cuando corresponda, pero SHALL NOT impedir este reingreso físico histórico. Trazabilidad: DP-014; RN-VEN-020/021; RF-VEN-018; RN-INV-001/002/007/012; modelo de dominio §8; propuesta, recomendación 4.

#### Scenario: Devolución posterior a otra compra
- **DADO** una unidad vendida con costo histórico 4.00 y existencia actual de dos unidades valoradas en 12.00 tras otra compra
- **CUANDO** se devuelve la unidad vendida y se declara apta
- **ENTONCES** SHALL quedar existencia tres y valor 16.00, con promedio publicado 5.333333, sin alterar el costo histórico 4.00 ni los movimientos anteriores.

#### Scenario: Producto no apto
- **DADO** una unidad devuelta clasificada como no apta
- **CUANDO** se confirma la devolución
- **ENTONCES** SHALL reducirse el exigible correspondiente sin aumentar existencia o valoración ni generar una entrada física.

#### Scenario: Producto desactivado después de vender
- **DADO** una venta histórica de un producto actualmente inactivo y cantidad todavía devolvible
- **CUANDO** se confirma su devolución apta
- **ENTONCES** SHALL admitirse el reingreso histórico manteniendo el producto inactivo para nuevas ventas.

#### Scenario: Última devolución apta conserva el valor de salida
- **DADO** una salida de varias unidades con residuo de valoración y sin devoluciones previas
- **CUANDO** todas sus unidades se devuelven aptas mediante varias devoluciones
- **ENTONCES** SHALL sumar sus entradas exactamente el valor histórico de la salida, sin perder ni crear valor por redondeos parciales.

### Requirement: Exceso pagado y reembolso efectivo separado

Una devolución SHALL reducir primero el exigible; si supera lo cubierto por pagos, SHALL crear una obligación visible de **reembolso** por el exceso calculado, sin registrar automáticamente un desembolso ni saldo a favor. Solo Administrador SHALL registrar dinero efectivamente devuelto, con importe positivo USD de hasta dos decimales, motivo, medio real EFECTIVO/TRANSFERENCIA o combinación coherente, fecha efectiva y vínculo a la venta y corrección comercial. El importe SHALL NOT superar el exceso vigente ni lo recibido neto de correcciones y reembolsos anteriores. SHALL NOT reembolsarse deuda no pagada ni transferirse el exceso a otra operación o entidad. Los reembolsos efectivos SHALL conservarse sin edición o eliminación ordinaria. Trazabilidad: DP-003/013/014; RN-VEN-019; RF-VEN-017; CU-014; UI-056/057; propuesta, recomendación 4.

#### Scenario: Devolución genera exceso visible sin desembolso ficticio
- **DADO** venta de 100.00 pagada íntegramente
- **CUANDO** una devolución reduce su exigible a 60.00
- **ENTONCES** SHALL mostrar 40.00 pendientes de reembolso y saldo cobrable cero, sin registrar todavía dinero devuelto.

#### Scenario: Registrar el dinero efectivamente devuelto
- **DADO** exceso pendiente de 40.00 en una venta comercial
- **CUANDO** el Administrador registra su devolución efectiva de 40.00 con medio real y motivo
- **ENTONCES** SHALL conservarse un reembolso vinculado y quedar exceso cero sin nueva deuda.

#### Scenario: Reembolso mayor al exceso o sin pago previo
- **DADO** una venta con exceso de 10.00 o una venta que nunca recibió pagos
- **CUANDO** se intenta registrar un reembolso de 20.00
- **ENTONCES** SHALL rechazarse sin desembolso registrado ni alteración de otros pagos.

#### Scenario: Medio, importe o entidad inválidos
- **DADO** un exceso comercial reembolsable
- **CUANDO** se envía medio CREDITO, importe no positivo, precisión excesiva, partes incoherentes o destino artesanal
- **ENTONCES** SHALL rechazarse todo el reembolso sin redondear ni trasladar el exceso.

#### Scenario: Intento de borrar un reembolso efectivo
- **DADO** un reembolso confirmado
- **CUANDO** se intenta editarlo o eliminarlo mediante una acción ordinaria
- **ENTONCES** SHALL rechazarse conservando importe, medio, actor, fecha y vínculo originales.

### Requirement: Correcciones atómicas e idempotentes bajo concurrencia

Cada anulación, devolución o reembolso SHALL aplicar conjuntamente sus efectos económicos, movimientos pertinentes, vínculos y auditoría o no aplicar ninguno. La identidad lógica SHALL impedir duplicados, incluso al repetir una confirmación con otra identidad de transporte; reutilizar un intento con contenido incompatible SHALL producir conflicto. Solicitudes concurrentes SHALL equivaler a un orden válido de cobros, correcciones y movimientos, sin superar cantidades devolvibles ni excesos reembolsables, ni dejar pagos huérfanos. Trazabilidad: RF-VEN-013/017; RF-AUD-006; RNF-INT-001/002/004/009; DP-014.

#### Scenario: Dos devoluciones compiten por la última unidad devolvible
- **DADO** una línea con una sola unidad todavía devolvible
- **CUANDO** se confirman simultáneamente dos devoluciones distintas de esa unidad
- **ENTONCES** SHALL confirmarse como máximo una y rechazarse la otra sin reingreso ni corrección económica parcial.

#### Scenario: Dos reembolsos compiten por el mismo exceso
- **DADO** exceso vigente 40.00 y dos solicitudes distintas de reembolso de 30.00
- **CUANDO** se registran simultáneamente
- **ENTONCES** SHALL aceptarse como máximo una; la otra SHALL rechazarse al exceder el remanente, sin pago negativo ni exceso ficticio.

#### Scenario: Repetir devolución después de perder respuesta
- **DADO** una devolución ya confirmada
- **CUANDO** se repite su confirmación compatible, incluso con otra identidad de transporte
- **ENTONCES** SHALL devolverse la devolución existente sin nueva reducción del exigible ni otra entrada.

#### Scenario: Reintento de reembolso incompatible
- **DADO** un intento de reembolso ya procesado para una venta y un importe
- **CUANDO** se reutiliza su identidad con otro importe, medio o venta
- **ENTONCES** SHALL responder conflicto y conservar el registro original sin otro desembolso registrado.

#### Scenario: Repetir un reembolso confirmado
- **DADO** un reembolso efectivo ya registrado cuya respuesta no llegó
- **CUANDO** se repite el mismo intento compatible
- **ENTONCES** SHALL devolverse el reembolso existente sin registrar otro desembolso ni pedir al usuario devolver nuevamente el dinero.

#### Scenario: Falla el registro del reembolso
- **DADO** un exceso pendiente y un registro explícito de devolución efectiva de dinero
- **CUANDO** falla un efecto antes de completar el registro
- **ENTONCES** SHALL conservarse el estado registrado previo sin reembolso parcial y comunicarse que el registro falló; reintentar SHALL registrar el mismo hecho sin solicitar un segundo desembolso.

#### Scenario: Falla una devolución de varias líneas
- **DADO** una devolución válida con líneas aptas y no aptas
- **CUANDO** falla un efecto antes de finalizar
- **ENTONCES** SHALL revertirse toda la devolución, incluidos reingresos, exigible, obligación de reembolso y auditoría de éxito del intento.

#### Scenario: Falla la anulación con tratamiento de pagos
- **DADO** una anulación revisada con su tratamiento de pagos
- **CUANDO** falla cualquier efecto antes de completar su registro
- **ENTONCES** SHALL conservarse íntegro el estado registrado anterior y no aparecer una anulación ni reembolso parcial; el sistema SHALL informar que la operación no se registró y permitir reintentar sin duplicar efectos.

#### Scenario: Pago y devolución simultáneos
- **DADO** una venta con deuda y una devolución que reduce el exigible
- **CUANDO** concurren el cobro y la devolución
- **ENTONCES** SHALL aplicarse un orden válido: si el cobro llega primero, el exceso resultante SHALL quedar por reembolsar; si la devolución llega primero, el cobro SHALL validarse contra el saldo reducido, sin sobrepago aceptado.

### Requirement: Historia y auditoría navegables

Las correcciones SHALL conservar original, acción, motivo, responsable, fecha efectiva, resultado, cantidades, clasificación y efectos económicos pertinentes, con vínculos navegables en ambos sentidos. Las consultas de venta y cobros SHALL mostrar sus correcciones sin exponer costos a roles no autorizados; las consultas globales de auditoría SHALL quedar reservadas al Administrador. SHALL distinguirse devolución, anulación, corrección de pago y reembolso, sin usar una eliminación genérica ni presentar una factura electrónica. Los rechazos de acciones críticas SHALL conservar evidencia cuando el sistema pueda registrarla, sin secretos ni datos personales innecesarios. Trazabilidad: RF-AUD-001…004; RN-CON-007/009; RF-REP-007; UI-055…057/061/063.

#### Scenario: Administrador recorre la corrección
- **DADO** una venta con devolución y reembolso registrado
- **CUANDO** el Administrador consulta la historia
- **ENTONCES** SHALL navegar desde la venta a devolución y reembolso y regresar al original, identificando motivo, actor, momento y efectos de cada acción.

#### Scenario: Vendedor consulta el efecto autorizado
- **DADO** una venta comercial con correcciones
- **CUANDO** el Vendedor consulta su detalle y saldo
- **ENTONCES** SHALL ver los efectos económicos y vigencia necesarios para cobrar, sin costos, permisos de corrección ni acceso al reporte global de auditoría.

#### Scenario: Rechazo de corrección crítica
- **DADO** una solicitud de corrección sin permiso o con cantidad excesiva
- **CUANDO** se rechaza y el registro de auditoría está disponible
- **ENTONCES** SHALL conservarse el resultado rechazado correlacionado con la acción, sin registrar un éxito ni datos sensibles innecesarios.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).

### Requirement: Reembolso limitado al dinero cobrado cuando hay retenciones

Cuando una venta tenga **retenciones recibidas** vigentes, el **reembolso** SHALL limitarse al dinero efectivamente cobrado neto de reembolsos anteriores; un valor retenido SHALL NOT reembolsarse ni convertirse en saldo a favor. La parte del exceso que corresponda a retenciones SHALL mostrarse como retención en exceso, separada de la obligación de reembolso, hasta que el Administrador anule la retención con motivo. Trazabilidad: propuesta de retenciones D16; DP-014/028; RN-VEN-019; RF-VEN-017.

#### Scenario: Devolución total de una venta con retención
- **DADO** una venta de 250.00 con dinero cobrado 245.00 y retención vigente 5.00
- **CUANDO** una devolución reduce el exigible a 0.00
- **ENTONCES** SHALL mostrarse 245.00 pendientes de reembolso y 5.00 de retención en exceso; un intento de reembolsar 250.00 SHALL rechazarse.

#### Scenario: Resolver la retención en exceso
- **DADO** una venta con 5.00 de retención en exceso
- **CUANDO** el Administrador anula esa retención con motivo
- **ENTONCES** SHALL desaparecer la retención en exceso sin crear deuda ni reembolso.

### Requirement: Anulación de la venta con retenciones vigentes

Una venta con retenciones vigentes SHALL NOT anularse. El intento SHALL bloquearse explicando que primero deben anularse sus retenciones con motivo, sin anularlas de forma automática ni inventar un reembolso. Trazabilidad: propuesta de retenciones D14; RN-VEN-016; RF-VEN-011.

#### Scenario: Intento de anular una venta con retención
- **DADO** una venta directa confirmada, por lo demás anulable, con una retención vigente de 5.00
- **CUANDO** el Administrador intenta anularla
- **ENTONCES** SHALL bloquearse identificando la retención, sin movimientos de inventario ni cambios en la venta.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
