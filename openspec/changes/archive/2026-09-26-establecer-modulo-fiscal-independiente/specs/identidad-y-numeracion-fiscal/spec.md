## ADDED Requirements

### Requirement: Ámbitos fiscales independientes de las series internas

El sistema SHALL identificar el ámbito por **entidad fiscal**, tipo documental, establecimiento, punto y ambiente. En esta entrega SHALL admitir identidad local para factura `01` y nota de crédito `04`; una solicitud de anulación SHALL NOT obtener número de comprobante nuevo. El **secuencial** SHALL representarse con exactamente nueve dígitos, entre `000000001` y `999999999`, sin reinicio anual ni reutilización. Las secuencias de pruebas y producción SHALL permanecer aisladas de COM-VEN, ART-SER y cualquier otra serie interna. Trazabilidad: propuesta §2, P4; DP-006/018; RN-FIS-008; RF-ACC-012; ficha técnica SRI, tablas 1/3/4.

#### Scenario: Mismo número en ámbitos diferentes
- **DADO** una factura comercial de prueba con secuencial `000000001`
- **CUANDO** se numera la primera factura artesanal de prueba
- **ENTONCES** SHALL poder utilizar `000000001` en su propio ámbito sin afectar el contador comercial ni las series internas.

#### Scenario: Secuencia agotada
- **DADO** un ámbito cuyo último secuencial es `999999999`
- **CUANDO** se solicita otro número de prueba
- **ENTONCES** SHALL rechazarse indicando agotamiento, sin volver a uno ni ampliar la longitud.

### Requirement: Asignación de prueba atómica e idempotente

Solo una preparación válida en ambiente de pruebas SHALL poder solicitar identidad fiscal local en esta fase. La asignación SHALL conservar número, clave, fecha de referencia, código numérico e identidad de la preparación como un único resultado durable. Repetir el intento compatible o volver a numerar la misma preparación SHALL devolver la misma identidad; contenido incompatible SHALL producir conflicto. Los borradores y validaciones previas SHALL NOT consumir números. Una cancelación posterior SHALL conservar el número asignado; un fallo antes de completar el registro SHALL NOT dejar asignación parcial. Trazabilidad: propuesta §2/6, P4; RF-AUD-006; RNF-INT-001/003/004/009.

#### Scenario: Respuesta perdida tras numerar
- **DADO** una preparación de prueba numerada cuya respuesta no recibió el usuario
- **CUANDO** repite la solicitud compatible
- **ENTONCES** SHALL recibir el mismo número y clave, sin avanzar de nuevo el contador.

#### Scenario: Dos preparaciones concurrentes
- **DADO** dos preparaciones válidas distintas del mismo ámbito de pruebas
- **CUANDO** solicitan identidad simultáneamente
- **ENTONCES** SHALL obtener números diferentes y claves coherentes, sin colisión ni alteración de otro ámbito.

#### Scenario: Falla al completar la asignación
- **DADO** una preparación todavía sin número
- **CUANDO** no puede completarse su registro de identidad
- **ENTONCES** SHALL conservarse sin numerar y no quedar un contador avanzado sin su documento correspondiente.

### Requirement: Clave de acceso validada y estable

La clave SHALL contener 49 dígitos y ser coherente con la fecha fiscal de referencia, documento, RUC, ambiente, serie, secuencial, código numérico y tipo de emisión según la ficha técnica. Su dígito final SHALL validarse mediante módulo 11 con las reglas del SRI. El sistema SHALL conservar sus componentes y SHALL NOT regenerar código numérico o fecha en un reintento. La fecha de referencia del ejercicio SHALL distinguirse de la fecha histórica de la operación y no simular una emisión real. La fecha fiscal de referencia SHALL determinarse en `America/Guayaquil`, independientemente de la zona horaria del servidor o navegador, y conservarse al asignar la identidad; los XML externos SHALL conservar su fecha declarada sin reinterpretarla como instante UTC. Una clave bien formada SHALL NOT implicar autorización. Trazabilidad: propuesta §2/6; DP-018; ficha técnica SRI, sección 5.2.

#### Scenario: Dígito de control incorrecto
- **DADO** una clave de longitud correcta con dígito final alterado
- **CUANDO** se valida
- **ENTONCES** SHALL rechazarse como identidad inválida, sin sustituir automáticamente el dígito del documento suministrado.

#### Scenario: Reintento al día siguiente
- **DADO** una preparación de prueba con identidad asignada el día anterior
- **CUANDO** se vuelve a solicitar su identidad
- **ENTONCES** SHALL conservarse la clave y fecha originales, sin usar la fecha actual para crear otra factura.

#### Scenario: Fecha local distinta de la fecha UTC
- **DADO** un ejercicio de prueba con fecha de referencia obtenida del instante `2026-09-26T02:30:00Z`
- **CUANDO** se asigna su identidad fiscal
- **ENTONCES** SHALL usarse `25/09/2026` en America/Guayaquil y el componente `25092026` en la clave, sin depender de la fecha UTC del servidor.

### Requirement: Producción sin asignación ni colisión con emisión externa

El sistema SHALL permitir al Administrador registrar antecedentes de numeración externa con emisor, ámbito, último número declarado, fecha, procedencia y responsable, distinguiéndolos de un contador verificado. En esta entrega SHALL NOT asignar nuevas identidades en producción, aunque el perfil esté completo. Una importación SHALL conservar la identidad externa sin consumir secuencias ni convertir antecedentes en autorización de emisión. La habilitación productiva futura SHALL exigir conciliación de las series usadas fuera del sistema; esta capacidad no realizará esa habilitación. Trazabilidad: propuesta P2/P4/P5; DP-018; RN-CON-009/010.

#### Scenario: Intento de numerar en producción
- **DADO** un perfil completo con antecedentes productivos
- **CUANDO** se solicita asignar una clave o secuencial productivo nuevo
- **ENTONCES** SHALL rechazarse explicando que la emisión no está habilitada, sin consumir número.

#### Scenario: XML con número externo
- **DADO** un comprobante externo de producción con secuencial `000000120`
- **CUANDO** se incorpora al archivo
- **ENTONCES** SHALL conservarse ese número como dato del archivo, sin asignar `000000121` ni avanzar contadores internos o de prueba.

### Requirement: Cambios y permisos sobre identidad

Solo el Administrador SHALL gestionar antecedentes y ámbitos; usuarios con permiso de preparar dentro de su entidad SHALL solicitar numeración de prueba. SHALL NOT editarse una identidad ya asignada, cambiar su emisor/ambiente o reutilizarla para otra preparación. Las modificaciones prospectivas de configuración y los intentos críticos SHALL ser auditables sin secretos. Trazabilidad: propuesta P1/P4; CT-001; RF-AUD-001…006.

#### Scenario: Cancelación seguida de nueva preparación
- **DADO** una preparación de prueba cancelada que ya tenía número
- **CUANDO** se numera una nueva preparación válida que la reemplaza
- **ENTONCES** SHALL asignarse otro número y conservarse el vínculo al original, sin reutilizar su clave.

#### Scenario: Usuario cambia de ámbito sin permiso
- **DADO** un Vendedor sin rol de taller
- **CUANDO** solicita identidad para una preparación artesanal
- **ENTONCES** SHALL denegarse sin revelar el documento ni modificar secuencias.

Fuentes: [ficha técnica y esquemas SRI](https://www.sri.gob.ec/facturacion-electronica).
