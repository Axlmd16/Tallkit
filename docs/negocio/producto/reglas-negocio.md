# Reglas de negocio

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Versión del documento | 0.3 |
| Estado | Alineado con el modelo de dominio aprobado |
| Fecha | 2026-09-08 |

> Las reglas usan identificadores estables por dominio. No deben renumerarse si una regla se elimina; en ese caso se conserva el identificador y se marca como reemplazado o descartado.

## 1. Convenciones

- **Debe / no debe:** obligación del negocio.
- **Puede:** comportamiento permitido, sujeto a permisos.
- **Entidad fiscal:** contribuyente legal bajo el cual se registra una operación.
- **Operación transaccional:** conjunto de cambios que se confirma completo o no se aplica.

Estados de una regla:

- `Propuesta`: requiere validación del negocio.
- `Aprobada`: forma parte de la línea base.
- `Reemplazada`: conserva trazabilidad, pero otra regla ocupa su lugar.
- `Descartada`: no se aplicará.

Las reglas alineadas con `../decisiones/decisiones-confirmadas.yaml` y con el modelo de dominio aprobado se encuentran en estado **Aprobada**. Los asuntos tributarios señalados al final requieren validación externa.

## 2. Entidades fiscales

| ID | Regla |
|---|---|
| RN-FIS-001 | El sistema debe registrar dos entidades fiscales legalmente independientes: una comercial y una artesanal. |
| RN-FIS-002 | Las compras, el inventario y las ventas de productos o repuestos deben pertenecer al RUC comercial. |
| RN-FIS-003 | Los mantenimientos, reparaciones, servicios y mano de obra deben pertenecer al RUC artesanal. |
| RN-FIS-004 | Clientes, vehículos y usuarios deben ser datos compartidos y no deben duplicarse únicamente por participar en ambas actividades. |
| RN-FIS-005 | Una operación económica debe pertenecer a una sola entidad fiscal. |
| RN-FIS-006 | Los conceptos de repuestos y servicios no deben combinarse en un mismo documento económico. |
| RN-FIS-007 | Cuando un mantenimiento utilice repuestos, el sistema debe crear o vincular una venta independiente del RUC comercial. |
| RN-FIS-008 | La venta de repuestos y la operación de servicios deben conservar secuenciales, impuestos, pagos, saldos, facturación, anulaciones y estados independientes. |
| RN-FIS-009 | Todo documento, pantalla de cobro y reporte económico debe identificar claramente su entidad fiscal. |
| RN-FIS-010 | Los parámetros tributarios deben configurarse por entidad fiscal y período de vigencia; no deben quedar fijados permanentemente en el código. |

## 3. Usuarios, roles y auditoría

| ID | Regla |
|---|---|
| RN-SEG-001 | Toda operación no pública debe ser realizada por un usuario autenticado y activo. |
| RN-SEG-002 | V1 debe disponer únicamente de tres roles internos: Administrador, Vendedor y Encargado del taller. |
| RN-SEG-003 | Cada usuario debe tener al menos uno de los tres roles y puede reunir varios de ellos; V1 no permitirá crear roles adicionales ni asignar permisos personalizados por usuario. |
| RN-SEG-004 | Ajustar existencias, confirmar, anular, devolver o reembolsar operaciones y confirmar reposiciones sin cargo debe requerir un permiso explícito. V1 no admite descuentos. |
| RN-SEG-005 | El sistema debe registrar usuario, fecha y motivo en operaciones críticas. |
| RN-SEG-006 | La desactivación de un usuario no debe eliminar su historial. |
| RN-SEG-007 | Los usuarios no deben poder aprobar acciones restringidas únicamente manipulando la interfaz; el backend debe verificar todos los permisos. |

## 4. Clientes y vehículos

| ID | Regla |
|---|---|
| RN-CLI-001 | Un cliente puede ser persona natural o jurídica y puede relacionarse con ambas entidades fiscales. |
| RN-CLI-002 | Cuando se registre un número de identificación, la combinación de tipo y número normalizado no debe repetirse. |
| RN-CLI-003 | La ausencia de identificación solo se permitirá si las reglas del documento u operación correspondiente lo admiten. |
| RN-CLI-004 | Un cliente puede tener uno o varios vehículos. |
| RN-CLI-005 | Un vehículo debe tener un único propietario vigente, que referencia a un Cliente; V1 no distingue responsable ni copropietarios. |
| RN-CLI-006 | La placa y el VIN, cuando existan, deben normalizarse y no deben duplicarse. |
| RN-CLI-007 | El historial de un vehículo debe conservar los mantenimientos y documentos relacionados aunque cambie su propietario. |
| RN-CLI-008 | Los clientes y vehículos con historial transaccional no deben eliminarse físicamente; podrán desactivarse o corregirse de forma trazable. |
| RN-CLI-009 | Cambiar el propietario debe cerrar el período anterior y abrir uno nuevo sin alterar mantenimientos ni documentos históricos. |

## 5. Productos, servicios y proveedores

| ID | Regla |
|---|---|
| RN-CAT-001 | Cada producto debe tener un código único dentro del catálogo comercial. |
| RN-CAT-002 | Un producto inactivo no puede agregarse a nuevas operaciones, pero debe seguir visible en el historial. |
| RN-CAT-003 | Categorías, marcas de producto y marcas de vehículo son catálogos distintos y no sustituyen la identificación del producto. |
| RN-CAT-004 | La compatibilidad vehicular es informativa en V1 y no debe bloquear una venta sin confirmación expresa del usuario. |
| RN-CAT-005 | Un kit comprado se manejará como un producto completo; su venta no descontará automáticamente componentes internos. |
| RN-CAT-006 | Una pieza que se venda por separado debe registrarse como producto independiente. |
| RN-CAT-007 | Los precios y costos deben almacenarse con precisión monetaria y no pueden ser negativos. |
| RN-CAT-008 | Cada servicio del catálogo debe tener un nombre, estado y precio referencial. |
| RN-CAT-009 | Modificar el precio referencial de un servicio no debe alterar mantenimientos anteriores. |
| RN-CAT-010 | Un proveedor inactivo no puede utilizarse en nuevos ingresos, pero debe conservarse en operaciones históricas. |
| RN-CAT-011 | Cada presentación completa vendible debe tener código, existencia, costo y precio propios; V1 no vende fracciones de envases abiertos. |
| RN-CAT-012 | Cantidad debe conservar valor y unidad; las unidades y presentaciones administrables no habilitan conversiones o fraccionamientos automáticos. |
| RN-CAT-013 | Marca de producto y compatibilidad con marca de vehículo sirven para búsqueda y filtros; la compatibilidad es informativa y no bloquea la venta. |
| RN-CAT-014 | Un producto comprado como kit puede desarmarse mediante una operación explícita; V1 no crea kits de inventario a partir de piezas sueltas. |
| RN-CAT-015 | Para un proveedor ocasional solo el nombre es obligatorio; identificación y contacto son opcionales. |
| RN-CAT-016 | El precio de catálogo de un producto representa el valor final para el cliente, con impuesto incluido cuando aplique. |

## 6. Ingresos, inventario y Kardex

| ID | Regla |
|---|---|
| RN-INV-001 | El stock no debe editarse directamente; toda variación debe originar un movimiento de Kardex. |
| RN-INV-002 | Todo movimiento debe registrar producto, bodega, cantidad, tipo, fecha, usuario y origen o motivo. |
| RN-INV-003 | Un ingreso de mercadería confirmado debe estar relacionado con un proveedor registrado. |
| RN-INV-004 | Un ingreso en borrador no modifica existencias ni costos. |
| RN-INV-005 | Al confirmar un ingreso, el sistema debe aumentar existencias y recalcular el costo promedio ponderado en una sola transacción. |
| RN-INV-006 | El nuevo costo promedio se calculará como `(existencia_anterior × costo_promedio_anterior + cantidad_ingresada × costo_unitario_ingreso) / existencia_resultante`, siempre que la existencia resultante sea mayor que cero. |
| RN-INV-007 | Una salida de inventario no debe recalcular retroactivamente el costo promedio; debe conservar el costo aplicable al momento del movimiento. |
| RN-INV-008 | La confirmación de una venta debe generar las salidas de Kardex correspondientes. |
| RN-INV-009 | Una proforma o una venta directa en borrador no genera movimientos ni reservas de inventario. |
| RN-INV-010 | Un ajuste debe indicar cantidad, sentido, motivo y usuario autorizado. |
| RN-INV-011 | Un documento confirmado que afecte stock no debe eliminarse ni editar sus cantidades directamente. |
| RN-INV-012 | La anulación o devolución debe generar movimientos inversos relacionados con el movimiento original. |
| RN-INV-013 | La confirmación de movimientos debe bloquear o validar de manera segura las existencias afectadas para evitar ventas simultáneas inconsistentes. |
| RN-INV-014 | Un mismo documento no debe generar dos veces el mismo efecto de inventario. |
| RN-INV-015 | Las cantidades de producto deben respetar la precisión permitida por su unidad de medida. |
| RN-INV-016 | V1 opera con una sola bodega y ninguna confirmación puede producir existencia o disponibilidad negativa. |
| RN-INV-017 | Solo una venta abierta vinculada a un mantenimiento reserva existencias; la reserva reduce disponibilidad, pero no existencia ni Kardex. |
| RN-INV-018 | Agregar o aumentar una línea reservada debe validar disponibilidad atómicamente; reducirla o retirarla debe liberar la diferencia. |
| RN-INV-019 | El desarme de un kit debe consumir una unidad del kit y producir los componentes reales en una sola operación trazable. |
| RN-INV-020 | El costo total del kit desarmado debe distribuirse exactamente entre los componentes, proporcionalmente a costos de referencia o a pesos informados por el Administrador. |
| RN-INV-021 | Un consumo interno disminuye existencia por presentación completa sin crear venta ni deuda para el cliente. |
| RN-INV-022 | Una reposición por corrección disminuye existencia sin cargo al cliente y requiere confirmación del Administrador. |
| RN-INV-023 | Una devolución a proveedor debe referenciar el ingreso original y disminuir existencia; V1 no controla la deuda o el reembolso del proveedor. |

## 7. Proformas

| ID | Regla |
|---|---|
| RN-PRO-001 | Una proforma es una oferta informativa y no constituye una venta confirmada. |
| RN-PRO-002 | La proforma no reserva ni descuenta stock. |
| RN-PRO-003 | La proforma debe registrar fecha de emisión, vigencia, cliente y detalle de productos. |
| RN-PRO-004 | Los precios finales e impuestos de una proforma son una referencia y deben validarse nuevamente al convertirla; V1 no admite descuentos. |
| RN-PRO-005 | Convertir una proforma debe crear una venta nueva y conservar la relación entre ambas. |
| RN-PRO-006 | Una proforma no puede convertirse más de una vez. |
| RN-PRO-007 | Una proforma vencida o anulada no puede reactivarse ni convertirse; si el cliente retoma la oferta se crea una proforma nueva vinculada. |
| RN-PRO-008 | Cambiar o anular una proforma no debe alterar una venta ya creada desde ella. |

## 8. Ventas, pagos y devoluciones

| ID | Regla |
|---|---|
| RN-VEN-001 | Una venta de repuestos pertenece siempre al RUC comercial. |
| RN-VEN-002 | Una venta en borrador no descuenta stock ni genera una cuenta por cobrar definitiva. |
| RN-VEN-003 | El stock se descuenta únicamente al confirmar la venta. |
| RN-VEN-004 | La confirmación debe validar productos activos, cantidades, precios, permisos y disponibilidad de stock según la política aprobada. |
| RN-VEN-005 | La confirmación debe asignar el secuencial y afectar inventario en una sola transacción. |
| RN-VEN-006 | Una venta confirmada no debe modificar directamente sus datos económicos; se corrige mediante anulación, devolución u otro documento relacionado. |
| RN-VEN-007 | El estado de la venta, el estado del pago, el estado del documento interno y la eventual referencia fiscal deben evolucionar de forma independiente. |
| RN-VEN-008 | La condición de crédito indica únicamente que puede quedar saldo pendiente; no constituye forma de pago ni contiene vencimiento, cuotas, intereses o cronograma. |
| RN-VEN-009 | Todo pago o abono debe registrar una forma de pago real, importe, fecha, entidad fiscal y usuario. |
| RN-VEN-010 | Una operación puede recibir varios pagos y cada pago puede combinar EFECTIVO y TRANSFERENCIA. |
| RN-VEN-011 | El saldo pendiente debe derivarse del total exigible menos los pagos válidos aplicados. |
| RN-VEN-012 | El estado de pago debe derivarse del saldo: pendiente, parcial o pagado, sin depender del estado de la venta. |
| RN-VEN-013 | Un pago no debe aplicarse a documentos de entidades fiscales diferentes. |
| RN-VEN-014 | Un pago o abono pertenece a una sola operación elegida por el usuario y no puede exceder su saldo; el sistema no distribuye automáticamente un importe entre deudas. |
| RN-VEN-015 | La devolución de un repuesto debe relacionarse con la venta original, limitarse a la cantidad todavía devolvible e identificar el resultado de la inspección. |
| RN-VEN-016 | Anular una venta no debe borrar sus pagos; estos deben anularse o reembolsarse mediante un procedimiento trazable. |
| RN-VEN-017 | V1 no admite descuentos en proformas, ventas, servicios ni mantenimientos. |
| RN-VEN-018 | Los secuenciales deben ser únicos por entidad fiscal, tipo de documento y serie, y generarse de forma segura ante concurrencia. V1 inicia COM-ING, COM-PRO y COM-VEN para el RUC comercial y ART-SER para el RUC artesanal; usa `<SERIE>-<SECUENCIAL>`, con contador desde 1 y al menos seis dígitos visibles, sin reinicio, reducción ni reutilización. |
| RN-VEN-019 | V1 no admite anticipos, sobrepagos ni saldos a favor; una devolución que produzca exceso pagado requiere un reembolso trazable. |
| RN-VEN-020 | Un producto devuelto solo reingresa al inventario si el Administrador lo declara apto para reventa; de lo contrario, la devolución económica no aumenta existencia. |
| RN-VEN-021 | El costo del reingreso apto debe ser el costo histórico de la salida original. |

## 9. Servicios y mantenimientos

| ID | Regla |
|---|---|
| RN-TAL-001 | Todo mantenimiento pertenece al RUC artesanal y debe relacionarse con un cliente y un vehículo. |
| RN-TAL-002 | Los estados permitidos en V1 son registrado, finalizado, reabierto y cancelado. |
| RN-TAL-003 | Un mantenimiento registrado puede editar sus datos operativos mientras el usuario tenga permiso. |
| RN-TAL-004 | Finalizar, reabrir o cancelar un mantenimiento debe registrar fecha y usuario responsable. |
| RN-TAL-005 | Solo puede cancelarse un mantenimiento duplicado, erróneo o sin trabajo cobrable; debe conservarse en el historial y liberar sus reservas. |
| RN-TAL-006 | El mantenimiento debe permitir registrar kilometraje, diagnóstico, observaciones y fotografías. |
| RN-TAL-007 | El kilometraje no puede ser negativo y el sistema debe advertir si es menor al último kilometraje conocido del vehículo. |
| RN-TAL-008 | Un servicio agregado al mantenimiento debe copiar el precio referencial vigente como punto de partida. |
| RN-TAL-009 | El Encargado del taller puede modificar el precio aplicado de un servicio antes de confirmar, sin motivo obligatorio y sin alterar el catálogo. |
| RN-TAL-010 | Los servicios y pagos del mantenimiento deben registrarse bajo el RUC artesanal. |
| RN-TAL-011 | Los repuestos utilizados no deben descontarse directamente desde el mantenimiento; deben incluirse en una venta vinculada del RUC comercial. |
| RN-TAL-012 | La venta vinculada y el mantenimiento deben conservar identificadores, estados, pagos, anulaciones e historial independientes. |
| RN-TAL-013 | Cancelar un mantenimiento no debe anular automáticamente una venta confirmada; el usuario debe resolver cada operación mediante su proceso autorizado. |
| RN-TAL-014 | Finalizar un mantenimiento no debe confirmar automáticamente una venta de repuestos que aún no haya superado sus validaciones. |
| RN-TAL-015 | La V1 no asignará trabajos a mecánicos ni calculará productividad o comisiones. |
| RN-TAL-016 | V1 no gestionará presupuesto, aprobación previa ni un módulo de garantías; sí registrará la corrección simple atribuible al taller. |
| RN-TAL-017 | Un mantenimiento finalizado puede reabrirse de forma explícita y auditada cuando el retorno sea atribuible al trabajo anterior; una falla nueva origina otro mantenimiento. |
| RN-TAL-018 | Cada reapertura debe agregar una intervención correctiva y conservar la intervención inicial sin sobrescribirla. |
| RN-TAL-019 | El trabajo correctivo atribuible al taller no genera un nuevo cobro al cliente. |
| RN-TAL-020 | Un mantenimiento no puede finalizar mientras la venta comercial abierta vinculada conserve líneas; estas deben confirmarse o retirarse primero. |
| RN-TAL-021 | Los repuestos aportados por el cliente no entran al inventario ni generan venta; solo pueden mencionarse en observaciones. |

## 10. Configuración, documentos y reportes

| ID | Regla |
|---|---|
| RN-CON-001 | Un cambio de impuesto o tarifa debe tener fecha de vigencia y no debe alterar documentos históricos. |
| RN-CON-002 | Los documentos confirmados deben conservar una copia de los datos y valores relevantes aplicados en ese momento. |
| RN-CON-003 | Los comprobantes internos deben indicar que no constituyen factura electrónica cuando corresponda. |
| RN-CON-004 | Los reportes deben obtener sus valores de operaciones confirmadas y correcciones válidas, respetando sus estados. |
| RN-CON-005 | Los reportes económicos deben poder filtrarse y totalizarse por entidad fiscal sin mezclar importes. |
| RN-CON-006 | Las fotografías forman parte del respaldo operativo y deben conservar su relación con el mantenimiento. |
| RN-CON-007 | Las operaciones transaccionales no deben eliminarse físicamente; se utilizarán estados y registros compensatorios. |
| RN-CON-008 | Las fechas y horas almacenadas deben mantener un criterio uniforme definido por la arquitectura, mostrando al usuario la zona horaria del negocio. |
| RN-CON-009 | El documento interno confirmado conserva su secuencia y no constituye una factura electrónica autorizada por el SRI. |
| RN-CON-010 | Una futura referencia fiscal electrónica tendrá identidad y estado independientes y no controlará inventario, pagos o mantenimiento. |
| RN-CON-011 | Cada entidad fiscal debe tener un cierre diario lógico separado, desglosado por EFECTIVO y TRANSFERENCIA, aunque una persona maneje físicamente ambos cobros. |
| RN-CON-012 | Una diferencia de caja debe registrar explicación sin alterar pagos o documentos originales. |
| RN-CON-013 | El margen bruto histórico se calcula con precio y costo históricos y no debe presentarse como ganancia neta. |

## 11. Invariantes críticas

Estas condiciones nunca deben romperse:

1. Una operación económica pertenece a una sola entidad fiscal.
2. Un movimiento de inventario tiene un origen o motivo trazable.
3. Una proforma nunca modifica stock.
4. Una venta solo modifica stock una vez al confirmarse.
5. Una corrección no elimina el historial original.
6. Un pago pertenece a la misma entidad fiscal que el documento al que se aplica.
7. Un repuesto usado en un mantenimiento sale del inventario mediante una venta comercial vinculada.
8. Un secuencial confirmado no se reutiliza ni duplica.
9. Los documentos históricos conservan los valores aplicados en su fecha.
10. Una reserva reduce disponibilidad, no existencia, y nunca genera Kardex.
11. Un pago se aplica a una sola operación confirmada de una sola entidad fiscal.
12. Un mantenimiento no finaliza con líneas comerciales pendientes.
13. Una corrección atribuible al taller no crea deuda para el cliente.
14. Consumos internos y reposiciones sin cargo afectan inventario mediante operaciones explícitas.

## 12. Decisiones abiertas relacionadas

- Límites y conservación definitiva de fotografías.
- Tratamiento fiscal y contable de consumos internos y reposiciones sin cargo entre RUC.
- Tarifas, clasificaciones tributarias y reglas de redondeo aplicables.
- Requisitos futuros de consumidor final y facturación electrónica.
