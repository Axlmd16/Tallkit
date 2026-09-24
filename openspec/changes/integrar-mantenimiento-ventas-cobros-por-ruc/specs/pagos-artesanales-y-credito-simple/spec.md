# Pagos artesanales y crédito simple

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24 con P2 (extensión de DP-027 a servicios) y P5; decisiones DP-003/013/019/027/028, CT-001; modelo de dominio §6, §7, §10 e invariantes 16 y 17; RN-FIS-005/008/009; RN-TAL-010; RN-VEN-008…014 (por analogía aprobada); RF-TAL-009; RF-PAG-001…012; RF-REP-006 (parte artesanal); CU-013/017 8; actores-y-roles §3.5; spec principal `pagos-comerciales-y-credito-simple`, cuyas reglas se aplican aquí al ámbito artesanal sin compartir dinero, saldos ni correcciones con él.

Los pagos artesanales se aplican a una sola **operación artesanal de servicios** confirmada. Nunca se aplican a ventas comerciales, ni se distribuyen, compensan o anticipan. Caja, cierres diarios, reembolsos y conciliación quedan fuera de esta entrega.

## ADDED Requirements

### Requirement: Acceso a pagos artesanales por acción

Administrador y Encargado del taller activos y autenticados SHALL consultar pagos y saldos artesanales con `pagos_artesanales.ver` y registrarlos con `pagos_artesanales.registrar`. Solo el Administrador SHALL anular o corregir pagos artesanales con `pagos_artesanales.anular`. Un Vendedor sin rol de taller SHALL NOT consultar ni registrar pagos artesanales. Los permisos y la pertenencia de la operación al RUC artesanal SHALL comprobarse en el servidor en toda consulta, escritura o reintento. Trazabilidad: CT-001; RF-PAG-002/008; RF-TAL-009; actores-y-roles §3.5.

#### Scenario: Encargado del taller registra un cobro de servicios
- **DADO** un Encargado del taller y una operación artesanal confirmada con saldo
- **CUANDO** registra un pago válido
- **ENTONCES** SHALL registrarse en esa operación del RUC artesanal.

#### Scenario: Vendedor intenta cobrar servicios
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** registra un pago o consulta el saldo de una operación artesanal por acceso directo
- **ENTONCES** el sistema SHALL denegarlo sin revelar datos ni modificar dinero.

#### Scenario: Encargado intenta corregir un pago
- **DADO** un pago artesanal y un usuario con solo el rol Encargado del taller
- **CUANDO** intenta anularlo o sustituirlo
- **ENTONCES** el sistema SHALL denegarlo sin cambiar su vigencia ni el saldo.

### Requirement: Contado y crédito separados del medio de pago

Cada operación artesanal SHALL registrar la condición CONTADO o CREDITO elegida al confirmarla, independiente de sus medios y de su estado de pago. **Crédito** SHALL permitir saldo pendiente y **abonos** posteriores sin fecha de vencimiento, cuotas, intereses, límite ni cronograma. CONTADO SHALL solicitar un cobro completo después de confirmar; si se interrumpe, la operación SHALL permanecer confirmada y pendiente, con posibilidad de reanudar el cobro, sin convertirse en crédito ni marcarse pagada. Confirmar y cobrar SHALL ser acciones independientes. CREDITO SHALL NOT admitirse como medio de pago. Trazabilidad: DP-003/027; RN-VEN-008; RF-PAG-001/012; propuesta P2.

#### Scenario: Servicios a crédito sin cobro inicial
- **DADO** una operación artesanal de USD 120,00 confirmada a crédito
- **CUANDO** se consulta
- **ENTONCES** SHALL mostrar saldo USD 120,00 y estado pendiente, sin vencimiento ni plan.

#### Scenario: Abono parcial en contado
- **DADO** una operación artesanal al contado con saldo USD 120,00
- **CUANDO** se intenta registrar un pago de USD 50,00
- **ENTONCES** SHALL rechazarse indicando que contado requiere cubrir el saldo completo, sin registrar el abono ni cambiar la condición.

#### Scenario: Abonos a crédito
- **DADO** una operación artesanal a crédito con saldo USD 120,00
- **CUANDO** se registran abonos de USD 50,00 y USD 70,00 en fechas distintas
- **ENTONCES** el estado SHALL pasar de pendiente a parcial y luego a pagado, con saldo USD 0,00.

### Requirement: Pago de una sola operación del RUC artesanal

Cada pago artesanal SHALL identificar exactamente una operación artesanal confirmada y vigente elegida por el usuario. SHALL registrar un importe positivo en USD con hasta dos decimales, uno o ambos medios EFECTIVO y TRANSFERENCIA con partes positivas cuya suma sea el importe, el usuario, la entidad artesanal y la fecha efectiva asignada por el sistema en America/Guayaquil. SHALL rechazarse sin redondear los importes nulos, negativos, con exceso de precisión o superiores al saldo; los anticipos, los sobrepagos, otros medios, la retrofecha y la distribución de un importe entre operaciones. Un pago SHALL NOT aplicarse a una venta comercial, a una operación anulada ni a la orden como conjunto. SHALL NOT generar saldo a favor ni monedero. Igual que en los pagos comerciales, el importe registrado es el aplicado; esta entrega no registra efectivo recibido ni cambio entregado. Trazabilidad: DP-003/013; RN-VEN-009/010/013/014; RF-PAG-003/004/007/010/011; invariante 17.

#### Scenario: Pago combinado
- **DADO** una operación artesanal con saldo USD 100,00
- **CUANDO** se registra un pago de USD 100,00 con USD 60,00 en efectivo y USD 40,00 por transferencia
- **ENTONCES** SHALL quedar un pago con dos partes, saldo USD 0,00 y estado pagado.

#### Scenario: Pago superior al saldo
- **DADO** una operación artesanal con saldo USD 30,00
- **CUANDO** se intenta registrar un pago de USD 30,01
- **ENTONCES** SHALL rechazarse sin crear pago ni saldo a favor.

#### Scenario: Pago de servicios dirigido a una venta de repuestos
- **DADO** una orden con una venta comercial vinculada y una operación artesanal, ambas con saldo
- **CUANDO** se intenta registrar un pago artesanal indicando la venta comercial como documento
- **ENTONCES** SHALL rechazarse sin modificar ningún saldo.

#### Scenario: Pago global de la orden
- **DADO** una orden con saldos de USD 40,00 en repuestos y USD 60,00 en servicios
- **CUANDO** se intenta registrar un único pago de USD 100,00 para la orden
- **ENTONCES** SHALL rechazarse; cada importe SHALL registrarse como un pago separado en su propio documento y RUC.

#### Scenario: Importes inválidos
- **DADO** una operación artesanal con saldo
- **CUANDO** se intenta registrar un pago de USD 0,00, USD −5,00 o USD 10,005, o partes cuya suma difiere del importe
- **ENTONCES** SHALL rechazarse con errores por campo sin crear pago.

### Requirement: Saldo y estado de pago derivados

El saldo pendiente de cada operación artesanal SHALL derivarse del importe exigible vigente menos los pagos efectivos netos de correcciones, sin edición manual. El estado de pago SHALL derivarse como pendiente (sin pagos efectivos), parcial (saldo positivo con pagos) o pagado (saldo cero) y SHALL ser independiente del estado operativo de la orden y del estado del documento. Una operación anulada SHALL tener exigible cero. Trazabilidad: RN-VEN-011/012; RF-PAG-005/006; modelo de dominio §10.

#### Scenario: Saldo reproducible
- **DADO** una operación de USD 120,00 con pagos efectivos de USD 50,00 y USD 20,00 y un pago corregido de USD 10,00
- **CUANDO** se consulta
- **ENTONCES** SHALL mostrar pagado USD 70,00, saldo USD 50,00 y estado parcial, sin sumar el pago corregido.

#### Scenario: Estados independientes
- **DADO** una orden finalizada con una operación artesanal a crédito pendiente
- **CUANDO** se consulta la orden
- **ENTONCES** la orden SHALL mostrarse finalizada y la operación pendiente de pago, sin que uno condicione al otro.

### Requirement: Corrección administrativa de pagos artesanales

El Administrador SHALL poder anular un pago artesanal registrado por error, o sustituirlo por otro correcto, con motivo no vacío, conservando el original, su vigencia, el usuario, la fecha y el vínculo con la sustitución. SHALL NOT eliminarse ni editarse un pago. La sustitución SHALL cumplir todas las reglas de un pago nuevo contra el saldo resultante. Corregir un pago SHALL NOT representar un reembolso de dinero realmente recibido. Trazabilidad: RF-PAG-008; RN-VEN-016; DP-028 (por analogía).

#### Scenario: Anular un pago registrado por error
- **DADO** una operación con un pago de USD 30,00 registrado por error
- **CUANDO** el Administrador lo anula con motivo
- **ENTONCES** el pago SHALL conservarse como anulado con motivo y usuario, y el saldo SHALL aumentar en USD 30,00.

#### Scenario: Sustituir un pago con otro medio
- **DADO** un pago de USD 50,00 registrado como efectivo que fue transferencia
- **CUANDO** el Administrador lo sustituye por un pago de USD 50,00 por transferencia
- **ENTONCES** SHALL conservarse el original como sustituido, el nuevo como vigente y el saldo SHALL permanecer igual.

### Requirement: Atomicidad, concurrencia e idempotencia de cobros artesanales

Cada registro, anulación o sustitución de pago SHALL confirmar conjuntamente sus partes, vínculos y auditoría, o no dejar ningún efecto. La validación del saldo SHALL realizarse dentro de la misma acción atómica y coordinarse con cobros, correcciones y anulaciones concurrentes de la misma operación. Reintentar con la misma identidad de intento y contenido compatible SHALL devolver el resultado existente; reutilizarla con otro contenido SHALL responder conflicto. Pagos legítimos distintos con igual importe SHALL distinguirse por su identidad. Los cobros artesanales y comerciales SHALL NOT requerir una transacción conjunta. Trazabilidad: RF-AUD-006; RNF-INT-001/004/009; RF-PAG-007.

#### Scenario: Dos cobros simultáneos del saldo completo
- **DADO** una operación con saldo USD 80,00
- **CUANDO** dos usuarios registran al mismo tiempo pagos de USD 80,00
- **ENTONCES** SHALL registrarse solo uno y el otro SHALL rechazarse por exceder el saldo, sin sobrepago.

#### Scenario: Reintento después de perder la respuesta
- **DADO** un pago ya registrado cuya respuesta se perdió
- **CUANDO** el cliente reintenta con la misma identidad de intento
- **ENTONCES** SHALL devolverse el pago existente sin crear otro.

#### Scenario: Cobro de servicios mientras se anula la operación
- **DADO** una operación sin pagos
- **CUANDO** el Administrador la anula mientras otro usuario registra un pago
- **ENTONCES** SHALL aplicarse una sola en un orden coherente: o la operación queda anulada sin pagos, o el pago queda registrado y la anulación se bloquea por pagos efectivos.

### Requirement: Cuentas por cobrar artesanales

Un usuario con `pagos_artesanales.ver` SHALL consultar las **cuentas por cobrar** artesanales por cliente, número de operación, orden, estado de pago y antigüedad desde la fecha de confirmación en America/Guayaquil, con filtros, paginación estable y sumas de todas las coincidencias autorizadas. Cada fila SHALL identificar el emisor artesanal y el tipo de documento. La consulta SHALL NOT mezclar importes comerciales, compensar saldos entre RUC, ofrecer un pago repartido ni presentar la antigüedad como mora, vencimiento o intereses. El historial de pagos SHALL distinguir los pagos vigentes, anulados y sustituidos, con medios, fecha, usuario y relaciones. La navegación SHALL ofrecer la entrada de cuentas por cobrar artesanales solo a quien tenga el permiso. Trazabilidad: RF-PAG-009; RF-REP-006 (parte artesanal); UI-060…063 (ámbito artesanal); DP-013.

#### Scenario: Deuda artesanal de un cliente
- **DADO** un cliente con dos operaciones artesanales de saldos USD 30,00 y USD 70,00 y una venta comercial con saldo USD 50,00
- **CUANDO** un Encargado del taller filtra la deuda artesanal del cliente
- **ENTONCES** SHALL mostrar las dos operaciones y un total artesanal de USD 100,00, excluyendo la venta comercial.

#### Scenario: Antigüedad sin mora
- **DADO** una operación a crédito confirmada diez días antes de la consulta
- **CUANDO** se consulta su antigüedad
- **ENTONCES** SHALL mostrar diez días desde la confirmación, sin vencimiento, recargo ni etiqueta de morosidad.

### Requirement: Experiencia de cobro artesanal

La acción de cobro de servicios SHALL rotularse como cobro del RUC artesanal y SHALL mostrar el número de la operación, el total, lo pagado y el saldo antes de registrar. SHALL presentarse separada de la acción de cobro de repuestos. SHALL prevenir envíos duplicados, conservar los datos ingresados ante errores recuperables, mostrar errores por campo y confirmar el éxito con las notificaciones del sistema visual. Trazabilidad: RN-FIS-009; UI-075/077; spec `patrones-de-pantalla-frontend`.

#### Scenario: Diálogo de cobro identifica el emisor
- **DADO** una orden con saldos en repuestos y servicios
- **CUANDO** el Encargado del taller abre «Cobrar servicios»
- **ENTONCES** el diálogo SHALL identificar el RUC artesanal y la operación, mostrar solo su saldo y no ofrecer aplicar el importe a la venta comercial.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
