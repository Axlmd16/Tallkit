## ADDED Requirements

### Requirement: Acceso administrativo a la configuración

El sistema SHALL permitir consultar y modificar la configuración operativa y fiscal únicamente a un **Administrador** autenticado con los permisos efectivos `entidades_fiscales.ver`, `entidades_fiscales.editar` o `parametros.gestionar`, según la acción. Ocultar una acción en la interfaz SHALL NOT sustituir la autorización del backend. Trazabilidad: `CT-001`, `RN-SEG-002…007`, `RF-ACC-008`, `RF-ACC-010…012`, `CU-003`, `UI-014…016`, `RNF-SEG-002…003`.

#### Scenario: Administrador consulta la configuración
- **WHEN** un Administrador autenticado consulta las entidades fiscales, impuestos, bodega o series
- **THEN** el sistema SHALL devolver únicamente la configuración solicitada dentro de sus permisos

#### Scenario: Usuario sin permiso intenta modificar un parámetro
- **WHEN** un Vendedor, un Encargado del taller o cualquier usuario sin el permiso requerido intenta modificar la configuración
- **THEN** el sistema SHALL denegar la acción y SHALL NOT cambiar ningún dato

### Requirement: Dos entidades fiscales obligatorias y diferenciadas

El sistema SHALL mantener exactamente dos **entidades fiscales**: una de tipo **RUC comercial** y otra de tipo **RUC artesanal**. Cada entidad SHALL tener un RUC único de 13 caracteres, razón social obligatoria y datos de identificación opcionales; su tipo SHALL NOT cambiar después de creada. Trazabilidad: `CT-001`, `RN-FIS-001…005`, `RF-ACC-010`, `CU-003`.

#### Scenario: Configuración inicial válida
- **WHEN** el Administrador registra RUC distintos y razones sociales para las entidades comercial y artesanal
- **THEN** el sistema SHALL conservar exactamente una entidad de cada tipo y SHALL mantenerlas disponibles para su ámbito operativo

#### Scenario: RUC inválido o repetido
- **WHEN** el Administrador intenta guardar un RUC que no tiene 13 caracteres o que ya pertenece a la otra entidad fiscal
- **THEN** el sistema SHALL rechazar la configuración y SHALL indicar el campo que debe corregirse

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

El sistema SHALL permitir al Administrador registrar uno o más **impuestos**, incluido IVA, para cada entidad fiscal mediante código, nombre, tarifa decimal, fecha de inicio y fecha de fin opcional. La tarifa SHALL estar entre 0 y 100 inclusive y el sistema SHALL NOT incorporar una tasa legal predeterminada no validada por el responsable del negocio. Trazabilidad: `RN-FIS-010`, `RN-CON-001`, `RF-ACC-011`, `CU-003`.

#### Scenario: Registro de una tarifa validada
- **WHEN** el Administrador registra para una entidad fiscal una tarifa válida con fecha de inicio
- **THEN** el sistema SHALL conservarla como una vigencia tributaria aplicable a esa entidad desde la fecha indicada

#### Scenario: Tarifa cero
- **WHEN** el Administrador registra una tarifa de 0 para un impuesto cuya aplicación fue validada por el negocio
- **THEN** el sistema SHALL aceptar la tarifa sin sustituirla por otro valor

#### Scenario: Tarifa fuera del intervalo permitido
- **WHEN** el Administrador intenta registrar una tarifa menor que 0 o mayor que 100
- **THEN** el sistema SHALL rechazarla y SHALL NOT crear la vigencia

### Requirement: Vigencias tributarias no ambiguas

Para una misma entidad fiscal y código de impuesto, el sistema SHALL impedir períodos de vigencia solapados. La configuración aplicable SHALL resolverse por la fecha operativa en la zona `America/Guayaquil`; si no existe una única vigencia aplicable, una operación económica dependiente SHALL fallar sin efectos parciales. Trazabilidad: `RN-FIS-010`, `RN-CON-001`, `RF-ACC-011`, `CU-003`, `RNF-INT-001`, `RNF-INT-008…009`.

#### Scenario: Solapamiento de vigencias
- **WHEN** el Administrador intenta registrar un período que se solapa con otra vigencia del mismo impuesto y entidad fiscal
- **THEN** el sistema SHALL rechazarlo y SHALL mostrar los períodos en conflicto

#### Scenario: Cambio futuro de tarifa
- **WHEN** el Administrador registra una nueva tarifa con inicio posterior al período vigente
- **THEN** el sistema SHALL permitir cerrar el período anterior sin alterar operaciones confirmadas y SHALL aplicar la nueva tarifa desde su fecha de inicio

#### Scenario: Ausencia de tarifa aplicable
- **WHEN** una operación económica intenta confirmarse en una fecha para la que no existe una única vigencia aplicable
- **THEN** el sistema SHALL rechazar la confirmación y SHALL NOT asignar secuencial, crear saldo ni afectar inventario

### Requirement: Configuración tributaria histórica inmutable

Una vigencia tributaria utilizada por al menos una operación confirmada SHALL NOT poder editarse ni eliminarse. Toda corrección SHALL crear una nueva vigencia sin recalcular bases, tarifas, impuestos o totales históricos. Trazabilidad: `DP-017`, `RN-CON-001…002`, `RF-ACC-011`, `RF-VEN-004`.

#### Scenario: Intento de editar una tarifa utilizada
- **WHEN** el Administrador intenta cambiar la tarifa o las fechas de una vigencia ya utilizada
- **THEN** el sistema SHALL rechazar la edición y SHALL orientar a crear una nueva vigencia

#### Scenario: Cambio de tarifa sin efecto retroactivo
- **WHEN** entra en vigor una nueva tarifa
- **THEN** las operaciones confirmadas anteriormente SHALL conservar su tarifa y desglose históricos

### Requirement: Bodega única de V1

El sistema SHALL crear y mantener una única **bodega** operativa para V1, identificada inicialmente como “Bodega principal”. El Administrador SHALL poder actualizar sus datos descriptivos, pero SHALL NOT poder crear una segunda bodega, eliminar la existente ni dejar al sistema sin una bodega activa. Trazabilidad: `DP-001`, `RN-INV-016`, `RF-INV-013`, `UI-017`.

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

El sistema SHALL crear las series internas `COM-ING`, `COM-PRO`, `COM-VEN` y `ART-SER`, asociadas respectivamente a ingresos de mercadería, proformas, ventas de repuestos y operaciones económicas de servicios. Cada serie SHALL pertenecer a una sola entidad fiscal y tipo de documento, y su primer **secuencial** asignable SHALL ser `000001`. Trazabilidad: aprobación de `DP-006` para este cambio, `RN-FIS-008`, `RN-VEN-018`, `RF-ACC-012`, `RF-INV-004`, `RF-VEN-006`, `RF-TAL-008`.

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
