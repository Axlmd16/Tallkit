# solicitudes-de-correccion-fiscal Specification

## Purpose
Registrar y evaluar localmente solicitudes administrativas de anulación o nota de crédito sobre comprobantes externos o de ensayo, con restricciones normativas versionadas, hechos pendientes explícitos y control del remanente afectable, sin ejecutar correcciones oficiales ni producir efectos comerciales.
## Requirements
### Requirement: Solicitud fiscal distinta de corrección comercial

Solo el Administrador SHALL preparar solicitudes locales de anulación fiscal o nota de crédito, identificando acción, motivo, emisor, original, fecha de referencia y corrección comercial asociada cuando exista. El original SHALL ser una evidencia externa identificada o un documento del ejercicio de pruebas, distinguiendo ambas procedencias. Las solicitudes SHALL mantener estados borrador, preparada y cancelada localmente; SHALL NOT ejecutarse ante el SRI, declararse aceptadas por el receptor ni marcar el original oficialmente anulado. Cancelar una preparación local ordinaria SHALL seguir su propio flujo y no exigir una solicitud de anulación oficial. Trazabilidad: propuesta §7/P1; DP-018; RN-CON-007/010; RF-AUD-001…004; CU-014/015.

#### Scenario: Preparar corrección de factura externa
- **DADO** una factura externa archivada con procedencia no verificada
- **CUANDO** el Administrador prepara una solicitud con motivo
- **ENTONCES** SHALL conservarse la solicitud local y el original intacto, con advertencia de verificación oficial pendiente.

#### Scenario: Devolución comercial sin nota de crédito
- **DADO** una venta relacionada con un comprobante externo
- **CUANDO** se confirma su devolución comercial
- **ENTONCES** SHALL NOT aparecer una nota de crédito emitida ni una anulación oficial por ese solo hecho.

#### Scenario: Vendedor intenta corregir fiscalmente
- **DADO** un Vendedor con acceso a una venta
- **CUANDO** intenta crear o preparar una solicitud fiscal de corrección
- **ENTONCES** SHALL denegarse sin modificar la venta ni el archivo.

### Requirement: Evaluación local de restricciones con fuente y fecha

Cada solicitud SHALL conservar la versión normativa, fecha de evaluación y hechos disponibles usados para determinar su elegibilidad local. Para anulación en línea SHALL evaluarse el plazo hasta el día 7 del mes siguiente a la emisión y su desplazamiento al siguiente hábil cuando corresponda; feriados aplicables desconocidos SHALL producir evaluación pendiente, no permiso inventado. Fuera del plazo SHALL bloquearse la preparación de esa vía y orientarse a evaluar nota de crédito, sin crearla automáticamente. Una factura declarada emitida y transmitida como consumidor final SHALL bloquear ambas vías ordinarias; también SHALL impedirse preparar cuando conste que el original sustenta devolución de impuestos o es factura comercial negociable efectivamente negociada. Hechos desconocidos que condicionen la corrección SHALL mostrarse como pendientes de comprobación; esta fase no certifica elegibilidad ante el SRI. Trazabilidad: propuesta §7; resoluciones 25-14, artículos 1…5 y generales, y 25-17.

#### Scenario: Anulación fuera del plazo
- **DADO** una factura cuyo plazo local calculado ya concluyó
- **CUANDO** se solicita preparar su anulación en línea
- **ENTONCES** SHALL bloquearse esa vía y mostrarse la alternativa de evaluar nota de crédito con sus propias restricciones.

#### Scenario: Consumidor final emitido y transmitido
- **DADO** un original identificado como consumidor final ya emitido y transmitido
- **CUANDO** se intenta preparar anulación o nota de crédito
- **ENTONCES** SHALL rechazarse la solicitud por la restricción aplicable, sin cambiar artificialmente al receptor.

#### Scenario: Calendario insuficiente
- **DADO** una fecha cuyo desplazamiento depende de un feriado local no determinado
- **CUANDO** se evalúa el plazo de anulación
- **ENTONCES** SHALL indicarse evaluación pendiente y su causa sin afirmar que la solicitud está dentro del plazo.

### Requirement: Nota de crédito con referencia e importes limitados

Una preparación de nota de crédito SHALL referenciar una factura original del mismo emisor y conservar fecha, número, motivo y las líneas o importes que pretende afectar. SHALL utilizar el tratamiento y valores históricos aplicables, nunca las tarifas actuales del catálogo por defecto. SHALL impedir importes negativos, cantidades superiores a las originales y una afectación acumulada superior al remanente, considerando otras preparaciones activas y evidencias relacionadas sin contabilizar dos veces una misma corrección. Si faltan datos del original o del historial externo necesario, SHALL permanecer borrador con impedimentos. SHALL NOT introducir descuentos comerciales prohibidos ni un límite general de doce meses eliminado por la reforma; las causas válidas y restricciones legales sí se conservan. Trazabilidad: propuesta §7; DP-004/017/025; RN-CON-002/007; resoluciones 25-14/25-17.

#### Scenario: Cambio posterior de tarifa
- **DADO** una factura archivada con tarifa histórica y una tarifa vigente diferente
- **CUANDO** se prepara una nota de crédito por una línea del original
- **ENTONCES** SHALL conservarse la referencia y tratamiento histórico pertinente, sin recalcular la venta original con la tarifa actual.

#### Scenario: Dos solicitudes exceden el remanente
- **DADO** un remanente afectable de USD 30
- **CUANDO** se preparan simultáneamente dos solicitudes distintas de USD 20
- **ENTONCES** SHALL quedar preparada como máximo una y la otra SHALL informar insuficiencia del remanente, sin efectos económicos.

#### Scenario: Historial externo insuficiente
- **DADO** una factura con indicios de correcciones previas cuyo detalle no está disponible
- **CUANDO** se intenta completar una nota de crédito local
- **ENTONCES** SHALL conservarse el borrador con el impedimento de historial incompleto, sin asumir que todo el original sigue disponible.

### Requirement: Trazabilidad y resultados sin efectos oficiales ficticios

Las solicitudes preparadas SHALL ser inmutables; su cancelación o reemplazo SHALL conservar original, motivo, responsable y fechas. Repetir una solicitud compatible SHALL recuperar el mismo resultado; reutilizar su identidad con otro contenido SHALL producir conflicto. Una importación posterior de nota de crédito SHALL poder relacionarse como evidencia, sin duplicar afectaciones locales ni marcar ejecución oficial verificada. La aceptación exigida para anular notas de crédito/débito o retenciones SHALL NOT generalizarse a todas las facturas; esta fase no registra una aceptación oficial sin mecanismo de comprobación. Ninguna solicitud SHALL modificar pagos, deuda, inventario ni estados comerciales. Trazabilidad: propuesta §6/7; RF-AUD-001…006; RNF-INT-001/003/004; resolución 25-14 artículo 4 reformado.

#### Scenario: Repetir una solicitud preparada
- **DADO** una solicitud ya preparada cuya respuesta se perdió
- **CUANDO** se repite con la misma identidad y contenido
- **ENTONCES** SHALL recuperarse la misma solicitud sin duplicar su afectación reservada ni consumir otra identidad.

#### Scenario: XML posterior como evidencia
- **DADO** una solicitud local y una nota de crédito externa compatible con ella
- **CUANDO** el Administrador relaciona la evidencia importada
- **ENTONCES** SHALL conservarse la relación y la condición no verificada, contando una sola afectación y sin cerrar la solicitud como oficialmente comprobada.

Fuentes: [resolución 25-14](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf) y [reforma 25-17](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf). Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).

