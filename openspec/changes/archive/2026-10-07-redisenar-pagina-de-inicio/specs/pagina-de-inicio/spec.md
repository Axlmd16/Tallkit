## ADDED Requirements

### Requirement: Resumen de inicio limitado por permisos efectivos

La página de inicio SHALL presentar un resumen de trabajo compuesto por cuatro bloques: acciones rápidas, pendientes, por cobrar y cobros recientes. El servidor SHALL exigir usuario activo con sesión vigente y SHALL decidir en cada consulta qué bloques e indicadores entrega según los **permisos efectivos** del usuario. Un indicador no autorizado SHALL NOT entregarse, ni con valor cero ni oculto en la respuesta. Los roles acumulados SHALL sumar sus indicadores. El resumen SHALL NOT entregar costos, costo promedio, valoración de inventario ni margen a ningún rol. Ocultar un bloque en pantalla SHALL NOT sustituir la autorización del servidor. Trazabilidad: D1; CT-001; UI-002; RF-ACC-008; RNF-SEG-002/003; `autorizacion-y-navegacion` («Navegación conforme a permisos»).

#### Scenario: Resumen de un Vendedor
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** abre la página de inicio
- **ENTONCES** SHALL recibir únicamente acciones e indicadores del RUC comercial y SHALL NOT recibir mantenimientos abiertos, saldos ni cobros artesanales.

#### Scenario: Resumen de un Encargado del taller
- **DADO** un usuario con solo el rol Encargado del taller
- **CUANDO** abre la página de inicio
- **ENTONCES** SHALL recibir únicamente acciones e indicadores del taller y del RUC artesanal y SHALL NOT recibir proformas, saldos ni cobros comerciales.

#### Scenario: Roles acumulados
- **DADO** un usuario Vendedor y Encargado del taller sin rol Administrador
- **CUANDO** abre la página de inicio
- **ENTONCES** SHALL recibir la unión de los indicadores de ambos roles, separados por entidad fiscal, y SHALL NOT recibir el aviso de la calificación artesanal.

#### Scenario: Consulta directa sin permiso
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** solicita directamente al servidor un indicador artesanal del resumen
- **ENTONCES** el servidor SHALL negarlo sin revelar su valor.

#### Scenario: Sesión invalidada
- **DADO** una sesión invalidada por desactivación o reducción de roles
- **CUANDO** se consulta el resumen
- **ENTONCES** SHALL denegarse el acceso y la interfaz SHALL solicitar un nuevo inicio de sesión.

### Requirement: Acciones rápidas hacia las operaciones frecuentes

El bloque de acciones rápidas SHALL ofrecer accesos a: nueva venta, nueva proforma, nuevo mantenimiento, registrar entrada y cobrar. Cada acceso SHALL mostrarse solo cuando el usuario tenga el permiso que ya exige su pantalla de destino y SHALL conducir a esa pantalla existente. Activar un acceso SHALL NOT crear, confirmar, numerar ni cobrar nada por sí mismo. «Cobrar» SHALL conducir a las **cuentas por cobrar** de la entidad fiscal correspondiente, donde se elige la operación; cuando el usuario pueda cobrar en las dos entidades, SHALL ofrecerse un acceso por entidad, cada uno identificado con su ámbito. Trazabilidad: D1; UI-002; DP-013; DP-030; RF-ACC-008; RN-FIS-009.

#### Scenario: Accesos de un Vendedor
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** ve las acciones rápidas
- **ENTONCES** SHALL ver nueva venta, nueva proforma, registrar entrada y cobrar repuestos, y SHALL NOT ver nuevo mantenimiento ni cobrar servicios.

#### Scenario: Cobrar con las dos entidades
- **DADO** un Administrador
- **CUANDO** ve las acciones rápidas
- **ENTONCES** SHALL ver un acceso para cobrar repuestos y otro para cobrar servicios, cada uno con el nombre, el icono y el tono de su entidad fiscal.

#### Scenario: Acceso sin efectos
- **DADO** un Vendedor en la página de inicio
- **CUANDO** activa «Nueva venta» y abandona la pantalla sin guardar
- **ENTONCES** SHALL NOT existir una venta nueva, un número consumido ni un movimiento de inventario.

### Requirement: Pendientes con acceso a su lista

El bloque de pendientes SHALL mostrar, para quien pueda consultar la lista correspondiente, el número de:

- **Mantenimientos abiertos:** órdenes en estado `registrado` o `reabierto`. Solo para quien puede listar órdenes de mantenimiento.
- **Ventas de contado sin cobrar:** ventas comerciales confirmadas, con condición contado y saldo pendiente mayor que cero.
- **Servicios de contado sin cobrar:** operaciones artesanales confirmadas, con condición contado y saldo pendiente mayor que cero.
- **Proformas por vencer:** proformas vigentes cuya vigencia termina hoy o mañana según el calendario de America/Guayaquil.
- **Retenciones por completar:** retenciones recibidas vigentes con comprobante pendiente, un indicador por entidad fiscal.
- **Borradores sin terminar:** ventas en borrador y proformas en borrador, contadas por separado.
- **Calificación artesanal por vencer:** solo para el Administrador, cuando falten 60 días o menos para su vencimiento o ya esté vencida, con la fecha y los días restantes.

Cada pendiente SHALL identificar su entidad fiscal cuando sea económico y SHALL conducir a su lista existente ya filtrada, de modo que el número de registros de esa lista coincida con el conteo mostrado en ese momento. Un pendiente autorizado con valor cero SHALL permanecer visible, sin énfasis de advertencia. Los pendientes SHALL NOT sumarse entre sí ni presentarse como mora, vencimiento de deuda o intereses. Trazabilidad: D1; UI-002; DP-027; DP-029; DP-031 (D4); DP-032 (D2); DP-033 (D2); RN-FIS-008/009; RF-TAL-001; RF-PRO-005; RF-PAG-006; `ordenes-de-mantenimiento`, `proformas-comerciales`, `retenciones-recibidas-en-cobros` («Seguimiento de comprobantes pendientes»), `configuracion-operativa-y-fiscal`.

#### Scenario: Mantenimientos abiertos
- **DADO** tres órdenes en estado `registrado`, una en `reabierto`, cinco en `finalizado` y una en `cancelado`
- **CUANDO** un Encargado del taller abre la página de inicio
- **ENTONCES** SHALL ver cuatro mantenimientos abiertos y, al activar el indicador, SHALL llegar a la lista de mantenimientos con esas cuatro órdenes.

#### Scenario: Venta de contado con cobro interrumpido
- **DADO** una venta comercial al contado confirmada de total 100.00 sin pagos y otra a crédito con saldo 50.00
- **CUANDO** un Vendedor abre la página de inicio
- **ENTONCES** SHALL contarse una venta de contado sin cobrar y la venta a crédito SHALL NOT contarse en ese indicador.

#### Scenario: Contado cubierto con retención
- **DADO** una venta al contado de total 100.00 con un pago vigente de 98.00 y una retención recibida vigente de 2.00
- **CUANDO** se consulta el resumen
- **ENTONCES** SHALL NOT contarse entre las ventas de contado sin cobrar.

#### Scenario: Proformas que vencen hoy o mañana
- **DADO** proformas vigentes que vencen hoy, mañana y dentro de tres días, y una que venció ayer
- **CUANDO** un Vendedor abre la página de inicio
- **ENTONCES** SHALL ver dos proformas por vencer.

#### Scenario: Retenciones separadas por entidad
- **DADO** dos retenciones comerciales y una artesanal con comprobante pendiente
- **CUANDO** un Administrador abre la página de inicio
- **ENTONCES** SHALL ver un indicador comercial con dos y otro artesanal con uno, sin un total conjunto.

#### Scenario: Entidad que no registra retenciones
- **DADO** una entidad fiscal con el registro de retenciones desactivado y sin retenciones pendientes
- **CUANDO** se consulta el resumen
- **ENTONCES** SHALL NOT mostrarse el indicador de retenciones de esa entidad.

#### Scenario: Calificación artesanal dentro del plazo de aviso
- **DADO** una calificación artesanal a la que le faltan 45 días para vencer
- **CUANDO** un Administrador abre la página de inicio
- **ENTONCES** SHALL ver el aviso con la fecha de vencimiento y los 45 días restantes, y un Encargado del taller sin rol Administrador SHALL NOT recibirlo.

#### Scenario: Calificación artesanal fuera del plazo de aviso
- **DADO** una calificación artesanal a la que le faltan 61 días para vencer
- **CUANDO** un Administrador abre la página de inicio
- **ENTONCES** SHALL NOT mostrarse el aviso.

#### Scenario: Sin pendientes
- **DADO** un Vendedor sin ventas de contado sin cobrar, proformas por vencer, retenciones por completar ni borradores
- **CUANDO** abre la página de inicio
- **ENTONCES** cada indicador SHALL mostrarse en cero sin énfasis de advertencia y el bloque SHALL comunicar con texto que no hay pendientes.

### Requirement: Saldos por cobrar separados por entidad fiscal

El bloque «Por cobrar» SHALL mostrar, por cada entidad fiscal que el usuario pueda consultar, el **saldo pendiente** total y el número de clientes con deuda. El indicador comercial SHALL exigir `pagos_comerciales.ver` y el artesanal `pagos_artesanales.ver`. El saldo SHALL coincidir con la suma de todas las coincidencias de las cuentas por cobrar de esa entidad sin filtros en ese mismo momento: importe exigible menos dinero neto cobrado y menos retenciones recibidas vigentes. Los reembolsos pendientes SHALL NOT restarse ni mostrarse como deuda. Los dos indicadores SHALL NOT sumarse, compensarse ni acompañarse de un total conjunto, y cada uno SHALL identificar su entidad con nombre, icono y tono, y conducir a sus cuentas por cobrar. Trazabilidad: D1; UI-002; DP-013; DP-027; DP-029; DP-032; RN-FIS-005/008/009; RN-CON-005; RF-REP-006/008; RF-PAG-005; modelo de dominio §10.

#### Scenario: Administrador con deuda en las dos entidades
- **DADO** saldos comerciales de 300.00 repartidos en dos clientes y artesanales de 120.00 en un cliente
- **CUANDO** un Administrador abre la página de inicio
- **ENTONCES** SHALL ver «Repuestos» con 300.00 y dos clientes y «Servicios» con 120.00 y un cliente, y SHALL NOT ver 420.00 en ninguna parte.

#### Scenario: Retención que reduce el saldo
- **DADO** una venta comercial de 100.00 con un pago vigente de 60.00 y una retención recibida vigente de 2.00
- **CUANDO** se consulta el resumen
- **ENTONCES** esa venta SHALL aportar 38.00 al saldo comercial por cobrar.

#### Scenario: Reembolso pendiente
- **DADO** una venta con un exceso pagado de 15.00 pendiente de reembolso y ninguna deuda
- **CUANDO** se consulta el resumen
- **ENTONCES** el saldo comercial por cobrar SHALL NOT incluir ni descontar esos 15.00.

#### Scenario: Coincidencia con las cuentas por cobrar
- **DADO** un indicador artesanal que muestra 120.00
- **CUANDO** el Encargado del taller lo activa
- **ENTONCES** SHALL llegar a las cuentas por cobrar artesanales, cuyo total de todas las coincidencias sin filtros SHALL ser 120.00.

#### Scenario: Sin deuda
- **DADO** una entidad fiscal sin saldos pendientes
- **CUANDO** un usuario autorizado abre la página de inicio
- **ENTONCES** su indicador SHALL mostrar 0.00 y cero clientes, sin énfasis de advertencia.

### Requirement: Cobros de los últimos siete días por entidad fiscal

El bloque de cobros recientes SHALL mostrar, por cada entidad fiscal que el usuario pueda consultar con `pagos_comerciales.ver` o `pagos_artesanales.ver`, el dinero cobrado en cada uno de los últimos siete días calendario de America/Guayaquil, incluido el día actual. El valor de cada día SHALL ser la suma de los pagos vigentes cuya fecha de cobro corresponde a ese día. SHALL NOT incluir retenciones recibidas, pagos anulados o sustituidos ni importes de la otra entidad. Un día sin cobros SHALL mostrarse con 0.00. SHALL mostrarse el total de los siete días por entidad y SHALL NOT mostrarse un total conjunto. El bloque SHALL NOT restar reembolsos, SHALL NOT presentarse como cierre de caja, ingreso neto ni ganancia, y SHALL NOT ofrecer selección de fechas, comparativas ni exportación. Cada valor SHALL poder consultarse también como texto. Trazabilidad: D1, D4; DP-003; DP-019; DP-027; DP-032; RN-FIS-008/009; RN-CON-004/005/008; RF-REP-008/010; RF-PAG-002; RNF-USA-006.

#### Scenario: Siete días con un día sin cobros
- **DADO** que hoy es 2026-10-06 en America/Guayaquil y existen pagos comerciales vigentes todos los días desde el 2026-09-30 salvo el 2026-10-03
- **CUANDO** un Vendedor abre la página de inicio
- **ENTONCES** SHALL ver siete días, del 2026-09-30 al 2026-10-06, con 0.00 el 2026-10-03.

#### Scenario: Cobro cerca de la medianoche
- **DADO** un pago registrado a las 23:30 del 2026-10-05 en America/Guayaquil
- **CUANDO** se consulta el resumen
- **ENTONCES** SHALL contarse en el 2026-10-05 y no en el día siguiente.

#### Scenario: Pago con retención
- **DADO** un cobro de hoy con 98.00 en dinero y una retención recibida de 2.00
- **CUANDO** se consulta el resumen
- **ENTONCES** el día de hoy SHALL incluir 98.00 por ese cobro.

#### Scenario: Pago anulado
- **DADO** un pago de 40.00 de ayer que el Administrador anuló hoy
- **CUANDO** se consulta el resumen
- **ENTONCES** el valor de ayer SHALL NOT incluir esos 40.00.

#### Scenario: Efectivo y transferencia combinados
- **DADO** un pago artesanal de hoy con 30.00 en efectivo y 20.00 en transferencia
- **CUANDO** un Encargado del taller abre la página de inicio
- **ENTONCES** el día de hoy SHALL incluir 50.00 por ese pago.

#### Scenario: Dos entidades sin total conjunto
- **DADO** 500.00 cobrados en siete días en el RUC comercial y 200.00 en el artesanal
- **CUANDO** un Administrador abre la página de inicio
- **ENTONCES** SHALL ver un gráfico por entidad con su total y SHALL NOT ver 700.00.

#### Scenario: Lectura sin el gráfico
- **DADO** una persona que usa un lector de pantalla
- **CUANDO** recorre el bloque de cobros recientes
- **ENTONCES** SHALL poder conocer la fecha y el importe de cada día y el total de cada entidad.

### Requirement: Resumen calculado y de solo lectura

Los valores del resumen SHALL calcularse en el servidor al consultarlo, a partir de las operaciones existentes y de sus correcciones válidas, y SHALL NOT almacenarse como hechos de negocio ni poder editarse. Consultar el resumen SHALL NOT crear, modificar, numerar ni registrar operaciones. La interfaz SHALL NOT calcular saldos, conteos ni totales por su cuenta. El resumen SHALL consultarse al abrir la página de inicio y SHALL NOT actualizarse de forma continua ni en tiempo real. Con una red local estable y el volumen esperado, SHALL responder dentro del objetivo de las consultas habituales. Trazabilidad: modelo de dominio §10; RN-CON-004; RNF-REN-001; RNF-INT-006/008; arquitectura («el frontend no decide totales»).

#### Scenario: Valor actualizado tras una operación
- **DADO** un Vendedor que ve tres ventas de contado sin cobrar
- **CUANDO** cobra por completo una de ellas y vuelve a la página de inicio
- **ENTONCES** SHALL ver dos.

#### Scenario: Consulta sin efectos
- **DADO** cualquier estado del sistema
- **CUANDO** un usuario abre la página de inicio varias veces
- **ENTONCES** SHALL NOT cambiar ninguna operación, existencia, saldo ni secuencia.

#### Scenario: Tiempo de respuesta
- **DADO** una red local estable y el volumen de datos objetivo
- **CUANDO** se consulta el resumen
- **ENTONCES** SHALL responder en 2 segundos o menos en al menos el 95 % de las mediciones.

### Requirement: Estados independientes por bloque

Cada bloque SHALL distinguir por sí mismo carga, contenido y error, conforme a PPF-07, sin reemplazar la página ni impedir el uso de los demás bloques. Un bloque con error SHALL explicar el fallo en lenguaje llano y ofrecer «Reintentar» solo para ese bloque. Ningún estado SHALL mostrar valores inventados, anteriores presentados como actuales ni un cero en lugar de un dato que no pudo obtenerse. Las acciones rápidas SHALL permanecer disponibles aunque fallen las consultas del resumen. Un usuario sin ninguna acción ni indicador autorizado SHALL ver un estado vacío que explique que su cuenta todavía no tiene funciones asignadas. Trazabilidad: PPF-07; RNF-USA-004/006; UI-002.

#### Scenario: Falla un solo bloque
- **DADO** que la consulta de cobros recientes falla por un error recuperable
- **CUANDO** un Vendedor abre la página de inicio
- **ENTONCES** ese bloque SHALL mostrar el error con «Reintentar» y las acciones rápidas, los pendientes y «Por cobrar» SHALL seguir operables.

#### Scenario: Dato no disponible
- **DADO** que no pudo obtenerse el saldo comercial por cobrar
- **CUANDO** se muestra el bloque «Por cobrar»
- **ENTONCES** SHALL NOT mostrarse 0.00 en su lugar.

#### Scenario: Carga
- **DADO** una consulta del resumen en curso
- **CUANDO** se muestra la página
- **ENTONCES** cada bloque pendiente SHALL mostrar marcadores de posición con la forma de su contenido.

#### Scenario: Usuario sin funciones
- **DADO** un usuario cuyos permisos no habilitan ninguna acción ni indicador
- **CUANDO** abre la página de inicio
- **ENTONCES** SHALL ver un estado vacío comprensible y SHALL conservar el acceso al cierre de sesión.

### Requirement: Inicio sin repetir la navegación

La página de inicio SHALL NOT presentar el listado de áreas y opciones del sistema que ya ofrece la navegación principal. La navegación lateral, la ruta de migas y el acceso a inicio SHALL conservarse sin cambios. La página SHALL conservar el título «Inicio» y SHALL identificar al usuario de la sesión y sus roles. Trazabilidad: D3; `interfaz-y-navegacion.md` §2.1; `experiencia-adaptable-frontend` («Navegación lateral adaptable y autorizada»).

#### Scenario: Inicio de un Administrador
- **DADO** un Administrador con acceso a todas las áreas
- **CUANDO** abre la página de inicio
- **ENTONCES** SHALL ver los bloques del resumen y SHALL NOT ver una lista de todas las áreas y opciones, que seguirán disponibles en la navegación lateral.

### Requirement: Presentación conforme al sistema Tallkit

La página de inicio SHALL usar los fundamentos, tokens, piezas y patrones ya definidos en `sistema-visual-frontend` y `patrones-de-pantalla-frontend`, sin colores, tipografías, sombras ni radios propios. Los pendientes SHALL agruparse en un panel compacto y comparable, sin una tarjeta con sombra por cada dato. El azul Tallkit SHALL reservarse a la acción principal. Todo indicador económico SHALL identificar su entidad fiscal con nombre, icono y tono, y ningún estado SHALL depender solo del color. Los importes SHALL usar la pieza de importes existente. La página SHALL ocupar todo el ancho disponible, SHALL ser utilizable desde 360 px sin desplazamiento horizontal de la página, SHALL ofrecer objetivos táctiles de al menos 44 px y SHALL poder operarse por completo con teclado y foco visible. Trazabilidad: D2; `sistema-visual-frontend`; PPF-07; `experiencia-adaptable-frontend`; RNF-USA-001/006/007/008/009/010.

#### Scenario: Teléfono de 360 px
- **DADO** una pantalla de 360 px de ancho
- **CUANDO** un usuario abre la página de inicio
- **ENTONCES** los bloques SHALL apilarse sin desplazamiento horizontal de la página y cada acción rápida e indicador SHALL poder activarse con el dedo.

#### Scenario: Uso con teclado
- **DADO** un usuario que solo usa el teclado
- **CUANDO** recorre la página de inicio
- **ENTONCES** SHALL alcanzar cada acción rápida e indicador en un orden coherente, con foco visible, y SHALL poder activarlos.

#### Scenario: Persona que no distingue el color
- **DADO** un indicador comercial y otro artesanal en la misma fila
- **CUANDO** los observa una persona que no percibe la diferencia de tono
- **ENTONCES** SHALL distinguirlos por su nombre y su icono.

#### Scenario: Coherencia con el resto de las pantallas
- **DADO** la página de inicio junto a una lista existente del sistema
- **CUANDO** se comparan sus paneles, cabeceras, tipografía y acciones
- **ENTONCES** SHALL usar los mismos tokens y piezas, sin valores visuales propios de la página.
