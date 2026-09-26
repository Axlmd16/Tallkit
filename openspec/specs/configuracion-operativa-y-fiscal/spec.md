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

El sistema SHALL permitir al Administrador completar por **entidad fiscal** razón social, RUC, nombre comercial opcional, dirección matriz y direcciones de establecimientos. También SHALL permitirle declarar régimen, obligación de llevar contabilidad y las condiciones aplicables de contribuyente especial, agente de retención, RIMPE y calificación artesanal. Cada condición SHALL tener ayuda contextual que explique su significado y que se declara con base en el certificado de RUC y la documentación vigente.

Las condiciones SHALL distinguir la ausencia de información de la no aplicabilidad, y conservar fundamento, vigencia y responsable de su registro. SHALL NOT inferirse una condición o beneficio por el tipo COMERCIAL/ARTESANAL, por textos como «artesano calificado» ni por consulta a registros externos.

El perfil SHALL mostrar uno de estos estados, siempre con su causa en texto y nunca solo con color o etiqueta:

- *Sin configurar*: no existe un perfil guardado. SHALL mostrarse en lugar de un número de revisión cero.
- *Falta completar*: faltan datos necesarios para preparar.
- *Lista para preparación local*: contiene lo necesario para preparar en ambiente de pruebas.
- *Requiere revisión*: una condición tributaria o correspondencia necesaria está fuera de vigencia.

Ningún estado SHALL afirmar validación, habilitación o declaración ante el SRI. El certificado opcional SHALL NOT afectar el estado. La información incompleta SHALL impedir preparar, sin bloquear operaciones internas que satisfagan su configuración actual. Antes de una emisión en producción, la configuración deberá revisarla el responsable tributario; esta capacidad no realiza esa habilitación.

Trazabilidad: propuesta §1, P1/P2; propuesta de simplificación B7, R4; DP-018/029; RN-FIS-001…010; RF-ACC-010/011; CU-003.

#### Scenario: Nuevo contribuyente aún no definido
- **DADO** un perfil sin régimen ni condiciones tributarias confirmadas por el responsable
- **CUANDO** el Administrador guarda su avance
- **ENTONCES** SHALL conservarse en estado *Falta completar* con los campos pendientes, sin inventar datos ni asignar automáticamente tarifa cero o tarifa general.

#### Scenario: Entidad sin perfil guardado
- **DADO** una entidad fiscal que nunca guardó perfil electrónico
- **CUANDO** el Administrador consulta la facturación electrónica
- **ENTONCES** SHALL verse «Sin configurar» con la explicación de que aún no existe configuración guardada, sin mostrar «Revisión 0».

#### Scenario: Perfil listo sin certificado
- **DADO** un perfil con condiciones, establecimiento, punto predeterminado y correspondencias vigentes, pero sin metadatos de certificado
- **CUANDO** se evalúa su estado
- **ENTONCES** SHALL mostrarse *Lista para preparación local* y, por separado, una advertencia de certificado sin declarar.

#### Scenario: Condición vencida
- **DADO** un perfil listo cuya condición RIMPE declarada terminó su vigencia ayer
- **CUANDO** se consulta su estado
- **ENTONCES** SHALL mostrarse *Requiere revisión* identificando la condición y su fecha de fin.

#### Scenario: Artesanal no equivale a beneficio comprobado
- **DADO** una entidad artesanal sin antecedentes de calificación
- **CUANDO** se evalúa su preparación fiscal
- **ENTONCES** SHALL indicarse la falta de fundamento cuando se pretenda aplicar el beneficio, sin marcarlo verificado ante el SRI.

#### Scenario: Usuario operativo intenta configurar otro emisor
- **DADO** un Vendedor sin rol Administrador
- **CUANDO** intenta modificar el régimen de cualquiera de las entidades
- **ENTONCES** SHALL denegarse sin modificar información ni revelar datos restringidos.

### Requirement: Establecimientos y puntos fiscales con vigencia e historia

El Administrador SHALL gestionar establecimientos y puntos de emisión por entidad, preservando códigos de tres dígitos ASCII y ceros iniciales; `000` SHALL rechazarse para ambos. SHALL impedirse duplicar un establecimiento dentro de una entidad o un punto dentro de su establecimiento. La dirección del establecimiento será obligatoria para preparar. Un ámbito usado SHALL conservar identidad e historia y deshabilitarse prospectivamente; nunca SHALL reasignarse a otro RUC ni renombrarse para reutilizar números. Los códigos no prueban registro ante el SRI.

Una entidad puede tener varios puntos activos, pero SHALL existir un **punto predeterminado** para preparar:

- si hay un único punto activo en un establecimiento activo, SHALL usarse automáticamente;
- si hay varios, el Administrador SHALL designar uno;
- sin designación determinable, la preparación SHALL bloquearse con un impedimento dirigido al Administrador.

El punto predeterminado SHALL pertenecer a la misma entidad y estar activo. Designarlo SHALL NOT afectar preparaciones completadas.

El único ambiente disponible SHALL ser *Pruebas*. La configuración SHALL mostrarlo como estado actual y explicar que la emisión real todavía no está disponible. SHALL rechazarse todo intento de configurar o preparar en producción mientras no exista un cambio aprobado para firma, emisión y transmisión.

Trazabilidad: propuesta §1/2, P4; propuesta de simplificación B8/B12, R1/R2; DP-006/018; RN-FIS-008; RF-ACC-012; ficha técnica SRI, tabla 1.

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

#### Scenario: Único punto activo
- **DADO** una entidad con un solo punto activo `001-001` y ninguna designación
- **CUANDO** se prepara una operación de esa entidad
- **ENTONCES** SHALL usarse `001-001` sin pedir selección.

#### Scenario: Varios puntos sin designación
- **DADO** una entidad con los puntos activos `001-001` y `001-002` y ninguno designado
- **CUANDO** se revisa una preparación
- **ENTONCES** SHALL bloquearse con un impedimento que indique al Administrador designar el punto predeterminado.

#### Scenario: Designar un punto de otra entidad
- **DADO** un punto de la entidad comercial
- **CUANDO** el Administrador intenta designarlo como predeterminado de la entidad artesanal
- **ENTONCES** SHALL rechazarse sin modificar ninguna designación.

#### Scenario: Deshabilitar el punto predeterminado
- **DADO** un punto designado como predeterminado
- **CUANDO** el Administrador lo deshabilita
- **ENTONCES** la designación SHALL dejar de ser utilizable y las revisiones nuevas SHALL mostrar el impedimento o usar el único punto activo restante.

#### Scenario: Intento de configurar producción
- **DADO** un Administrador
- **CUANDO** intenta habilitar o seleccionar el ambiente de producción para una entidad
- **ENTONCES** SHALL rechazarse explicando que la emisión real no está habilitada, sin cambiar la configuración.

### Requirement: Metadatos de certificado sin custodia de firma

El sistema SHALL permitir al Administrador registrar, de forma opcional, los metadatos del certificado de firma electrónica que podría usarse en una emisión futura. Cada campo SHALL tener nombre y ayuda contextual comprensibles:

- referencia o identificador;
- titular;
- entidad emisora del certificado;
- fuente de la información;
- fecha de inicio;
- fecha de vencimiento.

La interfaz SHALL explicar que estos metadatos no equivalen a firma, autorización ni capacidad de emitir. SHALL permitirse dejarlos vacíos. Si se informan fechas, SHALL exigirse vencimiento posterior al inicio y mostrarse vigente por fechas, futuro o vencido como evaluación local, sin afirmar comprobación criptográfica o ausencia de revocación.

SHALL NOT aceptarse archivos P12/PFX, claves privadas ni contraseñas, ni usarse para firmar. La falta o el vencimiento SHALL mostrarse como advertencia independiente para la futura emisión. SHALL NOT cambiar el estado del perfil, bloquear la preparación local ni impedir archivar documentos existentes. El formulario SHALL mostrarse solo al Administrador.

Trazabilidad: propuesta P3; propuesta de simplificación B11, R4; RN-SEG-005/007; DP-018.

#### Scenario: Certificado vencido
- **DADO** un certificado cuya fecha de vencimiento ya pasó
- **CUANDO** se consulta la configuración del emisor
- **ENTONCES** SHALL mostrarse vencido por fechas como advertencia, sin afirmar que se consultó al certificador y sin cambiar el estado *Lista para preparación local*.

#### Scenario: Certificado sin declarar
- **DADO** un perfil listo sin metadatos de certificado
- **CUANDO** un Vendedor prepara una venta de esa entidad
- **ENTONCES** la preparación local SHALL completarse sin impedimento por certificado.

#### Scenario: Intento de cargar la firma
- **DADO** un Administrador
- **CUANDO** intenta adjuntar un P12 o una contraseña a los metadatos
- **ENTONCES** SHALL rechazarse sin conservar el secreto ni reproducirlo en auditoría.

### Requirement: Correspondencias tributarias explícitas y versionadas

El sistema SHALL mantener catálogos oficiales de impuestos y tarifas como datos versionados. Cada entrada SHALL conservar código, descripción oficial, fuente, versión del catálogo o de la ficha técnica, fecha de vigencia, estado activo o inactivo y fecha de incorporación al sistema. Los códigos y tarifas SHALL NOT fijarse permanentemente en el código de la aplicación ni escribirse libremente.

El Administrador SHALL asociar cada definición tributaria interna usada para preparar con una entrada del catálogo, elegida por su nombre comprensible (por ejemplo IVA 0 %, IVA 15 %, no objeto de IVA, exento). El código oficial SHALL mostrarse solo como información avanzada. El campo «Fundamento» SHALL explicarse como «Fuente o referencia que justifica esta correspondencia tributaria».

La presentación del formulario SHALL seguir estas reglas:

- si la entidad no tiene definiciones tributarias, SHALL mostrarse «Primero debe configurarse el catálogo tributario de esta entidad»;
- si solo existe una definición interna, SHALL presentarse como dato fijo y no como selector;
- las correspondencias vigentes e históricas SHALL listarse.

SHALL diferenciarse tarifa cero, no objeto y exento aunque su resultado monetario coincida. El código de tarifa porcentual SHALL concordar con su porcentaje. Una correspondencia no determina por sí misma que el beneficio sea legalmente aplicable. SHALL rechazarse la ausencia, contradicción o solapamiento de correspondencias para una fecha.

Actualizar o desactivar una entrada de catálogo SHALL NOT modificar preparaciones completadas. Las combinaciones tributarias no soportadas SHALL bloquear la preparación indicando el motivo, sin omitirse ni transformarse en IVA. La fuente primaria SHALL ser la ficha técnica vigente del SRI. Cada entrada incorporada SHALL identificar la versión exacta de la ficha, la fecha de descarga y el archivo o manifiesto utilizado. Esta spec y los documentos de proveedores SHALL NOT constituir la fuente de los códigos, descripciones o tarifas.

Trazabilidad: propuesta §3; propuesta de simplificación B9, fuentes y vigencia; DP-017/025; RN-FIS-010; RN-CON-001/002; RF-ACC-011; ficha técnica SRI, tablas de impuestos.

#### Scenario: Tres tratamientos con impuesto cero
- **DADO** tres definiciones con tarifa cero, no objeto y exento
- **CUANDO** se prepara un documento con esas líneas
- **ENTONCES** SHALL conservarse la clasificación y agrupación independiente de cada tratamiento.

#### Scenario: Porcentaje incompatible
- **DADO** una definición con una tarifa distinta de la representada por la entrada oficial seleccionada
- **CUANDO** se intenta habilitar su correspondencia
- **ENTONCES** SHALL rechazarse sin cambiar la tarifa interna ni redondearla para hacerla coincidir.

#### Scenario: Actualización posterior del catálogo
- **DADO** una preparación que conserva la versión usada del catálogo
- **CUANDO** se incorpora otra versión o se desactiva una entrada
- **ENTONCES** SHALL conservarse el documento previo y usarse la nueva versión solo para preparaciones a las que corresponda.

#### Scenario: Selección por nombre comprensible
- **DADO** un Administrador que registra la correspondencia de una definición del 15 %
- **CUANDO** abre el selector del catálogo
- **ENTONCES** SHALL ver «IVA 15 %» con su vigencia y fuente, y el código oficial solo en la información avanzada, sin campo de texto libre para el código.

#### Scenario: Entidad sin definiciones tributarias
- **DADO** una entidad sin definiciones tributarias internas
- **CUANDO** el Administrador abre «Impuestos y catálogo SRI»
- **ENTONCES** SHALL mostrarse «Primero debe configurarse el catálogo tributario de esta entidad» sin formulario de correspondencia.

### Requirement: Correspondencia fiscal de las formas de pago

La preparación SHALL distinguir la **forma de pago** declarada para el comprobante de los cobros efectivos internos. El catálogo oficial de formas de pago SHALL tener la estructura de la Tabla 24 del SRI. El catálogo inicial SHALL contemplar las ocho formas siguientes:

| Código | Descripción de referencia |
|---|---|
| 01 | Sin utilización del sistema financiero |
| 15 | Compensación de deudas |
| 16 | Tarjeta de débito |
| 17 | Dinero electrónico |
| 18 | Tarjeta prepago |
| 19 | Tarjeta de crédito |
| 20 | Otros con utilización del sistema financiero |
| 21 | Endoso de títulos |

Esta spec no es la fuente oficial del catálogo. Los códigos, descripciones y vigencias que se incorporen SHALL provenir de la ficha técnica vigente del SRI y conservar, con cada entrada:

- la versión exacta de la ficha;
- la fecha de descarga;
- el archivo o manifiesto utilizado;
- la vigencia, el estado y la fecha de incorporación.

Si la ficha vigente difiere de la tabla anterior en descripciones, vigencias o códigos, SHALL prevalecer la ficha y registrarse la diferencia. Descripciones y vigencias SHALL NOT considerarse cerradas hasta cargarse desde esa fuente.

El Administrador SHALL consultar el catálogo completo con código, descripción, fuente, versión, vigencia y estado de habilitación por entidad. En V1 solo SHALL poder habilitarse `01`, asociada a efectivo o pago sin sistema financiero, y `20`, asociada a transferencia. Las demás, incluidas las tarjetas `16` y `19`, SHALL permanecer visibles y deshabilitadas. Habilitarlas requiere otra decisión que actualice pagos, caja, cierres, reportes y conciliación. Esta capacidad SHALL NOT crear medios internos de cobro.

Cada entidad SHALL tener una **forma de pago predeterminada** entre sus formas habilitadas, designada por el Administrador e inicialmente `01`, que la preparación sugiere cuando no hay cobros que cubran el total. Deshabilitar la forma predeterminada SHALL exigir designar otra habilitada.

**Crédito** y contado SHALL seguir siendo condiciones internas y nunca un código de la Tabla 24. La declaración SHALL admitir una o varias formas habilitadas cuyos importes sumen exactamente el total del comprobante. En esta fase SHALL NOT capturarse plazo ni unidad de tiempo, SHALL NOT inventarse vencimientos ni crearse planes de deuda, y la preparación local SHALL NOT bloquearse por la condición de crédito. La representación de un plazo real para la emisión electrónica queda pendiente de una spec futura. Los pagos parciales registrados SHALL NOT presentarse como la totalidad de las condiciones del documento.

Trazabilidad: propuesta §3; propuesta de simplificación B10, R3/R6; DP-003/013/019/027; RF-ACC-014; ficha técnica SRI vigente, Tabla 24.

#### Scenario: Pago combinado declarado
- **DADO** una operación de USD 100 y una declaración fiscal de USD 40 en efectivo y USD 60 por transferencia
- **CUANDO** se valida la preparación
- **ENTONCES** SHALL conservarse el desglose con códigos `01` y `20`, sin registrar cobros nuevos.

#### Scenario: Crédito sin plazo
- **DADO** una venta a crédito
- **CUANDO** se declara su forma de pago prevista y se solicita completar la preparación
- **ENTONCES** SHALL admitirse sin plazo ni unidad, sin usar CREDITO como código SRI ni inventar pago o vencimiento comercial.

#### Scenario: Catálogo completo visible
- **DADO** un Administrador en «Formas de pago SRI»
- **CUANDO** consulta el catálogo
- **ENTONCES** SHALL ver las formas incorporadas con descripción, fuente, versión de la ficha, fecha de descarga y vigencia, con `01` y `20` habilitadas y las demás deshabilitadas.

#### Scenario: Catálogo sin fuente
- **DADO** una entrada de forma de pago sin versión de ficha, fecha de descarga o archivo de origen
- **CUANDO** se intenta incorporar al catálogo
- **ENTONCES** SHALL rechazarse sin crear la entrada.

#### Scenario: Intento de habilitar tarjeta de crédito
- **DADO** la forma `19` deshabilitada
- **CUANDO** un Administrador intenta habilitarla en V1
- **ENTONCES** SHALL rechazarse explicando que requiere una decisión que incorpore ese medio a cobros, caja y cierres.

#### Scenario: Deshabilitar la forma predeterminada
- **DADO** una entidad con `01` y `20` habilitadas y `01` como predeterminada
- **CUANDO** el Administrador intenta deshabilitar `01` sin designar otra
- **ENTONCES** SHALL rechazarse indicando que primero debe designarse otra forma predeterminada habilitada.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).

