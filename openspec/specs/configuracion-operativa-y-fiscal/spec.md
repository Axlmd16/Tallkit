# configuracion-operativa-y-fiscal Specification

## Purpose
Establecer y administrar la configuración operativa y fiscal del taller: entidades fiscales obligatorias (RUC comercial y artesanal), bodega única de V1, tarifas tributarias con vigencia no ambigua y series de numeración interna para comprobantes.
## Requirements
### Requirement: Acceso administrativo a la configuración

El sistema SHALL permitir consultar y modificar la configuración operativa y fiscal únicamente a un **Administrador** autenticado con los permisos efectivos `entidades_fiscales.ver`, `entidades_fiscales.editar` o `parametros.gestionar`, según la acción. Ocultar una acción en la interfaz SHALL NOT sustituir la autorización del backend. Trazabilidad: `CT-001`, `RN-SEG-002…007`, `RF-ACC-008`, `RF-ACC-010…012`, `CU-003`, `UI-014…016`, `RNF-SEG-002…003`.

#### Scenario: Administrador consulta la configuración
- **WHEN** un Administrador autenticado consulta las entidades fiscales, impuestos, bodega o series
- **THEN** el sistema SHALL devolver únicamente la configuración solicitada dentro de sus permisos

#### Scenario: Usuario sin permiso intenta modificar un parámetro
- **WHEN** un Vendedor, un Encargado del taller o cualquier usuario sin el permiso requerido intenta modificar la configuración
- **THEN** el sistema SHALL denegar la acción y SHALL NOT cambiar ningún dato

### Requirement: Dos entidades fiscales obligatorias y diferenciadas

El sistema SHALL mantener exactamente dos **entidades fiscales**: una de tipo **RUC comercial** y otra de tipo **RUC artesanal**. Cada entidad SHALL tener un RUC único formado por exactamente 13 dígitos ASCII, razón social obligatoria de 1 a 200 caracteres después de quitar espacios exteriores y, opcionalmente, nombre comercial de hasta 200 caracteres, dirección de hasta 300, teléfono de hasta 32 y correo de hasta 254; un opcional vacío SHALL conservarse como ausencia. Estos límites no certifican la validez tributaria del RUC. Su tipo SHALL NOT cambiar después de creada. Trazabilidad: `CT-001`, `RN-FIS-001…005`, `RF-ACC-010`, `CU-003`.

#### Scenario: Configuración inicial válida
- **WHEN** el Administrador registra RUC distintos y razones sociales para las entidades comercial y artesanal
- **THEN** el sistema SHALL conservar exactamente una entidad de cada tipo y SHALL mantenerlas disponibles para su ámbito operativo

#### Scenario: RUC inválido o repetido
- **WHEN** el Administrador intenta guardar un RUC que no tiene 13 caracteres o que ya pertenece a la otra entidad fiscal
- **THEN** el sistema SHALL rechazar la configuración y SHALL indicar el campo que debe corregirse

#### Scenario: Identificación excedida o no numérica
- **WHEN** el Administrador envía un RUC con caracteres no numéricos, una razón social vacía o un dato de identificación que excede su límite
- **THEN** el sistema SHALL rechazar la entrada completa sin truncarla y SHALL NOT cambiar la configuración

#### Scenario: Intento de cambiar el tipo fiscal
- **WHEN** el Administrador intenta convertir el RUC comercial en artesanal o el artesanal en comercial
- **THEN** el sistema SHALL rechazar el cambio y SHALL conservar la separación existente

### Requirement: Historia de los datos fiscales

El sistema SHALL aplicar los cambios de identificación de una entidad fiscal solo a operaciones futuras. Un **documento interno** confirmado SHALL conservar la copia histórica de los datos fiscales usados al confirmarse y SHALL NOT cambiar cuando se edite la ficha vigente. Trazabilidad: `RN-FIS-008`, `RN-CON-002`, `RF-ACC-010`, `RNF-DAT-003`.

#### Scenario: Cambio posterior de razón social
- **WHEN** el Administrador actualiza la razón social de una entidad fiscal que ya tiene documentos confirmados
- **THEN** el sistema SHALL usar el nuevo dato en operaciones futuras y SHALL conservar intactos los documentos históricos

#### Scenario: Eliminación de una entidad configurada
- **WHEN** el Administrador intenta eliminar o desactivar una de las dos entidades fiscales obligatorias
- **THEN** el sistema SHALL rechazar la acción y SHALL mantener disponible la configuración del RUC comercial y del RUC artesanal

### Requirement: Tarifas tributarias por entidad y vigencia

El sistema SHALL permitir al Administrador registrar uno o más **impuestos**, incluido IVA, para cada entidad fiscal mediante código de 1 a 20 caracteres, nombre de 1 a 120, tarifa decimal, fecha de inicio y fecha de fin opcional. El código SHALL normalizarse a mayúsculas y admitir únicamente letras ASCII, dígitos, guion y guion bajo, comenzando por una letra. La tarifa SHALL viajar como cadena decimal ordinaria, sin exponente ni coma, entre 0 y 100 inclusive y con hasta cuatro decimales. El sistema SHALL NOT redondear ni truncar entradas y SHALL NOT incorporar una tasa legal predeterminada no validada por el responsable del negocio. Trazabilidad: `RN-FIS-010`, `RN-CON-001`, `RF-ACC-011`, `CU-003`.

#### Scenario: Registro de una tarifa validada
- **WHEN** el Administrador registra para una entidad fiscal una tarifa válida con fecha de inicio
- **THEN** el sistema SHALL conservarla como una vigencia tributaria aplicable a esa entidad desde la fecha indicada

#### Scenario: Tarifa cero
- **WHEN** el Administrador registra una tarifa de 0 para un impuesto cuya aplicación fue validada por el negocio
- **THEN** el sistema SHALL aceptar la tarifa sin sustituirla por otro valor

#### Scenario: Tarifa fuera del intervalo permitido
- **WHEN** el Administrador intenta registrar una tarifa menor que 0 o mayor que 100
- **THEN** el sistema SHALL rechazarla y SHALL NOT crear la vigencia

#### Scenario: Tarifa con precisión o representación no admitida
- **WHEN** el Administrador envía una tarifa con más de cuatro decimales, notación exponencial, coma decimal o como número JSON
- **THEN** el sistema SHALL rechazar la entrada sin redondearla ni crear la vigencia

### Requirement: Vigencias tributarias no ambiguas

Para una misma entidad fiscal y código de impuesto, el sistema SHALL impedir períodos de vigencia solapados. La configuración aplicable SHALL resolverse por la fecha operativa en la zona `America/Guayaquil`; si no existe una única vigencia aplicable, una operación económica dependiente SHALL fallar sin efectos parciales. Trazabilidad: `RN-FIS-010`, `RN-CON-001`, `RF-ACC-011`, `CU-003`, `RNF-INT-001`, `RNF-INT-008…009`.

#### Scenario: Solapamiento de vigencias
- **WHEN** el Administrador intenta registrar un período que se solapa con otra vigencia del mismo impuesto y entidad fiscal
- **THEN** el sistema SHALL rechazarlo y SHALL mostrar los períodos en conflicto

#### Scenario: Sucesión prospectiva válida
- **WHEN** el Administrador programa mediante la acción explícita de sucesión una nueva tarifa con inicio futuro, posterior a todo uso registrado de la vigencia abierta
- **THEN** el sistema SHALL cerrar la vigencia anterior el día previo, crear la sucesora atómicamente y SHALL aplicar la nueva tarifa desde su fecha de inicio sin alterar usos ni copias históricas

#### Scenario: Fecha de sucesión incompatible
- **WHEN** la fecha propuesta no es futura en `America/Guayaquil` o cerraría la vigencia antes de una operación que ya la utilizó
- **THEN** el sistema SHALL rechazar toda la sucesión y SHALL conservar sin cambios la vigencia abierta y sus usos

#### Scenario: Dos sucesiones concurrentes
- **WHEN** dos solicitudes intentan sustituir simultáneamente la misma vigencia abierta
- **THEN** el sistema SHALL confirmar una sola sucesora y SHALL rechazar la otra por conflicto sin crear solapamientos

#### Scenario: Ausencia de tarifa aplicable
- **WHEN** una operación económica intenta confirmarse en una fecha para la que no existe una única vigencia aplicable
- **THEN** el sistema SHALL rechazar la confirmación y SHALL NOT asignar secuencial, crear saldo ni afectar inventario

### Requirement: Configuración tributaria histórica inmutable

Una vigencia tributaria utilizada por al menos una operación confirmada SHALL NOT poder editarse ni eliminarse mediante modificación genérica. La única mutación admitida sobre una vigencia abierta utilizada SHALL ser su cierre prospectivo dentro de la acción explícita, atómica y auditada de sucesión descrita en esta especificación. Esa acción SHALL NOT cambiar tarifa ni inicio y SHALL NOT invalidar usos existentes. Toda corrección SHALL crear una nueva vigencia sin recalcular bases, tarifas, impuestos o totales históricos. Trazabilidad: `DP-017`, `RN-CON-001…002`, `RF-ACC-011`, `RF-VEN-004`.

#### Scenario: Intento de editar una tarifa utilizada
- **WHEN** el Administrador intenta cambiar la tarifa o las fechas de una vigencia ya utilizada
- **THEN** el sistema SHALL rechazar la edición genérica y SHALL orientar a usar la acción de sucesión cuando corresponda

#### Scenario: Cambio de tarifa sin efecto retroactivo
- **WHEN** entra en vigor una nueva tarifa
- **THEN** las operaciones confirmadas anteriormente SHALL conservar su tarifa y desglose históricos

### Requirement: Bodega única de V1

El sistema SHALL crear y mantener una única **bodega** operativa para V1, identificada inicialmente como “Bodega principal”. Su nombre SHALL tener entre 1 y 120 caracteres después de quitar espacios exteriores. El Administrador SHALL poder actualizar sus datos descriptivos, pero SHALL NOT poder crear una segunda bodega, eliminar la existente ni dejar al sistema sin una bodega activa. Trazabilidad: `DP-001`, `RN-INV-016`, `RF-INV-013`, `UI-017`.

#### Scenario: Configuración inicial de la bodega
- **WHEN** se completa la configuración inicial del taller
- **THEN** el sistema SHALL disponer de una sola bodega activa denominada “Bodega principal”

#### Scenario: Cambio de nombre de la bodega
- **WHEN** el Administrador cambia el nombre descriptivo de la bodega principal
- **THEN** el sistema SHALL conservar la misma identidad de bodega y SHALL aplicar el nombre nuevo a consultas futuras

#### Scenario: Intento de habilitar otra bodega
- **WHEN** el Administrador intenta crear o habilitar una segunda bodega
- **THEN** el sistema SHALL rechazar la acción y SHALL NOT habilitar transferencias ni operación multibodega

### Requirement: Series internas iniciales de V1

El sistema SHALL crear las series internas `COM-ING`, `COM-PRO`, `COM-VEN` y `ART-SER`, asociadas respectivamente a ingresos de mercadería, proformas, ventas de repuestos y operaciones económicas de servicios. Cada código SHALL tener entre 3 y 20 caracteres, comenzar por una letra y admitir únicamente letras ASCII mayúsculas, dígitos y guion. Cada serie SHALL pertenecer a una sola entidad fiscal y tipo de documento, y su primer **secuencial** asignable SHALL ser `000001`. Trazabilidad: aprobación de `DP-006` para este cambio, `RN-FIS-008`, `RN-VEN-018`, `RF-ACC-012`, `RF-INV-004`, `RF-VEN-006`, `RF-TAL-008`.

#### Scenario: Creación de series iniciales
- **WHEN** el Administrador completa la configuración inicial
- **THEN** el sistema SHALL crear `COM-ING`, `COM-PRO` y `COM-VEN` para el RUC comercial y `ART-SER` para el RUC artesanal, todas listas para asignar `000001`

#### Scenario: Asociación fiscal incorrecta
- **WHEN** se intenta usar `ART-SER` para un documento comercial o una serie `COM-*` para una operación artesanal
- **THEN** el sistema SHALL rechazar la asignación y SHALL conservar ambos ámbitos separados

### Requirement: Formato visible del número interno

Todo número interno de esta capacidad SHALL usar el formato `<SERIE>-<SECUENCIAL>`, donde el secuencial contiene al menos seis dígitos completados con ceros a la izquierda. Este número SHALL identificarse como interno y SHALL NOT presentarse como factura electrónica ni autorización del SRI. Trazabilidad: aprobación de `DP-006`, `DP-018`, `RN-CON-003`, `RN-CON-009…010`, `RF-PRO-010`, `RF-VEN-015`, `RNF-USA-012`.

#### Scenario: Primera venta comercial confirmada
- **WHEN** se asigna el primer número de la serie `COM-VEN`
- **THEN** el sistema SHALL producir `COM-VEN-000001`

#### Scenario: Presentación del número interno
- **WHEN** un usuario consulta o imprime un documento numerado por esta capacidad
- **THEN** el sistema SHALL mostrar el número interno y SHALL indicar que no constituye una factura electrónica autorizada por el SRI

### Requirement: Ciclo de vida controlado de las series

Antes de asignar su primer número, el Administrador SHALL poder corregir el código de una serie conservando un formato único y legible. Después del primer uso, el código y el último valor asignado SHALL quedar bloqueados; una sustitución SHALL cerrar la serie anterior y crear una sucesora distinta, manteniendo como máximo una serie activa por entidad fiscal y tipo de documento. Trazabilidad: aprobación de `DP-006`, `RF-ACC-012`, `CU-003`, `UI-016`.

#### Scenario: Corrección antes del primer uso
- **WHEN** el Administrador corrige el código de una serie que todavía no ha asignado números
- **THEN** el sistema SHALL guardar el código único y SHALL mantener `000001` como primer secuencial asignable

#### Scenario: Edición después del primer uso
- **WHEN** el Administrador intenta cambiar el código o reducir el contador de una serie utilizada
- **THEN** el sistema SHALL rechazar la edición y SHALL conservar la numeración existente

#### Scenario: Sustitución de una serie utilizada
- **WHEN** el Administrador cierra una serie utilizada y registra una serie sucesora válida para el mismo ámbito
- **THEN** el sistema SHALL conservar la serie anterior en el historial y SHALL dejar activa únicamente la sucesora

### Requirement: Asignación del secuencial según el estado del documento

El sistema SHALL asignar un secuencial únicamente cuando el documento alcance el estado que produce su numeración: emisión de una proforma o confirmación de un ingreso, una venta o una operación económica de servicios. Los borradores SHALL NOT consumir números. Trazabilidad: `RN-VEN-005`, `RN-CON-009`, `RF-INV-004`, `RF-VEN-006`, `RF-TAL-008`, `CU-007`, `CU-012`.

#### Scenario: Borrador sin numeración
- **WHEN** un usuario crea o edita un documento que permanece en borrador
- **THEN** el sistema SHALL NOT asignar ni reservar un secuencial definitivo

#### Scenario: Emisión de proforma
- **WHEN** una proforma válida se emite
- **THEN** el sistema SHALL asignar el siguiente número de su serie comercial dentro de la misma operación

#### Scenario: Confirmación de una operación
- **WHEN** se confirma válidamente un ingreso, una venta o una operación económica de servicios
- **THEN** el sistema SHALL asignar el siguiente número de la serie correspondiente dentro de la misma operación atómica

### Requirement: Secuenciales seguros ante concurrencia y reintentos

La asignación de secuenciales SHALL garantizar unicidad por entidad fiscal, tipo de documento y serie ante solicitudes concurrentes. Una misma solicitud lógica repetida SHALL devolver el resultado previamente asignado o SHALL detectar el reintento, y SHALL NOT crear otro documento ni consumir otro número por duplicado. Trazabilidad: `RN-VEN-018`, `RNF-INT-003…005`, `RNF-INT-009`, `RF-VEN-008`.

#### Scenario: Dos confirmaciones concurrentes
- **WHEN** dos operaciones válidas solicitan simultáneamente el siguiente número de una misma serie
- **THEN** el sistema SHALL confirmar ambas con números distintos y consecutivos, sin duplicar ninguno

#### Scenario: Reintento de una confirmación procesada
- **WHEN** se repite la misma solicitud lógica después de que su confirmación fue procesada
- **THEN** el sistema SHALL NOT crear un segundo documento ni asignar otro secuencial

#### Scenario: Falla durante una confirmación
- **WHEN** falla cualquier efecto requerido antes de completar la confirmación
- **THEN** el sistema SHALL revertir la confirmación y SHALL NOT dejar un documento confirmado sin sus efectos asociados

### Requirement: Conservación de números asignados

Un secuencial asignado a un documento confirmado o a una proforma emitida SHALL NOT reutilizarse, reasignarse ni trasladarse a otra entidad fiscal, tipo o serie. La anulación SHALL conservar el número y la relación con el documento original. Trazabilidad: `RN-CON-007`, `RN-CON-009`, invariante 8 de `reglas-negocio.md`, `RF-ACC-012`.

#### Scenario: Anulación de un documento numerado
- **WHEN** se anula un documento confirmado o una proforma emitida
- **THEN** el sistema SHALL conservar su número y SHALL NOT devolverlo al conjunto de números disponibles

#### Scenario: Intento de reasignar un número histórico
- **WHEN** una operación intenta usar un número ya asignado en cualquier documento de la misma serie
- **THEN** el sistema SHALL rechazar la operación y SHALL conservar el documento original

### Requirement: Configuración obligatoria para operaciones dependientes

Una operación dependiente SHALL NOT inventar valores predeterminados cuando falte la entidad fiscal, bodega, vigencia tributaria o serie aplicable. La validación SHALL ocurrir antes de producir efectos económicos, de inventario o numeración. Trazabilidad: `RN-FIS-005…010`, `RN-INV-016`, `RNF-INT-001`, `RNF-INT-009`.

#### Scenario: Configuración incompleta
- **WHEN** un usuario intenta confirmar una operación sin toda la configuración aplicable
- **THEN** el sistema SHALL rechazarla con un error corregible y SHALL NOT asignar número, modificar inventario ni crear saldo

#### Scenario: Configuración completa y no ambigua
- **WHEN** una operación válida encuentra una entidad, bodega, vigencia tributaria y serie únicas para su ámbito
- **THEN** el sistema SHALL permitir que la capacidad correspondiente continúe su confirmación

### Requirement: Auditoría de cambios de configuración

El sistema SHALL auditar cada creación, modificación, rechazo, cierre o sustitución relevante de entidades fiscales, vigencias tributarias, bodega y series. El registro SHALL conservar momento, usuario, acción, objetivo, resultado y campos modificados sin almacenar secretos ni permitir edición ordinaria. Trazabilidad: `RN-SEG-005`, `RF-ACC-009`, `RF-AUD-001…003`, `CU-003`, `RNF-AUD-001…005`.

#### Scenario: Cambio autorizado
- **WHEN** el Administrador modifica correctamente un parámetro permitido
- **THEN** el sistema SHALL registrar un evento de auditoría exitoso con el objetivo y los campos modificados

#### Scenario: Cambio rechazado
- **WHEN** el sistema rechaza un cambio por falta de permiso, solapamiento, duplicidad o protección histórica
- **THEN** el sistema SHALL conservar un evento de auditoría con el resultado rechazado y SHALL NOT registrar valores sensibles innecesarios

### Requirement: Idempotencia de comandos administrativos

Toda escritura administrativa basada en comando SHALL exigir una clave de idempotencia de 8 a 128 caracteres ASCII, formada por letras, dígitos, punto, guion, guion bajo o dos puntos. Su alcance SHALL ser el usuario actor y la acción. El sistema SHALL comparar una huella canónica de toda la entrada relevante y SHALL conservar el resultado sin caducidad automática en V1. Trazabilidad: `RNF-INT-003…005`, `RNF-INT-009`, `RF-AUD-006`.

#### Scenario: Repetición compatible de un comando
- **WHEN** el mismo actor repite la misma acción con igual clave e igual entrada
- **THEN** el sistema SHALL devolver el resultado persistido sin repetir efectos

#### Scenario: Reutilización incompatible de una clave
- **WHEN** el mismo actor y acción reutilizan una clave con una entrada diferente
- **THEN** el sistema SHALL responder conflicto y SHALL NOT ejecutar ni ocultar la nueva entrada

#### Scenario: Entrada que excede un límite contractual
- **WHEN** cualquier campo excede su longitud o precisión admitida
- **THEN** el sistema SHALL responder validación de campo sin truncar ni redondear y SHALL NOT persistir efectos parciales

### Requirement: Perfil fiscal adicional sin alterar la configuración operativa

El sistema SHALL permitir al Administrador completar por **entidad fiscal** razón social, RUC, nombre comercial opcional, dirección matriz y direcciones de establecimientos; régimen, obligación de llevar contabilidad y las condiciones aplicables de contribuyente especial, agente de retención, RIMPE y calificación artesanal. Las condiciones SHALL distinguir ausencia de información de no aplicabilidad y conservar fundamento, vigencia y responsable de su registro. SHALL NOT inferirse un beneficio por el tipo COMERCIAL/ARTESANAL ni consultar registros externos. La información adicional incompleta SHALL impedir declarar un perfil listo para preparación fiscal, sin bloquear operaciones internas que satisfagan su configuración actual. Trazabilidad: propuesta §1, P1/P2; DP-018/029; RN-FIS-001…010; RF-ACC-010/011; CU-003.

#### Scenario: Nuevo contribuyente aún no definido
- **DADO** un perfil sin régimen ni condiciones tributarias confirmadas por el responsable
- **CUANDO** el Administrador guarda su avance
- **ENTONCES** SHALL conservarse como incompleto con los campos pendientes, sin inventar datos, ni asignar automáticamente tarifa cero o tarifa general.

#### Scenario: Artesanal no equivale a beneficio comprobado
- **DADO** una entidad artesanal sin antecedentes de calificación
- **CUANDO** se evalúa su preparación fiscal
- **ENTONCES** SHALL indicarse la falta de fundamento cuando se pretenda aplicar el beneficio, sin marcarlo verificado ante el SRI.

#### Scenario: Usuario operativo intenta configurar otro emisor
- **DADO** un Vendedor sin rol Administrador
- **CUANDO** intenta modificar el régimen de cualquiera de las entidades
- **ENTONCES** SHALL denegarse sin modificar información ni revelar datos restringidos.

### Requirement: Establecimientos y puntos fiscales con vigencia e historia

El Administrador SHALL gestionar establecimientos y puntos de emisión por entidad, preservando códigos de tres dígitos ASCII y ceros iniciales; `000` SHALL rechazarse para ambos. Los ambientes de pruebas y producción SHALL identificarse separadamente. SHALL impedirse duplicar un establecimiento dentro de una entidad o un punto dentro del establecimiento; una dirección de establecimiento será obligatoria para preparación. Un ámbito usado SHALL conservar identidad e historia y deshabilitarse prospectivamente, nunca reasignarse a otro RUC ni renombrarse para reutilizar números. Los códigos no prueban registro ante el SRI. Trazabilidad: propuesta §1/2, P4; DP-006/018; RN-FIS-008; RF-ACC-012; ficha técnica SRI, tabla 1.

#### Scenario: Códigos con ceros iniciales
- **DADO** un establecimiento `001` de una entidad
- **CUANDO** se registra su punto `002`
- **ENTONCES** SHALL conservarse `001-002` sin convertirlo en `1-2` ni compartir su configuración con la otra entidad.

#### Scenario: Alta duplicada concurrente
- **DADO** un punto que no existe todavía en un establecimiento
- **CUANDO** dos administradores intentan crearlo simultáneamente
- **ENTONCES** SHALL existir un único punto y el otro intento SHALL informar el conflicto sin datos parciales.

#### Scenario: Deshabilitar un punto utilizado
- **DADO** un punto con documentos de prueba o evidencias archivadas
- **CUANDO** se deshabilita
- **ENTONCES** SHALL bloquearse su uso en nuevas preparaciones y conservarse la consulta de sus documentos anteriores.

### Requirement: Metadatos de certificado sin custodia de firma

El sistema SHALL permitir al Administrador registrar titular, entidad certificadora, referencia del certificado, inicio y fin de vigencia declarados y procedencia de esos datos. SHALL exigir fin posterior a inicio y mostrar vigente por fechas, futuro o vencido como evaluación local, sin afirmar comprobación criptográfica o ausencia de revocación. SHALL NOT aceptar archivos P12/PFX, claves privadas o contraseñas ni usarlos para firmar. La falta o caducidad SHALL quedar visible como impedimento para la futura emisión, sin impedir preparar borradores o archivar documentos existentes. Trazabilidad: propuesta P3; RN-SEG-005/007; DP-018.

#### Scenario: Certificado vencido
- **DADO** un certificado cuya fecha final ya pasó
- **CUANDO** se consulta la preparación del emisor
- **ENTONCES** SHALL mostrarse vencido por fechas y la necesidad de renovación, sin afirmar que se consultó al certificador.

#### Scenario: Intento de cargar la firma
- **DADO** un Administrador
- **CUANDO** intenta adjuntar un P12 o una contraseña a los metadatos
- **ENTONCES** SHALL rechazarse sin conservar el secreto ni reproducirlo en auditoría.

### Requirement: Correspondencias tributarias explícitas y versionadas

El sistema SHALL mantener un catálogo oficial de referencia con fuente, versión y vigencia, y permitir al Administrador asociar cada definición tributaria interna usada para preparación con impuesto, tratamiento y código de porcentaje del SRI. SHALL diferenciar tarifa cero, no objeto y exento aunque su resultado monetario coincida. Para IVA se reconocerán los códigos oficiales 0, 6 y 7 respectivamente; un código de tarifa porcentual SHALL concordar con su porcentaje. Una correspondencia no determina por sí misma que el beneficio sea legalmente aplicable. SHALL rechazarse ausencia, contradicción o solapamiento de correspondencias para una fecha; cambiar el catálogo SHALL NOT reinterpretar instantáneas ya preparadas. Combinaciones tributarias no soportadas SHALL bloquear la preparación indicando el motivo, sin omitirse ni transformarse en IVA. Trazabilidad: propuesta §3; DP-017/025; RN-FIS-010; RN-CON-001/002; RF-ACC-011; ficha técnica SRI, tablas de impuestos.

#### Scenario: Tres tratamientos con impuesto cero
- **DADO** tres definiciones con tarifa cero, no objeto y exento
- **CUANDO** se prepara un documento con esas líneas
- **ENTONCES** SHALL conservarse la clasificación y agrupación independiente de cada tratamiento.

#### Scenario: Porcentaje incompatible
- **DADO** una definición con una tarifa distinta de la representada por el código oficial seleccionado
- **CUANDO** se intenta habilitar su correspondencia
- **ENTONCES** SHALL rechazarse sin cambiar la tarifa interna ni redondearla para hacerla coincidir.

#### Scenario: Actualización posterior del catálogo
- **DADO** una preparación que conserva la versión usada del catálogo
- **CUANDO** se publica otra correspondencia prospectiva
- **ENTONCES** SHALL conservarse el documento previo y usarse la nueva versión solo para preparaciones a las que corresponda.

### Requirement: Correspondencia fiscal de las formas de pago

La preparación SHALL distinguir la **forma de pago** declarada para el comprobante de los cobros efectivos internos. El catálogo inicial SHALL relacionar efectivo con código SRI `01` y transferencia con `20`, conservar versión y fuente y no habilitar otros medios de cobro internos. **Crédito** SHALL seguir siendo una condición, nunca un código de medio; los datos fiscales adicionales de plazo y unidad, si son exigibles para el caso, SHALL señalarse como pendientes sin inventar vencimientos ni crear planes de deuda. La declaración de formas e importes prevista para el comprobante SHALL cubrir su total; pagos parciales registrados SHALL NOT presentarse como la totalidad de las condiciones del documento. Trazabilidad: propuesta §3; DP-003/013/027; RF-ACC-014; ficha técnica SRI, tabla de formas de pago.

#### Scenario: Pago combinado declarado
- **DADO** una operación de USD 100 y una declaración fiscal de USD 40 en efectivo y USD 60 por transferencia
- **CUANDO** se valida la preparación
- **ENTONCES** SHALL conservarse el desglose con códigos `01` y `20`, sin registrar cobros nuevos.

#### Scenario: Crédito pendiente de datos fiscales
- **DADO** una venta a crédito sin datos suficientes para las condiciones fiscales elegidas
- **CUANDO** se solicita declararla preparada
- **ENTONCES** SHALL indicarse qué dato falta, sin usar CREDITO como código SRI, ni inventar pago o vencimiento comercial.

Fuentes normativas: [ficha y catálogos oficiales](https://www.sri.gob.ec/facturacion-electronica). Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).

