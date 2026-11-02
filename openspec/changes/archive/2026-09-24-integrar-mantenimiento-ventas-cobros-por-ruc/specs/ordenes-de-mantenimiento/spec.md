# Órdenes de mantenimiento — delta de integración económica

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24 con P4…P7; decisiones DP-007/012/015/018/021, CT-001; RN-TAL-011…014/017…020; RF-TAL-012/013/016; CU-018/019; UI-075/076; actores-y-roles §3.4/§3.5; spec principal `ordenes-de-mantenimiento`. Este delta incorpora la condición de repuestos pendientes (DP-021), el acceso restringido del Vendedor, el bloqueo de cliente y vehículo con documentos vinculados y los avisos de reapertura. Sustituye el requisito de ausencia de efectos económicos, que era propio de la séptima entrega.

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Ausencia de efectos económicos e inventario

**Reason**: Requisito transitorio de la séptima entrega, que no tenía repuestos, ventas vinculadas ni operación artesanal. Esta entrega incorpora esos efectos mediante acciones explícitas separadas: reservas y ventas vinculadas en `repuestos-del-mantenimiento`, y documentos y cobros en `operacion-artesanal-de-servicios` y `pagos-artesanales-y-credito-simple`.

**Migration**: La garantía se conserva con otra forma. Crear, editar, finalizar o reabrir una orden, y gestionar sus datos o fotografías, siguen sin crear ni modificar ventas, reservas, existencias, Kardex, pagos, deudas ni secuencias; así lo exigen los requisitos modificados de finalización y reapertura. Los efectos económicos ocurren únicamente con las acciones explícitas de repuestos, confirmación de venta, documentación de servicios y cobro. No se migran ni se generan datos para las órdenes existentes.
