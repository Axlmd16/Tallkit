# ordenes-de-mantenimiento Specification

## Purpose
Registrar y controlar las órdenes de mantenimiento del RUC artesanal: cliente y vehículo, número interno ART-OT, kilometraje, finalización, reapertura con intervención correctiva, historial de transiciones y coordinación con repuestos y documentos económicos: las acciones operativas no producen efectos económicos por sí mismas y la finalización exige que no queden repuestos pendientes.
## Requirements
### Requirement: Autorización de órdenes por acción

El sistema SHALL exigir un usuario activo con sesión vigente para cualquier acción sobre órdenes. Administrador y Encargado del taller SHALL poder consultar con `mantenimientos.ver`, crear y editar con `mantenimientos.gestionar`, finalizar con `mantenimientos.finalizar` y reabrir con `mantenimientos.reabrir`. Un usuario con solo el rol Vendedor SHALL NOT listar órdenes, consultar órdenes sin venta vinculada ni modificarlas. Cuando una orden tenga al menos una venta comercial vinculada, un Vendedor con `ventas.ver` SHALL poder abrir una **vista restringida** de esa orden desde la venta, con número, estado, fechas, cliente y vehículo conservados, y sus repuestos y ventas vinculadas, sin servicios, importes artesanales, diagnóstico, observaciones, intervenciones ni fotografías. Los roles acumulados SHALL sumar sus permisos. La autorización SHALL validarse en el servidor en cada solicitud, incluso en reintentos. Ocultar acciones en la interfaz SHALL NOT sustituir esa validación. Trazabilidad: CT-001; actores-y-roles §3.4/§3.5 (`mantenimientos.ver`, Vendedor con venta vinculada); RF-TAL-002/012/013/016; RF-VEN-016.

#### Scenario: Encargado del taller crea una orden
- **DADO** un Encargado del taller activo con sesión vigente
- **CUANDO** crea una orden válida
- **ENTONCES** el sistema SHALL registrarla y aplicar todas las validaciones de la orden.

#### Scenario: Vendedor intenta consultar una orden
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** lista órdenes, o consulta el detalle o accede por un enlace directo a una orden sin venta vinculada
- **ENTONCES** el sistema SHALL denegar el acceso sin revelar la existencia de la orden ni sus datos.

#### Scenario: Vendedor abre la orden de origen de una venta vinculada
- **DADO** un usuario con solo el rol Vendedor y una venta vinculada a la orden `ART-OT-000020`
- **CUANDO** abre la orden de origen desde la venta
- **ENTONCES** SHALL ver la vista restringida con número, estado, cliente, vehículo y repuestos, y SHALL NOT recibir servicios, importes artesanales, diagnóstico, observaciones ni fotografías, tampoco en datos anidados.

#### Scenario: Vendedor intenta modificar o cambiar el estado
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** intenta crear, editar, finalizar o reabrir una orden mediante una solicitud directa
- **ENTONCES** el sistema SHALL rechazar la acción sin producir efectos ni eventos exitosos.

#### Scenario: Roles acumulados
- **DADO** un usuario con los roles Vendedor y Encargado del taller
- **CUANDO** consulta o gestiona una orden
- **ENTONCES** el sistema SHALL concederle los permisos del Encargado del taller.

#### Scenario: Sesión vencida durante la edición
- **DADO** un usuario cuya sesión dejó de ser válida mientras editaba
- **CUANDO** envía los cambios
- **ENTONCES** el sistema SHALL rechazarlos sin aplicar modificaciones y la interfaz SHALL conservar los datos ingresados para reintentar tras iniciar sesión.

### Requirement: Registro de una orden con cliente y vehículo válidos

Una orden SHALL pertenecer al **RUC artesanal** y relacionar exactamente un cliente y un vehículo existentes. Para crearla SHALL exigirse cliente, vehículo, fecha de apertura y kilometraje. El diagnóstico y las observaciones SHALL ser opcionales al crearla. Cliente y vehículo SHALL estar activos. El cliente SHALL ser el **propietario vigente** del vehículo cuando se crea la orden o se cambia esa selección. La fecha de apertura SHALL tener como valor inicial el día actual de America/Guayaquil y SHALL NOT ser futura. La orden SHALL iniciar en estado `registrado` con una intervención inicial. SHALL registrar automáticamente el usuario creador y las fechas de creación y última actualización. Crear una orden SHALL NOT modificar la propiedad del vehículo ni los datos del cliente o del vehículo. SHALL NOT existir motivo de ingreso, asignación de mecánico, presupuesto ni aprobación del cliente. Trazabilidad: DM-003 V1; RN-TAL-001/006/015/016; RF-TAL-001/002/018; CU-017; P3.

#### Scenario: Crear una orden válida
- **DADO** un cliente activo que es propietario vigente de un vehículo activo
- **CUANDO** un usuario autorizado crea una orden con fecha de apertura de hoy y 85 000 km, sin diagnóstico
- **ENTONCES** el sistema SHALL crearla en estado `registrado` bajo el RUC artesanal, con una intervención inicial, un número interno, el usuario creador y las fechas de creación y actualización.

#### Scenario: Vehículo incompatible con el cliente
- **DADO** un vehículo cuyo propietario vigente es el cliente A
- **CUANDO** se intenta crear una orden para el cliente B con ese vehículo
- **ENTONCES** el sistema SHALL rechazarla con un error asociado al vehículo, SHALL NOT crear la orden ni consumir un número y SHALL NOT transferir la propiedad.

#### Scenario: Cliente o vehículo inactivo
- **DADO** un cliente inactivo o un vehículo inactivo
- **CUANDO** se intenta seleccionarlo para una orden nueva o para cambiar la selección de una orden registrada
- **ENTONCES** el sistema SHALL rechazar la selección indicando el campo afectado.

#### Scenario: Datos obligatorios ausentes o fecha futura
- **DADO** una solicitud sin kilometraje, sin vehículo o con una fecha de apertura posterior al día actual de America/Guayaquil
- **CUANDO** se intenta crear la orden
- **ENTONCES** el sistema SHALL rechazarla con errores por campo y la interfaz SHALL conservar los datos ingresados.

#### Scenario: Sin campos fuera del alcance aprobado
- **DADO** el formulario o la solicitud de creación
- **CUANDO** se inspeccionan los campos aceptados
- **ENTONCES** SHALL NOT existir motivo de ingreso, mecánico, presupuesto, aprobación del cliente, descuento ni repuestos.

### Requirement: Número interno de la orden

Cada orden SHALL recibir al crearse un número interno único con el formato `ART-OT-` seguido de un secuencial de al menos seis dígitos completados con ceros, empezando en `ART-OT-000001`. El secuencial SHALL crecer sin reinicio anual. SHALL asignarse en la misma transacción que la creación y ser seguro ante creaciones simultáneas. Un número asignado SHALL NOT reasignarse, reutilizarse ni cambiar, tampoco al reabrir. Esta numeración SHALL ser independiente de `ART-SER`, de las series comerciales y de cualquier secuencia fiscal o de facturación electrónica, y SHALL NOT consumirlas. Trazabilidad: DP-006 (formato de referencia); DP-018; P5.

#### Scenario: Primera orden
- **DADO** que no existe ninguna orden
- **CUANDO** se crea la primera orden válida
- **ENTONCES** SHALL recibir el número `ART-OT-000001` y SHALL NOT avanzar ninguna otra serie.

#### Scenario: Creaciones simultáneas
- **DADO** dos usuarios que crean órdenes válidas al mismo tiempo
- **CUANDO** ambas creaciones se confirman
- **ENTONCES** SHALL recibir números distintos y consecutivos, sin duplicados.

#### Scenario: Creación rechazada
- **DADO** una solicitud de creación inválida
- **CUANDO** el sistema la rechaza
- **ENTONCES** SHALL NOT consumirse ningún número.

### Requirement: Una sola orden abierta por vehículo

Un vehículo SHALL tener como máximo una orden en estado `registrado` o `reabierto`. Crear una orden o cambiar el vehículo de una orden registrada SHALL rechazarse si ese vehículo ya tiene otra orden abierta; el error SHALL identificar el número de esa orden. Reabrir una orden SHALL rechazarse si su vehículo tiene otra orden abierta. Esta regla SHALL cumplirse también ante solicitudes simultáneas. Trazabilidad: P1; RF-TAL-019.

#### Scenario: Segunda orden abierta para el mismo vehículo
- **DADO** un vehículo con la orden `ART-OT-000010` registrada
- **CUANDO** se intenta crear otra orden para ese vehículo
- **ENTONCES** el sistema SHALL rechazarla indicando la orden abierta `ART-OT-000010`.

#### Scenario: Reapertura con otra orden abierta
- **DADO** una orden finalizada y otra orden registrada para el mismo vehículo
- **CUANDO** se solicita reabrir la orden finalizada
- **ENTONCES** el sistema SHALL rechazar la reapertura y la orden SHALL permanecer finalizada.

#### Scenario: Creaciones simultáneas para el mismo vehículo
- **DADO** un vehículo sin órdenes abiertas
- **CUANDO** dos usuarios crean al mismo tiempo una orden para ese vehículo
- **ENTONCES** SHALL crearse exactamente una y la otra solicitud SHALL rechazarse sin consumir un número.

### Requirement: Edición progresiva de una orden registrada

Mientras una orden esté `registrada`, un usuario con `mantenimientos.gestionar` SHALL poder editar cliente, vehículo, fecha de apertura, kilometraje, diagnóstico y observaciones, respetando las mismas validaciones de la creación. El cliente y el vehículo SHALL NOT cambiarse cuando la orden tenga una venta vinculada abierta con líneas, una venta vinculada confirmada o una operación artesanal confirmada no anulada; el error SHALL identificar los documentos que lo impiden. Los demás datos editables SHALL seguir editables. Diagnóstico, observaciones y servicios SHALL poder completarse en varias ediciones. Cada edición SHALL actualizar la fecha de última actualización. SHALL exigir la versión que el usuario tenía al empezar a editar. Si la orden cambió desde entonces, la edición SHALL rechazarse como conflicto sin sobrescribir los cambios de otro usuario. El estado SHALL NOT cambiar mediante una edición: SHALL cambiar únicamente con las acciones explícitas de finalizar y reabrir. Trazabilidad: RN-TAL-003/006; RF-TAL-002/015; DP-007; propuesta P7.

#### Scenario: Completar el diagnóstico posteriormente
- **DADO** una orden registrada sin diagnóstico
- **CUANDO** un usuario autorizado agrega el diagnóstico con la versión vigente
- **ENTONCES** el sistema SHALL guardarlo, SHALL actualizar la fecha de última actualización y la orden SHALL continuar registrada.

#### Scenario: Cambiar el vehículo por otro del mismo cliente
- **DADO** una orden registrada del cliente A sin documentos vinculados y otro vehículo activo del que A es propietario vigente, sin órdenes abiertas
- **CUANDO** se cambia el vehículo de la orden
- **ENTONCES** el sistema SHALL aceptarlo y SHALL actualizar los datos identificativos conservados en la orden.

#### Scenario: Cambio de cliente bloqueado por documentos vinculados
- **DADO** una orden registrada con la venta vinculada `COM-VEN-000031` confirmada
- **CUANDO** se intenta cambiar su cliente o su vehículo
- **ENTONCES** el sistema SHALL rechazarlo identificando `COM-VEN-000031`, y el diagnóstico y las observaciones SHALL seguir editables.

#### Scenario: Edición con una versión desactualizada
- **DADO** dos usuarios que abrieron la misma orden registrada y el primero ya guardó cambios
- **CUANDO** el segundo guarda con la versión anterior
- **ENTONCES** el sistema SHALL rechazarlo como conflicto, SHALL conservar los cambios del primero y la interfaz SHALL ofrecer recargar sin descartar lo que el segundo escribió.

#### Scenario: Intento de cambiar el estado mediante la edición
- **DADO** una orden registrada
- **CUANDO** una solicitud de edición incluye un estado, un número, un creador o fechas de auditoría
- **ENTONCES** el sistema SHALL ignorar o rechazar esos campos y SHALL NOT cambiar el estado ni los datos asignados por el sistema.

### Requirement: Kilometraje de la orden

El kilometraje SHALL ser un número entero no negativo expresado en kilómetros. SHALL conservarse en su orden y SHALL NOT sobrescribir el kilometraje de otras órdenes. SHALL NOT almacenarse ni actualizarse un kilometraje acumulado en la ficha del vehículo. El último kilometraje conocido SHALL ser el de la orden más reciente del mismo vehículo con fecha de apertura anterior o igual, excluyendo la orden que se edita. Si el valor ingresado es menor que ese kilometraje, el sistema SHALL advertirlo con el valor y el número de esa orden, y SHALL exigir una confirmación explícita en la misma solicitud. Una solicitud sin confirmación SHALL rechazarse sin guardar cambios. La confirmación SHALL registrarse con usuario y fecha. No SHALL existir una prohibición absoluta de valores menores. Trazabilidad: RN-TAL-007; RF-TAL-002/003; CU-017 2a; P3.

#### Scenario: Kilometraje negativo o fraccionario
- **DADO** una orden en creación o registrada
- **CUANDO** se ingresa −5 o 1 200,5 km
- **ENTONCES** el sistema SHALL rechazar el valor con un error de campo.

#### Scenario: Kilometraje menor sin confirmar
- **DADO** un vehículo cuya orden anterior registró 90 000 km
- **CUANDO** se crea una orden nueva con 80 000 km sin confirmación
- **ENTONCES** el sistema SHALL rechazarla advirtiendo que el último kilometraje conocido es 90 000 km en esa orden, sin crear la orden.

#### Scenario: Kilometraje menor confirmado
- **DADO** la advertencia anterior
- **CUANDO** el usuario autorizado confirma explícitamente el valor de 80 000 km
- **ENTONCES** el sistema SHALL crear la orden con 80 000 km y SHALL registrar la confirmación, su usuario y su fecha.

#### Scenario: Editar una orden anterior no reduce el historial
- **DADO** las órdenes finalizadas de 50 000 km y 60 000 km de un vehículo, y una orden registrada posterior con 70 000 km
- **CUANDO** se edita la orden registrada
- **ENTONCES** los kilometrajes de las órdenes anteriores SHALL permanecer sin cambios y el vehículo SHALL NOT adquirir un kilometraje acumulado.

### Requirement: Datos históricos de cliente y vehículo

La orden SHALL conservar la referencia al cliente y al vehículo seleccionados. También SHALL conservar los datos identificativos vigentes al seleccionarlos: nombre o razón social e identificación del cliente, y placa, marca y modelo del vehículo. Una transferencia de propiedad, la edición de las fichas o la desactivación posteriores SHALL NOT cambiar el cliente de la orden ni sus datos identificativos conservados. Consultar, finalizar o reabrir una orden SHALL NOT volver a comprobar que su cliente sigue siendo el propietario vigente. Trazabilidad: DM-003 V1; RN-CLI-009; RF-CLI-009; spec `modelo-dominio-taller` (historial de propiedad).

#### Scenario: Transferencia posterior del vehículo
- **DADO** una orden finalizada del cliente A y un vehículo transferido después al cliente B
- **CUANDO** se consulta la orden o el historial del cliente A
- **ENTONCES** la orden SHALL continuar asociada al cliente A con los datos identificativos conservados y SHALL NOT aparecer en el historial del cliente B.

#### Scenario: Reabrir después de una transferencia
- **DADO** una orden finalizada del cliente A cuyo vehículo pertenece ahora al cliente B
- **CUANDO** un usuario autorizado la reabre con motivo
- **ENTONCES** la reapertura SHALL permitirse sin cambiar el cliente de la orden ni rechazarla por la nueva propiedad.

#### Scenario: Edición de la ficha del vehículo
- **DADO** una orden finalizada del vehículo de placa «ABC-1234»
- **CUANDO** se corrigen después la marca o el modelo en la ficha del vehículo
- **ENTONCES** la orden SHALL conservar la marca y el modelo registrados al seleccionarlo.

### Requirement: Finalización explícita y atómica

Un usuario con `mantenimientos.finalizar` SHALL poder finalizar una orden `registrada` o `reabierta` mediante una acción explícita. Para finalizar la intervención inicial SHALL exigirse un diagnóstico no vacío, al menos una línea de servicio y que la venta vinculada abierta no tenga líneas. Para finalizar una intervención correctiva SHALL exigirse el trabajo realizado, no vacío. Todos los requisitos SHALL validarse en el servidor y la respuesta SHALL enumerar los que falten; si hay repuestos pendientes, SHALL identificar la venta abierta, sus líneas y que deben confirmarse por el Vendedor o el Administrador o retirarse. Finalizar SHALL NOT exigir que los servicios estén documentados ni que los documentos estén pagados. La finalización SHALL ser atómica y coordinarse con la incorporación concurrente de repuestos: una orden finalizada SHALL NOT quedar con una venta abierta con líneas. SHALL registrar el estado anterior, el usuario responsable y la fecha y hora de finalización. SHALL exigir la versión vigente de la orden. Finalizar SHALL NOT confirmar ventas, confirmar operaciones artesanales, registrar pagos, crear deuda, documentos internos, facturas ni movimientos o reservas de inventario. Trazabilidad: DP-007/018/021; RN-TAL-004/014/020; RF-TAL-011/013/015; CU-019; UI-076; P3 de la séptima entrega; propuesta P4.

#### Scenario: Finalizar con información incompleta
- **DADO** una orden registrada sin diagnóstico y sin servicios
- **CUANDO** se solicita finalizarla
- **ENTONCES** el sistema SHALL rechazarlo enumerando «diagnóstico» y «al menos un servicio» como requisitos pendientes, y la orden SHALL permanecer registrada sin cambios.

#### Scenario: Finalizar con repuestos pendientes
- **DADO** una orden registrada completa cuya venta vinculada abierta contiene 2 líneas reservadas
- **CUANDO** un Encargado del taller solicita finalizarla
- **ENTONCES** el sistema SHALL rechazarlo identificando la venta abierta y sus 2 líneas, indicando que deben confirmarse o retirarse, y SHALL NOT confirmar la venta, consumir reservas ni descontar inventario.

#### Scenario: Finalizar una orden completa
- **DADO** una orden registrada con diagnóstico, dos líneas de servicio y sin venta abierta con líneas
- **CUANDO** un Encargado del taller la finaliza con la versión vigente
- **ENTONCES** el sistema SHALL cambiarla a `finalizado`, SHALL registrar al usuario, la fecha y hora y el estado anterior, y SHALL NOT crear ventas, operaciones artesanales, pagos, deuda, documentos ni movimientos de inventario.

#### Scenario: Finalizar con servicios sin documentar y documentos a crédito
- **DADO** una orden completa con una venta vinculada confirmada a crédito pendiente de pago y servicios todavía no documentados
- **CUANDO** se finaliza
- **ENTONCES** la finalización SHALL aceptarse, la venta SHALL conservar su saldo y los servicios SHALL seguir pendientes de documentar.

#### Scenario: Finalización repetida
- **DADO** una orden que ya se finalizó
- **CUANDO** llega otra vez la misma solicitud de finalización, por un reintento o un doble clic
- **ENTONCES** el sistema SHALL responder sin crear una segunda finalización ni un evento duplicado, y la orden SHALL permanecer finalizada.

#### Scenario: Edición y finalización simultáneas
- **DADO** un usuario que edita el diagnóstico de una orden registrada y otro que la finaliza al mismo tiempo
- **CUANDO** ambas solicitudes se procesan
- **ENTONCES** SHALL aplicarse una sola en un orden coherente. Si la finalización se aplica primero, la edición SHALL rechazarse porque la orden está finalizada o su versión cambió. Si la edición se aplica primero, la finalización con la versión anterior SHALL rechazarse como conflicto. En ningún caso una orden finalizada SHALL quedar modificada.

#### Scenario: Agregar un repuesto mientras se finaliza
- **DADO** una orden registrada completa sin repuestos pendientes
- **CUANDO** un usuario la finaliza mientras otro agrega un repuesto
- **ENTONCES** SHALL aplicarse una sola en un orden coherente: o la orden queda finalizada y el repuesto se rechaza sin reserva, o el repuesto queda reservado y la finalización se rechaza por repuestos pendientes.

### Requirement: Protección de la orden finalizada

Una orden `finalizada` SHALL rechazar la edición de sus datos operativos, servicios y fotografías, y SHALL indicar que primero debe reabrirse. SHALL permanecer consultable. SHALL NOT existir una eliminación física ordinaria de órdenes. Trazabilidad: DP-007; RN-TAL-003; RF-TAL-015.

#### Scenario: Intento de editar una orden finalizada
- **DADO** una orden finalizada
- **CUANDO** un Administrador intenta cambiar su diagnóstico, su kilometraje, sus servicios o sus fotografías
- **ENTONCES** el sistema SHALL rechazarlo indicando que la orden está finalizada y debe reabrirse, sin modificar datos.

#### Scenario: Intento de eliminar una orden
- **DADO** una orden en cualquier estado
- **CUANDO** se solicita eliminarla
- **ENTONCES** el sistema SHALL rechazarlo y SHALL conservar la orden con su historial.

### Requirement: Reapertura explícita por corrección

Un usuario con `mantenimientos.reabrir`, es decir Administrador o Encargado del taller, SHALL poder reabrir una orden `finalizada` mediante una acción explícita que exija una causa no vacía. La causa describe la falla atribuible al trabajo anterior. La reapertura SHALL ser atómica, SHALL exigir la versión vigente y SHALL cumplir la regla de una sola orden abierta por vehículo. SHALL cambiar la orden a `reabierto`, SHALL registrar el estado anterior, el usuario, la fecha y hora y la causa, y SHALL agregar una intervención correctiva nueva con esa causa. SHALL conservar la identidad, el número, el cliente, el vehículo y las finalizaciones y reaperturas anteriores. SHALL NOT duplicar servicios ni fotografías. Mientras la orden esté reabierta, la intervención inicial, las intervenciones correctivas ya finalizadas y los datos operativos de la orden SHALL permanecer sin cambios. Solo la intervención correctiva abierta SHALL editarse: trabajo realizado, observaciones, servicios sin cargo y fotografías. Reabrir SHALL NOT anular ventas u operaciones artesanales, reponer inventario, revertir o corregir pagos, ni desbloquear líneas documentadas; todos los documentos y pagos existentes SHALL conservar sus efectos. Durante la reapertura SHALL NOT agregarse repuestos cobrables. Antes de confirmar, la interfaz SHALL informar que los documentos y pagos existentes conservan sus efectos. Una falla nueva o no atribuible SHALL registrarse en otra orden. La reapertura SHALL NOT constituir una garantía, una devolución ni un reembolso, ni crear cobros. Trazabilidad: DP-007/015; RN-TAL-004/013/017/018/019; RF-TAL-016/019/020; CU-019; UI-076/078; P2 de la séptima entrega; propuesta P6.

#### Scenario: Reapertura sin causa
- **DADO** una orden finalizada
- **CUANDO** se solicita reabrirla sin causa o con una causa formada solo por espacios
- **ENTONCES** el sistema SHALL rechazarlo con un error de campo y la orden SHALL permanecer finalizada.

#### Scenario: Reapertura con causa y nueva finalización
- **DADO** una orden finalizada `ART-OT-000015` con dos servicios y tres fotografías
- **CUANDO** un Encargado del taller la reabre con la causa «ruido tras cambio de pastillas», registra el trabajo realizado y la finaliza otra vez
- **ENTONCES** la orden SHALL conservar el número `ART-OT-000015`, sus dos servicios y sus tres fotografías originales sin duplicar, una intervención correctiva con la causa y el trabajo, y un historial con la primera finalización, la reapertura y la segunda finalización.

#### Scenario: Reapertura con documentos confirmados y pagados
- **DADO** una orden finalizada con la venta `COM-VEN-000031` pagada y la operación `ART-SER-000004` a crédito con saldo USD 20,00
- **CUANDO** se reabre con causa
- **ENTONCES** ambas SHALL conservar su estado, sus líneas, sus pagos y su saldo; el inventario SHALL permanecer sin cambios y la interfaz SHALL haber informado antes que los documentos y pagos conservan sus efectos.

#### Scenario: Intento de modificar la intervención inicial durante la reapertura
- **DADO** una orden reabierta
- **CUANDO** se intenta cambiar el diagnóstico inicial, el kilometraje, el cliente, el vehículo o una línea de servicio de la intervención inicial
- **ENTONCES** el sistema SHALL rechazarlo y SHALL conservar la intervención inicial intacta.

#### Scenario: Reapertura repetida o simultánea
- **DADO** una orden finalizada
- **CUANDO** llegan dos solicitudes de reapertura con la misma versión, por un reintento o por usuarios distintos
- **ENTONCES** SHALL aplicarse una sola reapertura con una sola intervención correctiva, y la otra solicitud SHALL rechazarse como conflicto o responderse sin efectos adicionales.

#### Scenario: Vendedor o usuario sin permiso intenta reabrir
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** solicita reabrir una orden
- **ENTONCES** el sistema SHALL denegarlo sin cambios.

### Requirement: Historial de transiciones y auditoría

Cada finalización y cada reapertura SHALL conservarse como una transición inmutable con estado anterior, estado nuevo, usuario, fecha y hora, y la causa en el caso de la reapertura. El historial SHALL mostrarse en orden cronológico dentro del detalle de la orden. La creación, la edición, los cambios de líneas y de precio aplicado, la carga y el retiro de fotografías, la finalización y la reapertura SHALL registrarse en la auditoría existente del sistema. SHALL registrarse el usuario, la acción, la orden afectada y la fecha, sin incluir contraseñas ni el contenido de los archivos. Registrar quién realizó una acción SHALL NOT interpretarse como la asignación de un mecánico. Trazabilidad: RN-TAL-004/015; RNF-SEG-009; DP-007.

#### Scenario: Consultar el historial de transiciones
- **DADO** una orden finalizada, reabierta y finalizada otra vez
- **CUANDO** un usuario autorizado consulta su detalle
- **ENTONCES** el sistema SHALL mostrar las tres transiciones en orden cronológico, con su usuario, su fecha y la causa de la reapertura.

#### Scenario: Acción denegada
- **DADO** un intento no autorizado de finalizar una orden
- **CUANDO** el sistema lo rechaza
- **ENTONCES** SHALL NOT registrar una transición ni un evento de éxito.

### Requirement: Listado, búsqueda y filtros de órdenes

Un usuario con `mantenimientos.ver` SHALL poder listar órdenes con paginación en el servidor, un total de resultados y un orden estable: la fecha de apertura más reciente primero y luego el número descendente. SHALL poder buscar por coincidencia parcial del número, del nombre o la identificación del cliente, y de la placa, sin distinguir mayúsculas ni espacios exteriores. SHALL poder filtrar por estado y por un rango de fechas de apertura. Cada resultado SHALL mostrar número, fecha de apertura, cliente, placa, kilometraje, estado y total de servicios de la orden. SHALL NOT mostrar saldos ni importes por cobrar. La lista SHALL ofrecer segmentos por estado (todas, abiertas y finalizadas) y cada segmento SHALL mostrar el número de órdenes que contiene, calculado por el servidor con la misma búsqueda y el mismo rango de fechas, de modo que el número coincida con el total de la lista al elegirlo. Filtros o parámetros inválidos SHALL rechazarse con un error comprensible. Trazabilidad: RF-TAL-017; UI-070; `DP-036`, regla 1; `docs/cambios-pendientes.md`, U4.

#### Scenario: Buscar por placa y filtrar por estado
- **DADO** órdenes registradas y finalizadas de varios vehículos
- **CUANDO** se busca «abc» con el estado «finalizado»
- **ENTONCES** el sistema SHALL devolver solo las órdenes finalizadas cuya placa, cliente o número coincidan, paginadas y con su total.

#### Scenario: Rango de fechas inválido
- **DADO** un filtro cuya fecha inicial es posterior a la final
- **CUANDO** se consulta el listado
- **ENTONCES** el sistema SHALL rechazar el filtro con un error comprensible.

#### Scenario: Lista vacía
- **DADO** que ninguna orden coincide con la búsqueda
- **CUANDO** se consulta el listado
- **ENTONCES** la interfaz SHALL mostrar un estado vacío explicativo sin errores.

#### Scenario: Contador de cada segmento
- **DADO** cuatro órdenes abiertas (registradas o reabiertas) y cinco finalizadas
- **CUANDO** se abre la lista
- **ENTONCES** los segmentos SHALL mostrar 9, 4 y 5, y al elegir «abiertas» el total de la lista SHALL ser 4.

#### Scenario: Contador con búsqueda
- **DADO** la búsqueda de una placa con una orden abierta y una finalizada
- **CUANDO** se aplica
- **ENTONCES** los segmentos SHALL reflejar solo esa búsqueda y no las órdenes de otros vehículos.

### Requirement: Detalle y acciones visibles de la orden

El detalle SHALL organizar la información en secciones: datos generales, diagnóstico y observaciones, intervenciones, servicios, repuestos, resumen económico por RUC, fotografías e historial. SHALL mostrar el estado de forma destacada y únicamente las acciones que el estado y los permisos del usuario permitan, incluidas las acciones separadas de confirmar la venta de repuestos, documentar servicios, cobrar repuestos y cobrar servicios. Antes de finalizar, SHALL presentar un resumen de la orden, los requisitos pendientes y los documentos vinculados con su estado. Antes de reabrir, SHALL solicitar la causa y explicar que la orden volverá a admitir cambios solo en una intervención correctiva y que los documentos y pagos existentes conservan sus efectos. Antes de una acción que descuente inventario o genere una obligación de pago, SHALL mostrar los importes, la condición y los efectos. Las acciones SHALL impedir envíos duplicados mientras se procesan. SHALL mostrar estados de carga, error y éxito, y confirmar las acciones exitosas con las notificaciones del sistema visual. SHALL NOT mostrar botones sin función, secciones simuladas ni saldos ficticios. Trazabilidad: UI-071/074/075/076/077/078; specs `sistema-visual-frontend`, `patrones-de-pantalla-frontend`, `repuestos-del-mantenimiento` y `resumen-economico-del-mantenimiento`.

#### Scenario: Acciones de una orden finalizada para el Encargado del taller
- **DADO** un Encargado del taller que consulta una orden finalizada con servicios no documentados
- **CUANDO** se muestra el detalle
- **ENTONCES** SHALL mostrarse las acciones «Reabrir» y «Documentar servicios», y SHALL NOT mostrarse las acciones de edición de datos, servicios, repuestos ni fotografías.

#### Scenario: Resumen antes de finalizar
- **DADO** una orden registrada sin diagnóstico y con repuestos pendientes
- **CUANDO** el usuario elige «Finalizar»
- **ENTONCES** la interfaz SHALL mostrar el resumen, los requisitos pendientes y la venta abierta con sus líneas, y SHALL impedir confirmar hasta que se cumplan, aunque el servidor también lo valide.

#### Scenario: Encargado del taller no ve acciones comerciales
- **DADO** un Encargado del taller sin rol comercial que consulta una orden con una venta vinculada abierta
- **CUANDO** se muestra el detalle
- **ENTONCES** SHALL NOT mostrarse las acciones «Confirmar venta» ni «Cobrar repuestos», y SHALL indicarse que la confirmación corresponde al Vendedor o al Administrador.

