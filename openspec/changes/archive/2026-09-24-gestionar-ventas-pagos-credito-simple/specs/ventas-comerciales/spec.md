# Ventas comerciales

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-20, decisiones confirmadas, modelo de dominio, specs principales de modelo/configuración/autorización, reglas de negocio, actores y roles, requisitos funcionales, CU-012, UI-053…055/058 y RNF-INT. Esta capacidad concreta ventas directas; no habilita proformas, reservas ni ventas de mantenimiento. Usa los términos del glosario del producto. Los datos históricos y la política de inventario vigente se conservan; las salidas comerciales son una operación nueva, no un ajuste manual. Estado: specs aprobadas el 2026-09-20 para crear diseño. El usuario respondió «si esta bien, continua» a la solicitud expresa de aprobación de las tres specs (24 requisitos y 105 escenarios), sobre el contenido registrado en master en c393e13. Esta aprobación no abarca diseño, tareas ni implementación.

## ADDED Requirements

### Requirement: Autorización comercial por acción

El sistema SHALL exigir usuario activo y sesión vigente para toda acción. Administrador y Vendedor SHALL poder consultar, crear, editar y confirmar ventas directas según `ventas.ver`, `ventas.crear` y `ventas.confirmar`. La unión de roles SHALL aplicarse sin conceder acceso comercial al Encargado del taller por sí solo. Toda acción SHALL validar autorización en el servidor, incluso al repetir una solicitud; costos y valoración SHALL limitarse al Administrador. Trazabilidad: CT-001; RN-SEG-001…007; actores-y-roles §3.4; RF-VEN-005.

#### Scenario: Vendedor confirma una venta autorizada
- **DADO** un Vendedor activo con sesión vigente y una venta válida
- **CUANDO** solicita confirmarla
- **ENTONCES** el sistema SHALL permitir la acción y aplicar todas las validaciones comerciales.

#### Scenario: Encargado sin rol comercial intenta acceder
- **DADO** un usuario con solo el rol Encargado del taller
- **CUANDO** consulta, crea, modifica o confirma una venta directa por acceso directo
- **ENTONCES** el sistema SHALL denegar la acción sin revelar datos ni producir efectos.

#### Scenario: Roles acumulados y costos restringidos
- **DADO** un usuario Vendedor y Encargado del taller sin rol Administrador
- **CUANDO** consulta una venta comercial autorizada
- **ENTONCES** SHALL recibir precios de venta e importes comerciales, pero no costos históricos ni valoración, tampoco en enlaces, errores o datos anidados.

#### Scenario: Sesión invalidada antes de confirmar
- **DADO** un borrador abierto por un usuario cuya sesión dejó de ser válida
- **CUANDO** intenta confirmarlo o repetir una confirmación anterior
- **ENTONCES** SHALL rechazarse sin ejecutar efectos ni revelar el resultado protegido.

### Requirement: Borradores directos sin efectos económicos

Una **venta de repuestos** SHALL pertenecer exclusivamente al **RUC comercial** y referenciar un cliente registrado conforme a DP-008. Sus líneas SHALL identificar productos y cantidades enteras positivas de presentaciones completas, con valor y unidad. SHALL permitirse preparar y editar un borrador sin modificar existencia, reservas, costo, deuda ni numeración. Confirmar SHALL exigir cliente válido y al menos una línea; SHALL rechazarse servicios, cantidades fraccionarias, cero o negativas y productos inactivos. Los kits SHALL venderse intactos, sin descontar componentes. Trazabilidad: DP-008/009/010/012; RN-FIS-002/005/006; RN-VEN-001/002/004; RF-VEN-001/005; CU-012.

#### Scenario: Guardar y editar un borrador
- **DADO** un cliente registrado y un producto disponible
- **CUANDO** se guarda o modifica un borrador de venta directa
- **ENTONCES** SHALL conservar sus datos sin reservar ni descontar inventario, crear deuda o consumir un número definitivo.

#### Scenario: Confirmación incompleta o con cantidad inválida
- **DADO** un borrador sin cliente, sin líneas o con una cantidad cero, negativa o fraccionaria
- **CUANDO** se solicita confirmarlo
- **ENTONCES** SHALL rechazarse indicando los datos inválidos, sin efectos parciales.

#### Scenario: Desactivación de producto después de preparar la venta
- **DADO** un producto agregado al borrador y desactivado antes de confirmar
- **CUANDO** se solicita la confirmación
- **ENTONCES** SHALL rechazarse e identificarse la línea afectada, conservando el borrador para corrección.

#### Scenario: Intento de mezclar servicios o entidad artesanal
- **DADO** una venta directa comercial
- **CUANDO** se intenta agregar un servicio o asignar la entidad artesanal
- **ENTONCES** SHALL rechazarse sin crear una operación económica mixta.

#### Scenario: Venta de un kit completo
- **DADO** un kit registrado como producto vendible
- **CUANDO** se confirma su venta de una unidad
- **ENTONCES** SHALL descontarse solo esa unidad del kit, sin desarmarlo ni descontar sus componentes.

### Requirement: Precios vigentes sin modificación libre ni descuentos

El **precio final de catálogo** SHALL ser el precio aplicado de la venta para todos los roles, en USD y con hasta dos decimales; SHALL NOT aceptarse precio negociado, descuento ni sustitución manual del impuesto en la venta. La selección tributaria SHALL proceder del producto y resolverse en el ámbito comercial. Una variación relevante de precio, impuesto, líneas o condición después de revisar SHALL exigir nueva revisión explícita antes de confirmar; cambiar la configuración no cambia automáticamente el precio final de catálogo. Trazabilidad: DP-004/017; RN-CAT-007/016; RF-VEN-003/005/014; propuesta, recomendaciones 1/2.

#### Scenario: Precio cambia después de la revisión
- **DADO** un borrador revisado con precio 10.00 y un cambio de catálogo a 12.00
- **CUANDO** se intenta confirmar con la revisión anterior
- **ENTONCES** SHALL requerirse revisar 12.00 y los totales actuales, sin confirmar ni descontar existencia.

#### Scenario: Administrador intenta cambiar el precio en la venta
- **DADO** un Administrador que prepara una venta
- **CUANDO** envía un precio distinto al de catálogo o un descuento, incluso de valor cero
- **ENTONCES** SHALL rechazarse la entrada; el cambio de precio del catálogo SHALL seguir su función administrativa independiente.

### Requirement: Desglose decimal por línea y vigencia de confirmación

El sistema SHALL calcular con decimales: total de línea = cantidad × precio final; base = total / (1 + tarifa/100), redondeada a centavos con HALF_UP; impuesto = total − base. Los totales de documento SHALL sumar las líneas ya calculadas. La fecha operativa SHALL ser la fecha efectiva de confirmación asignada por el sistema en America/Guayaquil, sin retrofecha; SHALL existir configuración comercial, bodega, serie y una vigencia tributaria única por selección. Ausencia de configuración SHALL NOT significar tarifa cero. Los datos inválidos o excesos de escala SHALL rechazarse sin redondearlos silenciosamente. Trazabilidad: DP-017; RN-FIS-010; RF-VEN-003/005; RNF-INT-006/008; configuración-operativa-y-fiscal; propuesta, recomendación 1.

#### Scenario: Desglose con tarifa de ejemplo
- **DADO** una tarifa configurada de prueba de 15% y dos unidades a 11.50
- **CUANDO** se calculan los importes de la línea
- **ENTONCES** SHALL resultar total 23.00, base 20.00 e impuesto 3.00; la tarifa del ejemplo SHALL NOT convertirse en predeterminada legal.

#### Scenario: Redondeo de medio centavo
- **DADO** una tarifa de prueba de 20% y una línea de total 0.03
- **CUANDO** se desglosa la línea
- **ENTONCES** SHALL resultar base 0.03 e impuesto 0.00 mediante HALF_UP, conservando el total 0.03.

#### Scenario: Totales suman líneas redondeadas
- **DADO** dos líneas distintas de total 0.03 cada una y tarifa de prueba de 20%
- **CUANDO** se calculan los totales del documento
- **ENTONCES** SHALL resultar base 0.06, impuesto 0.00 y total 0.06, sin recalcular el impuesto globalmente.

#### Scenario: Falta configuración aplicable
- **DADO** que falta entidad, bodega, serie o vigencia única para alguna línea
- **CUANDO** se solicita confirmar
- **ENTONCES** SHALL rechazarse con explicación corregible sin número, movimientos ni saldo.

#### Scenario: Confirmación cruza un cambio de día o tarifa
- **DADO** un borrador revisado antes de entrar en vigor otra tarifa
- **CUANDO** se intenta confirmar después del cambio efectivo en America/Guayaquil
- **ENTONCES** SHALL resolverse la tarifa del momento efectivo y requerirse nueva revisión del desglose cambiado.

### Requirement: Confirmación indivisible y disponibilidad protegida

Confirmar SHALL revalidar datos, autorización y disponibilidad; asignar número, conservar historia, registrar salidas de **Kardex** con costo de salida e importe exigible y auditar el éxito como una sola acción atómica. SHALL NOT producirse existencia o disponibilidad negativa. Las salidas SHALL respetar la valoración vigente y sus residuos sin revalorar movimientos anteriores; una venta SHALL NOT usar ajustes manuales como sustituto. Trazabilidad: DP-001/002/017; RN-INV-007/008/013/014/016; RF-VEN-004…008; RNF-INT-001/002/009; spec de existencias y ajustes vigente del cambio de compras/inventario.

#### Scenario: Confirmación válida con varios productos
- **DADO** un borrador revisado con disponibilidad suficiente en todas sus líneas
- **CUANDO** se confirma
- **ENTONCES** SHALL quedar confirmada una venta con número, historia, salidas, importe exigible y auditoría coherentes, sin crear un pago ni autorización fiscal.

#### Scenario: Una línea carece de disponibilidad
- **DADO** una venta con dos productos y disponibilidad insuficiente en uno
- **CUANDO** se confirma
- **ENTONCES** SHALL rechazarse toda la venta, sin descontar el otro producto ni consumir numeración.

#### Scenario: Dos ventas compiten por la última unidad
- **DADO** una sola unidad disponible y dos ventas de esa unidad
- **CUANDO** se confirman simultáneamente
- **ENTONCES** SHALL confirmarse como máximo una; la otra SHALL informar insuficiencia sin número, deuda ni salida parcial.

#### Scenario: Falla un efecto de confirmación
- **DADO** una venta válida
- **CUANDO** falla cualquier efecto antes de completar la confirmación
- **ENTONCES** SHALL conservarse el borrador y revertirse número, historia confirmada, salidas, saldo y auditoría de éxito de ese intento.

### Requirement: Numeración e idempotencia de escrituras comerciales

Los borradores SHALL NOT consumir números; la confirmación SHALL usar la serie activa del ámbito de ventas comerciales, inicialmente COM-VEN, conforme a configuración. Las escrituras SHALL identificar el intento lógico y rechazar su reutilización con contenido incompatible; repetir un intento compatible SHALL devolver el resultado existente. Confirmar una misma venta, incluso con otro identificador de intento, SHALL NOT duplicar su número, salida o deuda. La asignación concurrente SHALL ser única y los números confirmados SHALL conservarse tras anulaciones. Trazabilidad: DP-006; RF-VEN-006…008; RF-AUD-006; RNF-INT-003/004; configuración-operativa-y-fiscal.

#### Scenario: Repetir creación después de perder la respuesta
- **DADO** un intento de creación de borrador ya procesado
- **CUANDO** se repite con igual identidad y contenido
- **ENTONCES** SHALL devolverse el mismo borrador sin crear otro.

#### Scenario: Reconfirmar una venta con otra identidad de intento
- **DADO** una venta confirmada
- **CUANDO** se repite su confirmación compatible con otra identidad de intento
- **ENTONCES** SHALL devolverse la venta existente sin duplicar efectos.

#### Scenario: Reutilizar intento con otra entrada
- **DADO** una escritura comercial ya procesada
- **CUANDO** se reutiliza su identidad con contenido incompatible
- **ENTONCES** SHALL responder conflicto, sin ocultar la incompatibilidad ni ejecutar nuevos efectos.

#### Scenario: Confirmaciones concurrentes con suficiente inventario
- **DADO** dos ventas distintas válidas y suficiente disponibilidad
- **CUANDO** se confirman simultáneamente
- **ENTONCES** SHALL recibir números comerciales distintos y consecutivos de la serie activa, sin invadir ART-SER.

#### Scenario: Ediciones concurrentes del borrador
- **DADO** dos usuarios que editaron la misma versión de un borrador
- **CUANDO** intentan guardar cambios incompatibles
- **ENTONCES** SHALL conservarse un resultado válido y rechazarse la edición obsoleta, sin sobrescribir silenciosamente lo guardado.

### Requirement: Historia y estados independientes

La venta SHALL distinguir borrador, confirmada y anulada. Una operación confirmada SHALL conservar cliente, entidad, productos, cantidades, precios, impuesto, totales y costo histórico aunque cambien datos maestros. SHALL NOT editarse ni eliminarse mediante acciones ordinarias; sus correcciones SHALL seguir la capacidad de correcciones de ventas. Estado de venta, **estado de pago**, documento interno y futura facturación SHALL ser independientes. Trazabilidad: DP-017/018; RN-VEN-006/007; RF-VEN-004/009/010; RF-AUD-003/004.

#### Scenario: Cambian datos maestros después de vender
- **DADO** una venta confirmada
- **CUANDO** cambian nombre del cliente, producto, datos fiscales, precio, tarifa o costo actual
- **ENTONCES** SHALL conservarse la información histórica de la venta y su comprobante.

#### Scenario: Intento de edición destructiva
- **DADO** una venta confirmada o anulada
- **CUANDO** cualquier rol intenta editar sus importes, cantidades, cliente o estado mediante edición genérica, o eliminarla
- **ENTONCES** SHALL rechazarse y conservarse la historia.

#### Scenario: Venta confirmada aún no cobrada
- **DADO** una venta de total positivo sin pagos
- **CUANDO** finaliza su confirmación
- **ENTONCES** SHALL mostrarse confirmada y pendiente de pago, con documento interno confirmado y sin autorización del SRI.

### Requirement: Consulta comercial y comprobante interno accesibles

El sistema SHALL ofrecer lista y detalle autorizados con número, cliente, origen directo, fecha, total y estados independientes; filtros por cliente, fecha y estado y paginación estable. El detalle SHALL enlazar pagos, correcciones y origen de movimientos según permisos. El **documento interno** imprimible SHALL identificar RUC comercial, cliente, líneas, desglose, número y estado, y declarar que no constituye factura electrónica autorizada por el SRI. La experiencia SHALL conservar entradas ante errores, explicar efectos antes de confirmar y permitir navegación por teclado. Trazabilidad: RF-VEN-015; RF-AUD-004; UI-053…055/058; RNF-USA; DP-018.

#### Scenario: Filtrar ventas y abrir detalle
- **DADO** ventas de varios clientes, fechas y estados
- **CUANDO** un usuario autorizado combina filtros y recorre páginas sin cambios concurrentes
- **ENTONCES** SHALL obtener únicamente coincidencias sin duplicados u omisiones y abrir su detalle conservando el contexto de consulta.

#### Scenario: Imprimir una venta anulada
- **DADO** una venta anulada consultable por el actor
- **CUANDO** solicita su comprobante
- **ENTONCES** SHALL conservar número y valores originales, indicar anulación y ámbito comercial, incluir el aviso de documento no autorizado por el SRI y omitir costos internos.

#### Scenario: Error durante captura accesible
- **DADO** un borrador con líneas capturadas
- **CUANDO** una validación rechaza guardar o confirmar
- **ENTONCES** SHALL conservarse la entrada para corregirla y comunicarse el error en el campo o acción correspondiente, accesible por teclado y sin repetir efectos.

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
