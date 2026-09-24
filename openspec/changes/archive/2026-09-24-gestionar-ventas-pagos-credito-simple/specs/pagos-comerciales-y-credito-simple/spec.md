# Pagos comerciales y crédito simple

## Fuentes y alcance

Fuentes: propuesta y sus cuatro recomendaciones aprobadas el 2026-09-20; decisiones confirmadas; modelo de dominio y su spec principal; reglas RN-VEN; actores-y-roles; RF-PAG; CU-012/013/015; UI-060…063; RNF-INT; glosario del producto. Se cubren únicamente cobros y deudas comerciales. La vista artesanal, su operación económica y los cierres diarios siguen fuera de esta entrega. Estado: specs aprobadas el 2026-09-20 para crear diseño. El usuario respondió «si esta bien, continua» a la solicitud expresa de aprobación de las tres specs (24 requisitos y 105 escenarios), sobre el contenido registrado en master en c393e13. Esta aprobación no abarca diseño, tareas ni implementación.

## ADDED Requirements

### Requirement: Acceso a pagos por entidad y acción

Administrador y Vendedor activos y autenticados SHALL consultar y registrar **pagos** comerciales mediante los permisos existentes. Solo Administrador SHALL anular o corregirlos. El Encargado del taller sin rol comercial SHALL NOT acceder a esos cobros o saldos. Los permisos vigentes y la pertenencia de la venta al RUC comercial SHALL comprobarse en toda consulta, escritura o reintento, sin depender de controles visibles. Trazabilidad: CT-001; RN-FIS-005/008/009; RN-SEG-001…007; RF-PAG-002/004/008; actores-y-roles §3.4/3.5.

#### Scenario: Vendedor registra un cobro comercial
- **DADO** un Vendedor activo y una venta comercial confirmada con saldo
- **CUANDO** registra un pago válido
- **ENTONCES** SHALL permitirse su registro en esa venta y únicamente en su ámbito comercial.

#### Scenario: Encargado intenta cobrar o consultar deuda comercial
- **DADO** un usuario con solo rol Encargado del taller
- **CUANDO** consulta saldos comerciales o registra un pago por acceso directo
- **ENTONCES** SHALL denegarse sin revelar datos ni modificar dinero.

#### Scenario: Vendedor intenta corregir un pago
- **DADO** un pago comercial y un usuario con solo rol Vendedor
- **CUANDO** intenta anularlo o corregirlo
- **ENTONCES** SHALL denegarse sin cambiar su vigencia ni el saldo.

#### Scenario: Roles acumulados habilitan el permiso comercial
- **DADO** un usuario Vendedor y Encargado del taller
- **CUANDO** registra un pago comercial válido
- **ENTONCES** SHALL permitirse por su rol Vendedor, sin crear un cobro artesanal ni acceso a correcciones administrativas.

### Requirement: Contado y crédito separados del medio de pago

Cada venta SHALL registrar condición CONTADO o CREDITO independientemente de sus medios y estado de pago. **Crédito** SHALL permitir deuda y **abonos** posteriores sin fecha de vencimiento, cuotas, intereses, límite o cronograma. Contado SHALL solicitar un cobro completo después de confirmar; si se interrumpe, SHALL conservarse la venta confirmada pendiente y ofrecer reanudar el cobro, sin cambiar automáticamente a crédito. Confirmación y cobro SHALL ser acciones independientes y SHALL NOT registrar dinero ficticio. Trazabilidad: DP-003; RN-VEN-007/008; RF-PAG-001/012; CU-012/013; propuesta, recomendación 3.

#### Scenario: Crédito sin cobro inicial
- **DADO** una venta a crédito de total 100.00
- **CUANDO** se confirma sin registrar dinero
- **ENTONCES** SHALL quedar saldo 100.00 y estado pendiente, sin exigir vencimiento ni plan.

#### Scenario: Cobro de contado interrumpido
- **DADO** una venta al contado confirmada de total 100.00
- **CUANDO** se abandona el registro del cobro antes de confirmarlo
- **ENTONCES** SHALL conservarse la venta confirmada al contado con saldo 100.00 y posibilidad de reanudar el cobro completo, sin un pago inventado.

#### Scenario: Abono parcial en contado
- **DADO** una venta al contado con saldo 100.00
- **CUANDO** se intenta registrar un cobro de 40.00
- **ENTONCES** SHALL rechazarse indicando que contado requiere cubrir el saldo completo, sin convertir la condición ni registrar el abono.

#### Scenario: Crédito usado como medio
- **DADO** una venta confirmada
- **CUANDO** se intenta registrar CREDITO como forma de pago
- **ENTONCES** SHALL rechazarse y conservarse separados condición y medios reales.

### Requirement: Pago de una única operación y partes reales

Cada **pago** SHALL identificar exactamente una venta comercial confirmada vigente elegida por el actor. SHALL registrar importe positivo en USD con hasta dos decimales, uno o ambos medios EFECTIVO/TRANSFERENCIA con partes positivas de igual precisión cuya suma sea el importe, usuario, entidad y fecha efectiva del sistema en America/Guayaquil. SHALL NOT redondearse entradas con exceso de precisión, registrar anticipos, exceder el saldo, admitir otros medios o distribuir un importe entre ventas. La fecha SHALL NOT poder retrofecharse ni alterarse para simular otro día. Trazabilidad: DP-003/013; RN-VEN-009/010/013/014/019; RF-PAG-002…004/007/011; RNF-INT-006/008; propuesta, recomendación 3.

#### Scenario: Pago combinado válido
- **DADO** una venta confirmada con saldo 100.00
- **CUANDO** se registra un cobro de 100.00 con 40.00 en efectivo y 60.00 en transferencia
- **ENTONCES** SHALL conservarse un solo pago de esa venta con ambas partes, fecha efectiva, actor y entidad comercial.

#### Scenario: Partes incoherentes o precisión excesiva
- **DADO** una venta cobrable
- **CUANDO** se envían partes que no suman el importe, una parte no positiva o un importe con más de dos decimales
- **ENTONCES** SHALL rechazarse el pago completo con explicación de los datos inválidos, sin redondeo silencioso.

#### Scenario: Pago anterior a confirmación
- **DADO** una venta en borrador
- **CUANDO** se intenta registrar dinero contra ella
- **ENTONCES** SHALL rechazarse por anticipo sin modificar el borrador ni crear saldo o pago.

#### Scenario: Cobro sobre venta anulada o sin saldo
- **DADO** una venta anulada o con saldo cero
- **CUANDO** se intenta registrar un pago positivo
- **ENTONCES** SHALL rechazarse sin crear dinero aplicado.

#### Scenario: Sobrepago
- **DADO** una venta con saldo 35.00
- **CUANDO** se intenta cobrar 40.00
- **ENTONCES** SHALL rechazarse toda la operación sin registrar 35.00 ni guardar 5.00 a favor.

#### Scenario: Importe destinado a dos ventas
- **DADO** dos ventas del mismo cliente con deuda
- **CUANDO** se intenta aplicar un solo pago a ambas
- **ENTONCES** SHALL rechazarse y exigirse registrar pagos separados elegidos por el usuario, sin reparto automático.

#### Scenario: Entidad incompatible
- **DADO** una referencia a una operación artesanal
- **CUANDO** cualquier actor intenta cobrarla mediante el registro comercial
- **ENTONCES** SHALL rechazarse sin cambiar saldos de ninguna entidad.

#### Scenario: Fecha de cobro manipulada
- **DADO** una venta confirmada con saldo
- **CUANDO** se intenta registrar un cobro con una fecha distinta de la efectiva del sistema
- **ENTONCES** SHALL rechazarse la fecha alterada y mantenerse pendiente el cobro, sin asiento retroactivo.

### Requirement: Saldo y estado derivados con exceso separado

El sistema SHALL calcular E como importe exigible vigente tras correcciones, P como pagos válidos netos de anulaciones/correcciones y R como reembolsos efectivamente registrados de la misma venta. El importe aplicado neto SHALL ser P − R; el **saldo pendiente** SHALL ser máximo(E − (P − R), 0) y el exceso pendiente de reembolso SHALL ser máximo((P − R) − E, 0). El **estado de pago** SHALL ser pendiente si E > 0 y no hay importe aplicado, parcial si existe aplicación positiva menor que E, y pagado si el saldo es cero; una venta de importe cero SHALL quedar sin deuda y sin pago ficticio. Un exceso SHALL mostrarse separadamente hasta liquidarse, incluso cuando el estado sea pagado. SHALL NOT existir edición manual de saldo, total pagado o estado de pago. Trazabilidad: DP-014; RN-VEN-011/012/019; RF-PAG-005/006; modelo de dominio §10; propuesta, recomendaciones 3/4.

#### Scenario: Abono parcial de crédito
- **DADO** una venta a crédito de 100.00 sin cobros
- **CUANDO** se registra un abono de 30.00
- **ENTONCES** SHALL mostrar aplicado 30.00, saldo 70.00 y estado parcial.

#### Scenario: Abono que completa el crédito
- **DADO** una venta a crédito de 100.00 con un abono válido de 30.00
- **CUANDO** se registra otro pago de 70.00
- **ENTONCES** SHALL mostrar aplicado 100.00, saldo cero y estado pagado, conservando ambos pagos independientes.

#### Scenario: Devolución sobre venta parcialmente pagada
- **DADO** una venta de 100.00 con pagos válidos de 60.00
- **CUANDO** una devolución reduce el exigible a 80.00
- **ENTONCES** SHALL resultar saldo 20.00 y estado parcial, sin reembolso pendiente.

#### Scenario: Exceso por devolución sin deuda negativa
- **DADO** una venta con exigible 80.00, pagos válidos 100.00 y ningún reembolso
- **CUANDO** se consultan sus saldos
- **ENTONCES** SHALL mostrar saldo cero, estado pagado y 20.00 por reembolsar; SHALL NOT presentar saldo a favor, deuda negativa o cobro adicional.

#### Scenario: Reembolso liquida el exceso
- **DADO** exigible 80.00, pagos válidos 100.00 y exceso 20.00
- **CUANDO** se registra el reembolso efectivo de 20.00
- **ENTONCES** SHALL mostrar aplicación neta 80.00, saldo cero y exceso cero, sin deuda nueva.

#### Scenario: Venta de importe cero
- **DADO** una venta válida cuyos precios finales vigentes producen total cero
- **CUANDO** se confirma
- **ENTONCES** SHALL mostrar saldo cero y estado pagado sin inventar un pago de cero; SHALL rechazarse todo intento de cobrarla mientras no exista deuda.

### Requirement: Corrección administrativa de pagos sin borrar historia

Solo Administrador SHALL anular un pago erróneo o sustituirlo por un registro corregido de la misma venta, con motivo no vacío y vínculos entre original y corrección. El original SHALL conservar importe, medios, actor, momento y estado histórico; una sustitución SHALL anular y registrar el reemplazo en una sola acción. El resultado SHALL cumplir medios, precisión, saldo, contado y separación fiscal, considerando conjuntamente los efectos. SHALL NOT transferirse dinero a otra venta ni utilizarse una anulación de pago para representar dinero realmente reembolsado. Si hay reembolsos o correcciones dependientes incompatibles, SHALL rechazarse y explicarse la dependencia, sin borrar historia ni crear deuda artificial. Trazabilidad: RF-PAG-008; RF-AUD-002…004; RN-VEN-016; CU-015; UI-063; propuesta, recomendación 4.

#### Scenario: Anular un pago registrado por error
- **DADO** una venta de 100.00 con un pago erróneo de 100.00 y sin reembolsos
- **CUANDO** el Administrador anula el pago con motivo
- **ENTONCES** SHALL conservar el original anulado y su auditoría, y derivar saldo 100.00 y estado pendiente sin cambiar el estado confirmado de la venta.

#### Scenario: Corregir el medio de un pago
- **DADO** un pago de 100.00 registrado en efectivo cuando fue transferencia, sin dependencias incompatibles
- **CUANDO** el Administrador lo sustituye por 100.00 en transferencia con motivo
- **ENTONCES** SHALL conservarse original y reemplazo vinculados, cambiar los medios netos y mantener el mismo saldo sin contabilizar 200.00.

#### Scenario: Corrección sin motivo o reemplazo inválido
- **DADO** un pago vigente
- **CUANDO** se intenta corregir sin motivo o con reemplazo que incumple el saldo o los medios
- **ENTONCES** SHALL rechazarse toda la corrección conservando vigente el original.

#### Scenario: Anulación incompatible con un reembolso
- **DADO** pagos válidos de 100.00, exigible cero y reembolso efectivo de 100.00
- **CUANDO** se intenta anular esos pagos dejando sin respaldo el reembolso
- **ENTONCES** SHALL rechazarse por dependencia, sin borrar el desembolso ni crear deuda del cliente.

### Requirement: Atomicidad y concurrencia de cobros y correcciones

Cada registro, anulación o sustitución de pago SHALL confirmar conjuntamente sus partes, vínculos y auditoría, o no dejar ningún efecto. La validación SHALL usar el saldo vigente y coordinarse con cobros, devoluciones, reembolsos y anulaciones concurrentes de la misma venta. Los reintentos compatibles del mismo pago o corrección SHALL devolver el resultado existente; cambiar la identidad de transporte SHALL NOT duplicar una operación ya identificada. Una identidad reutilizada con contenido incompatible SHALL producir conflicto. Pagos distintos legítimos con igual importe SHALL distinguirse por su propia identidad, no solo por sus valores. Trazabilidad: RF-AUD-006; RNF-INT-001/004/009; RF-PAG-007/008; DP-013.

#### Scenario: Cobros simultáneos excederían el saldo
- **DADO** saldo 100.00 de crédito y dos pagos distintos de 70.00
- **CUANDO** se intentan registrar simultáneamente
- **ENTONCES** SHALL aceptarse como máximo uno y rechazarse el otro por saldo insuficiente, sin aplicación automática parcial.

#### Scenario: Respuesta perdida y reintento
- **DADO** un pago de 25.00 procesado cuya respuesta no llegó
- **CUANDO** se repite su mismo intento compatible
- **ENTONCES** SHALL devolverse el pago existente sin otros 25.00 ni nuevas partes.

#### Scenario: Reintento incompatible
- **DADO** una identidad de pago ya usada para 25.00 en efectivo
- **CUANDO** se reutiliza para 30.00 o para otra venta
- **ENTONCES** SHALL responder conflicto sin alterar el pago original.

#### Scenario: Falla una parte de pago combinado
- **DADO** un pago válido de 40.00 efectivo y 60.00 transferencia
- **CUANDO** falla un efecto antes de completar el registro
- **ENTONCES** SHALL conservarse el saldo previo y no quedar ninguna parte aplicada ni auditoría de éxito parcial.

#### Scenario: Cobro compite con anulación de venta
- **DADO** una venta confirmada con saldo
- **CUANDO** concurren un cobro y su anulación administrativa
- **ENTONCES** SHALL resultar un orden válido: el cobro posterior a anular se rechaza, o la anulación considera y resuelve el cobro ya registrado; SHALL NOT quedar un pago huérfano.

### Requirement: Consultas comerciales de deuda e historial

El sistema SHALL mostrar **cuentas por cobrar** comerciales por cliente, venta, estado y antigüedad desde la fecha de confirmación en America/Guayaquil, con filtros y paginación estable. Las sumas SHALL corresponder a todas las coincidencias autorizadas, no solo a la página visible. Los reembolsos pendientes SHALL distinguirse de deudas cobrables y SHALL NOT compensarse entre ventas. El historial SHALL identificar pagos vigentes y corregidos, medios, fecha, actor y relaciones; las acciones administrativas SHALL limitarse al Administrador. La consulta comercial SHALL NOT mezclar importes artesanales ni presentar antigüedad como mora, vencimiento o intereses. Trazabilidad: RF-PAG-005/006/009; RF-REP-006/008/010 en ámbito comercial; UI-060…063; DP-013/014.

#### Scenario: Consulta de varias ventas del mismo cliente
- **DADO** dos ventas comerciales con saldos 30.00 y 70.00 y una operación artesanal ajena a esta consulta
- **CUANDO** se filtra la deuda comercial del cliente
- **ENTONCES** SHALL mostrar ambas ventas y total comercial 100.00, excluyendo la operación artesanal y sin ofrecer un pago repartido automáticamente.

#### Scenario: Historial conserva pagos corregidos
- **DADO** una venta con pago sustituido y vínculo al reemplazo
- **CUANDO** un usuario con permiso de consulta abre su historial
- **ENTONCES** SHALL distinguir los registros y su vigencia sin sumar ambos como cobros válidos; las acciones de corrección SHALL estar disponibles solo al Administrador.

#### Scenario: Exceso en una venta y deuda en otra
- **DADO** el mismo cliente con 20.00 por reembolsar en una venta y 40.00 por pagar en otra
- **CUANDO** se consulta su posición comercial
- **ENTONCES** SHALL mostrarse deuda 40.00 y reembolso pendiente 20.00 por separado, sin convertirlos en deuda neta 20.00 ni saldo a favor utilizable.

#### Scenario: Antigüedad sin mora
- **DADO** una venta a crédito pendiente confirmada diez fechas operativas antes de la fecha de consulta
- **CUANDO** se consulta su antigüedad
- **ENTONCES** SHALL mostrar diez días desde confirmación sin fecha de vencimiento, recargo ni etiqueta de morosidad.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
