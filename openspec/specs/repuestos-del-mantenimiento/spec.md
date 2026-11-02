# repuestos-del-mantenimiento Specification

## Purpose
Registrar los repuestos de una orden como líneas de la única venta comercial abierta vinculada, que reservan disponibilidad sin descontar existencia ni generar deuda, y cuya confirmación comercial produce una sola salida de inventario, con trazabilidad entre orden, venta y Kardex y sin repuestos cobrables durante una reapertura.
## Requirements
### Requirement: Venta abierta vinculada única por orden

Cada orden SHALL tener como máximo una **venta comercial vinculada abierta** (en borrador) y SHALL poder conservar varias ventas vinculadas confirmadas o anuladas. La venta vinculada SHALL pertenecer al **RUC comercial**, SHALL tener como cliente el cliente de la orden y SHALL identificar la orden como su origen de forma inmutable. SHALL crearse al agregar el primer repuesto cuando no exista una abierta, y SHALL reutilizarse mientras permanezca abierta. Crear una venta vinculada SHALL NOT consumir numeración comercial, SHALL NOT crear deuda ni salidas de inventario y SHALL NOT depender de que el usuario vuelva a capturar cliente ni productos. La creación SHALL ser segura ante reintentos y solicitudes simultáneas: nunca SHALL existir dos ventas vinculadas abiertas para la misma orden. Trazabilidad: invariante 10; RN-FIS-007; RN-TAL-012; RF-TAL-010/012; RF-VEN-002; CU-018 3/3a.

#### Scenario: Primer repuesto crea la venta vinculada
- **DADO** una orden registrada del cliente A sin ventas vinculadas
- **CUANDO** un Encargado del taller agrega 2 unidades del producto «Filtro de aceite»
- **ENTONCES** SHALL existir una venta comercial en borrador del cliente A, con origen en esa orden, sin número, deuda ni movimiento de Kardex, y con esa línea.

#### Scenario: Siguiente repuesto reutiliza la venta abierta
- **DADO** una orden con una venta vinculada abierta que contiene una línea
- **CUANDO** se agrega otro producto
- **ENTONCES** la línea SHALL añadirse a la misma venta abierta y SHALL NOT crearse otra venta.

#### Scenario: Primeros repuestos agregados simultáneamente
- **DADO** una orden registrada sin venta vinculada abierta
- **CUANDO** dos usuarios agregan al mismo tiempo un repuesto cada uno
- **ENTONCES** SHALL existir una sola venta vinculada abierta con ambas líneas, o una de las solicitudes SHALL rechazarse como conflicto sin efectos, y nunca SHALL existir una segunda venta abierta.

#### Scenario: Nuevo repuesto después de confirmar la venta anterior
- **DADO** una orden registrada cuya venta vinculada `COM-VEN-000031` ya fue confirmada
- **CUANDO** se agrega un repuesto adicional
- **ENTONCES** SHALL crearse una nueva venta vinculada abierta sin modificar `COM-VEN-000031`, y ambas SHALL mostrarse relacionadas con la orden.

### Requirement: Selección de productos vendibles con ayuda de disponibilidad

Mientras la orden esté `registrada`, un usuario con `mantenimientos.gestionar_repuestos` y `ventas.preparar_vinculada` SHALL poder buscar productos por coincidencia parcial de código interno, código del fabricante o nombre, sin distinguir mayúsculas ni espacios exteriores, con paginación. SHALL poder seleccionar únicamente productos activos del catálogo. Los resultados SHALL mostrar existencia, cantidad reservada y **disponibilidad** actuales como ayuda informativa, sin costos ni valoración para quien no tenga `productos.ver_costos` o `inventario.ver_valorizacion`. SHALL NOT admitirse servicios, productos inactivos ni productos libres fuera del catálogo. Trazabilidad: DP-009/012; RF-TAL-010; RF-INV-007; CU-018 1/2/4; UI-074.

#### Scenario: Buscar por código y ver disponibilidad
- **DADO** el producto activo «FO-100 Filtro de aceite» con existencia 5, reservada 2 y disponibilidad 3
- **CUANDO** un Encargado del taller busca «fo-1»
- **ENTONCES** SHALL mostrarse el producto con existencia 5, reservada 2 y disponibilidad 3, sin costo ni valoración.

#### Scenario: Producto inactivo o servicio
- **DADO** un producto inactivo o un identificador de servicio
- **CUANDO** se intenta agregarlo como repuesto
- **ENTONCES** el sistema SHALL rechazarlo sin crear línea, venta ni reserva.

### Requirement: Líneas pendientes que reservan sin descontar

Cada repuesto agregado SHALL formar una línea de la venta vinculada abierta con producto y cantidad entera positiva de presentaciones completas. El precio de la línea SHALL ser el precio final vigente del catálogo y SHALL NOT editarse en la orden ni en la venta, para ningún rol; SHALL NOT aceptarse descuentos. Un mismo producto agregado varias veces SHALL formar líneas independientes que SHALL identificarse por su propia identidad, no solo por el producto. Agregar o aumentar una línea SHALL crear o aumentar una **reserva de mantenimiento** por esa cantidad, únicamente si la disponibilidad del producto lo permite. La reserva SHALL reducir disponibilidad y SHALL NOT reducir existencia, generar Kardex, costo, deuda ni numeración. Si la disponibilidad es insuficiente, la solicitud SHALL rechazarse informando la disponibilidad actual, sin crear ni modificar la línea ni la reserva. Agregar una línea SHALL poder reintentarse sin duplicarla. Trazabilidad: DP-004/009/012/026; RN-VEN-002; RF-TAL-010; CU-018 3/3b/5.

#### Scenario: Agregar un repuesto con disponibilidad suficiente
- **DADO** el producto «Bujía» con existencia 10 y sin reservas, y una orden registrada
- **CUANDO** un Encargado del taller agrega 4 unidades
- **ENTONCES** la venta vinculada SHALL tener una línea de 4 unidades al precio final vigente, la reserva del producto SHALL ser 4, su disponibilidad 6 y su existencia SHALL seguir en 10, sin movimiento de Kardex ni deuda.

#### Scenario: Disponibilidad insuficiente al agregar
- **DADO** el producto «Batería» con existencia 2, de las cuales 2 ya están reservadas por otra orden
- **CUANDO** se intenta agregar 1 unidad a una orden
- **ENTONCES** el sistema SHALL rechazarlo indicando disponibilidad 0, sin crear línea, venta ni reserva.

#### Scenario: Mismo producto en dos líneas
- **DADO** una venta vinculada abierta con una línea de 2 unidades de «Bujía»
- **CUANDO** se agrega otra línea de 1 unidad de «Bujía»
- **ENTONCES** SHALL existir dos líneas independientes, la reserva total del producto SHALL ser 3 y la disponibilidad SHALL validarse contra la suma de ambas.

#### Scenario: Intento de cambiar el precio o aplicar un descuento
- **DADO** un Encargado del taller o un Administrador que agrega un repuesto
- **CUANDO** envía un precio distinto del catálogo, un descuento o un porcentaje
- **ENTONCES** el sistema SHALL rechazar esos campos y la línea SHALL NOT registrarse con un importe diferente.

#### Scenario: Reintento al agregar un repuesto
- **DADO** una solicitud para agregar un repuesto enviada dos veces con la misma identidad de intento
- **CUANDO** el sistema procesa ambas
- **ENTONCES** SHALL existir una sola línea y una sola reserva por su cantidad.

#### Scenario: Cantidad inválida
- **DADO** una orden registrada
- **CUANDO** se intenta agregar un repuesto con cantidad 0, −1 o 1,5
- **ENTONCES** el sistema SHALL rechazarla con un error de campo sin crear línea ni reserva.

### Requirement: Modificar y retirar líneas pendientes

Mientras la venta vinculada siga abierta y la orden esté `registrada`, un usuario con `mantenimientos.gestionar_repuestos` SHALL poder cambiar la cantidad de una línea o retirarla. Aumentar la cantidad SHALL validar la disponibilidad adicional; disminuirla o retirar la línea SHALL liberar exactamente la reserva correspondiente. Cada modificación SHALL exigir la versión vigente de la venta vinculada y SHALL rechazarse como conflicto si otra acción la cambió, la confirmó o si la orden se finalizó. Las líneas de una venta ya confirmada o anulada SHALL NOT modificarse ni retirarse. Retirar la última línea SHALL eliminar el borrador vinculado vacío en la misma acción atómica, junto con la liberación de su reserva. Esa eliminación SHALL auditarse con la venta y la orden afectadas, y SHALL NOT generar un documento vacío confirmado. Agregar un repuesto después SHALL crear un borrador vinculado nuevo. Cada cambio SHALL auditarse. Trazabilidad: RF-TAL-010; CU-018 5; CU-019 3; DP-021; propuesta A1.

#### Scenario: Retirar un repuesto no utilizado
- **DADO** una venta vinculada abierta con dos líneas, una de ellas de 4 «Bujía» con reserva 4
- **CUANDO** un Encargado del taller retira la línea de «Bujía»
- **ENTONCES** la línea SHALL dejar de existir, la reserva del producto SHALL disminuir en 4, la venta SHALL seguir abierta con la otra línea y SHALL NOT producirse movimiento de Kardex.

#### Scenario: Retirar el último repuesto elimina el borrador vacío
- **DADO** una orden registrada cuya venta vinculada abierta tiene una sola línea de 2 «Filtro» con reserva 2
- **CUANDO** un Encargado del taller retira esa línea
- **ENTONCES** la reserva SHALL liberarse, la venta vinculada en borrador SHALL dejar de existir y SHALL NOT aparecer en la lista de ventas, la orden SHALL quedar sin repuestos pendientes y la auditoría SHALL registrar la eliminación con la venta y la orden.

#### Scenario: Nuevo repuesto después de vaciar la venta
- **DADO** una orden cuyo borrador vinculado se eliminó al retirar su último repuesto
- **CUANDO** se agrega otro repuesto
- **ENTONCES** SHALL crearse un nuevo borrador vinculado con esa línea y su reserva.

#### Scenario: Reintento de retirar el último repuesto
- **DADO** una solicitud para retirar la última línea que ya se procesó y eliminó el borrador
- **CUANDO** llega otra vez con la misma identidad de intento
- **ENTONCES** SHALL devolverse el resultado existente sin error ni efectos adicionales.

#### Scenario: Aumentar la cantidad sin disponibilidad
- **DADO** una línea de 2 unidades y una disponibilidad restante de 1 para ese producto
- **CUANDO** se cambia la cantidad a 4
- **ENTONCES** el sistema SHALL rechazarlo indicando la disponibilidad, y la línea y la reserva SHALL permanecer en 2.

#### Scenario: Modificar una línea ya confirmada
- **DADO** una línea de una venta vinculada confirmada
- **CUANDO** se intenta cambiar su cantidad o retirarla desde la orden
- **ENTONCES** el sistema SHALL rechazarlo explicando que la venta está confirmada y que una corrección no forma parte de la orden.

#### Scenario: Edición concurrente con la confirmación
- **DADO** un Vendedor que confirma la venta vinculada mientras un Encargado retira o cambia una de sus líneas
- **CUANDO** ambas solicitudes se procesan
- **ENTONCES** SHALL aplicarse una sola en un orden coherente: si la confirmación se aplica primero, el cambio SHALL rechazarse; si el cambio se aplica primero, la confirmación con la revisión anterior SHALL exigir una nueva revisión o informar que la venta ya no existe. En ningún caso SHALL confirmarse una cantidad distinta de la revisada ni una venta eliminada.

### Requirement: Confirmación comercial de la venta vinculada

La venta vinculada SHALL confirmarse únicamente mediante la confirmación existente de ventas comerciales, por un usuario con `ventas.confirmar` (Administrador o Vendedor), con las mismas validaciones de productos activos, precios vigentes, revisión explícita de totales, configuración tributaria, numeración COM-VEN, idempotencia y concurrencia. El confirmante SHALL elegir la condición contado o crédito. En una sola acción atómica SHALL asignarse el número, congelarse los valores históricos, consumirse la reserva de cada línea, generarse exactamente una salida de **Kardex** por la cantidad total de cada producto y nacer el importe exigible. Productos repetidos SHALL sumarse correctamente. Si falla cualquier validación, incluida la disponibilidad, la venta SHALL permanecer abierta con sus líneas y reservas, sin número, salida ni deuda. Confirmar SHALL NOT registrar pagos: el cobro es una acción posterior independiente. Un Encargado del taller sin rol comercial SHALL NOT confirmar la venta. Trazabilidad: DP-002/012/021/025…027; RN-TAL-011/014; RF-TAL-011; RF-VEN-005…008; CU-018 6/6a.

#### Scenario: Confirmar con disponibilidad suficiente
- **DADO** una venta vinculada abierta con 4 «Bujía» reservadas y una existencia de 10
- **CUANDO** un Vendedor revisa los totales y la confirma a crédito
- **ENTONCES** la venta SHALL recibir un número COM-VEN, la reserva SHALL consumirse, SHALL registrarse una sola salida de 4 unidades en el Kardex con origen en esa venta, la existencia SHALL quedar en 6 y SHALL nacer un saldo comercial igual al total, sin pagos.

#### Scenario: Productos repetidos en la confirmación
- **DADO** una venta vinculada con dos líneas de «Bujía» de 2 y 1 unidades
- **CUANDO** se confirma
- **ENTONCES** la existencia del producto SHALL disminuir exactamente en 3 y cada línea SHALL conservar su cantidad, precio e impuesto históricos.

#### Scenario: Confirmación rechazada sin efectos parciales
- **DADO** una venta vinculada con dos productos, uno de los cuales fue desactivado o cuya existencia revalidada dentro de la confirmación resulta menor que su cantidad
- **CUANDO** se confirma
- **ENTONCES** SHALL rechazarse toda la confirmación identificando el producto, sin número, salida, consumo de reserva ni deuda para ninguno de los dos productos, y la venta SHALL permanecer abierta con sus líneas y reservas.

#### Scenario: Confirmación repetida
- **DADO** una venta vinculada ya confirmada
- **CUANDO** se repite su confirmación por un reintento o un doble clic, incluso con otra identidad de intento
- **ENTONCES** SHALL devolverse la venta existente sin segundo número, salida, consumo de reserva ni deuda.

#### Scenario: Encargado del taller intenta confirmar
- **DADO** un usuario con solo el rol Encargado del taller
- **CUANDO** solicita confirmar la venta vinculada de su orden
- **ENTONCES** el sistema SHALL denegarlo sin efectos e indicar que la confirmación corresponde al Vendedor o al Administrador.

#### Scenario: Precio de catálogo cambia antes de confirmar
- **DADO** una venta vinculada revisada con un repuesto a USD 10,00 cuyo precio de catálogo cambia a USD 12,00
- **CUANDO** se intenta confirmar con la revisión anterior
- **ENTONCES** SHALL exigirse revisar el precio y los totales actuales, sin confirmar ni descontar existencia.

### Requirement: Dos órdenes por las últimas unidades

La reserva y la confirmación SHALL validar la disponibilidad dentro de la misma acción atómica que las modifica. Solicitudes simultáneas de distintas órdenes, o de una orden y una venta directa, sobre las mismas unidades SHALL equivaler a un orden completo válido: SHALL NOT producirse existencia ni disponibilidad negativas. Trazabilidad: DP-002/012; invariante 6; RNF-INT-001/002/009.

#### Scenario: Dos órdenes reservan la última unidad
- **DADO** el producto «Correa» con existencia 1 y sin reservas
- **CUANDO** dos órdenes intentan agregar 1 unidad al mismo tiempo
- **ENTONCES** SHALL reservarse para una sola orden y la otra SHALL recibir un rechazo por disponibilidad insuficiente, sin línea ni reserva.

#### Scenario: Venta directa frente a una reserva de mantenimiento
- **DADO** el producto «Correa» con existencia 1 reservada por una orden
- **CUANDO** un Vendedor confirma una venta directa de 1 unidad
- **ENTONCES** la venta directa SHALL rechazarse por disponibilidad insuficiente, sin número ni salida, y la reserva SHALL conservarse.

### Requirement: Repuestos solo en órdenes registradas

Agregar, modificar o retirar repuestos SHALL exigir que la orden esté `registrada`. En una orden `finalizada` SHALL rechazarse indicando que la orden está cerrada. En una orden `reabierta` SHALL rechazarse explicando que el trabajo correctivo no se cobra y que la reposición de repuestos por corrección es una operación futura del Administrador, no una venta. SHALL NOT ofrecerse ninguna acción que simule esa reposición. Las ventas vinculadas ya confirmadas SHALL conservar sus efectos en cualquier estado de la orden. Trazabilidad: DP-015/021; RN-TAL-019/020; CU-019; propuesta P6.

#### Scenario: Agregar un repuesto a una orden reabierta
- **DADO** una orden reabierta por corrección
- **CUANDO** un Encargado del taller intenta agregar un repuesto
- **ENTONCES** el sistema SHALL rechazarlo explicando que el trabajo correctivo no genera cobro y que no existe todavía la reposición por corrección, sin crear venta ni reserva.

#### Scenario: Agregar un repuesto a una orden finalizada
- **DADO** una orden finalizada
- **CUANDO** se intenta agregar un repuesto
- **ENTONCES** el sistema SHALL rechazarlo indicando que la orden está finalizada.

### Requirement: Trazabilidad entre orden, líneas, venta y movimientos

El sistema SHALL permitir navegar desde la orden a cada venta vinculada, desde cada venta vinculada a su orden de origen y desde cada venta confirmada a sus movimientos de Kardex, según los permisos del usuario. Cada línea de repuesto SHALL identificarse de forma estable y, tras la confirmación, SHALL relacionarse con su línea de venta confirmada y con la salida de inventario que la originó. Anular o corregir una venta vinculada SHALL conservar estos vínculos. La relación de origen SHALL NOT poder eliminarse ni cambiarse mediante acciones ordinarias de ventas ni de órdenes. Trazabilidad: RF-TAL-012; RF-VEN-002/016; RF-INV-008; spec `kardex-de-productos` (acceso al origen).

#### Scenario: Navegar de la orden al Kardex
- **DADO** una orden con una venta vinculada confirmada
- **CUANDO** un Administrador abre la venta desde la orden y luego sus movimientos
- **ENTONCES** SHALL ver la venta con su orden de origen y las salidas de Kardex originadas por ella.

#### Scenario: Intento de desvincular la venta
- **DADO** una venta vinculada abierta o confirmada
- **CUANDO** cualquier rol intenta cambiar o quitar su orden de origen mediante una solicitud directa
- **ENTONCES** el sistema SHALL rechazarlo y SHALL conservar el vínculo.

### Requirement: Autorización de las acciones sobre repuestos

Agregar, modificar y retirar repuestos pendientes SHALL exigir `mantenimientos.gestionar_repuestos` y `ventas.preparar_vinculada` (Administrador o Encargado del taller). Confirmar la venta vinculada SHALL exigir `ventas.confirmar` (Administrador o Vendedor). Cobrarla SHALL exigir el permiso de pagos comerciales. Consultar costos y valoración SHALL exigir `productos.ver_costos` o `inventario.ver_valorizacion`. Un Vendedor sin rol de taller SHALL NOT agregar ni modificar repuestos de una orden. Las autorizaciones SHALL validarse en el servidor en cada solicitud y reintento, también cuando la acción llega por los recursos ordinarios de ventas. Trazabilidad: actores-y-roles §3.4/§3.5; CT-001; RNF-SEG.

#### Scenario: Vendedor intenta agregar un repuesto
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** envía directamente una solicitud para agregar un repuesto a una orden
- **ENTONCES** el sistema SHALL denegarla sin crear línea, venta ni reserva.

#### Scenario: Roles acumulados
- **DADO** un usuario con los roles Vendedor y Encargado del taller
- **CUANDO** agrega un repuesto y después confirma la venta vinculada
- **ENTONCES** ambas acciones SHALL permitirse, cada una por el permiso de su rol, sin exponerle costos.

#### Scenario: Usuario anónimo
- **DADO** una solicitud sin sesión válida
- **CUANDO** intenta consultar o agregar repuestos de una orden
- **ENTONCES** el sistema SHALL rechazarla sin revelar datos.

### Requirement: Experiencia de repuestos en la orden

La sección de repuestos del detalle de la orden SHALL separar visualmente la venta abierta, rotulada como «pendiente de confirmar: reserva sin descontar inventario», de las ventas confirmadas, rotuladas con su número y como salida de inventario ya registrada. SHALL mostrar, por línea, producto, cantidad, precio final, subtotal e impuesto, y por venta los subtotales, impuestos y total calculados por el servidor. SHALL explicar que agregar un repuesto no descuenta inventario ni genera deuda y que la salida ocurre cuando el Vendedor o el Administrador confirma la venta. Las líneas confirmadas SHALL mostrarse sin acciones de edición y con una explicación del bloqueo. SHALL incluir estados de carga, vacío, error y éxito, errores por campo, prevención de envíos duplicados y conservación de los datos ingresados ante errores recuperables, con navegación por teclado. Trazabilidad: UI-074/075; specs `sistema-visual-frontend` y `patrones-de-pantalla-frontend`.

#### Scenario: Línea pendiente frente a línea confirmada
- **DADO** una orden con una venta confirmada y otra abierta
- **CUANDO** se muestra la sección de repuestos
- **ENTONCES** las líneas abiertas SHALL presentarse como reservadas pendientes de confirmar, con acciones de edición, y las confirmadas SHALL presentarse con su número de venta, sin acciones de edición y con el motivo del bloqueo.

#### Scenario: Error de disponibilidad conserva la captura
- **DADO** un usuario que ingresó un producto y una cantidad
- **CUANDO** el servidor rechaza la línea por disponibilidad insuficiente
- **ENTONCES** la interfaz SHALL mostrar el error en el campo de cantidad con la disponibilidad actual y SHALL conservar la selección para corregirla.
