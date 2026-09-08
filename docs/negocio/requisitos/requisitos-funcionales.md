# Requisitos funcionales

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Nombre técnico provisional | Sys-Inventario |
| Versión del documento | 0.2 |
| Estado | Borrador para revisión |
| Fecha | 2026-08-04 |

> Los requisitos describen el sistema objetivo de la versión 1. No documentan como correcto el comportamiento del código existente.

## 1. Convenciones

- Identificador: `RF-<MÓDULO>-<NÚMERO>`.
- Prioridades: `Debe` (indispensable para V1), `Debería` (importante, pero admite planificación posterior dentro de V1) y `Podría` (conveniente si no compromete lo esencial).
- Los identificadores son estables y no se reutilizan.
- V1 reconoce únicamente los roles Administrador, Vendedor y Encargado del taller; cada usuario tiene al menos uno y puede reunir varios de esos tres.
- “Usuario autorizado” significa uno de esos tres roles cuando posee el permiso específico definido en `actores-y-roles.md`.
- Todo requisito económico se interpreta junto con las reglas de separación fiscal de `reglas-negocio.md`.

## 2. Identidad, acceso y configuración

| ID | Requisito | Prioridad | Criterio de cumplimiento resumido |
|---|---|---|---|
| RF-ACC-001 | El sistema debe permitir iniciar sesión con credenciales válidas y rechazar cuentas inactivas o credenciales incorrectas. | Debe | Solo un usuario activo con credenciales válidas obtiene una sesión. |
| RF-ACC-002 | El sistema debe permitir cerrar la sesión actual e invalidar su uso posterior. | Debe | Una petición protegida con la sesión cerrada es rechazada. |
| RF-ACC-003 | Un usuario autenticado debe poder cambiar su contraseña confirmando las credenciales requeridas. | Debe | La contraseña anterior deja de funcionar y el cambio queda registrado. |
| RF-ACC-004 | El Administrador debe poder iniciar un restablecimiento seguro de credenciales sin conocer la contraseña anterior. | Debe | Se entrega o genera un mecanismo temporal que obliga a establecer una nueva contraseña. |
| RF-ACC-005 | El administrador debe poder crear, editar, activar y desactivar usuarios. | Debe | Los cambios respetan unicidad; una cuenta desactivada no inicia sesión y conserva historial. |
| RF-ACC-006 | El Administrador debe poder consultar los permisos fijos de Administrador, Vendedor y Encargado del taller. | Debe | El sistema presenta únicamente los tres roles de V1 y no permite crear ni modificar roles. |
| RF-ACC-007 | El Administrador debe poder asignar a cada usuario uno o más de los tres roles de V1. | Debe | Un usuario activo tiene al menos un rol permitido y no puede recibir un rol adicional o personalizado. |
| RF-ACC-008 | El sistema debe validar en el backend el permiso requerido para cada acción protegida. | Debe | Invocar directamente una operación sin permiso devuelve denegación y no cambia datos. |
| RF-ACC-009 | El administrador debe poder consultar la actividad crítica por usuario, fecha, acción, entidad afectada y resultado. | Debe | La consulta filtra los eventos registrados y muestra su origen trazable. |
| RF-ACC-010 | El sistema debe permitir configurar los datos de las dos entidades fiscales y mantenerlas diferenciadas. | Debe | Cada entidad conserva su RUC, tipo, datos de identificación y parámetros propios. |
| RF-ACC-011 | El sistema debe permitir configurar impuestos y tarifas por entidad fiscal con período de vigencia. | Debe | Un cambio futuro no altera los valores conservados en documentos históricos. |
| RF-ACC-012 | El sistema debe permitir configurar series y secuenciales por entidad fiscal y tipo de documento. | Debe | Dos documentos confirmados del mismo ámbito no reciben el mismo secuencial. |
| RF-ACC-013 | El sistema debe permitir configurar umbrales de stock bajo por producto. | Debería | El umbral guardado determina cuándo el producto aparece en la alerta. |
| RF-ACC-014 | El sistema debe permitir configurar las formas de pago habilitadas una vez resuelta `DP-003`. | Debe | Solo las formas activas pueden utilizarse en pagos nuevos. |

## 3. Clientes y vehículos

| ID | Requisito | Prioridad | Criterio de cumplimiento resumido |
|---|---|---|---|
| RF-CLI-001 | El sistema debe permitir registrar clientes como persona natural o jurídica con los datos obligatorios definidos en `DP-008`. | Debe | El cliente válido se guarda una sola vez y queda disponible para ambas entidades fiscales. |
| RF-CLI-002 | El sistema debe permitir buscar clientes por nombre, identificación, teléfono y otros datos disponibles. | Debe | La búsqueda devuelve coincidencias parciales pertinentes y admite seleccionar un cliente. |
| RF-CLI-003 | El sistema debe normalizar la identificación y evitar duplicados por tipo y número cuando exista. | Debe | El intento de registrar la misma identificación normalizada es rechazado. |
| RF-CLI-004 | El Administrador, el Vendedor y el Encargado del taller deben poder editar datos de un cliente sin alterar documentos históricos confirmados. | Debe | La ficha cambia, pero los datos conservados en documentos anteriores permanecen. |
| RF-CLI-005 | El Administrador debe poder desactivar y reactivar clientes sin eliminar su historial. | Debe | El cliente inactivo no se usa en nuevas operaciones y sigue visible en las anteriores. |
| RF-CLI-006 | El sistema debe permitir registrar uno o varios vehículos relacionados con un cliente responsable vigente. | Debe | Cada vehículo queda asociado a un cliente y puede consultarse desde su ficha. |
| RF-CLI-007 | El sistema debe registrar, según disponibilidad, placa, VIN, marca, modelo, año, color y datos técnicos necesarios. | Debe | La ficha valida formatos y obligatoriedad conforme a `DP-008`. |
| RF-CLI-008 | El sistema debe normalizar placa y VIN, y evitar duplicados cuando estén informados. | Debe | No se guardan dos vehículos activos o históricos con la misma placa o VIN normalizados. |
| RF-CLI-009 | El Administrador o el Encargado del taller debe poder cambiar el cliente responsable vigente de un vehículo conservando el historial anterior. | Debería | Los mantenimientos anteriores siguen asociados al vehículo y se registra el cambio. |
| RF-CLI-010 | El Administrador y el Encargado del taller deben poder editar vehículos; solo el Administrador puede desactivarlos o reactivarlos. | Debe | Un vehículo inactivo no entra en nuevas operaciones, pero conserva consultas históricas. |
| RF-CLI-011 | El sistema debe mostrar un historial cronológico del vehículo con mantenimientos y documentos vinculados permitidos. | Debe | La consulta reúne los eventos del vehículo sin mezclar pagos o entidades fiscales. |
| RF-CLI-012 | El sistema debe advertir posibles duplicados de clientes o vehículos antes de confirmar un registro. | Debería | Ante coincidencias relevantes, el usuario puede revisar la ficha existente antes de continuar. |

## 4. Catálogos de productos, servicios y proveedores

| ID | Requisito | Prioridad | Criterio de cumplimiento resumido |
|---|---|---|---|
| RF-CAT-001 | El sistema debe permitir registrar productos con código único, nombre, descripción, categoría, marca, unidad, precio y estado. | Debe | Un producto válido se guarda y un código repetido es rechazado. |
| RF-CAT-002 | El sistema debe permitir editar un producto sin modificar líneas históricas de documentos confirmados. | Debe | Los cambios aplican a operaciones futuras y el histórico conserva sus valores. |
| RF-CAT-003 | El sistema debe permitir activar y desactivar productos sin eliminarlos. | Debe | Un producto inactivo no se agrega a operaciones nuevas, pero sigue visible en el historial. |
| RF-CAT-004 | El sistema debe permitir buscar y filtrar productos por código, nombre, categoría, marca, estado y disponibilidad. | Debe | Los filtros pueden combinarse y los resultados reflejan los criterios. |
| RF-CAT-005 | El sistema debe mostrar existencias a los tres roles y costos únicamente al Administrador. | Debe | El Vendedor y el Encargado del taller no reciben costos ni valorización desde la interfaz o la API. |
| RF-CAT-006 | El sistema debe permitir gestionar categorías, marcas y unidades utilizadas por los productos. | Debería | Los valores activos pueden seleccionarse y los históricos permanecen legibles. |
| RF-CAT-007 | El sistema debe permitir registrar compatibilidades vehiculares como información de referencia. | Debería | La compatibilidad puede consultarse y no bloquea por sí sola una venta. |
| RF-CAT-008 | El sistema debe permitir marcar un producto como kit completo sin descomponer automáticamente sus componentes. | Debe | La venta del kit afecta solo la existencia del producto kit. |
| RF-CAT-009 | Toda pieza vendida por separado debe poder registrarse como un producto independiente. | Debe | La pieza tiene código, precio, existencia y Kardex propios. |
| RF-CAT-010 | El sistema debe permitir crear, editar, activar y desactivar servicios con nombre y precio referencial. | Debe | El cambio de precio no altera servicios aplicados a mantenimientos previos. |
| RF-CAT-011 | El sistema debe permitir buscar y filtrar el catálogo de servicios. | Debe | Se localizan servicios activos por nombre y criterios disponibles. |
| RF-CAT-012 | El sistema debe permitir registrar, editar, buscar, activar y desactivar proveedores. | Debe | Un proveedor inactivo queda en históricos y no se selecciona en ingresos nuevos. |

## 5. Ingresos de mercadería, inventario y Kardex

| ID | Requisito | Prioridad | Criterio de cumplimiento resumido |
|---|---|---|---|
| RF-INV-001 | El sistema debe permitir crear y editar un ingreso de mercadería en borrador con proveedor, productos, cantidades y costos unitarios. | Debe | Guardar el borrador no modifica existencias ni costos. |
| RF-INV-002 | El sistema debe validar que un ingreso confirmado tenga proveedor activo, líneas válidas, cantidades positivas y costos no negativos. | Debe | Una confirmación inválida es rechazada sin efectos parciales. |
| RF-INV-003 | Al confirmar un ingreso, el sistema debe aumentar existencias y recalcular el costo promedio ponderado en una transacción atómica. | Debe | Todos los movimientos y costos se aplican juntos o ninguno se aplica. |
| RF-INV-004 | El sistema debe asignar al ingreso confirmado un identificador y secuencial únicos según la configuración aprobada. | Debe | Confirmaciones concurrentes no duplican secuenciales. |
| RF-INV-005 | El sistema debe impedir que un mismo ingreso produzca dos veces sus efectos. | Debe | Repetir la solicitud de confirmación no duplica existencias ni movimientos. |
| RF-INV-006 | El Administrador debe poder anular un ingreso confirmado indicando motivo. | Debe | La anulación genera movimientos inversos relacionados y conserva el original. |
| RF-INV-007 | El sistema debe mostrar la existencia actual por producto y bodega habilitada. | Debe | El saldo coincide con la suma de movimientos válidos del Kardex. |
| RF-INV-008 | El sistema debe permitir consultar el Kardex por producto, fecha, tipo, documento de origen, bodega y usuario. | Debe | Cada fila identifica entrada o salida, saldo y origen trazable. |
| RF-INV-009 | El Administrador debe poder registrar un ajuste de inventario con producto, cantidad, sentido, bodega y motivo obligatorio. | Debe | Confirmar el ajuste crea un movimiento; no edita directamente el saldo. |
| RF-INV-010 | El sistema debe impedir editar o eliminar directamente movimientos de inventario confirmados. | Debe | La corrección se realiza mediante un movimiento relacionado, no mediante sobrescritura. |
| RF-INV-011 | El sistema debe advertir productos cuya existencia sea igual o inferior a su umbral configurado. | Debería | El producto aparece o desaparece de la alerta al cruzar el umbral. |
| RF-INV-012 | La confirmación de salidas debe aplicar de forma transaccional la política de stock negativo que se apruebe en `DP-002`. | Debe | Dos operaciones simultáneas no dejan un resultado contrario a la política. |
| RF-INV-013 | El sistema debe soportar al menos una bodega principal y no impedir la ampliación definida en `DP-001`. | Debe | Toda existencia y movimiento referencia una bodega válida. |
| RF-INV-014 | Las cantidades deben validarse conforme a la precisión permitida por la unidad del producto. | Debe | No se aceptan fracciones no permitidas ni cantidades cero en movimientos. |

## 6. Proformas

| ID | Requisito | Prioridad | Criterio de cumplimiento resumido |
|---|---|---|---|
| RF-PRO-001 | El sistema debe permitir crear una proforma con cliente, fecha, vigencia y detalle de productos. | Debe | La proforma válida se guarda sin generar movimientos ni saldos. |
| RF-PRO-002 | El Administrador o el Vendedor debe poder editar una proforma mientras su estado lo permita. | Debe | Los cambios no afectan existencias ni ventas ya creadas. |
| RF-PRO-003 | El sistema debe calcular subtotal, descuentos, impuestos y total usando los parámetros aplicables como referencia. | Debe | Los totales corresponden a las líneas y reglas vigentes al guardar. |
| RF-PRO-004 | La proforma debe mostrar disponibilidad informativa sin reservar ni descontar existencia. | Debe | Crear o editar una proforma no cambia el Kardex ni la cantidad disponible. |
| RF-PRO-005 | El sistema debe controlar la vigencia y distinguir proformas editables, vencidas, convertidas y anuladas. | Debe | Las acciones disponibles corresponden al estado y fecha de vigencia. |
| RF-PRO-006 | El Administrador o el Vendedor debe poder anular una proforma sin afectar ventas ya generadas. | Debe | La anulación conserva el documento y no modifica stock. |
| RF-PRO-007 | El Administrador o el Vendedor debe poder convertir una proforma válida en una venta nueva. | Debe | Se copia la información pertinente y se conserva la relación entre ambos documentos. |
| RF-PRO-008 | Antes de confirmar la venta proveniente de una proforma, el sistema debe recalcular precios, impuestos y disponibilidad. | Debe | Los cambios se presentan al usuario y la venta sigue el flujo normal de confirmación. |
| RF-PRO-009 | El sistema debe impedir convertir más de una vez la misma proforma, salvo un procedimiento futuro aprobado. | Debe | Un segundo intento es rechazado y no crea otra venta. |
| RF-PRO-010 | El sistema debe permitir imprimir o exportar la proforma como comprobante interno claramente identificado. | Debería | El documento contiene entidad, cliente, vigencia, líneas y totales, y no se presenta como factura electrónica. |

## 7. Ventas, devoluciones y documentos comerciales

| ID | Requisito | Prioridad | Criterio de cumplimiento resumido |
|---|---|---|---|
| RF-VEN-001 | El sistema debe permitir crear y editar una venta de repuestos en borrador bajo el RUC comercial. | Debe | El borrador no descuenta existencia ni genera cuenta por cobrar definitiva. |
| RF-VEN-002 | La venta debe poder originarse de forma directa, desde una proforma o vinculada a un mantenimiento. | Debe | El origen queda identificado y no cambia la pertenencia al RUC comercial. |
| RF-VEN-003 | El sistema debe calcular subtotal, descuentos, impuestos y total de la venta. | Debe | Los importes se reproducen a partir de sus líneas y parámetros aplicados. |
| RF-VEN-004 | El sistema debe conservar en cada línea el producto, cantidad, precio aplicado, descuento, impuesto y valores históricos relevantes. | Debe | Cambiar el catálogo posteriormente no altera una venta confirmada. |
| RF-VEN-005 | El sistema debe validar productos activos, cantidades, permisos, precios y disponibilidad antes de confirmar. | Debe | Cualquier incumplimiento rechaza la operación completa con explicación. |
| RF-VEN-006 | Al confirmar una venta, el sistema debe asignar secuencial, generar salidas de Kardex y crear el valor exigible en una sola transacción. | Debe | La operación queda completamente confirmada o sin efectos. |
| RF-VEN-007 | El sistema debe impedir que la confirmación repetida produzca dos descuentos de inventario. | Debe | Una solicitud repetida devuelve el estado existente sin duplicar movimientos. |
| RF-VEN-008 | La confirmación concurrente debe evitar secuenciales duplicados y resultados de existencia contrarios a `DP-002`. | Debe | Las pruebas simultáneas conservan unicidad y consistencia. |
| RF-VEN-009 | El sistema debe manejar de forma independiente el estado de venta, pago y facturación. | Debe | Cambiar o derivar un estado no sobrescribe los otros dos. |
| RF-VEN-010 | Una venta confirmada no debe permitir edición destructiva de sus valores económicos. | Debe | La interfaz y la API exigen anulación, devolución o corrección trazable. |
| RF-VEN-011 | El Administrador debe poder anular una venta confirmada indicando motivo y resolviendo sus pagos. | Debe | Se generan efectos compensatorios, se conserva el original y no quedan pagos huérfanos. |
| RF-VEN-012 | El Administrador debe poder registrar una devolución total o parcial relacionada con la venta original. | Debe | Las cantidades válidas regresan a existencia y los valores se corrigen trazablemente. |
| RF-VEN-013 | El sistema debe impedir devolver cantidades superiores a las vendidas menos devoluciones anteriores. | Debe | El exceso es rechazado sin cambios parciales. |
| RF-VEN-014 | Los descuentos y cambios de precio deben requerir los permisos y límites definidos en `DP-004`. | Debe | Un usuario sin autorización no supera el límite ni evita la validación mediante la API. |
| RF-VEN-015 | El sistema debe permitir imprimir o exportar un comprobante interno de la venta. | Debería | El documento identifica el RUC comercial, el estado y que no equivale a factura electrónica cuando corresponda. |
| RF-VEN-016 | Desde una venta vinculada, el sistema debe permitir navegar al mantenimiento relacionado sin fusionar documentos ni pagos. | Debería | Ambas referencias son visibles y mantienen estados independientes. |

## 8. Pagos, abonos y cuentas por cobrar

| ID | Requisito | Prioridad | Criterio de cumplimiento resumido |
|---|---|---|---|
| RF-PAG-001 | El sistema debe registrar la condición de cada operación como contado o crédito, sin tratar el crédito como forma de pago. | Debe | La condición y las formas de pago se almacenan en campos distintos. |
| RF-PAG-002 | El Administrador o el Vendedor debe poder registrar pagos comerciales, y el Administrador o el Encargado del taller debe poder registrar pagos artesanales. | Debe | Cada registro contiene importe, fecha, forma real, usuario y entidad fiscal. |
| RF-PAG-003 | El sistema debe permitir pagos combinados conforme a las formas aprobadas en `DP-003`. | Debe | La suma de partes se aplica como un cobro y cada parte conserva su forma. |
| RF-PAG-004 | El sistema debe impedir aplicar un pago a un documento de una entidad fiscal diferente. | Debe | El intento es rechazado sin modificar ningún saldo. |
| RF-PAG-005 | El sistema debe calcular el saldo pendiente a partir del total exigible y los pagos válidos. | Debe | El saldo puede reproducirse y no depende de un valor editado manualmente. |
| RF-PAG-006 | El sistema debe derivar el estado de pago como pendiente, parcial o pagado según el saldo. | Debe | Registrar o anular un pago actualiza únicamente el estado de pago derivado. |
| RF-PAG-007 | El sistema debe rechazar sobrepagos hasta que `DP-005` establezca saldos a favor o reembolsos. | Debe | Ningún pago válido excede el saldo pendiente en la línea base provisional. |
| RF-PAG-008 | El Administrador debe poder anular o corregir un pago mediante un registro trazable, sin eliminarlo. | Debe | El pago original conserva estado, motivo, usuario y relación con su corrección. |
| RF-PAG-009 | El sistema debe mostrar cuentas por cobrar separadas por entidad fiscal, cliente, estado y antigüedad. | Debe | No se totalizan juntos saldos comerciales y artesanales. |
| RF-PAG-010 | Los pagos de una venta vinculada y los de servicios del mismo mantenimiento deben registrarse y mostrarse por separado. | Debe | Cada cobro referencia solo su documento y entidad fiscal. |

## 9. Servicios y mantenimientos

| ID | Requisito | Prioridad | Criterio de cumplimiento resumido |
|---|---|---|---|
| RF-TAL-001 | El sistema debe permitir crear un mantenimiento bajo el RUC artesanal, relacionado con cliente y vehículo. | Debe | El mantenimiento inicia en estado `registrado` y no pertenece al RUC comercial. |
| RF-TAL-002 | El Administrador o el Encargado del taller debe poder registrar fecha, kilometraje, diagnóstico y observaciones. | Debe | El kilometraje no es negativo y los campos se conservan en la ficha. |
| RF-TAL-003 | El sistema debe advertir cuando el kilometraje ingresado sea menor al último conocido. | Debe | La advertencia es visible y la resolución queda sujeta a confirmación autorizada. |
| RF-TAL-004 | El Administrador o el Encargado del taller debe poder adjuntar, consultar y retirar fotografías mientras el estado lo permita. | Debe | Cada archivo válido se relaciona con el mantenimiento y se incluye en respaldos. |
| RF-TAL-005 | El Administrador o el Encargado del taller debe poder agregar servicios del catálogo con cantidad y precio aplicado. | Debe | Se copia el precio referencial vigente y el histórico queda independiente del catálogo. |
| RF-TAL-006 | El Administrador o el Encargado del taller debe poder modificar el precio aplicado de un servicio sin cambiar su precio referencial. | Debe | Solo cambia la línea del mantenimiento y se registra el usuario responsable. |
| RF-TAL-007 | El sistema debe calcular los valores de la operación de servicios bajo el RUC artesanal. | Debe | Los conceptos de servicio no se incluyen en la venta comercial. |
| RF-TAL-008 | El Administrador o el Encargado del taller debe poder confirmar la operación económica de servicios de forma independiente al estado del mantenimiento. | Debe | Recibe su secuencial y valores históricos sin confirmar ventas de repuestos. |
| RF-TAL-009 | El Administrador o el Encargado del taller debe poder registrar pagos y saldos de servicios mediante el flujo de pagos artesanales. | Debe | El pago no puede aplicarse a la venta comercial vinculada. |
| RF-TAL-010 | El Administrador o el Encargado del taller debe poder seleccionar repuestos usados y preparar una venta comercial vinculada. | Debe | Los repuestos se incluyen en una venta del RUC comercial y el mantenimiento no descuenta stock directamente. |
| RF-TAL-011 | La venta vinculada debe pasar por las mismas validaciones, permisos y confirmación que cualquier venta comercial. | Debe | Finalizar el mantenimiento no confirma ni descuenta automáticamente los repuestos. |
| RF-TAL-012 | El sistema debe permitir consultar juntos el mantenimiento, su operación de servicios y la venta vinculada, mostrando su separación. | Debe | La vista presenta documentos, estados, pagos y totales por entidad fiscal. |
| RF-TAL-013 | El Administrador o el Encargado del taller debe poder finalizar un mantenimiento registrado cuando sus datos obligatorios estén completos. | Debe | Se registra fecha y usuario; no se alteran automáticamente documentos económicos pendientes. |
| RF-TAL-014 | El Administrador o el Encargado del taller debe poder cancelar un mantenimiento registrado indicando motivo. | Debe | El historial se conserva y la venta confirmada vinculada no se anula automáticamente. |
| RF-TAL-015 | El sistema debe restringir las transiciones a `registrado`, `finalizado` y `cancelado`. | Debe | Una transición no definida es rechazada por el backend. |
| RF-TAL-016 | La reapertura de un mantenimiento finalizado solo debe habilitarse si se aprueba `DP-007`. | Debe | Mientras esté pendiente, no existe una transición operativa de reapertura. |
| RF-TAL-017 | El sistema debe permitir consultar el historial de mantenimientos por cliente, vehículo, fecha y estado. | Debe | Los filtros devuelven únicamente registros autorizados y conservan vínculos económicos. |
| RF-TAL-018 | El sistema no debe exigir asignación a mecánicos, presupuesto, aprobación previa ni garantía en V1. | Debe | Los flujos pueden completarse sin esos conceptos. |

## 10. Reportes, documentos y consultas

| ID | Requisito | Prioridad | Criterio de cumplimiento resumido |
|---|---|---|---|
| RF-REP-001 | El sistema debe mostrar existencias y productos con stock bajo a los tres roles. | Debe | El reporte filtra y exporta productos conforme a sus saldos y umbrales, sin mostrar costos al Vendedor ni al Encargado del taller. |
| RF-REP-002 | El sistema debe generar un Kardex por producto y período para los tres roles. | Debe | El saldo inicial, movimientos y saldo final son reconciliables; solo el Administrador ve valorización. |
| RF-REP-003 | El sistema debe permitir al Administrador reportar ingresos de mercadería por proveedor, período, estado y usuario. | Debe | Los totales consideran operaciones confirmadas y anulaciones válidas. |
| RF-REP-004 | El sistema debe permitir al Administrador y al Vendedor reportar ventas, devoluciones, pagos y saldos del RUC comercial. | Debe | El reporte excluye valores artesanales y permite filtros de fecha y estado. |
| RF-REP-005 | El sistema debe permitir al Administrador y al Encargado del taller reportar mantenimientos, servicios, pagos y saldos del RUC artesanal. | Debe | El reporte excluye valores comerciales y conserva vínculos informativos. |
| RF-REP-006 | El sistema debe mostrar cuentas por cobrar separadas por entidad fiscal: ambas al Administrador, comerciales al Vendedor y artesanales al Encargado del taller. | Debe | Los saldos se agrupan sin cruzar documentos comerciales y artesanales. |
| RF-REP-007 | El sistema debe permitir únicamente al Administrador consultar operaciones anuladas, devoluciones y ajustes con motivo y responsable. | Debe | Cada corrección conduce al registro original y al compensatorio. |
| RF-REP-008 | Los reportes económicos deben identificar claramente la entidad fiscal y no combinar sus totales. | Debe | Cada salida contiene un único ámbito fiscal o secciones separadas sin total conjunto. |
| RF-REP-009 | El sistema debe permitir exportar los reportes tabulares en el formato aprobado para V1. | Debería | El archivo exportado refleja filtros, columnas y totales visibles. |
| RF-REP-010 | El sistema debe mostrar la zona horaria del negocio en documentos y consultas de fechas. | Debe | Las fechas presentadas siguen un criterio uniforme definido por arquitectura. |

## 11. Auditoría y correcciones

| ID | Requisito | Prioridad | Criterio de cumplimiento resumido |
|---|---|---|---|
| RF-AUD-001 | El sistema debe registrar usuario, fecha, acción, objeto afectado y resultado en confirmaciones, anulaciones, devoluciones, ajustes y cambios de configuración. | Debe | Cada acción crítica genera un evento consultable. |
| RF-AUD-002 | Cuando una acción requiera motivo, el sistema debe impedir completarla si está vacío. | Debe | La operación sin motivo es rechazada sin efectos. |
| RF-AUD-003 | Los documentos económicos y movimientos confirmados no deben eliminarse físicamente desde funciones normales. | Debe | Las correcciones usan estados o registros compensatorios. |
| RF-AUD-004 | El sistema debe conservar la relación entre el registro original y cada anulación, devolución o movimiento inverso. | Debe | La navegación de auditoría muestra ambos sentidos de la relación. |
| RF-AUD-005 | El sistema debe registrar cambios de datos maestros sensibles sin sobrescribir la identidad del usuario responsable. | Debería | Puede identificarse quién cambió estado, precio o datos fiscales y cuándo. |
| RF-AUD-006 | El sistema debe impedir la ejecución doble de acciones críticas ante reintentos de red o solicitudes repetidas. | Debe | El mismo intento lógico no crea dos documentos, cobros o movimientos. |

## 12. Dependencias de decisiones pendientes

| Decisión | Requisitos afectados | Regla provisional |
|---|---|---|
| `DP-001` Bodegas | RF-INV-007, RF-INV-008, RF-INV-009, RF-INV-013 | V1 debe soportar al menos una bodega principal. |
| `DP-002` Stock negativo | RF-INV-012, RF-VEN-005, RF-VEN-008 | La confirmación no se implementa hasta aprobar la política; las pruebas asumirán prohibición mientras se valida. |
| `DP-003` Formas de pago | RF-ACC-014, RF-PAG-002, RF-PAG-003 | El catálogo es configurable; la lista inicial queda pendiente. |
| `DP-004` Descuentos | RF-PRO-003, RF-VEN-003, RF-VEN-014 | El Vendedor aplica descuentos dentro del límite pendiente; el Administrador autoriza cualquier exceso. |
| `DP-005` Devoluciones y saldos a favor | RF-VEN-011 a RF-VEN-013, RF-PAG-007, RF-PAG-008 | Se rechaza el sobrepago y se exige corrección trazable. |
| `DP-006` Secuenciales | RF-ACC-012, RF-INV-004, RF-VEN-006, RF-TAL-008 | Deben ser únicos por entidad, tipo y serie; formatos pendientes. |
| `DP-007` Reapertura | RF-TAL-016 | No se habilita la reapertura hasta decidirla. |
| `DP-008` Datos obligatorios | RF-CLI-001, RF-CLI-007 | Los campos exactos se cerrarán antes del diseño de formularios y API. |

## 13. Exclusiones funcionales expresas

No se derivarán requisitos V1 para facturación electrónica ante el SRI, migración desde Flutter, funcionamiento sin conexión, portal de clientes, asignación a mecánicos, agenda, garantías, presupuesto y aprobación previa del mantenimiento, contabilidad general, conciliación bancaria, comercio electrónico, descomposición automática de kits ni múltiples sucursales avanzadas.
