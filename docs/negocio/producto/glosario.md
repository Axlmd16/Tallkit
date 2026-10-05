# Glosario del producto

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Versión del documento | 0.3 |
| Estado | Alineado con el modelo de dominio aprobado |
| Fecha | 2026-09-08 |

> Las definiciones de este glosario son las que deben utilizarse en requisitos, pantallas, API, diagramas y conversaciones del proyecto. Cuando un término tributario requiera precisión legal, deberá validarse con el responsable contable.

## Términos

### Abono

Pago parcial aplicado a una operación confirmada a crédito. Utiliza una forma de pago real y disminuye el saldo pendiente; no es por sí mismo una forma de pago.

### Administrador

Rol con control general sobre usuarios, configuración, catálogos, inventario, reportes, auditoría, correcciones críticas, respaldos, restauración y actualización del sistema.

### Ajuste de inventario

Movimiento autorizado que corrige una diferencia entre la existencia registrada y la existencia comprobada. Debe incluir motivo y responsable.

### Cuentas por cobrar

Deuda cobrable de las ventas comerciales confirmadas, derivada de los hechos registrados (importe exigible menos pagos aplicados). Se presenta separada del exceso pendiente de reembolso, que nunca se resta de ella ni constituye saldo a favor; la antigüedad cuenta días desde la confirmación, sin vencimiento ni mora.

### Anulación

Proceso controlado que deja sin efecto una operación sin eliminar su historial. Cuando la operación afectó inventario o dinero, la anulación requiere movimientos o registros compensatorios.

### Bodega

Ubicación lógica o física donde se controlan existencias de productos. V1 opera con una sola bodega, sin impedir una ampliación futura.

### Cantidad

Objeto de valor formado por un valor numérico y una unidad de medida compatible. En V1 la existencia se controla por presentaciones completas vendibles.

### Disponibilidad

Existencia actual menos las reservas activas de mantenimientos. Las proformas y ventas directas en borrador no reducen esta cantidad.

### Cierre diario

Conciliación lógica de cobros por fecha, entidad fiscal y forma de pago, sin modificar los pagos originales.

### Catálogo de servicios

Lista de trabajos que presta el taller, cada uno con nombre, estado y precio referencial.

### Cliente

Persona natural o jurídica que adquiere repuestos, solicita servicios o es propietaria de un vehículo. Es un dato compartido por las dos entidades fiscales.

### Compatibilidad vehicular

Información que relaciona un producto con marcas, modelos, años u otras características de vehículos compatibles. En V1 sirve como referencia y no reemplaza la verificación del usuario.

### Consumo interno

Salida de una presentación completa entregada para uso operativo del taller, sin venta ni deuda para el cliente.

### Documento interno

Documento generado por el sistema para respaldar o comunicar una operación. No equivale necesariamente a una factura electrónica autorizada por el SRI.

### Condición de venta

Acuerdo que establece cuándo debe pagarse una operación, por ejemplo, contado o crédito. No debe confundirse con la forma de pago.

### Confirmación

Acción que convierte un borrador en una operación con efectos definitivos. Puede asignar secuencial, afectar inventario o generar un saldo, según el tipo de documento.

### Costo promedio ponderado

Método de valoración que recalcula el costo unitario promedio al ingresar mercadería, ponderando el valor de la existencia anterior y el valor de la nueva entrada. Una entrada sin costo no lo modifica.

### Crédito

Condición de venta que permite pagar total o parcialmente después de confirmar la operación. No es una forma de pago y en V1 no incluye vencimientos, cuotas, intereses ni cronogramas.

### Cuenta por cobrar

Consulta calculada del importe que un cliente debe pagar a una entidad fiscal por una operación confirmada; no es una deuda duplicada independiente.

### Devolución

Corrección total o parcial de una venta mediante la cual el cliente devuelve productos. Debe relacionarse con la venta original y ajustar inventario y valores de forma trazable.

### Diagnóstico

Descripción del problema detectado o de la condición del vehículo dentro de un mantenimiento.

### Documento económico

Registro que representa una operación con importes, impuestos, pagos o saldos. Pertenece a una sola entidad fiscal.

### Entidad fiscal

Contribuyente legal identificado por un RUC bajo el cual se registran operaciones, secuenciales, impuestos, pagos, anulaciones y reportes.

### Etiqueta de producto

Identificación impresa que acompaña a un producto físico y muestra su código interno, datos básicos y un código de barras, sin precio ni efectos sobre inventario.

### Encargado del taller

Rol responsable de clientes, vehículos, mantenimientos, servicios, fotografías, pagos artesanales y preparación de los repuestos utilizados. No confirma ni cobra la venta comercial vinculada.

### Estado de facturación futura

Situación del futuro proceso de emisión o anulación del comprobante fiscal autorizado. Está fuera de V1 y es independiente del estado de la venta, del documento interno y del pago.

### Estado de mantenimiento

Situación operativa de un mantenimiento. En V1 puede ser `registrado`, `finalizado`, `reabierto` o `cancelado`.

### Estado de pago

Situación derivada del saldo de una operación: `pendiente`, `parcial` o `pagado`. No indica si la venta está confirmada o anulada.

### Estado de venta

Situación comercial de una venta, independiente de su pago y facturación. Los estados exactos se detallarán en los requisitos; como mínimo se distinguirán borrador, confirmada y anulada.

### Existencia

Cantidad registrada de un producto en una bodega, resultante de sus movimientos válidos.

### Evidencia fotográfica

Imagen asociada a un mantenimiento para documentar el estado del vehículo, un daño, una pieza o el trabajo realizado.

### Facturación electrónica

Proceso de generación, firma, autorización y entrega de comprobantes electrónicos conforme a las disposiciones del SRI. El sistema implementa preparación local, identidad de ensayo y archivo; la firma, transmisión y autorización productiva continúan fuera de esta entrega.

### Preparación fiscal

Expediente local versionado que conserva emisor, receptor declarado, líneas, impuestos, pagos fiscales declarados y totales históricos antes de una futura emisión. Sus estados no son estados del SRI y no alteran cobros ni operaciones comerciales.

### Borrador fiscal

Preparación fiscal todavía editable. Se crea con los datos de la operación y de la configuración centralizada ya precargados; el usuario solo completa lo que falta y, al revisarlo, el sistema vuelve a resolver la configuración vigente.

### Preparación local

Preparación fiscal completada y congelada en el sistema. No es una factura electrónica: no ha sido firmada ni enviada al SRI. Conserva los datos revisados y las referencias de configuración usadas, que no cambian si después se modifica la configuración.

### Impedimento

Causa identificada, con el campo afectado y los valores esperado y observado cuando aplica, por la que una preparación fiscal permanece en borrador. Nunca se resuelve con valores ficticios, recortes ni ajustes: lo corrige quien tiene el dato, el usuario operativo o el Administrador.

### Pendiente de emisión

Situación de una preparación local para la que todavía no existe emisión electrónica. No indica que se haya solicitado ni obtenido una autorización.

### Perfil del emisor

Conjunto de condiciones tributarias que el Administrador declara para cada entidad fiscal con valores cerrados, fuente y vigencia: régimen tributario, obligación de llevar contabilidad, agente de retención, contribuyente especial y calificación artesanal. Se declara con base en el certificado de RUC y la documentación vigente; el sistema no lo deduce ni lo valida ante el SRI.

### Régimen tributario

Clasificación del contribuyente ante el SRI: General, RIMPE Emprendedor o RIMPE Negocio Popular. La leyenda del comprobante se deriva del régimen y no se escribe (la de Negocio Popular está por confirmar con la ficha técnica del SRI). RIMPE Negocio Popular no cobra IVA y puede emitir comprobantes electrónicos de forma voluntaria; el sistema solo prepara sus facturas con líneas a IVA 0 %. Al pasar de Negocio Popular a Emprendedor el Administrador declara el nuevo régimen y programa la tarifa y su correspondencia con el SRI.

### Calificación artesanal

Reconocimiento vigente que la Junta Nacional de Defensa del Artesano otorga al artesano y que sustenta la tarifa 0 % de sus servicios. Se declara con número, organismo, fecha de inicio y fecha de vencimiento obligatoria; el sistema avisa al Administrador 60 días antes del vencimiento y, mientras esté vigente, solo prepara líneas con IVA 0 %. No acredita el beneficio legal ante el SRI.

### Agente de retención

Contribuyente que el SRI obliga a retener impuestos cuando paga a un proveedor. El perfil lo declara con el número de su resolución (hasta 8 dígitos) cuando aplica. Es una condición del emisor; las retenciones que los clientes aplican al taller al pagar son un asunto distinto.

### Punto predeterminado

Punto de emisión de una entidad fiscal que se usa automáticamente al preparar datos fiscales. Si la entidad tiene un único punto activo se usa ese; si tiene varios, lo designa el Administrador.

### Forma de pago SRI

Código de la Tabla 24 de la ficha técnica del SRI con el que se declara cómo se paga un comprobante. Es distinta de la forma de pago real del cobro; en V1 solo pueden habilitarse 01 (efectivo o sin sistema financiero) y 20 (transferencia u otros con sistema financiero). Crédito es una condición y no tiene código de la Tabla 24.

### Forma de pago predeterminada

Forma de pago SRI habilitada que el Administrador designa por entidad y que la preparación sugiere para el importe no cubierto por cobros registrados.

### Catálogo oficial

Conjunto versionado de códigos del SRI, como tarifas de IVA y formas de pago, incorporado desde la ficha técnica con su versión, fecha de descarga, huella del archivo, vigencia y estado. Actualizarlo no modifica preparaciones completadas.

### Placa de RUC

Pieza visual que muestra el RUC de una entidad fiscal con la etiqueta «RUC» diferenciada y sus 13 dígitos en tipografía monoespaciada, sin separadores. Solo presenta el dato; no acredita su validez tributaria.

### Logotipo de entidad fiscal

Imagen opcional que identifica visualmente a una entidad fiscal en el encabezado de sus comprobantes internos: el logotipo comercial en ventas e ingresos, y el artesanal en los comprobantes de servicios. Solo el Administrador lo sube, cambia o quita. No se versiona: los comprobantes antiguos muestran el logotipo vigente, mientras su razón social y su RUC conservan la copia histórica. Es distinto del logotipo de Tallkit, que identifica al sistema.

### Archivo fiscal

Conjunto protegido de XML externos, bytes originales, hashes, identidades, procedencias y vínculos administrativos conservados en PostgreSQL. Una incorporación externa permanece no verificada por el sistema.

### Evidencia fiscal externa

Comprobante o envoltorio incorporado desde fuera del sistema. Su contenido puede declarar autorización, pero el sistema no la confirma ante el SRI en esta entrega.

### Sin costo registrado

Estado de un producto con existencia cuyo costo se desconoce porque ninguna entrada lo informó ni hubo un promedio previo. Es distinto de un costo cero: no suma al valor del inventario, no permite calcular margen y se regulariza con la primera entrada que traiga costo. Solo el Administrador lo ve.

### Solicitud de corrección fiscal

Preparación administrativa local de una anulación en línea o nota de crédito. Puede quedar pendiente, bloqueada, preparada o cancelada localmente y nunca prueba ejecución oficial.

### Forma de pago

Medio real utilizado para entregar o recibir dinero. En V1 los medios habilitados son efectivo y transferencia y pueden combinarse dentro del pago de una operación.

### Historial de vehículo

Conjunto cronológico de mantenimientos y operaciones relacionadas con un vehículo, conservado aunque cambie su propietario.

### Impuesto

Valor calculado conforme a una tarifa y regla configuradas para una entidad fiscal y un período de vigencia.

### Entrada de stock

Forma simple del ingreso de mercadería que registra y confirma el Vendedor (o el Administrador) en una sola acción, tras una revisión previa. Solo exige productos y cantidades; proveedor, referencia, observación y costo son opcionales. No lleva impuestos, fecha del documento ni totales. Reemplaza a la compra documentada con borrador.

### Ingreso de mercadería

Operación que registra productos recibidos en la bodega. Al confirmarse aumenta el inventario y, si trae costo, actualiza el costo promedio. En V1 se registra como **entrada de stock**; las compras documentadas anteriores se conservan como historia de solo lectura.

### Invariante

Condición que el sistema no puede violar, incluso ante errores, concurrencia o anulaciones.

### Kardex

Registro cronológico de los movimientos de inventario de un producto, incluyendo entradas, salidas, ajustes, devoluciones y movimientos inversos.

### Carga inicial

Primera entrada de existencias de un producto sin historia de inventario, con costo explícito y sin proveedor inventado. Solo puede hacerse una vez por producto y bodega, incluso si luego se compensa.

### Corte de consulta

Punto estable de la historia (identificado por un ordinal y con vigencia de 30 minutos) contra el que se leen todas las páginas, filas y resúmenes del Kardex, de modo que un movimiento confirmado por otro usuario no se mezcle con lo que se está leyendo.

### Movimiento compensatorio

Movimiento inverso, vinculado al original, que restituye exactamente cantidad, valor y promedio previos sin borrar ni editar la historia. Solo procede si el original es el último efecto del producto.

### Posición de inventario

Proyección operativa de la cantidad, el valor y el costo promedio de un producto en la bodega. Siempre debe poder reconstruirse a partir de los movimientos.

### Revisión previa

Consulta de solo lectura que muestra importes y efectos antes de confirmar y entrega un token firmado, de 15 minutos, ligado al actor, la acción y el contenido revisado.

### Kit

Producto comprado como conjunto y controlado como una unidad completa. Puede venderse intacto o desarmarse mediante una operación explícita; nunca se descompone automáticamente al vender.

### Intervención

Período de atención del vehículo dentro de un mantenimiento. Puede ser la atención inicial o una intervención correctiva posterior.

### Intervención correctiva

Nueva atención dentro del mismo mantenimiento por una falla atribuible al trabajo anterior, sin constituir un módulo completo de garantías.

### Mantenimiento

Caso operativo completo del trabajo realizado sobre un vehículo bajo el RUC artesanal. Contiene una o más intervenciones con diagnóstico, kilometraje, servicios, observaciones y evidencias.

En la interfaz se presenta como **orden de mantenimiento**, con número interno `ART-OT-NNNNNN` independiente de las series fiscales. Sus estados son registrado, finalizado y reabierto.

### Marca de vehículo

Catálogo administrable que identifica la marca de un vehículo del cliente; es independiente de la marca de producto. Los tres roles la consultan, Administrador y Encargado del taller la crean y editan, y solo el Administrador la desactiva o reactiva.

### Movimiento de inventario

Registro inmutable de una entrada o salida que modifica la existencia de un producto y conserva su tipo, origen, fecha y responsable.

### Movimiento inverso

Movimiento que compensa el efecto de otro movimiento sin borrarlo, utilizado en anulaciones, devoluciones o correcciones autorizadas.

### Modelo de dominio

Representación conceptual de responsabilidades, reglas y relaciones del negocio, independiente del diseño de base de datos.

### Operación de servicios

Registro económico del RUC artesanal que contiene los servicios y valores cobrados por un mantenimiento. Sus pagos y documentos son independientes de una venta de repuestos.

### Pago

Registro de un importe recibido mediante una forma de pago real y aplicado a una operación de la misma entidad fiscal.

### Pago combinado

Cobro de una operación mediante dos o más formas de pago, por ejemplo una parte en efectivo y otra por transferencia.

### Sin comprobante

Importe de líneas de servicio aún no incluidas en un comprobante de servicios, o de repuestos reservados en la venta vinculada abierta. Es informativo: no constituye deuda ni se suma a los saldos hasta que el comprobante se confirma.

### Período de propiedad

Intervalo en el que un cliente es el propietario vigente de un vehículo, con inicio y fin opcional. Cambiar el propietario cierra el período anterior y abre otro; los períodos anteriores se conservan y no se editan retroactivamente.

### Precio aplicado

Precio efectivamente utilizado en una línea de venta o servicio. Se conserva en el documento histórico aunque luego cambie el precio del catálogo.

### Precio referencial

Precio sugerido en el catálogo de servicios que se copia como punto de partida al mantenimiento. El Encargado del taller puede cambiarlo antes de confirmar, sin motivo obligatorio.

### Precio final de catálogo

Valor que pagará el cliente por un producto, con impuesto incluido cuando aplique. La operación conserva por separado base, tarifa, impuesto y total.

### Presentación

Forma completa y cerrada en que un producto se controla y vende, por ejemplo un envase de un galón o uno de medio galón; presentaciones diferentes son productos distintos.

### Producto

Bien físico que compra, almacena o vende el RUC comercial. Puede ser un repuesto, pieza, insumo o kit tratado como unidad completa.

### Proforma

Oferta de productos con precios y vigencia. No representa una venta confirmada, no reserva stock y puede convertirse en una venta nueva.

### Propietario vigente

Único cliente que posee un vehículo en el período de propiedad abierto. V1 no admite copropiedad ni un responsable distinto del propietario.

### Proveedor

Persona o empresa que suministra productos al RUC comercial. Una entrada de stock puede indicarlo o no. Para un proveedor ocasional solo el nombre es obligatorio.

### Reembolso

Devolución trazable de dinero al cliente cuando una anulación o devolución produce un importe pagado en exceso; V1 no conserva saldos a favor.

### Reposición por corrección

Salida de inventario sin cargo al cliente para reemplazar una pieza dañada por responsabilidad del taller; requiere confirmación del Administrador.

### Reserva de mantenimiento

Asignación temporal de un producto a la venta abierta de un mantenimiento. Reduce disponibilidad, pero no existencia ni Kardex.

### RUC artesanal

Entidad fiscal responsable de mantenimientos, reparaciones, mano de obra y demás servicios del taller.

### RUC comercial

Entidad fiscal responsable de compras, inventario y ventas de productos o repuestos.

### Rol

Conjunto fijo de permisos asignado a un usuario. V1 define únicamente Administrador, Vendedor y Encargado del taller; un usuario puede reunir varios de esos tres.

### Credencial temporal

Contraseña generada durante un restablecimiento administrativo, mostrada una sola vez y almacenada únicamente en forma protegida. Obliga al usuario a establecer una contraseña personal antes de utilizar funciones internas.

### Permiso efectivo

Acción concreta concedida por al menos uno de los roles vigentes de un usuario. Se calcula como unión de permisos y el backend la comprueba aunque la interfaz oculte la acción.

### Sesión invalidada

Sesión que dejó de ser válida porque el usuario fue desactivado, se restableció su contraseña o se redujeron sus roles. Debe volver al inicio de sesión sin conservar permisos anteriores.

### Evento de auditoría de identidad

Registro inmutable de una acción relevante sobre acceso, usuarios, roles o credenciales. Conserva actor cuando está confirmado, resultado, momento, objetivo y correlación, pero nunca contraseñas ni secretos de sesión.

### Saldo pendiente

Importe de una operación que aún no ha sido cubierto por pagos válidos.

### Secuencial

Número único y ordenado asignado a un documento dentro de una entidad fiscal, tipo de documento y serie. No debe duplicarse ni reutilizarse.

### Servicio

Trabajo o mano de obra ofrecido por el taller, registrado en un catálogo y aplicado a un mantenimiento.

### Código de servicio

Identificador visible, único e inmutable de un servicio del catálogo, asignado por el sistema al crearlo con el formato `SRV-` y un número correlativo de al menos seis dígitos. Se copia a las líneas de las operaciones artesanales y es el código de línea de la factura; nadie lo escribe y no se reutiliza.

### SRI

Servicio de Rentas Internas del Ecuador. La integración electrónica con esta institución está fuera de V1.

### Stock

Sinónimo operativo de existencia. En documentación formal se prefiere **existencia**, salvo en expresiones de uso común como “stock bajo”.

### Stock bajo

Condición en la que la existencia alcanza o desciende del umbral configurado para un producto.

### Total de servicios de la orden

Suma de cantidad por precio aplicado de los servicios de una orden de mantenimiento, calculada por el servidor. Es un valor operativo: no constituye saldo por cobrar, deuda, documento interno ni factura. Los servicios de una intervención correctiva no lo aumentan.

### Transacción atómica

Operación en la que todos los cambios relacionados se confirman juntos o, si ocurre un error, ninguno queda aplicado.

### Usuario

Persona autenticada que utiliza el sistema. Tiene al menos uno de los tres roles de V1 y puede reunir varios cuando cumple más de una función; es un dato compartido por las dos entidades fiscales.

### Vehículo

Automotor relacionado con un cliente y utilizado como referencia para mantenimientos, compatibilidades e historial.

### Vendedor

Rol responsable de clientes, proformas, ventas de repuestos, consumos internos y pagos del RUC comercial.

### Venta de repuestos

Operación económica del RUC comercial que contiene productos vendidos. Puede ser directa, provenir de una proforma o estar vinculada a un mantenimiento.

## Términos que no deben usarse como sinónimos

| Términos | Diferencia obligatoria |
|---|---|
| Cliente / Usuario | El cliente recibe productos o servicios; el usuario opera el sistema. |
| Crédito / Forma de pago | Crédito define cuándo se paga; la forma de pago define con qué medio se paga. |
| Proforma / Venta | La proforma es una oferta sin efecto de stock; la venta confirmada sí produce efectos. |
| Mantenimiento / Operación de servicios | El mantenimiento documenta el trabajo; la operación de servicios documenta su valor económico. |
| Servicio / Producto | El servicio pertenece al RUC artesanal; el producto pertenece al RUC comercial. |
| Anulación / Eliminación | La anulación conserva el historial; la eliminación lo borra y no se permite en operaciones transaccionales. |
| Existencia / Movimiento | La existencia es el resultado acumulado; el movimiento explica cada variación. |
| Existencia / Reserva / Disponibilidad | La existencia es física; la reserva asigna temporalmente; la disponibilidad resta las reservas activas. |
| Estado de venta / Estado de pago / Documento interno / Facturación futura | Son dimensiones independientes y no deben representarse con un único estado. |
| Precio referencial / Precio aplicado | El referencial proviene del catálogo; el aplicado queda registrado en la operación. |
| Documento interno / Factura electrónica | El documento interno respalda la operación en V1; la factura electrónica futura requiere autorización del SRI. |
| Venta / Pago | La venta crea el importe exigible; el pago registra cómo se cubre una operación confirmada. |
| Mantenimiento / Intervención | El mantenimiento es el caso completo; cada intervención representa una atención inicial o correctiva. |

## Abreviaturas

| Abreviatura | Significado |
|---|---|
| API | Interfaz de programación de aplicaciones. |
| DRF | Django REST Framework. |
| RUC | Registro Único de Contribuyentes. |
| SRI | Servicio de Rentas Internas. |
| V1 | Primera versión funcional definida en `alcance-v1.md`. |
