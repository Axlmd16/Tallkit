# retenciones-recibidas-en-cobros Specification

## Purpose
Registrar la retención que un cliente agente de retención aplica al pagar una venta comercial o una operación artesanal confirmada, como un hecho propio que reduce el saldo sin contarse como dinero cobrado: junto al cobro o sola, con el comprobante completado después, seguimiento de pendientes por entidad fiscal, anulación administrativa trazable y activación por entidad, sin calcular porcentajes ni depender del régimen o la tarifa de la entidad.
## Requirements
### Requirement: Retención recibida sobre una única operación confirmada

Una **retención recibida** SHALL registrarse sobre exactamente una venta comercial o una operación artesanal confirmada y vigente, con importe positivo en USD de hasta dos decimales, usuario, **entidad fiscal** de la operación y fecha efectiva del sistema en America/Guayaquil. SHALL reducir el **saldo pendiente** de esa operación y SHALL NOT ser un **pago**, un medio de pago ni dinero cobrado. La suma de pagos netos y retenciones vigentes SHALL NOT superar el importe exigible. SHALL NOT redondearse una entrada con exceso de precisión, retrofecharse, aplicarse a un borrador o a una operación anulada, repartirse entre operaciones ni cruzar de una entidad fiscal a otra. Ninguna regla SHALL depender del régimen, la tarifa de impuesto o las condiciones tributarias que la entidad tenga declaradas. Trazabilidad: propuesta A1/A2/A4/A6 y principio 19, D1; DP-003/013/029; RN-VEN-009/013/014; RF-PAG-004/007/011.

#### Scenario: Retención que completa un saldo
- **DADO** una operación confirmada con importe exigible 250.00 y pagos vigentes de 245.00
- **CUANDO** se registra una retención de 5.00
- **ENTONCES** SHALL conservarse la retención vinculada a esa operación, con saldo cero, dinero cobrado 245.00 y retenido 5.00, sin crear ni modificar un pago.

#### Scenario: Retención mayor que el saldo
- **DADO** una operación con saldo pendiente 5.00
- **CUANDO** se intenta registrar una retención de 5.01
- **ENTONCES** SHALL rechazarse indicando el saldo disponible, sin registrar nada.

#### Scenario: Operación no elegible
- **DADO** una operación en borrador o anulada
- **CUANDO** se intenta registrar una retención
- **ENTONCES** SHALL rechazarse explicando su estado.

#### Scenario: Precisión excesiva o importe no positivo
- **DADO** una operación con saldo pendiente
- **CUANDO** se envía una retención de 0.00, negativa o con más de dos decimales
- **ENTONCES** SHALL rechazarse sin redondeo silencioso.

#### Scenario: Misma regla con cualquier configuración tributaria
- **DADO** dos entidades con regímenes y tarifas de impuesto distintos y el registro de retenciones activado
- **CUANDO** en cada una se registra una retención válida sobre una operación propia
- **ENTONCES** SHALL aplicarse el mismo comportamiento en ambas, sin cálculo ni restricción derivados del régimen o de la tarifa.

### Requirement: Cobro acompañado de una retención en una sola acción

El registro de un cobro SHALL admitir, en la misma acción, una retención sobre la misma operación. Dinero y retención SHALL registrarse de forma atómica: ambos o ninguno. La retención SHALL poder registrarse también sola, sin dinero. En una operación de CONTADO, la suma del dinero y la retención de la acción SHALL cubrir el saldo completo; en CREDITO SHALL admitirse cualquier combinación que no supere el saldo. Trazabilidad: propuesta A3/A5; DP-027; RF-PAG-001/003.

#### Scenario: Contado cubierto con dinero y retención
- **DADO** una operación al contado con saldo 250.00
- **CUANDO** se registra en una acción 245.00 por transferencia y una retención de 5.00
- **ENTONCES** SHALL quedar un pago de 245.00, una retención de 5.00, saldo cero y estado pagado.

#### Scenario: Contado que no se cubre
- **DADO** una operación al contado con saldo 250.00
- **CUANDO** se intenta registrar 200.00 en efectivo y una retención de 5.00
- **ENTONCES** SHALL rechazarse toda la acción indicando que contado requiere cubrir el saldo, sin registrar el dinero ni la retención.

#### Scenario: Retención sola sobre un crédito
- **DADO** una operación a crédito con saldo 5.00 cuyo dinero se cobró en una fecha anterior
- **CUANDO** se registra únicamente una retención de 5.00
- **ENTONCES** SHALL quedar saldo cero sin crear un pago.

#### Scenario: Falla parcial
- **DADO** una acción con dinero válido y una retención que excede el saldo restante
- **CUANDO** se procesa
- **ENTONCES** SHALL rechazarse completa, sin conservar el pago.

### Requirement: Cobro en lenguaje llano

La experiencia de cobro SHALL pedir únicamente el dinero recibido y su medio. Cuando el dinero sea menor que el saldo y la entidad registre retenciones, SHALL preguntar en lenguaje llano si la diferencia la retuvo el cliente, proponiendo ese importe ya calculado, y SHALL permitir confirmarla, ajustarla o dejarla como saldo pendiente cuando la condición lo permita. El cobro SHALL NOT pedir ni mostrar número de comprobante, fecha de comprobante ni desglose por impuesto. Cuando el **cliente** tenga la marca de agente de retención, la opción SHALL presentarse de forma visible desde el inicio; sin la marca SHALL seguir disponible sin sugerirse. La interfaz SHALL NOT decidir saldos ni límites: el servidor valida. Trazabilidad: propuesta A3a, C12/C13, D2/D5; UI de cobro; RNF de usabilidad.

#### Scenario: Diferencia propuesta como retención
- **DADO** una operación con saldo 250.00 de una entidad que registra retenciones
- **CUANDO** quien cobra escribe 245.00 recibidos
- **ENTONCES** SHALL preguntarse si los 5.00 restantes los retuvo el cliente, sin solicitar datos del comprobante.

#### Scenario: Cliente marcado
- **DADO** un cliente con la marca de agente de retención
- **CUANDO** se abre el cobro de una de sus operaciones
- **ENTONCES** la retención SHALL ofrecerse de forma visible antes de escribir importes.

#### Scenario: Diferencia que no es retención
- **DADO** una operación a crédito con saldo 250.00
- **CUANDO** quien cobra escribe 100.00 y responde que la diferencia no fue retenida
- **ENTONCES** SHALL registrarse solo el abono de 100.00 y quedar saldo 150.00.

### Requirement: Registro activable por entidad fiscal

El registro de retenciones SHALL depender del ajuste declarado en el perfil tributario de cada entidad fiscal. Con el registro desactivado, SHALL rechazarse toda retención nueva de esa entidad y el cobro SHALL NOT ofrecerla, conservando su comportamiento sin retenciones. Las retenciones ya registradas SHALL conservarse, seguir descontando del saldo y poder completarse o anularse. Trazabilidad: propuesta F20…F22, D7.

#### Scenario: Entidad con registro desactivado
- **DADO** una entidad con el registro de retenciones desactivado
- **CUANDO** se abre el cobro de una operación suya o se envía una retención
- **ENTONCES** el cobro SHALL NOT ofrecer la retención y el envío SHALL rechazarse explicando que la entidad no registra retenciones.

#### Scenario: Desactivar con retenciones previas
- **DADO** una operación con una retención vigente de 5.00
- **CUANDO** el Administrador desactiva el registro de la entidad
- **ENTONCES** la retención SHALL seguir vigente y descontando del saldo.

### Requirement: Advertencia por importe inusual

Cuando la retención de una acción, sumada a las retenciones vigentes de la operación, supere el porcentaje de advertencia configurado para la entidad sobre el importe exigible, el sistema SHALL advertirlo y exigir un reconocimiento explícito antes de registrar, sin bloquear. Con la advertencia desactivada SHALL NOT mostrarse. El sistema SHALL NOT calcular, sugerir ni validar porcentajes legales de retención. Trazabilidad: propuesta D4.

#### Scenario: Retención sobre el umbral
- **DADO** una entidad con advertencia al 20 % y una operación de 100.00
- **CUANDO** se envía una retención de 25.00 sin reconocimiento
- **ENTONCES** SHALL devolverse la advertencia sin registrar; con el reconocimiento explícito SHALL registrarse.

#### Scenario: Advertencia desactivada
- **DADO** una entidad con la advertencia desactivada
- **CUANDO** se registra una retención de 25.00 sobre una operación de 100.00
- **ENTONCES** SHALL registrarse sin advertencia.

### Requirement: Comprobante de retención completado después

Una retención SHALL nacer con **comprobante pendiente**. Quien puede cobrar en el ámbito, o el Administrador, SHALL poder completar después el número del **comprobante de retención** con formato `NNN-NNN-NNNNNNNNN`, su fecha de emisión no posterior a la fecha actual de America/Guayaquil y, de forma opcional, el desglose entre impuesto a la renta e IVA, con importes no negativos de hasta dos decimales cuya suma SHALL ser igual al importe de la retención. Completar SHALL NOT cambiar el importe, el saldo ni la fecha efectiva. El mismo número SHALL NOT registrarse en dos retenciones vigentes del mismo cliente dentro de una entidad fiscal. Una vez completado, solo el Administrador SHALL poder corregir esos datos, con motivo y conservando los valores anteriores. El sistema SHALL NOT afirmar que el comprobante existe o fue verificado ante el SRI. Trazabilidad: propuesta B7…B10, D2/D3/D6.

#### Scenario: Completar un comprobante pendiente
- **DADO** una retención de 5.00 con comprobante pendiente
- **CUANDO** se completa con `001-001-000028564`, fecha válida y desglose renta 5.00 e IVA 0.00
- **ENTONCES** SHALL quedar completada con esos datos, sin cambiar importe ni saldo.

#### Scenario: Desglose que no suma
- **DADO** una retención de 5.00
- **CUANDO** se envía renta 3.00 e IVA 1.00
- **ENTONCES** SHALL rechazarse indicando la diferencia, sin guardar datos parciales.

#### Scenario: Número con formato inválido o fecha futura
- **DADO** una retención con comprobante pendiente
- **CUANDO** se envía el número `1-1-28564` o una fecha posterior a hoy
- **ENTONCES** SHALL rechazarse señalando el dato inválido.

#### Scenario: Número repetido para el mismo cliente
- **DADO** una retención vigente del cliente con comprobante `001-001-000028564` en una entidad
- **CUANDO** se intenta completar otra retención vigente del mismo cliente y entidad con ese número
- **ENTONCES** SHALL rechazarse identificando la retención que ya lo usa.

#### Scenario: Corrección posterior
- **DADO** una retención con comprobante completado
- **CUANDO** un usuario que no es Administrador intenta cambiar el número
- **ENTONCES** SHALL denegarse; el Administrador SHALL poder corregirlo con motivo, conservando el valor anterior en la historia.

### Requirement: Seguimiento de comprobantes pendientes

El sistema SHALL ofrecer, por entidad fiscal, una lista de retenciones vigentes con comprobante pendiente que identifique cliente, operación, importe, fecha efectiva y antigüedad, con filtros, paginación estable y total de todas las coincidencias autorizadas. SHALL NOT mezclar retenciones de las dos entidades ni presentar la antigüedad como mora. Trazabilidad: propuesta B9; RF-PAG-009/010.

#### Scenario: Pendientes separados por entidad
- **DADO** una retención pendiente comercial y otra artesanal
- **CUANDO** un Vendedor consulta los pendientes comerciales
- **ENTONCES** SHALL ver solo la comercial y su total.

#### Scenario: Retención completada sale de la lista
- **DADO** una retención pendiente listada
- **CUANDO** se completa su comprobante
- **ENTONCES** SHALL dejar de aparecer entre los pendientes y conservarse en la historia de la operación.

### Requirement: Permisos por ámbito

El servidor SHALL exigir sesión vigente y permiso por acción. Registrar, consultar y completar retenciones comerciales SHALL corresponder a Administrador y Vendedor; las artesanales, a Administrador y Encargado del taller. Anular una retención y corregir un comprobante ya completado SHALL corresponder solo al Administrador. La unión de roles SHALL respetarse sin otorgar acceso al otro ámbito. Ocultar acciones en la interfaz SHALL NOT sustituir la autorización del servidor. Trazabilidad: propuesta D3; CT-001; RN-FIS-001…009; RF-PAG-002.

#### Scenario: Vendedor en ámbito artesanal
- **DADO** un Vendedor sin rol Encargado del taller
- **CUANDO** intenta registrar una retención sobre una operación artesanal
- **ENTONCES** SHALL denegarse sin revelar datos de la operación.

#### Scenario: Anulación por un usuario operativo
- **DADO** un Encargado del taller
- **CUANDO** intenta anular una retención artesanal
- **ENTONCES** SHALL denegarse sin cambios.

### Requirement: Anulación administrativa sin borrar historia

Una retención SHALL NOT editarse en su importe ni eliminarse. El Administrador SHALL poder anularla con motivo no vacío, conservando el registro original, el usuario y la fecha; la anulación SHALL devolver ese importe al saldo pendiente y liberar su número de comprobante. Una retención anulada SHALL NOT reactivarse. Toda alta, completado, corrección y anulación SHALL quedar auditada sin registrar datos personales innecesarios. Trazabilidad: propuesta D14/D15; RN-VEN-016; RF-PAG-008; RF-AUD.

#### Scenario: Anular una retención registrada por error
- **DADO** una operación de 250.00 con pago de 245.00 y retención de 5.00
- **CUANDO** el Administrador anula la retención con motivo
- **ENTONCES** SHALL mostrarse saldo 5.00, la retención como anulada con su motivo y el pago sin cambios.

#### Scenario: Motivo vacío
- **DADO** una retención vigente
- **CUANDO** se solicita su anulación sin motivo
- **ENTONCES** SHALL rechazarse sin cambios.

### Requirement: Atomicidad, concurrencia e idempotencia

Registrar, completar y anular retenciones SHALL ser acciones atómicas e idempotentes con identidad estable ante reintentos. Dos acciones concurrentes sobre el mismo saldo, sean pagos o retenciones, SHALL resolverse sin superar el importe exigible: una SHALL completarse y la otra SHALL recalcularse contra el saldo resultante o rechazarse. Un reintento con la misma identidad y contenido SHALL devolver el resultado existente; con contenido distinto SHALL rechazarse como conflicto. Trazabilidad: ADR-0006/0008; RNF-INT-006/008/009.

#### Scenario: Cobro y retención simultáneos
- **DADO** una operación con saldo 5.00
- **CUANDO** un usuario registra un pago de 5.00 y otro, a la vez, una retención de 5.00
- **ENTONCES** SHALL completarse solo una acción y la otra SHALL rechazarse por saldo insuficiente.

#### Scenario: Respuesta perdida
- **DADO** una retención registrada cuya respuesta no llegó al cliente
- **CUANDO** se reintenta con la misma identidad y el mismo contenido
- **ENTONCES** SHALL devolverse la retención existente sin duplicarla.

#### Scenario: Reintento con otro importe
- **DADO** una retención registrada con una identidad
- **CUANDO** se reutiliza esa identidad con otro importe
- **ENTONCES** SHALL rechazarse como conflicto sin cambios.

### Requirement: Independencia de la preparación fiscal

Registrar una retención SHALL NOT exigir una preparación fiscal ni un comprobante archivado de la operación. Una retención SHALL NOT presentarse como forma de pago del **SRI**, ni modificar la declaración de formas de pago, los importes o la instantánea de una preparación existente o futura. Trazabilidad: propuesta E17/E18; DP-018; spec `preparacion-y-seguimiento-fiscal`.

#### Scenario: Operación facturada fuera del sistema
- **DADO** una operación confirmada sin preparación fiscal
- **CUANDO** se registra una retención válida
- **ENTONCES** SHALL registrarse sin solicitar datos de la factura.

#### Scenario: Preparación posterior
- **DADO** una operación de 250.00 con pago de 245.00 y retención de 5.00
- **CUANDO** se prepara su factura
- **ENTONCES** las formas de pago declaradas SHALL sumar 250.00 con códigos habilitados, sin una forma de pago «retención».

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).

