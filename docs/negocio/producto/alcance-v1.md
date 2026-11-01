# Alcance de la versión 1

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Nombre técnico provisional | Sys-Inventario |
| Versión del documento | 0.3 |
| Estado | Alineado con el modelo de dominio aprobado |
| Fecha | 2026-09-08 |

> Este documento define el límite funcional de la primera versión. Una capacidad no mencionada como incluida no debe asumirse como comprometida.

## 1. Objetivo de la versión

Entregar una aplicación web operativa para la red local del taller que cubra los procesos esenciales de repuestos y mantenimientos, comparta clientes, vehículos y usuarios, y mantenga una separación estricta entre las operaciones del RUC comercial y las del RUC artesanal.

La versión 1 prioriza control, trazabilidad y consistencia. Incorpora preparación fiscal local, archivo de evidencia y la emisión de facturas electrónicas autorizadas por el SRI mediante un proveedor de emisión reemplazable, activada por separado en cada RUC (`DP-034`). No resuelve todos los procesos administrativos posibles de un taller.

## 2. Límites del producto

### 2.1 Incluido

- Una sola aplicación web para las dos actividades del negocio.
- Datos maestros compartidos de clientes, vehículos y usuarios.
- Operaciones comerciales de repuestos asociadas al RUC comercial.
- Operaciones de servicios y mantenimientos asociadas al RUC artesanal.
- Relación explícita entre un mantenimiento y la venta de los repuestos utilizados.
- Documentos, pagos, saldos, anulaciones, secuenciales y reportes independientes por entidad fiscal.
- Acceso concurrente desde dispositivos conectados a la red local.
- Configuración fiscal declarada, preparación local, numeración de ensayo, archivo XML externo y solicitudes locales de corrección, independientes de un proveedor.
- Emisión de facturas y notas de crédito electrónicas autorizadas por el SRI y registro de anulaciones, mediante un proveedor de emisión reemplazable; cada RUC se activa por separado (`DP-034`). Hasta que se archiven los cambios 3 y 4 de `docs/cambios-pendientes.md`, el sistema opera solo en pruebas y rechaza producción.

### 2.2 No incluido

- Fusión de las dos actividades en una única operación fiscal.
- Migración automática de datos desde la aplicación Flutter.
- Sustitución de un sistema contable completo.
- Otros comprobantes electrónicos distintos de la factura y la nota de crédito: guía de remisión, nota de débito, liquidación de compra y retención emitida.
- Descuentos, anticipos, sobrepagos, planes de pago y saldos a favor.

## 3. Módulos incluidos

La capacidad fiscal local comprende perfil declarado por emisor, establecimientos y puntos, correspondencias tributarias, preparación/revisión, identidad exclusiva de ensayo, archivo XML y readiness de restauración. Los documentos internos, pagos y operaciones siguen siendo independientes.

### 3.1 Configuración e identidad

- Registro y configuración de las dos entidades fiscales.
- Usuarios activos e inactivos.
- Tres roles fijos: Administrador, Vendedor y Encargado del taller, con permisos definidos por acción.
- Inicio y cierre de sesión.
- Cambio y recuperación administrativa de credenciales.
- Registro de operaciones críticas.
- Configuración con vigencia de impuestos, tarifas y parámetros variables.

### 3.2 Clientes y vehículos

- Registro, edición, búsqueda y consulta de clientes.
- Tipos de identificación y datos de contacto.
- Registro de uno o varios vehículos por cliente y conservación de sus períodos de propiedad.
- Placa, marca, modelo y propietario obligatorios; año, color y VIN opcionales; kilometraje y datos técnicos según las capacidades de taller que los requieran.
- Catálogo administrable de marcas de vehículo, con consulta para los tres roles, alta y edición para Administrador y Encargado del taller, y baja y reactivación solo para el Administrador.
- Consulta del historial de mantenimientos y operaciones relacionadas.
- Uso compartido de clientes y vehículos por las dos entidades fiscales.

### 3.3 Productos y catálogo

- Productos y repuestos con código interno, código del fabricante opcional, nombre, descripción, categoría, marca de producto, presentación, unidad y estado.
- **Presentaciones** completas vendibles; una presentación diferente tiene producto, existencia, costo y precio propios.
- Precios finales para el cliente, con impuesto incluido cuando aplique, e información de costo separada.
- Búsqueda y filtros combinables por marca de producto y marca de vehículo.
- Compatibilidad vehicular como información de apoyo.
- **Kits** comprados registrados y vendidos como productos completos, con desarme manual explícito cuando corresponda.
- Piezas vendidas individualmente registradas como productos independientes.
- Activación o desactivación sin eliminar el historial transaccional.

### 3.4 Proveedores y entradas de stock

- Registro y consulta de proveedores.
- Entradas de stock que registra y confirma el Vendedor o el Administrador en una sola acción, con revisión previa y sin borrador (DP-030).
- Cantidades por producto; proveedor, referencia de texto libre, observación y costo unitario opcionales.
- Sin impuestos, fecha del documento ni totales de compra; el cliente no conserva el documento del proveedor.
- Proveedor ocasional con nombre obligatorio e identificación y contacto opcionales.
- Incremento de existencias al confirmar.
- Actualización del costo promedio ponderado cuando la entrada trae costo; productos sin costo registrado hasta la primera entrada con costo.
- Aviso de posible duplicado cuando hoy ya se registró una entrada igual.
- Anulación controlada, solo del Administrador, mediante movimientos inversos.
- Compras documentadas anteriores conservadas como historia de solo lectura.
- Devolución a proveedor vinculada al ingreso original, sin cuentas por pagar ni seguimiento del reembolso del proveedor.

### 3.5 Inventario y Kardex

- Una sola bodega operativa en V1.
- Existencia actual por producto y bodega habilitada.
- Kardex con entradas, salidas, ajustes y movimientos inversos.
- Consulta por producto, fecha, tipo de movimiento y documento de origen.
- Ajustes autorizados con motivo obligatorio.
- Reservas exclusivas para ventas abiertas vinculadas a mantenimientos; reducen disponibilidad, no existencia.
- Consumos internos, reposiciones por corrección y desarmes como operaciones explícitas de inventario.
- Alertas de stock bajo configurables.
- Validaciones transaccionales para evitar resultados inconsistentes entre usuarios.

La operación multibodega queda fuera de V1, pero el modelo no debe impedir su incorporación futura.

### 3.6 Proformas

- Creación de proformas de repuestos y edición de sus borradores; una proforma emitida no se edita: los cambios originan una nueva vinculada.
- Selección de cliente, productos y cantidades; el precio final y el impuesto provienen del catálogo, sin edición manual ni descuentos.
- Fecha de emisión y vigencia.
- Impresión o exportación de un documento interno.
- Conversión a venta sin duplicar manualmente los datos.
- Anulación o vencimiento.
- Las proformas no reservan ni descuentan stock.

### 3.7 Ventas de repuestos

- Venta directa o generada desde una proforma.
- Venta vinculada a un mantenimiento cuando se utilizan repuestos.
- Borrador, confirmación y anulación controlada.
- Reserva previa únicamente cuando la venta está vinculada a un mantenimiento; la existencia se descuenta al confirmar.
- Secuenciales seguros y separados por entidad y tipo de documento.
- Cálculo de base, impuesto y total, sin descuentos.
- Devolución total o parcial de repuestos con movimiento inverso y trazabilidad.
- Impresión o exportación de comprobantes internos.

### 3.8 Pagos, abonos y crédito

- Condición de venta al contado o a crédito.
- Registro de pagos con formas de pago reales.
- Pagos combinados con efectivo y transferencia dentro de una misma operación.
- Abonos posteriores para ventas a crédito.
- Cálculo del saldo pendiente.
- Estados de pago independientes del estado de la venta.
- Consulta de cuentas por cobrar.
- Pagos de repuestos separados de los pagos por servicios.
- Un pago se aplica a una sola operación; un importe destinado a dos ventas se registra como dos pagos.
- Sin anticipos, sobrepagos, vencimientos, cuotas, intereses ni cronogramas.

### 3.9 Servicios y mantenimientos

- Catálogo de servicios con precio referencial.
- Registro de mantenimiento para un cliente y vehículo.
- Fecha, kilometraje, diagnóstico, observaciones y fotografías.
- Servicios realizados con cantidad y precio aplicado.
- Modificación del precio aplicado sin cambiar el catálogo.
- Estados: registrado, finalizado, reabierto y cancelado.
- Registro de la operación económica de servicios bajo el RUC artesanal.
- Pagos y saldos de servicios independientes de las ventas de repuestos.
- Selección de repuestos utilizados y generación de una venta comercial vinculada.
- Bloqueo de la finalización mientras la venta abierta tenga líneas pendientes.
- Intervenciones correctivas sin cargo dentro del mismo mantenimiento cuando la falla sea atribuible al taller.
- Reposición de repuestos dañados por responsabilidad del taller mediante salida confirmada por el Administrador.
- Consumo interno de materiales por presentaciones completas, sin venta al cliente.
- Consulta del historial por cliente y vehículo.

### 3.10 Reportes y consultas

- Existencias y productos con stock bajo.
- Kardex por producto y período.
- Ingresos de mercadería por proveedor y período.
- Ventas, devoluciones, pagos y saldos del RUC comercial.
- Mantenimientos, servicios, pagos y saldos del RUC artesanal.
- Historial de cliente y vehículo.
- Operaciones anuladas y ajustes de inventario.
- Consumos internos, reposiciones por corrección y margen bruto histórico, sin presentarlo como ganancia neta.
- Cierres diarios separados por RUC, efectivo y transferencia.
- Filtros por entidad fiscal, fecha, estado y usuario cuando corresponda.
- Exportación en un formato tabular común; el formato definitivo se especificará en requisitos de interfaz.

### 3.11 Operación, respaldo y seguridad

- Instalación en una computadora principal dentro de la red local.
- Acceso desde computadoras, tabletas y teléfonos mediante navegador.
- Manejo seguro de contraseñas y sesiones.
- Variables de entorno para secretos y configuración sensible.
- Respaldo y restauración de base de datos y fotografías.
- Registro de errores y de operaciones críticas.
- Procedimiento de actualización del sistema.

### 3.12 Facturación electrónica

- Emisión de facturas y notas de crédito autorizadas por el SRI y registro de anulaciones, por medio de un proveedor de emisión que genera el XML, lo firma, lo envía al SRI y genera el RIDE.
- Tallkit reúne los datos, solicita la emisión, guarda el resultado y conserva su propia copia del XML y del RIDE; no firma ni custodia la firma electrónica.
- Cambiar de proveedor significa agregar un adaptador y cambiar una configuración, sin tocar ventas, taller, cobros ni pantallas.
- Activación separada por entidad fiscal. La artesanal no espera a la comercial, que además necesita su RUC definitivo, su firma vigente y la validación del redondeo del IVA.
- Un fallo de emisión no deshace la venta ni el cobro. Sin Internet, la operación queda registrada y el comprobante espera en Tallkit.
- Prueba real supervisada con pocas facturas reales antes de la facturación diaria, que sigue bloqueada hasta tener política de conservación y restauración probada.
- Matriz de normas que relaciona cada obligación con su fuente oficial y su estado de verificación.

## 4. Actores previstos

| Actor | Responsabilidad general en V1 |
|---|---|
| Administrador | Configura el sistema, administra usuarios y ejecuta operaciones de alto impacto. |
| Vendedor | Gestiona clientes, proformas, ventas, consumos internos y pagos comerciales según permisos. |
| Encargado del taller | Gestiona vehículos, mantenimientos, servicios, reservas de repuestos, correcciones y evidencias. |

Cada usuario tendrá al menos uno de estos tres roles y podrá reunir varios cuando cumpla más de una función. El Administrador asumirá también la consulta global de reportes, la auditoría y las tareas de respaldo, restauración y actualización. V1 no permitirá crear roles adicionales ni asignar permisos personalizados por usuario.

## 5. Flujos esenciales de la versión

### 5.1 Entrada de stock

1. El Vendedor busca o escanea los productos que llegaron y ajusta sus cantidades; proveedor, referencia y costos son opcionales.
2. Revisa un resumen de lo que entra y confirma; no hay borrador ni aprobación del Administrador.
3. Al confirmar, se generan movimientos de entrada y, si hay costo, se recalcula el costo promedio.
4. Una anulación posterior, solo del Administrador, genera movimientos inversos; no borra la entrada.

### 5.2 Venta directa

1. El Vendedor selecciona o registra al cliente.
2. Agrega productos, cantidades y condiciones comerciales.
3. El sistema valida disponibilidad y permisos.
4. Al confirmar, asigna el secuencial y descuenta stock de forma atómica.
5. El Vendedor registra el pago inicial o deja un saldo si la venta es a crédito.

### 5.3 Proforma convertida en venta

1. El Vendedor crea una proforma sin reservar stock.
2. Al convertirla, el sistema copia la información relevante a una nueva venta.
3. Antes de confirmar la venta se recalculan valores y se valida el stock disponible.
4. La proforma conserva la referencia a la venta creada.

### 5.4 Mantenimiento sin repuestos

1. El encargado selecciona cliente y vehículo.
2. Registra kilometraje, diagnóstico, servicios, observaciones y fotografías.
3. El sistema calcula la operación de servicios del RUC artesanal.
4. Se registran pagos o saldo pendiente de servicios.
5. El mantenimiento se finaliza cuando la información está completa.

### 5.5 Mantenimiento con repuestos

1. Se ejecuta el flujo del mantenimiento.
2. El encargado selecciona los repuestos utilizados.
3. El sistema crea o reutiliza una venta abierta del RUC comercial y reserva las cantidades seleccionadas.
4. El encargado ajusta sus líneas hasta reflejar lo realmente utilizado.
5. El Vendedor o Administrador confirma la venta o retira todas sus líneas; la finalización queda bloqueada mientras existan líneas pendientes.
6. El mantenimiento se finaliza por separado y ambos documentos conservan estados y pagos independientes.

### 5.6 Anulación o devolución

1. El Administrador selecciona la operación y registra el motivo.
2. El sistema valida que la corrección sea posible.
3. Se generan movimientos o registros compensatorios.
4. Se conserva el documento original y la relación con la corrección.
5. Los pagos afectados se corrigen mediante registros trazables, nunca eliminándolos sin evidencia.

## 6. Funcionalidades excluidas o futuras

Las siguientes capacidades no forman parte del compromiso de la versión 1:

- Otros comprobantes electrónicos distintos de la factura y la nota de crédito (guía de remisión, nota de débito, liquidación de compra y retención emitida).
- Acceso público a Tallkit desde Internet; la emisión solo usa conexión de salida.
- Migración de registros desde la aplicación Flutter.
- Aplicación móvil nativa o funcionamiento sin conexión.
- Comercio electrónico, catálogo público o ventas en línea.
- Integración automática con bancos, datáfonos o pasarelas de pago.
- Contabilidad general, conciliación bancaria y declaraciones tributarias.
- Presupuesto de mantenimiento y aprobación previa del cliente.
- Gestión completa de garantías, plazos, pólizas o reclamaciones; solo se incluye la corrección simple atribuible al taller.
- Asignación de trabajos, agenda, productividad o comisiones de mecánicos.
- Descomposición automática de kits al vender y armado de kits de inventario con piezas sueltas.
- Compras con órdenes, aprobaciones multinivel o importaciones.
- Gestión avanzada de múltiples sucursales.
- Fidelización, puntos, campañas y marketing.
- Seguimiento por GPS, telemetría o conexión con dispositivos del vehículo.
- Portal de autoservicio para clientes.

Estas funciones requerirán una propuesta y especificación independientes antes de implementarse.

## 7. Restricciones de la versión

- El frontend objetivo se desarrolla con React y TypeScript.
- El backend objetivo utiliza Django REST Framework.
- La persistencia principal utiliza PostgreSQL.
- Las operaciones económicas y de inventario deben ejecutarse de forma transaccional.
- Los archivos fotográficos deben respaldarse junto con la base de datos.
- No se modificará el código basándose solo en este alcance; primero se completarán requisitos, arquitectura y especificaciones OpenSpec.
- Las decisiones fiscales deberán ser confirmadas por el responsable del negocio o su asesor contable.
- La emisión real de cada entidad depende de sus condiciones de activación y de la matriz de normas; registrar `DP-034` no la habilita ni certifica el cumplimiento tributario.

## 8. Supuestos

- El taller dispone de una computadora principal que puede funcionar como servidor local.
- Los dispositivos de los usuarios acceden mediante una red local razonablemente estable.
- Los usuarios recibirán capacitación básica.
- El negocio proporcionará la información oficial de ambos contribuyentes.
- La computadora principal dispone de Internet para emitir; sin ella la operación diaria continúa y el comprobante espera en Tallkit.
- Los impuestos, precios y formas de pago se configurarán antes de iniciar la operación real.
- Los datos iniciales se cargarán manualmente o mediante una plantilla específica; no provendrán de una migración automática de Flutter.

## 9. Criterios de aceptación del alcance

La versión 1 podrá considerarse funcionalmente completa cuando:

1. Todos los módulos incluidos tengan requisitos y criterios de aceptación aprobados.
2. Los flujos esenciales se ejecuten de extremo a extremo con los permisos correspondientes.
3. Ninguna operación combine conceptos fiscales de los dos RUC en un mismo documento.
4. Los movimientos de stock puedan rastrearse hasta su origen.
5. Las pruebas concurrentes no produzcan stock ni secuenciales inconsistentes.
6. Las anulaciones y devoluciones preserven el historial.
7. Los respaldos de datos y fotografías puedan restaurarse en un entorno de prueba.
8. Los reportes distingan claramente la entidad fiscal y el período consultado.
9. Las exclusiones permanezcan fuera de la implementación o estén aisladas como trabajos futuros.
10. La emisión funcione para las dos entidades fiscales con el adaptador simulado y cada entidad activada obtenga una factura real autorizada por el SRI.

## 10. Decisiones pendientes de configuración o validación externa

| ID | Decisión | Impacto |
|---|---|---|
| EXT-001 | Validar tratamiento fiscal y contable de consumos internos y reposiciones sin cargo. | Contabilidad y obligaciones de ambos RUC. |
| EXT-002 | Confirmar tarifas, clasificaciones tributarias y redondeo aplicables. | Configuración de impuestos y documentos. |
| FUT-001 | Especificar las reglas de consumidor final. La facturación electrónica se incorporó a V1 por `DP-034`. | Cambio 6 de `docs/cambios-pendientes.md`. |

## 11. Control de cambios de alcance

Toda adición o exclusión posterior debe:

1. Explicar el problema y el valor esperado.
2. Identificar reglas, requisitos y módulos afectados.
3. Evaluar efectos fiscales, de inventario y seguridad.
4. Crear un cambio OpenSpec separado cuando corresponda.
5. Ser aprobada antes de modificar el código de producción.
# Extensión fiscal local aprobada

El alcance incorpora configuración tributaria declarada, preparación local de facturas, numeración exclusiva de ensayo, archivo de XML externos y solicitudes administrativas de corrección. Todavía no incorpora firma electrónica, transmisión, autorización, entrega de comprobantes ni integración con un proveedor: `DP-034` los incluye en V1 y los incorporarán los cambios 3 a 7 de `docs/cambios-pendientes.md`. Esos resultados permanecen separados de ventas, servicios y cobros.
