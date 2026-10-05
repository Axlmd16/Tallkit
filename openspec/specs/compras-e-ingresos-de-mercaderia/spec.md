# compras-e-ingresos-de-mercaderia Specification

## Purpose
Registrar y confirmar entradas de stock del RUC comercial en una sola acción, con proveedor, referencia, observación y costos opcionales; conservar las compras anteriores como historia de solo lectura, con valoración, anulación compensatoria y consulta según rol.
## Requirements
### Requirement: Autorización de compras por operación

El sistema SHALL conceder al Administrador y al Vendedor la consulta de **ingresos de mercadería** mediante `ingresos.ver`, el registro mediante `ingresos.crear` y la confirmación mediante `ingresos.confirmar`. La anulación mediante `ingresos.anular` SHALL permanecer reservada al Administrador. El Encargado del taller sin otro rol SHALL NOT recibir ninguno de estos permisos. SHALL comprobarse sesión vigente, usuario activo y unión de roles en cada solicitud, incluida la consulta directa. El Vendedor sin Administrador SHALL NOT recibir costos, costo promedio, valoración, impuestos ni totales monetarios de ninguna entrada o compra, en campos, resúmenes, referencias anidadas o errores; SHALL poder informar el costo de la entrada que registra sin que el sistema se lo devuelva después. Trazabilidad: CT-001; RN-SEG-001…007; RF-CAT-005; actores-y-roles §3.3; autorizacion-y-navegacion; proposal D4 y R3.

#### Scenario: Administrador opera con su permiso
- **GIVEN** un Administrador autenticado
- **WHEN** solicita una operación de entrada válida
- **THEN** SHALL permitirse continuar conforme al permiso específico y al estado de la entrada

#### Scenario: Vendedor registra y confirma
- **GIVEN** un Vendedor autenticado sin Administrador
- **WHEN** registra y confirma una entrada válida
- **THEN** SHALL permitirse y quedar identificado como responsable de la entrada

#### Scenario: Vendedor intenta anular
- **GIVEN** un Vendedor sin Administrador y una entrada confirmada, propia o ajena
- **WHEN** intenta anularla directamente
- **THEN** SHALL denegarse sin compensaciones ni cambios

#### Scenario: Encargado del taller sin permiso
- **GIVEN** un Encargado del taller sin otro rol
- **WHEN** intenta consultar, registrar, confirmar o anular una entrada directamente
- **THEN** SHALL denegarse sin revelar contenido protegido ni producir cambios

#### Scenario: Costo informado no se devuelve al Vendedor
- **GIVEN** un Vendedor que confirmó una entrada informando costo
- **WHEN** consulta después esa entrada o su lista
- **THEN** SHALL recibir productos y cantidades sin el costo informado, el promedio ni valores derivados

#### Scenario: Unión de roles y sesión invalidada
- **GIVEN** un usuario con Administrador y Vendedor cuya sesión se invalida al retirarle Administrador
- **WHEN** intenta anular una entrada con esa sesión
- **THEN** SHALL exigirse autenticación de nuevo y aplicarse únicamente los permisos vigentes


### Requirement: Productos y proveedores confirmables

Confirmar una entrada SHALL exigir al menos una línea y que todos sus productos estén activos en el catálogo. Un **servicio** SHALL NOT utilizarse como producto inventariable. El proveedor SHALL ser opcional: una entrada sin proveedor SHALL ser válida y SHALL NOT atribuirse a un proveedor genérico o inventado. Cuando se informe, SHALL ser un proveedor activo existente; el formulario de entrada SHALL NOT crear ni editar proveedores. Un proveedor o producto desactivado después SHALL permanecer legible en las entradas ya confirmadas. Trazabilidad: DP-009/010; proposal D2 y R4, que sustituyen a DP-011; RN-CAT-010/011; RF-INV-002/014; CU-007.

#### Scenario: Entrada sin proveedor
- **GIVEN** una entrada con productos activos y sin proveedor
- **WHEN** se confirma
- **THEN** SHALL aceptarse y mostrarse sin proveedor, sin asignar uno ficticio

#### Scenario: Entrada con proveedor activo
- **GIVEN** un proveedor activo elegido de la lista
- **WHEN** se confirma la entrada
- **THEN** SHALL conservarse la referencia a ese proveedor en la historia de la entrada

#### Scenario: Producto desactivado antes de confirmar
- **GIVEN** una entrada preparada cuyo producto se desactiva antes de confirmar
- **WHEN** se solicita confirmar
- **THEN** SHALL rechazarse la entrada completa indicando el producto, sin número ni movimientos

#### Scenario: Proveedor inactivo o inexistente
- **GIVEN** una solicitud que referencia un proveedor inactivo o inexistente
- **WHEN** se solicita confirmar
- **THEN** SHALL rechazarse con error del campo proveedor y sin efectos

#### Scenario: Selección de un servicio
- **GIVEN** un servicio artesanal existente
- **WHEN** se intenta incorporarlo como producto de una entrada
- **THEN** SHALL rechazarse la línea sin producir inventario de servicios

#### Scenario: Baja concurrente y confirmación
- **GIVEN** una confirmación y una desactivación simultáneas del mismo producto
- **WHEN** ambas se procesan
- **THEN** SHALL obtenerse un resultado equivalente a un orden completo: confirmar antes de la baja o rechazar después de ella, sin recepción parcial

### Requirement: Cantidades de presentaciones y costos de compra

Las cantidades SHALL ser decimales de valor entero positivo de **presentaciones** completas, sin fraccionar envases, convertir unidades ni confundir contenido con unidades recibidas. Cada producto SHALL aparecer en una sola línea por entrada. El costo unitario SHALL ser opcional por línea: cuando se informe SHALL ser un único valor en USD no negativo con hasta seis decimales, sin desglose de impuesto y distinto del precio de venta; cuando se omita SHALL registrarse como ausente y SHALL NOT sustituirse por cero, por el precio de venta ni por otro valor inventado. Un costo cero SHALL aceptarse solo si se informa explícitamente y SHALL distinguirse de un costo ausente. SHALL rechazarse precisión excedida, valores no finitos, negativos y cantidades cero o fraccionarias sin truncarlos. Trazabilidad: DP-009/010/017; proposal D1 y R2, que sustituyen a DP-022 y a DP-023 en compras; RN-CAT-007/011; RN-INV-015; RF-INV-002/014; RNF-INT-006/007.

#### Scenario: Presentación de medio galón
- **GIVEN** un producto cuyo contenido es 0.5 galones
- **WHEN** se reciben 3 presentaciones cerradas
- **THEN** SHALL aumentar su existencia en 3 unidades del producto, conservando 0.5 galones como contenido de cada presentación

#### Scenario: Fracción o precisión excedida
- **GIVEN** una entrada en preparación
- **WHEN** se envía cantidad 0, 1.5, costo negativo o costo con siete decimales
- **THEN** SHALL rechazarse el campo correspondiente sin redondear la entrada ni registrarla parcialmente

#### Scenario: Costo omitido
- **GIVEN** una línea válida sin costo
- **WHEN** se confirma la entrada
- **THEN** SHALL aceptarse, conservarse la cantidad y registrarse la línea como sin costo, sin convertirla en costo cero

#### Scenario: Costo cero explícito
- **GIVEN** una línea válida con costo unitario 0 informado
- **WHEN** se confirma la entrada
- **THEN** SHALL aceptarse como costo cero conocido, distinto de una línea sin costo

#### Scenario: Líneas con y sin costo en la misma entrada
- **GIVEN** una entrada con el producto A a costo 4.50 y el producto B sin costo
- **WHEN** se confirma
- **THEN** SHALL recibirse ambos productos, con A valorado a 4.50 y B tratado como entrada sin costo

#### Scenario: Producto repetido en la solicitud
- **GIVEN** una solicitud que contiene dos líneas del mismo producto
- **WHEN** se intenta confirmar
- **THEN** SHALL rechazarse indicando el producto repetido, sin recibir ninguna línea



### Requirement: Referencia del proveedor y prevención de duplicados

La entrada SHALL admitir una referencia externa opcional de texto libre, por ejemplo el número de la factura del proveedor, y una observación opcional. La referencia SHALL NOT exigir tipo documental ni ser única, y SHALL NOT bloquear otra entrada con el mismo texto. El número interno SHALL mantenerse separado de la referencia externa y SHALL NOT certificar autorización fiscal. Para prevenir registros dobles, antes de confirmar SHALL advertirse cuando exista otra entrada confirmada vigente del mismo día de America/Guayaquil con exactamente los mismos productos y cantidades; continuar SHALL exigir un reconocimiento explícito y SHALL NOT bloquearse. La advertencia SHALL NOT revelar costos al Vendedor. Trazabilidad: DP-006/018; proposal D2 y R5; RNF-INT-004/005; RN-INV-014.

#### Scenario: Entrada sin referencia
- **GIVEN** una entrada válida sin referencia ni observación
- **WHEN** se confirma
- **THEN** SHALL aceptarse sin inventar un número externo

#### Scenario: Referencia repetida
- **GIVEN** una entrada confirmada con referencia 001-001-000123
- **WHEN** se confirma otra entrada con la misma referencia y contenido distinto
- **THEN** SHALL aceptarse como otra entrada, sin conflicto por la referencia

#### Scenario: Posible registro doble el mismo día
- **GIVEN** una entrada confirmada hoy con 2 unidades de A y 3 de B
- **WHEN** se prepara otra entrada hoy con exactamente 2 de A y 3 de B
- **THEN** SHALL advertirse la coincidencia con el número de la entrada existente y SHALL exigirse reconocimiento explícito para confirmar

#### Scenario: Reconocimiento omitido
- **GIVEN** una entrada con coincidencia vigente no reconocida
- **WHEN** se solicita confirmar directamente
- **THEN** SHALL rechazarse solicitando el reconocimiento, sin número ni movimientos

#### Scenario: Coincidencia con una entrada anulada
- **GIVEN** una entrada anulada hoy con 2 unidades de A
- **WHEN** se prepara otra entrada con 2 unidades de A
- **THEN** SHALL NOT advertirse coincidencia por la entrada anulada


### Requirement: Confirmación atómica y numeración comercial

Confirmar una entrada válida SHALL recibir todas sus líneas en la **bodega** configurada del RUC comercial, registrar sus movimientos, actualizar existencias y valoración conforme a la capacidad de existencias, asignar el número interno de ingresos, identificar al usuario responsable y auditar la acción en una sola operación atómica. SHALL utilizarse la serie comercial activa de ingresos, inicialmente COM-ING, continuando la numeración existente con el formato y las garantías de configuración. Si falta entidad, bodega o serie, SHALL rechazarse sin valores inventados ni efectos parciales. SHALL NOT crearse pagos, deudas, ventas, recepciones parciales, usos fiscales ni inventario artesanal. Trazabilidad: DP-001/002/006; RF-INV-003…005/013; RN-FIS-002/005/006; RNF-INT-001/003/009; CU-007.

#### Scenario: Recepción completa
- **GIVEN** una entrada válida con 2 unidades de A y 3 de B
- **WHEN** se confirma
- **THEN** SHALL quedar confirmada, aumentar A en 2 y B en 3, registrar los movimientos vinculados y asignar un único número interno comercial

#### Scenario: Falla intermedia
- **GIVEN** una confirmación que falla después de preparar parte de sus efectos
- **WHEN** la operación termina con error
- **THEN** SHALL conservarse los saldos previos sin entrada, movimientos, número consumido ni auditoría de éxito parciales

#### Scenario: Configuración ausente
- **GIVEN** una entrada sin bodega o serie aplicable
- **WHEN** se solicita confirmar
- **THEN** SHALL rechazarse completamente con indicación corregible de la configuración necesaria

#### Scenario: Entradas simultáneas del mismo producto
- **GIVEN** dos entradas válidas de 4 y 6 unidades del mismo producto con existencia 10
- **WHEN** se confirman simultáneamente por usuarios distintos
- **THEN** SHALL recibir números únicos y resultar existencia 20, con ambos movimientos completos y saldos coherentes con un orden total

#### Scenario: Numeración continua tras el cambio
- **GIVEN** que la última compra del flujo anterior recibió el número COM-ING-000041
- **WHEN** se confirma la primera entrada simple
- **THEN** SHALL recibir COM-ING-000042, sin reiniciar ni reutilizar números

#### Scenario: Confirmaciones de compras distintas
- **GIVEN** dos compras válidas del ámbito comercial
- **WHEN** se confirman simultáneamente
- **THEN** SHALL recibir números únicos y conservar completos sus efectos, sin mezclar líneas ni numeración artesanal

### Requirement: Confirmación idempotente e historia económica

El registro de una entrada SHALL detectar reintentos compatibles de la misma intención y devolver la entrada ya confirmada sin nuevos movimientos, valoración ni número. Reutilizar la misma intención con contenido diferente SHALL responderse como conflicto sin ejecutar efectos. Una entrada confirmada o anulada SHALL NOT admitir edición de líneas, proveedor, referencia, cantidades ni costos, incluido completar después un costo omitido; SHALL conservar proveedor, productos, códigos, presentación, unidad, cantidades, costos informados o su ausencia, usuario y momento aunque cambie el catálogo. Trazabilidad: RN-INV-011/014; RN-CON-001/002/007; RF-INV-005/010; RNF-INT-004/009; proposal.

#### Scenario: Doble clic o reintento de red
- **GIVEN** una confirmación ya procesada con éxito
- **WHEN** se repite la misma solicitud
- **THEN** SHALL devolverse la entrada existente sin duplicar movimientos ni número

#### Scenario: Misma intención con otro contenido
- **GIVEN** una solicitud ya procesada
- **WHEN** se reutiliza su identidad de intención con cantidades o productos diferentes
- **THEN** SHALL responderse conflicto sin ocultar la incompatibilidad ni ejecutar nuevos efectos

#### Scenario: Intento de completar el costo después
- **GIVEN** una entrada confirmada con una línea sin costo
- **WHEN** cualquier rol intenta editarla para agregar el costo
- **THEN** SHALL rechazarse y conservarse la línea sin costo

#### Scenario: Catálogo modificado después de confirmar
- **GIVEN** una entrada confirmada y cambios posteriores de nombre, presentación, proveedor o precio
- **WHEN** se consulta la entrada histórica
- **THEN** SHALL mostrar los datos aplicados originalmente sin reescribirlos ni modificar el precio de venta

#### Scenario: Doble clic y reintento con otra clave
- **GIVEN** un ingreso confirmado
- **WHEN** se repite su confirmación compatible, incluso con otra clave o Administrador
- **THEN** SHALL devolverse la confirmación existente sin duplicar movimientos ni número

### Requirement: Anulación conservadora con compensación

Solo el Administrador SHALL anular una entrada o una compra anterior confirmada, con motivo no vacío, responsable y momento del sistema. SHALL comprobarse que sus efectos sean los últimos de cada producto afectado, exista cantidad suficiente y se pueda restituir exactamente cantidad y valoración previas, incluido el estado sin costo registrado cuando corresponda. Cualquier movimiento posterior de un producto SHALL bloquear toda la anulación, aunque exista stock suficiente o ese movimiento haya sido compensado. La anulación SHALL conservar original y número y generar **movimientos inversos** vinculados atómicamente. Repetirla SHALL devolver el estado anulado sin segunda compensación. SHALL NOT representar devolución física al proveedor. Trazabilidad: RF-INV-006/010/012; RN-INV-011…014; RN-CON-007; CU-015; proposal D4.

#### Scenario: Anulación segura de la última entrada
- **GIVEN** una entrada cuyo efecto fue pasar de 10 unidades con valor 20.00 a 15 con valor 40.00, sin movimientos posteriores
- **WHEN** el Administrador la anula con motivo válido
- **THEN** SHALL restituirse 10 unidades y valor 20.00, conservarse el número y vincularse la compensación al original

#### Scenario: Anulación de una entrada sin costo
- **GIVEN** un producto sin costo registrado que pasó de 0 a 5 unidades por una entrada sin costo, sin movimientos posteriores
- **WHEN** el Administrador la anula
- **THEN** SHALL restituirse existencia 0 y el producto SHALL seguir sin costo registrado, sin valores inventados

#### Scenario: Movimiento posterior con stock suficiente
- **GIVEN** una entrada de 5 unidades seguida de otra entrada de 10 del mismo producto
- **WHEN** se intenta anular la primera
- **THEN** SHALL bloquearse por movimientos posteriores sin modificar ambas entradas ni sus valoraciones

#### Scenario: Un producto impide anular un documento completo
- **GIVEN** una entrada de A y B, con una salida posterior solo de B
- **WHEN** se solicita anular
- **THEN** SHALL rechazarse toda la anulación indicando B y su dependencia, sin compensar parcialmente A

#### Scenario: Carrera entre salida y anulación
- **GIVEN** una entrada anulable y una salida simultánea del mismo producto
- **WHEN** ambas operaciones se procesan
- **THEN** SHALL conservarse un orden válido y rechazarse la operación incompatible, sin stock negativo ni valoración incoherente

#### Scenario: Anulación repetida o fallida
- **GIVEN** una entrada cuya anulación se solicita dos veces o falla antes de terminar
- **WHEN** finaliza el procesamiento
- **THEN** SHALL existir una sola compensación completa si tuvo éxito, o ninguna y estado confirmado si falló

### Requirement: Consulta y experiencia de compras

El Administrador y el Vendedor SHALL consultar entradas y compras anteriores buscando por número interno, referencia o proveedor, filtrando por estado, período de confirmación y usuario que registró, y paginando con total y orden estable, de la más reciente a la más antigua. La lista SHALL mostrar número, momento, usuario, cantidad de productos y unidades, y estado, de modo que el Administrador pueda revisar después lo registrado sin aprobarlo. El detalle SHALL mostrar las líneas y los movimientos generados. Costos y valores SHALL mostrarse solo al Administrador, que SHALL distinguir una línea sin costo de una con costo cero. La acción de anular SHALL ofrecerse solo al Administrador. SHALL conservarse filtros al volver del detalle, prevenirse envíos duplicados, avisarse cambios sin guardar y ofrecerse estados de carga, vacío, error y éxito con errores de campo y navegación por teclado. Trazabilidad: UI-040…042; CU-007; RNF-USA; RF-REP-003 en consulta básica; proposal D5.

#### Scenario: Revisión posterior del Administrador
- **GIVEN** entradas registradas por varios usuarios durante la semana
- **WHEN** el Administrador filtra por un Vendedor y por ese período
- **THEN** SHALL ver solo las entradas de ese usuario con su número, momento, productos y unidades

#### Scenario: Lista filtrada y retorno
- **GIVEN** entradas suficientes para varias páginas
- **WHEN** se filtran por período y estado y se vuelve de un detalle
- **THEN** SHALL conservarse criterios y página con total y filas correspondientes, sin perder el contexto

#### Scenario: Detalle según el rol
- **GIVEN** una entrada con una línea a costo 4.50 y otra sin costo
- **WHEN** la consultan un Administrador y un Vendedor
- **THEN** el Administrador SHALL ver 4.50 y la indicación de sin costo; el Vendedor SHALL ver solo productos y cantidades, sin la acción de anular

#### Scenario: Error y recuperación del formulario
- **GIVEN** una entrada con campos inválidos o una operación que falla
- **WHEN** se muestra el resultado
- **THEN** SHALL conservarse lo escrito, asociarse los errores a sus campos y permitirse corregir o reintentar sin duplicar efectos

#### Scenario: Consulta vacía o en carga
- **GIVEN** una lista sin resultados o todavía pendiente
- **WHEN** se presenta al usuario
- **THEN** SHALL identificarse el estado real sin entradas ficticias, y una falla SHALL mostrar recuperación sin datos inventados

### Requirement: Registro directo de entradas con revisión

Una **entrada de stock** SHALL ser un **ingreso de mercadería** del RUC comercial que se registra y confirma en una sola acción explícita, precedida por una revisión de su contenido. SHALL NOT existir un borrador persistente intermedio: mientras no se confirme, la entrada SHALL NOT guardarse, numerarse ni producir efectos. Una entrada SHALL tener únicamente los estados confirmado y anulado. El momento efectivo SHALL ser el de confirmación, asignado por el sistema y no editable; SHALL NOT capturarse una fecha del documento del proveedor. Cancelar la revisión o abandonar el formulario SHALL NOT dejar registro alguno. Trazabilidad: proposal D3 y D5; RF-INV-001…003; RN-INV-005; CU-007; modelo-dominio §7.

#### Scenario: Registro y confirmación en una acción
- **GIVEN** un Vendedor que eligió 2 unidades del producto A y 3 del producto B
- **WHEN** revisa el contenido y confirma
- **THEN** SHALL quedar una entrada confirmada con número, A aumentado en 2 y B en 3, sin haber existido un borrador guardado

#### Scenario: Revisión cancelada
- **GIVEN** una entrada preparada y su revisión abierta
- **WHEN** el usuario cancela
- **THEN** SHALL conservarse lo escrito para seguir editando y SHALL NOT existir entrada, número ni movimiento

#### Scenario: Formulario abandonado
- **GIVEN** una entrada preparada sin confirmar
- **WHEN** el usuario abandona la pantalla tras el aviso de cambios sin guardar
- **THEN** SHALL NOT persistirse ningún registro de esa entrada

#### Scenario: Fecha impuesta por el cliente
- **GIVEN** una solicitud de confirmación que incluye una fecha efectiva distinta
- **WHEN** se procesa
- **THEN** SHALL ignorarse o rechazarse ese dato y registrarse el momento del sistema

### Requirement: Registro sencillo de entradas

El registro de una entrada SHALL presentar a la vista únicamente lo imprescindible: la búsqueda de productos y la lista de productos elegidos con su cantidad. La búsqueda SHALL aceptar código interno, código del fabricante o nombre; una coincidencia exacta del código interno SHALL agregar el producto directamente. Un producto agregado SHALL aparecer con cantidad 1 y elegirlo de nuevo SHALL aumentar su cantidad en lugar de crear otra línea. Proveedor, referencia, observación y costo SHALL ofrecerse como detalles opcionales que permanecen plegados hasta que el usuario los solicita, y SHALL NOT marcarse ni tratarse como obligatorios. La pantalla SHALL NOT mostrar impuestos, tipos de documento, fechas documentales ni totales monetarios al Vendedor. La revisión SHALL resumir cuántos productos y cuántas unidades entran. Tras confirmar, SHALL comunicarse el éxito con el número asignado mediante un aviso breve no bloqueante y SHALL quedar el formulario listo para otra entrada. Trazabilidad: proposal D5; RNF-USA; UI-041; spec `patrones-de-pantalla-frontend`.

#### Scenario: Entrada mínima sin abrir detalles
- **GIVEN** un Vendedor en el registro de entradas con los detalles opcionales plegados
- **WHEN** busca un producto, ajusta su cantidad a 4, revisa y confirma
- **THEN** SHALL confirmarse la entrada sin haber solicitado proveedor, referencia, observación ni costo

#### Scenario: Código interno exacto
- **GIVEN** un producto activo con código interno P-000123
- **WHEN** se ingresa exactamente ese código en la búsqueda
- **THEN** SHALL agregarse el producto a la lista con cantidad 1 sin un paso adicional de selección

#### Scenario: Producto elegido dos veces
- **GIVEN** una lista que ya contiene el producto A con cantidad 2
- **WHEN** se vuelve a elegir el producto A
- **THEN** SHALL quedar una sola línea de A con cantidad 3

#### Scenario: Resumen de revisión
- **GIVEN** una lista con 3 productos y 10 unidades en total
- **WHEN** se abre la revisión
- **THEN** SHALL mostrarse que entran 3 productos y 10 unidades, con los detalles opcionales solo si fueron informados

#### Scenario: Continuar con otra entrada
- **GIVEN** una entrada recién confirmada
- **WHEN** se muestra el resultado
- **THEN** SHALL informarse el número asignado sin interrumpir el trabajo y el formulario SHALL quedar vacío y utilizable

### Requirement: Compras anteriores de solo lectura

Las compras registradas con el flujo anterior SHALL conservarse íntegras como historia de solo lectura, con proveedor, documento externo, fechas, impuestos, recuperabilidad, costos, totales, número y movimientos originales. SHALL NOT crearse, editarse ni confirmarse compras con ese flujo. Un borrador anterior pendiente SHALL permanecer visible para el Administrador, identificado como borrador sin efecto, y SHALL NOT poder confirmarse, numerarse ni afectar existencias. Una compra anterior confirmada SHALL poder anularse con las mismas condiciones que una entrada. El Vendedor SHALL consultar las compras anteriores sin recibir sus valores económicos. Trazabilidad: proposal D3 y R6; RN-INV-011; RN-CON-007; RF-INV-010.

#### Scenario: Consulta de una compra anterior
- **GIVEN** una compra confirmada con el flujo anterior, con IVA y documento del proveedor
- **WHEN** el Administrador la consulta
- **THEN** SHALL mostrarse con todos sus datos e importes originales, sin acciones de edición

#### Scenario: Borrador anterior pendiente
- **GIVEN** un borrador de compra creado con el flujo anterior
- **WHEN** se intenta confirmarlo o editarlo
- **THEN** SHALL rechazarse sin número, movimientos ni cambios, y el borrador SHALL seguir visible como sin efecto

#### Scenario: Vendedor consulta una compra anterior
- **GIVEN** un Vendedor sin Administrador
- **WHEN** consulta una compra anterior
- **THEN** SHALL recibir productos, cantidades, estado y número, sin costos, impuestos, totales ni datos privados del proveedor

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
