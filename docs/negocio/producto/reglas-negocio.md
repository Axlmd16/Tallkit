# Reglas de negocio

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Versión del documento | 0.2 |
| Estado | Borrador para revisión |
| Fecha | 2026-08-04 |

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

Todas las reglas de esta versión se encuentran en estado **Propuesta** hasta su revisión.

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
| RN-SEG-004 | Cambiar precios fuera de los límites definidos, aplicar descuentos especiales, ajustar stock, confirmar, anular o devolver operaciones debe requerir un permiso explícito. |
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
| RN-CLI-005 | Un vehículo debe tener un propietario o cliente responsable vigente. |
| RN-CLI-006 | La placa y el VIN, cuando existan, deben normalizarse y no deben duplicarse. |
| RN-CLI-007 | El historial de un vehículo debe conservar los mantenimientos y documentos relacionados aunque cambie su propietario. |
| RN-CLI-008 | Los clientes y vehículos con historial transaccional no deben eliminarse físicamente; podrán desactivarse o corregirse de forma trazable. |

## 5. Productos, servicios y proveedores

| ID | Regla |
|---|---|
| RN-CAT-001 | Cada producto debe tener un código único dentro del catálogo comercial. |
| RN-CAT-002 | Un producto inactivo no puede agregarse a nuevas operaciones, pero debe seguir visible en el historial. |
| RN-CAT-003 | Categorías, marcas y compatibilidades vehiculares son datos de clasificación y no sustituyen la identificación del producto. |
| RN-CAT-004 | La compatibilidad vehicular es informativa en V1 y no debe bloquear una venta sin confirmación expresa del usuario. |
| RN-CAT-005 | Un kit se manejará como un producto completo; su venta no descontará automáticamente componentes internos. |
| RN-CAT-006 | Una pieza que se venda por separado debe registrarse como producto independiente. |
| RN-CAT-007 | Los precios y costos deben almacenarse con precisión monetaria y no pueden ser negativos. |
| RN-CAT-008 | Cada servicio del catálogo debe tener un nombre, estado y precio referencial. |
| RN-CAT-009 | Modificar el precio referencial de un servicio no debe alterar mantenimientos anteriores. |
| RN-CAT-010 | Un proveedor inactivo no puede utilizarse en nuevos ingresos, pero debe conservarse en operaciones históricas. |

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
| RN-INV-009 | Una proforma no genera movimientos ni reservas de inventario. |
| RN-INV-010 | Un ajuste debe indicar cantidad, sentido, motivo y usuario autorizado. |
| RN-INV-011 | Un documento confirmado que afecte stock no debe eliminarse ni editar sus cantidades directamente. |
| RN-INV-012 | La anulación o devolución debe generar movimientos inversos relacionados con el movimiento original. |
| RN-INV-013 | La confirmación de movimientos debe bloquear o validar de manera segura las existencias afectadas para evitar ventas simultáneas inconsistentes. |
| RN-INV-014 | Un mismo documento no debe generar dos veces el mismo efecto de inventario. |
| RN-INV-015 | Las cantidades de producto deben respetar la precisión permitida por su unidad de medida. |
| RN-INV-016 | La política definitiva sobre stock negativo debe aprobarse antes de implementar la confirmación de ventas. |

## 7. Proformas

| ID | Regla |
|---|---|
| RN-PRO-001 | Una proforma es una oferta informativa y no constituye una venta confirmada. |
| RN-PRO-002 | La proforma no reserva ni descuenta stock. |
| RN-PRO-003 | La proforma debe registrar fecha de emisión, vigencia, cliente y detalle de productos. |
| RN-PRO-004 | Los precios, descuentos e impuestos de una proforma son una referencia y deben validarse nuevamente al convertirla. |
| RN-PRO-005 | Convertir una proforma debe crear una venta nueva y conservar la relación entre ambas. |
| RN-PRO-006 | Una proforma no puede convertirse más de una vez, salvo que la conversión anterior haya sido invalidada mediante un proceso expresamente definido. |
| RN-PRO-007 | Una proforma vencida o anulada no puede convertirse sin una renovación autorizada. |
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
| RN-VEN-007 | El estado de la venta, el estado del pago y el estado de facturación deben almacenarse y evolucionar de forma independiente. |
| RN-VEN-008 | La condición de crédito indica cuándo se espera cobrar y no constituye una forma de pago. |
| RN-VEN-009 | Todo pago o abono debe registrar una forma de pago real, importe, fecha, entidad fiscal y usuario. |
| RN-VEN-010 | Una operación puede recibir varios pagos y, cuando se habilite, un mismo cobro puede combinar formas de pago. |
| RN-VEN-011 | El saldo pendiente debe derivarse del total exigible menos los pagos válidos aplicados. |
| RN-VEN-012 | El estado de pago debe derivarse del saldo: pendiente, parcial o pagado, sin depender del estado de la venta. |
| RN-VEN-013 | Un pago no debe aplicarse a documentos de entidades fiscales diferentes. |
| RN-VEN-014 | Un abono no puede exceder el saldo pendiente salvo que se apruebe una regla de saldo a favor o devolución. |
| RN-VEN-015 | La devolución de un repuesto debe relacionarse con la venta original, identificar cantidades y motivo, y devolver stock cuando corresponda. |
| RN-VEN-016 | Anular una venta no debe borrar sus pagos; estos deben anularse, devolverse o reasignarse mediante un procedimiento trazable. |
| RN-VEN-017 | Los descuentos deben respetar límites y permisos aún pendientes de definición. |
| RN-VEN-018 | Los secuenciales deben ser únicos por entidad fiscal, tipo de documento y serie, y generarse de forma segura ante concurrencia. |

## 9. Servicios y mantenimientos

| ID | Regla |
|---|---|
| RN-TAL-001 | Todo mantenimiento pertenece al RUC artesanal y debe relacionarse con un cliente y un vehículo. |
| RN-TAL-002 | Los estados permitidos en V1 son registrado, finalizado y cancelado. |
| RN-TAL-003 | Un mantenimiento registrado puede editar sus datos operativos mientras el usuario tenga permiso. |
| RN-TAL-004 | Finalizar o cancelar un mantenimiento debe registrar fecha y usuario responsable. |
| RN-TAL-005 | Un mantenimiento cancelado debe conservarse en el historial y no debe generar nuevos cobros. |
| RN-TAL-006 | El mantenimiento debe permitir registrar kilometraje, diagnóstico, observaciones y fotografías. |
| RN-TAL-007 | El kilometraje no puede ser negativo y el sistema debe advertir si es menor al último kilometraje conocido del vehículo. |
| RN-TAL-008 | Un servicio agregado al mantenimiento debe copiar el precio referencial vigente como punto de partida. |
| RN-TAL-009 | El precio aplicado de un servicio puede modificarse dentro del mantenimiento sin alterar el catálogo. |
| RN-TAL-010 | Los servicios y pagos del mantenimiento deben registrarse bajo el RUC artesanal. |
| RN-TAL-011 | Los repuestos utilizados no deben descontarse directamente desde el mantenimiento; deben incluirse en una venta vinculada del RUC comercial. |
| RN-TAL-012 | La venta vinculada y el mantenimiento deben conservar identificadores, estados, pagos, anulaciones e historial independientes. |
| RN-TAL-013 | Cancelar un mantenimiento no debe anular automáticamente una venta confirmada; el usuario debe resolver cada operación mediante su proceso autorizado. |
| RN-TAL-014 | Finalizar un mantenimiento no debe confirmar automáticamente una venta de repuestos que aún no haya superado sus validaciones. |
| RN-TAL-015 | La V1 no asignará trabajos a mecánicos ni calculará productividad o comisiones. |
| RN-TAL-016 | La V1 no gestionará presupuesto, aprobación previa del cliente ni garantía del mantenimiento. |
| RN-TAL-017 | El tratamiento de reapertura de mantenimientos finalizados debe definirse antes de implementar esa acción. |

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

## 12. Decisiones abiertas relacionadas

- Política de stock negativo.
- Número de bodegas operativas en V1.
- Formas de pago y combinaciones admitidas.
- Límite de descuento ordinario del Vendedor; el Administrador autorizará cualquier exceso.
- Tratamiento de sobrepagos, saldos a favor y reembolsos.
- Reapertura de mantenimientos finalizados.
- Estados definitivos de proforma y facturación interna.
- Reglas tributarias que deben validarse con el responsable contable.
