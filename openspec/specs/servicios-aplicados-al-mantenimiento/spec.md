# servicios-aplicados-al-mantenimiento Specification

## Purpose
Registrar servicios del catálogo en las órdenes de mantenimiento con precio aplicado independiente del referencial, cantidades, servicios correctivos sin cargo y totales calculados por el servidor.
## Requirements
### Requirement: Agregar servicios activos del catálogo

Mientras la intervención editable de una orden esté abierta, un usuario con `mantenimientos.gestionar` SHALL poder agregar líneas que referencien servicios activos del **catálogo de servicios**. SHALL NOT admitirse servicios libres fuera del catálogo, servicios inactivos ni productos. Cada línea SHALL pertenecer a una sola intervención y SHALL conservar la referencia al servicio. También SHALL conservar los datos vigentes al agregarla: nombre del servicio, **precio referencial** y selección tributaria artesanal. La cantidad SHALL ser un entero positivo y su valor inicial SHALL ser 1. Un mismo servicio agregado varias veces SHALL formar líneas independientes, sin fusionarse ni recalcular los precios de las otras líneas. Agregar una línea SHALL poder reintentarse sin crear duplicados. Trazabilidad: RN-TAL-008; RF-TAL-005; CU-017; UI-072; P3.

#### Scenario: Agregar un servicio con su precio referencial
- **DADO** una orden registrada y el servicio activo «Alineación» con un precio referencial de USD 25,00
- **CUANDO** un Encargado del taller lo agrega con cantidad 1 sin cambiar el precio
- **ENTONCES** la línea SHALL conservar «Alineación», un precio referencial de USD 25,00, un precio aplicado de USD 25,00 y un subtotal de USD 25,00.

#### Scenario: Servicio inactivo o inexistente
- **DADO** un servicio inactivo o un identificador que no corresponde a un servicio
- **CUANDO** se intenta agregarlo a una orden
- **ENTONCES** el sistema SHALL rechazarlo sin crear la línea.

#### Scenario: Servicio libre fuera del catálogo
- **DADO** una solicitud con un nombre y un precio sin un servicio del catálogo
- **CUANDO** se intenta agregar como línea
- **ENTONCES** el sistema SHALL rechazarla.

#### Scenario: Servicio repetido
- **DADO** una orden con una línea de «Alineación» a USD 25,00
- **CUANDO** se agrega otra vez «Alineación» con un precio aplicado de USD 30,00
- **ENTONCES** SHALL existir dos líneas independientes con sus propios precios y el total SHALL ser USD 55,00.

#### Scenario: Reintento al agregar una línea
- **DADO** una solicitud para agregar una línea que se envía dos veces con la misma clave de reintento
- **CUANDO** el sistema procesa ambas
- **ENTONCES** SHALL existir una sola línea.

### Requirement: Precio aplicado independiente del catálogo

Cada línea SHALL tener un **precio aplicado** en USD: un decimal no negativo con hasta dos decimales, final para el cliente e impuesto incluido cuando corresponda. Su valor inicial SHALL ser el precio referencial. Un usuario con `mantenimientos.cambiar_precio_servicio`, es decir Administrador o Encargado del taller, SHALL poder fijarlo al agregar o editar la línea, sin que se exija un motivo. El precio cero SHALL admitirse. Los valores negativos, no numéricos o con más de dos decimales SHALL rechazarse sin redondear. Un usuario sin ese permiso SHALL NOT cambiarlo. Cambiar el precio aplicado SHALL modificar solo esa línea y SHALL registrar al usuario en la auditoría. SHALL NOT modificar el precio del catálogo. SHALL NOT existir campos de descuento, porcentajes ni promociones. Trazabilidad: DP-004/017/020; RN-TAL-009; RF-TAL-006; CU-017 5/5a; UI-072.

#### Scenario: Ajustar el precio aplicado
- **DADO** una línea de «Cambio de embrague» con un precio referencial de USD 300,00
- **CUANDO** un Encargado del taller fija un precio aplicado de USD 350,00
- **ENTONCES** la línea SHALL conservar USD 350,00 como precio aplicado y USD 300,00 como precio referencial, y el catálogo SHALL seguir en USD 300,00.

#### Scenario: Precio aplicado inválido
- **DADO** una línea de servicio
- **CUANDO** se ingresa un precio aplicado de −1,00 o de 10,005
- **ENTONCES** el sistema SHALL rechazarlo con un error de campo, sin redondear.

#### Scenario: Precio aplicado cero
- **DADO** una línea de servicio de una intervención inicial
- **CUANDO** se fija un precio aplicado de USD 0,00
- **ENTONCES** el sistema SHALL aceptarlo y el subtotal SHALL ser USD 0,00.

#### Scenario: Intento de aplicar un descuento
- **DADO** una solicitud de línea con un campo de descuento o de porcentaje
- **CUANDO** se procesa
- **ENTONCES** el sistema SHALL rechazar o ignorar ese campo y SHALL NOT reducir el importe.

### Requirement: Cambios posteriores del catálogo

Un cambio posterior del nombre, del precio referencial, de la selección tributaria o del estado del servicio en el catálogo SHALL NOT recalcular ni modificar las líneas ya agregadas, en ninguna orden y en ningún estado. Los servicios nuevos agregados después SHALL tomar los valores vigentes en ese momento. Trazabilidad: CU-016 (alternativa); invariante 15 del modelo de dominio; RF-TAL-005.

#### Scenario: Cambio de precio referencial después de agregar el servicio
- **DADO** una orden con «Alineación» agregada a USD 25,00
- **CUANDO** el catálogo cambia el precio referencial a USD 28,00
- **ENTONCES** la línea existente SHALL conservar USD 25,00 como precio referencial y aplicado, y una línea nueva de «Alineación» SHALL iniciar con USD 28,00.

#### Scenario: Servicio desactivado después de usarse
- **DADO** una orden finalizada con una línea de «Lavado de motor»
- **CUANDO** el servicio se desactiva o se renombra en el catálogo
- **ENTONCES** la orden SHALL seguir mostrando la línea con el nombre y los importes conservados.

### Requirement: Editar y retirar líneas mientras la intervención esté abierta

Mientras la intervención de una línea esté abierta y la orden no esté finalizada, un usuario con `mantenimientos.gestionar` SHALL poder cambiar su cantidad o retirarla. Cambiar el precio aplicado SHALL exigir además `mantenimientos.cambiar_precio_servicio`. Retirar una línea SHALL quitarla del total y SHALL registrarse en la auditoría. Las líneas de una intervención ya finalizada SHALL NOT editarse ni retirarse, tampoco con la orden reabierta. Cada modificación SHALL exigir la versión vigente de la orden y SHALL rechazarse como conflicto si la orden cambió o se finalizó. Trazabilidad: RN-TAL-003/018; RF-TAL-005/006; P2.

#### Scenario: Cambiar la cantidad
- **DADO** una línea con precio aplicado de USD 12,50 y cantidad 1 en una orden registrada
- **CUANDO** se cambia la cantidad a 3
- **ENTONCES** el subtotal SHALL ser USD 37,50 y el total de la orden SHALL recalcularse en el servidor.

#### Scenario: Cantidad inválida
- **DADO** una línea de servicio
- **CUANDO** se ingresa una cantidad de 0, −1 o 1,5
- **ENTONCES** el sistema SHALL rechazarla con un error de campo.

#### Scenario: Retirar una línea
- **DADO** una orden registrada con dos líneas
- **CUANDO** un usuario autorizado retira una de ellas
- **ENTONCES** el total SHALL incluir solo la línea restante.

#### Scenario: Modificar líneas de una orden finalizada
- **DADO** una orden finalizada
- **CUANDO** se intenta agregar, editar o retirar una línea
- **ENTONCES** el sistema SHALL rechazarlo indicando que la orden debe reabrirse.

### Requirement: Servicios correctivos sin cargo

Las líneas agregadas a una intervención correctiva SHALL registrarse sin cargo al cliente, con un precio aplicado de USD 0,00. Conservarán el precio referencial vigente solo como dato informativo. Se mostrarán como servicios correctivos sin cargo y SHALL NOT aumentar el total cobrable de la orden. Los importes de la intervención inicial SHALL conservarse sin cambios. Trazabilidad: DP-015; RN-TAL-019; RF-TAL-020; UI-078; P2/P3.

#### Scenario: Servicio correctivo
- **DADO** una orden reabierta cuya intervención inicial suma USD 120,00
- **CUANDO** se agrega a la intervención correctiva «Ajuste de frenos», con un precio referencial de USD 20,00
- **ENTONCES** la línea SHALL registrar un precio aplicado de USD 0,00 como servicio correctivo sin cargo y el total cobrable SHALL permanecer en USD 120,00.

#### Scenario: Intento de cobrar un servicio correctivo
- **DADO** una línea de una intervención correctiva
- **CUANDO** se intenta fijar un precio aplicado mayor que cero
- **ENTONCES** el sistema SHALL rechazarlo.

### Requirement: Subtotales y total calculados por el servidor

El servidor SHALL calcular el subtotal de cada línea como cantidad × precio aplicado, en decimal exacto y en USD con dos decimales. SHALL calcular el total de servicios de la orden como la suma de los subtotales de sus intervenciones. Los importes enviados por el cliente para subtotales o totales SHALL ignorarse. El total SHALL identificarse como «total de servicios de la orden». SHALL NOT presentarse como saldo por cobrar, deuda, factura, documento interno ni operación artesanal confirmada. SHALL NOT mostrarse un desglose de impuestos ni aplicarse una tarifa fijada en el código. La selección tributaria conservada en cada línea SHALL quedar disponible para que la futura operación de servicios resuelva la vigencia con la configuración existente. Trazabilidad: DP-017/018; RF-TAL-007; RN-TAL-010; decisiones de la propuesta sobre impuestos.

#### Scenario: Precisión decimal
- **DADO** las líneas 3 × USD 0,10 y 1 × USD 19,99
- **CUANDO** el servidor calcula el total
- **ENTONCES** los subtotales SHALL ser USD 0,30 y USD 19,99 y el total SHALL ser exactamente USD 20,29.

#### Scenario: Total manipulado por el cliente
- **DADO** una solicitud que envía un subtotal o un total diferente
- **CUANDO** el servidor la procesa
- **ENTONCES** SHALL conservar y devolver los valores que calculó.

#### Scenario: Presentación del total
- **DADO** el detalle de una orden con servicios
- **CUANDO** se muestra el total
- **ENTONCES** SHALL rotularse como total de servicios de la orden, con los precios identificados como aplicados a esa orden, sin saldo, pagos, factura ni desglose de impuestos.

### Requirement: Autorización de las acciones sobre servicios

Agregar, editar y retirar líneas SHALL exigir `mantenimientos.gestionar`. Fijar un precio aplicado distinto del referencial SHALL exigir además `mantenimientos.cambiar_precio_servicio`. Consultar las líneas SHALL exigir `mantenimientos.ver`. Un usuario con solo el rol Vendedor SHALL NOT consultar ni modificar líneas. Trazabilidad: actores-y-roles §3.5; RF-TAL-005/006.

#### Scenario: Vendedor intenta agregar un servicio
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** envía directamente una solicitud para agregar una línea
- **ENTONCES** el sistema SHALL denegarla sin crear la línea.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
