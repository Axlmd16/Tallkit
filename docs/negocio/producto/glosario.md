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

Método de valoración que recalcula el costo unitario promedio al ingresar mercadería, ponderando el valor de la existencia anterior y el valor de la nueva entrada.

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

Proceso de generación, firma, autorización y entrega de comprobantes electrónicos conforme a las disposiciones del SRI. Está fuera de la versión 1.

### Forma de pago

Medio real utilizado para entregar o recibir dinero. En V1 los medios habilitados son efectivo y transferencia y pueden combinarse dentro del pago de una operación.

### Historial de vehículo

Conjunto cronológico de mantenimientos y operaciones relacionadas con un vehículo, conservado aunque cambie su propietario.

### Impuesto

Valor calculado conforme a una tarifa y regla configuradas para una entidad fiscal y un período de vigencia.

### Ingreso de mercadería

Documento que registra productos recibidos de un proveedor, con cantidades y costos. Solo al confirmarse aumenta el inventario y actualiza el costo promedio.

### Invariante

Condición que el sistema no puede violar, incluso ante errores, concurrencia o anulaciones.

### Kardex

Registro cronológico de los movimientos de inventario de un producto, incluyendo entradas, salidas, ajustes, devoluciones y movimientos inversos.

### Kit

Producto comprado como conjunto y controlado como una unidad completa. Puede venderse intacto o desarmarse mediante una operación explícita; nunca se descompone automáticamente al vender.

### Intervención

Período de atención del vehículo dentro de un mantenimiento. Puede ser la atención inicial o una intervención correctiva posterior.

### Intervención correctiva

Nueva atención dentro del mismo mantenimiento por una falla atribuible al trabajo anterior, sin constituir un módulo completo de garantías.

### Mantenimiento

Caso operativo completo del trabajo realizado sobre un vehículo bajo el RUC artesanal. Contiene una o más intervenciones con diagnóstico, kilometraje, servicios, observaciones y evidencias.

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

### Proveedor

Persona o empresa que suministra productos al RUC comercial y con la que se relacionan los ingresos de mercadería. Para un proveedor ocasional solo el nombre es obligatorio.

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

### Saldo pendiente

Importe de una operación que aún no ha sido cubierto por pagos válidos.

### Secuencial

Número único y ordenado asignado a un documento dentro de una entidad fiscal, tipo de documento y serie. No debe duplicarse ni reutilizarse.

### Servicio

Trabajo o mano de obra ofrecido por el taller, registrado en un catálogo y aplicado a un mantenimiento.

### SRI

Servicio de Rentas Internas del Ecuador. La integración electrónica con esta institución está fuera de V1.

### Stock

Sinónimo operativo de existencia. En documentación formal se prefiere **existencia**, salvo en expresiones de uso común como “stock bajo”.

### Stock bajo

Condición en la que la existencia alcanza o desciende del umbral configurado para un producto.

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
