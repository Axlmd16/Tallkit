## ADDED Requirements

<!-- Specs para revisión. Proposal aprobado y registrado en master en c17ad64. GIVEN/WHEN/THEN corresponden a Dado/Cuando/Entonces. Las tarifas de los ejemplos son datos de prueba, no tasas legales predeterminadas. -->

### Requirement: Autorización de compras por operación

El sistema SHALL reservar al Administrador la consulta de **ingresos de mercadería** mediante `ingresos.ver`, creación y edición mediante `ingresos.crear`, confirmación mediante `ingresos.confirmar` y anulación mediante `ingresos.anular`. SHALL comprobar sesión vigente, usuario activo y unión de roles en cada solicitud, incluida la consulta directa. Los roles operativos sin Administrador SHALL NOT recibir compras, proveedores, costos, impuestos o totales de compra. Trazabilidad: CT-001; RN-SEG-001…007; actores-y-roles §3.3; autorizacion-y-navegacion; proposal.

#### Scenario: Administrador opera con su permiso
- **GIVEN** un Administrador autenticado
- **WHEN** solicita una operación de compras válida
- **THEN** SHALL permitirse continuar conforme al permiso específico y al estado del documento

#### Scenario: Acceso directo de roles operativos
- **GIVEN** un Vendedor o Encargado del taller sin Administrador
- **WHEN** intenta consultar, crear, modificar, confirmar o anular una compra directamente
- **THEN** SHALL denegarse sin revelar contenido protegido ni producir cambios

#### Scenario: Unión de roles y sesión invalidada
- **GIVEN** un usuario con Administrador y Vendedor cuya sesión se invalida al retirarle Administrador
- **WHEN** intenta continuar una compra con esa sesión
- **THEN** SHALL exigirse autenticación de nuevo y aplicarse únicamente los permisos vigentes

### Requirement: Borradores de recepción completa

Una compra SHALL representarse como un **ingreso de mercadería** con identidad estable y estados borrador, confirmado y anulado. El borrador SHALL conservar proveedor seleccionado, fecha del documento, tipo y referencia externa, observación opcional y líneas con producto, cantidad, costo unitario sin impuesto, selección tributaria y recuperabilidad. SHALL poder guardarse sin líneas para continuar después, pero una línea guardada SHALL ser válida. Crear o editar un borrador SHALL NOT modificar existencias, costos, usos fiscales confirmados ni numeración. Solo borrador → confirmado y confirmado → anulado SHALL producir transiciones, mediante acciones explícitas; no se admite editar genéricamente el estado ni eliminar historia. Trazabilidad: RF-INV-001/002; RN-INV-004/011; modelo-dominio §7; CU-007; proposal.

#### Scenario: Guardar y retomar un borrador
- **GIVEN** una compra nueva con proveedor activo y fecha válida, sin líneas
- **WHEN** el Administrador la guarda y vuelve a abrirla
- **THEN** SHALL recuperar la misma identidad en borrador, sin número definitivo ni cambios de stock o valoración

#### Scenario: Agregar y retirar líneas
- **GIVEN** un borrador con líneas válidas
- **WHEN** el Administrador agrega una línea o retira otra y guarda
- **THEN** SHALL persistir el contenido revisado y recalcular sus totales sin efectos de inventario

#### Scenario: Edición simultánea del borrador
- **GIVEN** dos usuarios trabajando sobre la misma versión del borrador
- **WHEN** ambos guardan modificaciones incompatibles
- **THEN** SHALL conservarse una modificación y rechazarse la desactualizada con conflicto, sin sobrescribir cambios inadvertidamente

#### Scenario: Manipulación de estado o borrado
- **GIVEN** una compra existente
- **WHEN** se intenta cambiar su estado por edición ordinaria o eliminar su historia
- **THEN** SHALL rechazarse la operación y conservarse el documento

### Requirement: Productos y proveedores confirmables

Guardar una selección nueva SHALL exigir proveedor y productos activos del catálogo existente. Confirmar SHALL revalidar proveedor activo, al menos una línea válida y todos sus productos activos. Un **servicio** SHALL NOT utilizarse como producto inventariable. Un proveedor ocasional con solo nombre SHALL ser válido conforme a DP-011. Las referencias inactivas ya guardadas SHALL permanecer legibles, pero SHALL impedir confirmar mientras el proveedor o producto permanezca inactivo. Las bajas de auxiliares SHALL respetar el contrato del catálogo sin desactivar productos en cascada. Trazabilidad: DP-009/010/011; RN-CAT-010/011; RF-INV-002/014; specs activas de productos y proveedores; CU-007.

#### Scenario: Proveedor ocasional registrado
- **GIVEN** un proveedor activo con nombre, sin identificación ni contacto
- **WHEN** se confirma un ingreso con productos activos y datos válidos
- **THEN** SHALL aceptarse sin exigir proveedor genérico ni información no obligatoria

#### Scenario: Producto desactivado después de guardar
- **GIVEN** una línea cuyo producto fue desactivado tras guardar el borrador
- **WHEN** se solicita confirmar
- **THEN** SHALL rechazarse la compra completa indicando la línea y sin asignar número ni generar entradas

#### Scenario: Proveedor desactivado después de guardar
- **GIVEN** un borrador cuyo proveedor se desactivó
- **WHEN** se solicita confirmar
- **THEN** SHALL rechazarse sin efectos, conservando el borrador y la referencia histórica legible

#### Scenario: Selección de un servicio
- **GIVEN** un servicio artesanal existente
- **WHEN** se intenta incorporarlo como producto de una compra
- **THEN** SHALL rechazarse la línea sin producir inventario de servicios

#### Scenario: Baja concurrente y confirmación
- **GIVEN** una confirmación y una desactivación simultáneas del mismo proveedor o producto
- **WHEN** ambas se procesan
- **THEN** SHALL obtenerse un resultado equivalente a un orden completo: confirmar antes de la baja o rechazar después de ella, sin recepción parcial

### Requirement: Cantidades de presentaciones y costos de compra

Las cantidades SHALL ser decimales de valor entero positivo de **presentaciones** completas, sin fraccionar envases, convertir unidades ni confundir contenido con unidades recibidas. El costo unitario SHALL ser USD no negativo con hasta seis decimales, distinto del precio de venta. SHALL rechazarse precisión excedida, valores no finitos, negativos y cantidades cero o fraccionarias sin truncarlos. Cada línea conservará su propio costo y tratamiento; varias líneas del mismo producto SHALL contabilizarse conjuntamente al confirmar, conservando el detalle original. Trazabilidad: DP-009/010/017; RN-CAT-007/011; RN-INV-015; RF-INV-002/014; RNF-INT-006/007; proposal recomendaciones 1/2.

#### Scenario: Presentación de medio galón
- **GIVEN** un producto cuyo contenido es 0.5 galones
- **WHEN** se reciben 3 presentaciones cerradas
- **THEN** SHALL aumentar su existencia en 3 unidades del producto, conservando 0.5 galones como contenido de cada presentación

#### Scenario: Fracción o precisión excedida
- **GIVEN** un borrador
- **WHEN** se envía cantidad 0, 1.5, costo negativo o costo con siete decimales
- **THEN** SHALL rechazarse el campo correspondiente sin redondear la entrada ni guardar parcialmente

#### Scenario: Costo cero explícito
- **GIVEN** una línea válida con costo unitario 0 y cantidad positiva
- **WHEN** se confirma la compra
- **THEN** SHALL aceptarse el costo cero explícito, conservarse la cantidad y no sustituirse por el precio de venta

#### Scenario: Producto repetido en líneas distintas
- **GIVEN** dos líneas del mismo producto con cantidades 2 y 3 y costos diferentes
- **WHEN** se confirma la compra
- **THEN** SHALL recibirse un total de 5 unidades y conservarse el valor inventariable conjunto y la trazabilidad de ambas líneas sin duplicar efectos

### Requirement: Impuestos de compra y totales históricos

Cada línea SHALL seleccionar una definición tributaria comercial, sugerida desde el producto pero explícitamente revisable antes de confirmar, y clasificar su impuesto como recuperable o no recuperable. SHALL NOT inferirse recuperabilidad del proveedor, RUC o tarifa ni admitirse recuperación parcial en esta entrega. La base de línea SHALL ser cantidad × costo unitario sin impuesto, redondeada a centavos HALF_UP; el impuesto SHALL calcularse sobre esa base redondeada por la tarifa aplicable y redondearse a centavos HALF_UP. Total de línea SHALL ser base + impuesto, y totales del documento SHALL sumar las líneas ya redondeadas. Valor inventariable de línea SHALL ser base más impuesto no recuperable; el recuperable SHALL excluirse. Todos los cálculos SHALL realizarse con decimales en el backend; importes derivados enviados por el cliente SHALL NOT sustituirlos. Trazabilidad: DP-017; RN-CON-001/002; RNF-INT-006; propuesta aprobada recomendaciones 1/2 y decisión de IVA por línea.

#### Scenario: IVA recuperable y no recuperable
- **GIVEN** dos líneas de 2 unidades a USD 10.00 y tarifa de prueba 10 %, una recuperable y otra no recuperable
- **WHEN** se calculan sus importes
- **THEN** SHALL resultar base 20.00, impuesto 2.00 y total 22.00 por línea; valores inventariables 20.00 y 22.00 respectivamente, y total del documento 44.00

#### Scenario: Redondeo por línea
- **GIVEN** dos líneas independientes de una unidad a USD 0.335 y tarifa de prueba 10 %
- **WHEN** se calculan los totales
- **THEN** SHALL resultar base 0.34 e impuesto 0.03 por línea, con base total 0.68, impuesto total 0.06 y total 0.74

#### Scenario: Clasificación ausente o parcial
- **GIVEN** una línea con impuesto seleccionado
- **WHEN** falta su recuperabilidad o se solicita recuperar solo un porcentaje
- **THEN** SHALL rechazarse la entrada con error de campo, sin decidir automáticamente la clasificación

#### Scenario: Tarifa cero explícita y tarifa ausente
- **GIVEN** una definición con tarifa cero configurada y otra sin vigencia aplicable
- **WHEN** se intenta confirmar cada compra correspondiente
- **THEN** SHALL aceptarse la primera con impuesto cero y rechazarse la segunda sin convertir ausencia de configuración en exención

#### Scenario: Totales manipulados
- **GIVEN** una compra cuyo cálculo válido produce total 44.00
- **WHEN** el cliente intenta confirmar imponiendo total 1.00
- **THEN** SHALL rechazarse la manipulación y no confirmarse un documento con totales distintos del cálculo autorizado

### Requirement: Fechas documentales y vigencias de compra

La fecha del documento SHALL ser obligatoria, anterior o igual al día actual en America/Guayaquil. SHALL ser la fecha operativa usada para resolver la vigencia tributaria de la compra. El momento efectivo del movimiento SHALL ser el de confirmación, asignado por el sistema y no editable. Un borrador SHALL poder corregir su fecha; una compra confirmada SHALL conservar ambas fechas sin reordenar movimientos ni revalorar períodos anteriores. La confirmación SHALL exigir revisión actualizada cuando cambien los importes o datos relevantes respecto de lo revisado por el usuario. Trazabilidad: RN-CON-001/002/008; RNF-INT-008; configuración operativa y fiscal; proposal recomendación 3.

#### Scenario: Documento antiguo con tarifa distinta
- **GIVEN** un documento del día 10 con tarifa configurada de prueba 10 % y recepción del día 20 con tarifa vigente ese día de 12 %
- **WHEN** se confirma el ingreso el día 20
- **THEN** SHALL aplicarse el 10 % del documento y registrarse la entrada después de los movimientos ya confirmados, sin modificar sus valores

#### Scenario: Documento futuro
- **GIVEN** una fecha posterior al día actual del negocio
- **WHEN** se guarda o confirma la compra con esa fecha
- **THEN** SHALL rechazarse el campo fecha sin efectos parciales

#### Scenario: Cambio de tarifa antes de confirmar
- **GIVEN** un borrador revisado cuya tarifa aplicable cambia válidamente antes de la confirmación
- **WHEN** se solicita confirmar con la revisión anterior
- **THEN** SHALL exigirse revisar los valores actualizados y no confirmarse silenciosamente un importe diferente

### Requirement: Referencia del proveedor y prevención de duplicados

El ingreso SHALL admitir tipos FACTURA, NOTA_DE_VENTA, OTRO y SIN_DOCUMENTO. Los tres primeros SHALL exigir referencia externa no vacía; SHALL normalizarse quitando espacios exteriores y comparando mayúsculas, conservando ceros y puntuación significativa. La combinación proveedor, tipo y referencia SHALL identificar el documento externo e impedir compras independientes duplicadas, incluidos borradores y anulados. SIN_DOCUMENTO SHALL exigir explicación y carecer de número inventado; SHALL advertir coincidencias por proveedor, fecha, productos, cantidades e importes sin tratarlas como identidad documental cierta. El número interno SHALL mantenerse separado de la referencia externa y no certificar autorización fiscal. Trazabilidad: DP-006/011/018; RNF-INT-004/005; proposal recomendación 4.

#### Scenario: Referencia repetida normalizada
- **GIVEN** una compra del proveedor P con tipo FACTURA y referencia 001-001-000123
- **WHEN** se registra otra independiente para P con el mismo tipo y referencia rodeada de espacios
- **THEN** SHALL rechazarse como duplicada, incluso si la anterior está en borrador o anulada

#### Scenario: Distinto proveedor o tipo
- **GIVEN** una factura registrada con referencia 000123
- **WHEN** se registra esa referencia para otro proveedor o con otro tipo documental válido
- **THEN** SHALL admitirse como otra identidad externa sin fusionar documentos

#### Scenario: Altas concurrentes duplicadas
- **GIVEN** dos solicitudes independientes con igual proveedor, tipo y referencia
- **WHEN** se procesan simultáneamente
- **THEN** SHALL persistirse como máximo una compra independiente y la otra recibir conflicto identificable

#### Scenario: Compra sin documento externo
- **GIVEN** una compra ocasional SIN_DOCUMENTO con explicación
- **WHEN** coincide en proveedor, fecha, productos, cantidades e importes con otra compra
- **THEN** SHALL advertirse la coincidencia y exigirse reconocimiento explícito para continuar, sin inventar un número externo ni afirmar que son necesariamente la misma compra

### Requirement: Reemplazo vinculado de un documento anulado

Un documento externo ya registrado SHALL poder reutilizarse únicamente en una compra de reemplazo vinculada expresamente a su antecedente anulado y a su identidad externa original. SHALL conservarse toda la cadena y las numeraciones internas anteriores. SHALL NOT confirmarse un reemplazo si existe una compra confirmada vigente para ese documento o si su antecedente no está anulado. Reemplazos concurrentes SHALL NOT producir dos recepciones vigentes. Trazabilidad: RN-INV-011/012/014; RN-CON-007/009; proposal recomendación 4.

#### Scenario: Reemplazo después de anulación
- **GIVEN** una compra anulada con referencia externa F-1
- **WHEN** se confirma su reemplazo válido expresamente vinculado
- **THEN** SHALL conservarse F-1, asignarse otro número interno y mantenerse visibles el original, su compensación y el reemplazo

#### Scenario: Reemplazos simultáneos
- **GIVEN** dos borradores de reemplazo del mismo documento anulado
- **WHEN** ambos intentan confirmarse simultáneamente
- **THEN** SHALL confirmarse como máximo uno y rechazarse el otro sin duplicar recepción ni consumir otro número

### Requirement: Confirmación atómica y numeración comercial

Confirmar un ingreso válido SHALL recibir todas sus líneas en la **bodega** configurada del RUC comercial, registrar sus movimientos, actualizar existencias y **costo promedio ponderado**, conservar configuración histórica, asignar el número interno de ingresos y auditar la acción en una sola operación atómica. SHALL utilizarse la serie comercial activa, inicialmente COM-ING, con el formato y garantías de configuración. Si falta entidad, bodega, serie o vigencia única, SHALL rechazarse sin valores inventados ni efectos parciales. SHALL NOT crearse pagos, deudas, ventas, recepciones parciales ni inventario artesanal. Trazabilidad: DP-001/002/006/011; RF-INV-003…005/013; RN-FIS-002/005/006; RNF-INT-001/003/009; CU-007.

#### Scenario: Recepción completa
- **GIVEN** un borrador válido con 2 unidades de A y 3 de B
- **WHEN** se confirma
- **THEN** SHALL quedar confirmado, aumentar A en 2 y B en 3, registrar los movimientos vinculados y asignar un único número interno comercial

#### Scenario: Falla intermedia
- **GIVEN** una confirmación que falla después de preparar parte de sus efectos
- **WHEN** la operación termina con error
- **THEN** SHALL conservarse el borrador y los saldos previos sin movimientos, usos fiscales, número consumido ni auditoría de éxito parciales

#### Scenario: Configuración ausente o ámbito incorrecto
- **GIVEN** una compra sin bodega o serie aplicable, o con impuesto del ámbito artesanal
- **WHEN** se solicita confirmar
- **THEN** SHALL rechazarse completamente con indicación corregible de la configuración necesaria

#### Scenario: Confirmaciones de compras distintas
- **GIVEN** dos compras válidas del ámbito comercial
- **WHEN** se confirman simultáneamente
- **THEN** SHALL recibir números únicos y conservar completos sus efectos, sin mezclar líneas ni numeración artesanal

### Requirement: Confirmación idempotente e historia económica

Las escrituras de compras SHALL detectar reintentos compatibles y rechazar reutilizaciones incompatibles de la misma intención. La identidad del ingreso SHALL impedir duplicar confirmación aun cambiando la clave de solicitud o el actor autorizado. Una repetición compatible SHALL devolver el resultado existente sin nuevos movimientos, valoración ni número. Confirmado o anulado SHALL NOT admitir edición de líneas, proveedor, fecha, impuestos o importes; SHALL conservar datos fiscales, proveedor, productos, códigos, presentación, unidad, cantidades, costos, tarifas, clasificación y valores aplicados aunque cambie el catálogo. Trazabilidad: RN-INV-011/014; RN-CON-001/002/007; RF-INV-005/010; RNF-INT-004/009; proposal.

#### Scenario: Doble clic y reintento con otra clave
- **GIVEN** un ingreso confirmado
- **WHEN** se repite su confirmación compatible, incluso con otra clave o Administrador
- **THEN** SHALL devolverse la confirmación existente sin duplicar movimientos ni número

#### Scenario: Misma intención con otro contenido
- **GIVEN** una solicitud ya procesada
- **WHEN** se reutiliza su identidad lógica con cantidades o datos diferentes
- **THEN** SHALL responderse conflicto sin ocultar la incompatibilidad ni ejecutar nuevos efectos

#### Scenario: Catálogo modificado después de confirmar
- **GIVEN** una compra confirmada y cambios posteriores de nombre, presentación, proveedor, precio o tarifa
- **WHEN** se consulta la compra histórica
- **THEN** SHALL mostrar los datos e importes aplicados originalmente sin reescribirlos ni modificar el precio de venta

### Requirement: Anulación conservadora con compensación

Solo el Administrador SHALL anular un ingreso confirmado, con motivo no vacío, responsable y momento del sistema. SHALL comprobarse que sus efectos sean los últimos de cada producto afectado, exista cantidad suficiente y se pueda restituir exactamente cantidad y valoración previas. Cualquier movimiento posterior de un producto SHALL bloquear toda la anulación, aunque exista stock suficiente o ese movimiento haya sido compensado. La anulación SHALL conservar original y número y generar **movimientos inversos** vinculados atómicamente. Repetirla SHALL devolver el estado anulado sin segunda compensación. SHALL NOT representar devolución física al proveedor. Trazabilidad: RF-INV-006/010/012; RN-INV-011…014; RN-CON-007; CU-015; proposal recomendación 5.

#### Scenario: Anulación segura de la última compra
- **GIVEN** una compra cuyo efecto fue pasar de 10 unidades con valor 20.00 a 15 con valor 40.00, sin movimientos posteriores
- **WHEN** se anula con motivo válido
- **THEN** SHALL restituirse 10 unidades y valor 20.00, conservarse el número y vincularse la compensación al original

#### Scenario: Movimiento posterior con stock suficiente
- **GIVEN** una compra de 5 unidades seguida de otra entrada de 10 del mismo producto
- **WHEN** se intenta anular la primera
- **THEN** SHALL bloquearse por movimientos posteriores sin modificar ambas compras ni sus valoraciones

#### Scenario: Un producto impide anular un documento completo
- **GIVEN** una compra de A y B, con una salida posterior solo de B
- **WHEN** se solicita anular
- **THEN** SHALL rechazarse toda la anulación indicando B y su dependencia, sin compensar parcialmente A

#### Scenario: Carrera entre salida y anulación
- **GIVEN** una compra anulable y una salida simultánea del mismo producto
- **WHEN** ambas operaciones se procesan
- **THEN** SHALL conservarse un orden válido y rechazarse la operación incompatible, sin stock negativo ni valoración incoherente

#### Scenario: Anulación repetida o fallida
- **GIVEN** una compra cuya anulación se solicita dos veces o falla antes de terminar
- **WHEN** finaliza el procesamiento
- **THEN** SHALL existir una sola compensación completa si tuvo éxito, o ninguna y estado confirmado si falló

### Requirement: Consulta y experiencia de compras

El Administrador SHALL buscar por número interno, referencia o proveedor, filtrar por proveedor, estado y período de fecha documental, y paginar con total y orden estable. Lista y detalle SHALL distinguir fecha documental, confirmación, estado, ámbito fiscal y totales. El formulario SHALL permitir revisar líneas y totales calculados antes de confirmar; el diálogo SHALL explicar la recepción completa. SHALL conservar filtros al volver del detalle, prevenir envíos duplicados, avisar cambios sin guardar y ofrecer estados de carga, vacío, error y éxito con errores de campo y navegación por teclado. Trazabilidad: UI-040…042; CU-007; RNF-USA; RF-REP-003 en consulta básica; proposal.

#### Scenario: Lista filtrada y retorno
- **GIVEN** compras suficientes para varias páginas
- **WHEN** se filtran por proveedor, período y estado y se vuelve de un detalle
- **THEN** SHALL conservarse criterios y página con total y filas correspondientes, sin perder el contexto

#### Scenario: Confirmación cancelada
- **GIVEN** un borrador revisado y su aviso de recepción completa
- **WHEN** el usuario cancela la confirmación
- **THEN** SHALL permanecer en borrador sin numeración ni movimientos

#### Scenario: Error y recuperación del formulario
- **GIVEN** una compra con campos inválidos o una operación que falla
- **WHEN** se muestra el resultado
- **THEN** SHALL conservarse la entrada editable, asociarse los errores a sus campos y permitirse corregir o reintentar sin duplicar efectos

#### Scenario: Consulta vacía o en carga
- **GIVEN** una lista sin resultados o todavía pendiente
- **WHEN** se presenta al usuario
- **THEN** SHALL identificarse el estado real sin compras ficticias, y una falla SHALL mostrar recuperación sin datos inventados
