# existencias-y-ajustes-de-inventario Specification

## Purpose
Mantener existencias y valoración por producto y bodega mediante entradas de stock, cargas iniciales, ajustes con motivo, reversiones exactas y protección contra existencias negativas; distinguir productos sin costo registrado y conciliar saldos desde movimientos.
## Requirements
### Requirement: Existencia comercial explicada por movimientos

El sistema SHALL controlar **existencias** reales de productos por la única **bodega** configurada del RUC comercial. Toda variación SHALL provenir de una operación confirmada y producir un **movimiento de inventario** inmutable con cantidad, sentido, producto, bodega, origen, referencia, usuario, fecha efectiva y saldo resultante. El historial SHALL permitir reconstruir y reconciliar cantidad y valor; cualquier saldo operativo conservado SHALL actualizarse junto con sus movimientos. SHALL NOT existir edición directa de stock o costo promedio desde catálogo ni operaciones genéricas. Trazabilidad: DP-001/002; RN-FIS-002; RN-INV-001/002/016; RF-INV-007/010/013; modelo-dominio §10.

#### Scenario: Borradores excluidos del saldo
- **GIVEN** un producto con 4 unidades y un ingreso en borrador de 7
- **WHEN** se consultan sus existencias
- **THEN** SHALL mostrarse 4 unidades y el borrador no SHALL formar parte de los movimientos contabilizados

#### Scenario: Conciliación con compensaciones
- **GIVEN** entradas de 10, salida de 3 y compensación de esa salida por 3 unidades
- **WHEN** se reconstruye la existencia
- **THEN** SHALL resultar 10 unidades incluyendo todos los movimientos originales e inversos, sin excluir el original por estar corregido

#### Scenario: Escritura directa de saldo
- **GIVEN** un Administrador autorizado para ajustes
- **WHEN** intenta fijar stock o costo promedio mediante edición genérica o catálogo
- **THEN** SHALL rechazarse sin cambiar saldos y exigirse una operación trazable

#### Scenario: Bodega inexistente o diferente
- **GIVEN** una operación sin bodega configurada o que solicita otra bodega
- **WHEN** intenta confirmarse
- **THEN** SHALL rechazarse sin crear otra bodega ni registrar efectos

### Requirement: Consulta de existencias e inactivos

Los tres roles SHALL consultar existencias mediante `inventario.ver`, buscando por código interno, código del fabricante o nombre sin distinguir mayúsculas y filtrando por categoría, estado y con/sin existencias. Los criterios SHALL combinarse por intersección y paginarse con total y orden estable. La consulta inicial SHALL incluir productos activos y también inactivos con saldo o historial; un filtro explícito SHALL permitir consultar todos los inactivos. La ficha SHALL mostrar identidad, presentación, unidad, cantidad real, cantidad reservada y **disponibilidad**, con acceso al **Kardex** y a las ventas vinculadas que sostienen reservas vigentes, según permisos. La falta de movimientos SHALL representar cero una vez consultada la información real, no una cifra simulada durante carga o error. Trazabilidad: RF-INV-007; RF-CAT-005; UI-031/043/074; RNF-USA; CU-008 3; proposal.

#### Scenario: Inactivo con existencias
- **GIVEN** un producto inactivo con 6 unidades
- **WHEN** se abre el inventario sin filtros explícitos
- **THEN** SHALL permanecer visible con su estado, existencia y acceso a historia

#### Scenario: Inactivo agotado con historia
- **GIVEN** un producto inactivo con saldo cero y movimientos previos
- **WHEN** se consulta inventario y Kardex
- **THEN** SHALL conservarse su acceso y mostrarse saldo cero sin eliminar su historia

#### Scenario: Filtros combinados y paginación
- **GIVEN** productos de varias categorías y suficientes coincidencias para varias páginas
- **WHEN** se busca por código o nombre y se filtra categoría y sin existencias
- **THEN** SHALL devolverse solo la intersección con total correcto y orden estable, sin repetir u omitir filas si los datos no cambian

#### Scenario: Existencia, reserva y disponibilidad
- **GIVEN** un producto con existencia 10 y dos órdenes que reservan 3 y 2 unidades
- **WHEN** se consulta su ficha
- **THEN** SHALL mostrarse existencia 10, reservada 5 y disponibilidad 5, y el Kardex SHALL NOT contener movimientos por esas reservas

#### Scenario: Fallo de consulta
- **GIVEN** una consulta de existencia que falla
- **WHEN** se muestra la ficha
- **THEN** SHALL indicarse error recuperable en lugar de presentar cero como saldo confirmado

### Requirement: Protección de costos y operaciones administrativas

Solo Administrador SHALL recibir valoración mediante `inventario.ver_valorizacion` y costos de ficha mediante `productos.ver_costos`. Solo Administrador con `inventario.ajustar` SHALL registrar o confirmar carga inicial, ajustes y correcciones. Roles operativos SHALL recibir únicamente los datos autorizados de cantidades e historia, sin valores económicos en campos, totales, referencias anidadas o errores; SHALL NOT acceder a documentos de compra sin `ingresos.ver`. La unión de roles y seguridad de sesión SHALL aplicarse en cada solicitud. Trazabilidad: CT-001; RF-CAT-005; actores-y-roles §3.2/3.3; RN-SEG-004/007; proposal.

#### Scenario: Operativo consulta inventario
- **GIVEN** un Vendedor o Encargado del taller sin Administrador
- **WHEN** consulta lista, ficha o historial
- **THEN** SHALL recibir cantidades autorizadas sin costo unitario, promedio, valor total, impuesto o total de compra

#### Scenario: Ajuste directo sin permiso
- **GIVEN** un usuario con `inventario.ver` pero sin `inventario.ajustar`
- **WHEN** intenta registrar, confirmar o corregir un ajuste directamente
- **THEN** SHALL denegarse sin movimientos ni acceso a costos

#### Scenario: Administrador con varios roles
- **GIVEN** un usuario con Administrador y Encargado del taller
- **WHEN** consulta valoración o confirma un ajuste válido
- **THEN** SHALL conservar los permisos administrativos sin crear roles nuevos

### Requirement: Carga inicial única y trazable

La carga inicial SHALL registrar por producto cantidad positiva de presentaciones completas, costo inventariable no negativo con hasta seis decimales, motivo, responsable, bodega y momento efectivo. SHALL permitirse únicamente antes de cualquier movimiento del producto, mediante origen CARGA_INICIAL distinguible de compra y ajuste, sin proveedor ficticio ni edición directa del saldo. Dos cargas simultáneas o un reintento SHALL NOT duplicarla. Revertir una carga SHALL conservar su historia y no habilitar otra carga inicial; las correcciones posteriores SHALL usar operaciones vinculadas o ajustes. Datos previos encontrados durante incorporación SHALL reconciliarse antes de cargar y SHALL NOT contabilizarse dos veces. Trazabilidad: RN-INV-001/002/010/014; RNF-INT-004/009/010; proposal recomendación 6.

#### Scenario: Primera carga de producto sin historia
- **GIVEN** un producto activo sin movimientos
- **WHEN** se confirma carga inicial de 8 unidades a costo inventariable 2.50 con motivo
- **THEN** SHALL resultar existencia 8 y valor 20.00, con movimiento identificado y sin compra ni proveedor inventados

#### Scenario: Dos cargas iniciales simultáneas
- **GIVEN** un producto sin historia
- **WHEN** se confirman dos cargas independientes simultáneamente
- **THEN** SHALL aceptarse como máximo una y rechazarse la otra por carga previa sin duplicar cantidades

#### Scenario: Producto con historia aunque esté agotado
- **GIVEN** un producto con movimientos previos y existencia cero
- **WHEN** se intenta una carga inicial
- **THEN** SHALL rechazarse y orientarse al ajuste justificado, sin borrar el historial

#### Scenario: Carga ya compensada
- **GIVEN** una carga inicial anulada mediante compensación
- **WHEN** se intenta otra carga inicial independiente
- **THEN** SHALL rechazarse porque la historia permanece y la corrección requiere la operación correspondiente

### Requirement: Ajustes justificados con vista previa

Un **ajuste de inventario** SHALL registrar producto, sentido entrada/salida, cantidad positiva entera de presentaciones, motivo no vacío y referencia u observación opcional. Una entrada SHALL exigir costo inventariable explícito documentado; una salida SHALL usar el promedio vigente. El Administrador SHALL revisar existencia actual y efecto previsto antes de confirmar. Preparar o cancelar SHALL NOT cambiar stock. Confirmar SHALL revalidar las existencias; si cambió el estado relevante desde la vista previa SHALL exigir revisión actualizada. Nuevas entradas SHALL exigir producto activo; las salidas justificadas y correcciones SHALL poder operar sobre inactivos con stock o historia. SHALL NOT utilizarse ajustes para representar compras, ventas, consumos ni devoluciones físicas. Trazabilidad: RN-INV-010/015/016; RF-INV-009/012/014; CU-009; UI-045; proposal recomendación 6.

#### Scenario: Salida justificada
- **GIVEN** existencia 9 y ajuste preparado por pérdida comprobada de 2 unidades
- **WHEN** el Administrador revisa saldo previsto 7 y confirma con motivo
- **THEN** SHALL resultar saldo 7 y una salida trazable al promedio vigente

#### Scenario: Entrada justificada sin costo
- **GIVEN** una diferencia física positiva comprobada
- **WHEN** se intenta confirmar su ajuste sin costo inventariable explícito o sin motivo
- **THEN** SHALL rechazarse con error de campo, sin inventar costo ni producir movimientos

#### Scenario: Stock cambiado después de la vista previa
- **GIVEN** una vista previa calculada con existencia 9 y otra operación que la cambia a 6
- **WHEN** se intenta confirmar usando la revisión anterior
- **THEN** SHALL comunicarse conflicto y exigirse revisar el efecto actualizado, sin aplicar una salida silenciosa

#### Scenario: Salida de producto inactivo
- **GIVEN** un producto inactivo con 3 unidades físicamente deterioradas
- **WHEN** el Administrador confirma ajuste de salida por 3 con motivo
- **THEN** SHALL permitirse llegar a cero conservando el estado inactivo y la historia

#### Scenario: Cancelación de la vista previa
- **GIVEN** un ajuste preparado válido
- **WHEN** el usuario cancela
- **THEN** SHALL conservarse el saldo y no registrarse un movimiento confirmado

### Requirement: Stock no negativo bajo concurrencia

Toda salida y reversión SHALL validar las existencias y la **disponibilidad** dentro de la misma operación atómica que las modifica. La disponibilidad SHALL ser la existencia menos las reservas vigentes. SHALL NOT confirmarse cantidad superior a la disponibilidad, salvo la venta vinculada que consume sus propias reservas, ni producir existencia o disponibilidad negativas. Ajustes negativos, correcciones de cargas o ingresos, ventas directas y cualquier otra salida SHALL NOT consumir unidades reservadas. Crear o aumentar una reserva SHALL validar la disponibilidad con el mismo rigor. Operaciones simultáneas sobre productos comunes SHALL equivaler a un orden completo válido; una operación de varios productos SHALL aplicarse por completo o no aplicarse. Trazabilidad: DP-002/012; RN-INV-013/016; RF-INV-012; RNF-INT-001/002/009; invariante 6.

#### Scenario: Stock insuficiente
- **GIVEN** existencia 2 y salida solicitada de 3
- **WHEN** se confirma
- **THEN** SHALL rechazarse indicando cantidad disponible e insuficiencia, sin dejar movimiento ni saldo parcial

#### Scenario: Dos salidas sobre las últimas unidades
- **GIVEN** existencia 5 y dos salidas independientes de 4
- **WHEN** se confirman simultáneamente con sus validaciones vigentes
- **THEN** SHALL confirmarse como máximo una, resultar saldo 1 y fallar la otra por conflicto o insuficiencia sin afectar stock

#### Scenario: Entrada y salida concurrentes
- **GIVEN** existencia 2, entrada de 3 y salida de 4 simultáneas
- **WHEN** se procesan
- **THEN** SHALL resultar saldo 1 si la entrada precede a la salida, o saldo 5 si se rechaza primero la salida insuficiente; nunca saldo negativo

#### Scenario: Ajuste negativo sobre unidades reservadas
- **GIVEN** existencia 4 con 3 unidades reservadas por una orden
- **WHEN** el Administrador confirma un ajuste negativo de 2 unidades
- **THEN** SHALL rechazarse indicando disponibilidad 1, sin movimiento ni cambio en la reserva

#### Scenario: Reserva y ajuste simultáneos
- **GIVEN** existencia 3 sin reservas
- **WHEN** una orden reserva 2 unidades mientras se confirma un ajuste negativo de 2
- **THEN** SHALL aplicarse como máximo una de las dos y nunca resultar disponibilidad negativa

### Requirement: Valoración por promedio ponderado y conservación de valor

Entradas con costo SHALL sumar cantidad y valor inventariable y actualizar el **costo promedio ponderado** a seis decimales HALF_UP. El valor previo SHALL conservar los residuos de redondeo trazables; la representación redondeada del promedio SHALL NOT sustituir ni destruir valor acumulado. Las salidas SHALL conservar el promedio vigente sin revalorar movimientos anteriores; el último egreso que agote stock SHALL absorber el residuo pendiente para dejar cantidad y valor cero. La carga inicial y el ajuste de entrada SHALL seguir exigiendo costo y valorar cantidad × costo inventariable informado a seis decimales. La entrada de stock con costo SHALL aportar cantidad × costo unitario informado, sin impuestos; las compras anteriores SHALL conservar el valor inventariable con que se confirmaron.

Una entrada sin costo SHALL aumentar la existencia sin modificar el promedio: SHALL valorarse al promedio vigente del producto o, si su existencia es cero, al último promedio conocido. Si el producto nunca tuvo promedio, SHALL quedar **sin costo registrado**: su existencia SHALL carecer de valor, estado distinto de un valor cero, y sus movimientos SHALL registrarse sin costo. Un producto SHALL estar completamente valorado o completamente sin costo registrado, nunca en parte. La primera entrada con costo de un producto sin costo registrado SHALL valorar a ese costo también las unidades existentes, dejando constancia trazable de esa regularización en la misma operación y sin reescribir movimientos anteriores. Un reingreso cuyo costo histórico de salida esté ausente SHALL tratarse como entrada sin costo. El Administrador SHALL poder identificar los productos sin costo registrado; el valor total del inventario SHALL excluirlos e indicar cuántos quedan fuera, sin presentarlos como cero. La consulta monetaria podrá mostrar centavos, distinguiéndolos de la precisión de costos, pero SHALL ser reproducible desde los movimientos. Trazabilidad: RN-INV-005…007; RNF-INT-006/007; RF-INV-003/007; proposal D1, R1 y R2.

#### Scenario: Promedio ponderado de una entrada
- **GIVEN** 10 unidades con valor 20.00 y una entrada de 5 con valor inventariable 20.00
- **WHEN** se confirma la entrada
- **THEN** SHALL resultar cantidad 15, valor 40.00 y promedio 2.666667 sin modificar precios de venta

#### Scenario: Agotamiento con residuo
- **GIVEN** 3 unidades con valor total 1.000000 y promedio 0.333333
- **WHEN** salen las tres unidades en operaciones sucesivas de una unidad
- **THEN** SHALL valorarse las dos primeras en 0.333333 cada una y la última en 0.333334, quedando cantidad y valor cero

#### Scenario: Entrada posterior a agotamiento
- **GIVEN** un producto agotado con cantidad y valor cero
- **WHEN** ingresa 2 unidades con valor 7.00
- **THEN** SHALL resultar promedio 3.500000 sin arrastrar valor de existencias antiguas

#### Scenario: Valor histórico de una salida
- **GIVEN** una salida valorada con el promedio vigente y una entrada posterior que cambia el promedio
- **WHEN** se consulta la salida anterior
- **THEN** SHALL conservar su costo y valor originales sin aplicar el nuevo promedio

#### Scenario: Entrada sin costo con promedio vigente
- **GIVEN** 10 unidades con valor 20.00 y promedio 2.000000
- **WHEN** se confirma una entrada de 5 unidades sin costo
- **THEN** SHALL resultar cantidad 15, valor 30.00 y promedio 2.000000

#### Scenario: Entrada sin costo tras agotamiento
- **GIVEN** un producto agotado cuyo último promedio conocido fue 3.500000
- **WHEN** se confirma una entrada de 2 unidades sin costo
- **THEN** SHALL resultar cantidad 2, valor 7.00 y promedio 3.500000

#### Scenario: Producto que nunca tuvo costo
- **GIVEN** un producto sin movimientos previos
- **WHEN** se confirma una entrada de 5 unidades sin costo
- **THEN** SHALL resultar existencia 5 y el producto SHALL quedar sin costo registrado, sin valor ni promedio cero

#### Scenario: Primera entrada con costo regulariza
- **GIVEN** un producto sin costo registrado con 5 unidades
- **WHEN** se confirma una entrada de 5 unidades a costo 2.00
- **THEN** SHALL resultar cantidad 10, valor 20.00 y promedio 2.000000, con la regularización de las 5 unidades previas trazable en esa operación y sin modificar movimientos anteriores

#### Scenario: Valor total con productos sin costo
- **GIVEN** un producto valorado en 40.00 y otro sin costo registrado con 8 unidades
- **WHEN** el Administrador consulta el valor del inventario
- **THEN** SHALL mostrarse 40.00 e indicarse que un producto queda fuera por no tener costo registrado


### Requirement: Correcciones de cargas y ajustes sin borrar historia

La corrección SHALL conservar original, motivo, responsable y vínculo. Una reversión exacta SHALL permitirse solo si el efecto original es el último del producto, no existe reversión previa y se puede restituir cantidad y valoración anteriores sin negativos; SHALL registrarse como **movimiento inverso** atómico. Con movimientos posteriores SHALL bloquearse esa reversión y permitirse únicamente un nuevo ajuste por diferencia física comprobada a valoración vigente: no SHALL presentarse como eliminación de la operación original ni restitución automática de costos antiguos. Si no existe diferencia física, SHALL NOT inventarse cantidad para corregir únicamente valoración. Trazabilidad: RN-INV-010…014; RF-INV-009/010/012; CU-009/015; proposal recomendación 6.

#### Scenario: Revertir ajuste de entrada erróneo
- **GIVEN** un ajuste de entrada que pasó de 4 unidades con valor 8.00 a 6 con valor 14.00 y sigue siendo el último efecto
- **WHEN** se revierte con motivo
- **THEN** SHALL restituirse cantidad 4 y valor 8.00, conservando el original y su compensación

#### Scenario: Revertir salida que agotó stock
- **GIVEN** una salida que dejó cantidad y valor cero y no tiene movimientos posteriores
- **WHEN** se revierte válidamente
- **THEN** SHALL restituirse exactamente cantidad y valor anteriores, incluido su residuo, sin crear una compra

#### Scenario: Corrección con movimientos posteriores
- **GIVEN** un ajuste erróneo seguido de otros movimientos y una diferencia física comprobada de menos 1 unidad
- **WHEN** se solicita corregir
- **THEN** SHALL bloquearse la reversión exacta y permitirse un ajuste nuevo vinculado de salida por 1 a costo vigente si hay stock, sin reescribir la historia

#### Scenario: Error solo de costo con dependencias
- **GIVEN** un ajuste con costo erróneo seguido de movimientos y sin diferencia física
- **WHEN** se intenta corregirlo mediante una cantidad ficticia
- **THEN** SHALL rechazarse y explicarse que esta entrega no permite reconstruir retrospectivamente valoración ni inventar stock

### Requirement: Idempotencia y auditoría de inventario

Carga inicial, ajustes y reversiones SHALL proteger sus escrituras frente a reintentos compatibles, claves reutilizadas con distinta entrada y confirmaciones repetidas de la misma operación. La identidad de la operación SHALL evitar efectos duplicados incluso con claves diferentes. El éxito SHALL conservarse junto con movimientos y auditoría; un fallo SHALL revertirlos juntos. Cada acción crítica SHALL identificar actor, momento, operación, resultado y motivo cuando corresponda, sin editar registros previos. Trazabilidad: RN-SEG-005; RN-INV-002/014; RF-AUD-001…004; RNF-INT-004/009; proposal.

#### Scenario: Repetición de ajuste confirmado
- **GIVEN** un ajuste confirmado de entrada de 2 unidades
- **WHEN** se repite su confirmación compatible con otra clave
- **THEN** SHALL devolverse la operación existente sin otras 2 unidades ni movimientos nuevos

#### Scenario: Reversión simultánea repetida
- **GIVEN** una operación reversible
- **WHEN** dos Administradores intentan revertirla simultáneamente
- **THEN** SHALL existir como máximo una compensación y conservarse un único efecto neto

#### Scenario: Fallo de auditoría o persistencia
- **GIVEN** una confirmación que no puede completar sus efectos o auditoría requerida
- **WHEN** finaliza con error
- **THEN** SHALL mantenerse el saldo previo sin operación parcialmente confirmada

### Requirement: Experiencia y alcance de inventario

Inventario SHALL integrarse con navegación y ficha de producto existentes, mostrando ámbito comercial, estados reales, filtros conservados, confirmaciones con consecuencias y errores comprensibles. Los formularios SHALL ser accesibles por teclado, conservar datos tras errores y prevenir envío duplicado. La entrega SHALL NOT añadir alertas de umbral, adjuntos, exportaciones, reservas, desarmes, consumos ni devoluciones físicas; SHALL mantenerlos como cobertura pendiente del alcance general, sin presentarlos como implementados. Trazabilidad: UI-031/043/045; RNF-USA; proposal recomendación 7 y exclusiones aprobadas.

#### Scenario: Navegación desde producto
- **GIVEN** una ficha de producto y sesión autorizada
- **WHEN** se abre su inventario y después se regresa
- **THEN** SHALL conservarse la identidad del producto y el contexto de navegación sin habilitar edición directa de stock

#### Scenario: Formulario accesible y error recuperable
- **GIVEN** un Administrador que utiliza teclado y un ajuste inválido
- **WHEN** lo envía
- **THEN** SHALL recibir errores asociados a campos, mantener sus datos y poder corregirlos sin perder el foco ni duplicar operaciones

#### Scenario: Umbrales fuera de entrega
- **GIVEN** un producto con stock cero
- **WHEN** se consulta su inventario
- **THEN** SHALL identificarse sin existencias, sin atribuirle un umbral ficticio ni presentar alertas avanzadas como disponibles



### Requirement: Reservas de mantenimiento trazables

Una **reserva de mantenimiento** SHALL existir solo mientras la venta vinculada abierta que la sostiene tenga la línea correspondiente. SHALL identificar el producto, la cantidad y la línea de la venta vinculada, y por medio de esta la orden. Proformas y ventas directas en borrador SHALL NOT crear reservas. Retirar o disminuir la línea SHALL liberar exactamente la cantidad retirada; confirmar la venta SHALL consumir la reserva en la misma acción que registra la salida. Una reserva SHALL NOT generar movimientos de Kardex, costo ni valoración, y SHALL NOT corregirse manualmente. La cantidad reservada de un producto SHALL poder reconciliarse con la suma de las líneas de las ventas vinculadas abiertas. Trazabilidad: DP-012; invariantes 8 y 9; modelo de dominio §10 (disponibilidad calculada); RF-TAL-010.

#### Scenario: Reserva liberada al retirar la línea
- **GIVEN** una reserva de 3 unidades sostenida por una línea de venta vinculada abierta
- **WHEN** se retira esa línea desde la orden
- **THEN** la cantidad reservada del producto SHALL disminuir en 3 sin movimiento de Kardex

#### Scenario: Reconciliación de reservas
- **GIVEN** productos con reservas creadas, aumentadas, disminuidas, liberadas y consumidas por varias órdenes
- **WHEN** se verifica la integridad del inventario
- **THEN** la cantidad reservada de cada producto SHALL coincidir con la suma de las líneas de las ventas vinculadas abiertas

#### Scenario: Borrador directo no reserva
- **GIVEN** una venta directa en borrador con 2 unidades de un producto
- **WHEN** se consulta la disponibilidad del producto
- **THEN** SHALL NOT reflejar ninguna reserva por ese borrador
