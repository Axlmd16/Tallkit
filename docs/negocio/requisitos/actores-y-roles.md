# Actores, roles y permisos

| Campo | Valor |
|---|---|
| Producto | Sistema de gestión integral para taller automotriz |
| Nombre técnico provisional | Sys-Inventario |
| Versión del documento | 0.3 |
| Estado | Alineado con el modelo de dominio aprobado |
| Fecha | 2026-09-08 |

> La versión 1 tendrá únicamente tres tipos de **rol** interno: **Administrador**, **Vendedor** y **Encargado del taller**. No se crearán roles adicionales ni se asignarán permisos personalizados por usuario en esta versión.

## 1. Principios de acceso

1. Toda función interna requiere un usuario autenticado y activo.
2. Cada usuario debe tener al menos uno de los tres roles definidos para V1 y puede reunir más de uno cuando cumpla varias funciones.
3. Los permisos efectivos son la unión de los roles asignados; los permisos de cada rol son fijos para V1 y se aplican por acción concreta.
4. El backend debe verificar cada permiso, aunque la interfaz oculte la acción.
5. Las acciones que afectan dinero, inventario, secuenciales, configuración o historial requieren autorización explícita del rol.
6. Desactivar un usuario no elimina las operaciones que realizó.
7. Una acción no concedida al rol se considera denegada.
8. Los datos económicos y reportes deben respetar la entidad fiscal y el ámbito permitido para cada rol.

## 2. Actores internos

### ACT-001 — Administrador

Responsable del control general del sistema. Administra usuarios, asigna uno o más de los tres roles disponibles, configura las entidades fiscales y los parámetros, gestiona catálogos, proveedores, ingresos e inventario, supervisa ventas y mantenimientos, ejecuta correcciones de alto impacto, consulta todos los reportes y realiza las tareas de respaldo, restauración y actualización.

### ACT-002 — Vendedor

Responsable del proceso comercial del RUC comercial. Gestiona clientes, consulta productos, existencias y disponibilidad, elabora proformas, registra y confirma ventas de repuestos, entrega consumos internos solicitados, registra pagos comerciales y consulta los reportes necesarios para sus actividades. V1 no admite descuentos.

### ACT-003 — Encargado del taller

Responsable de la operación del RUC artesanal. Gestiona clientes, vehículos, catálogo de servicios, mantenimientos, intervenciones, fotografías, servicios realizados y pagos artesanales. Selecciona y reserva los repuestos utilizados, solicita consumos internos y puede reabrir mantenimientos; la confirmación y el cobro de la venta comercial corresponden al Vendedor o al Administrador.

El cliente es una parte interesada y un dato del negocio, pero no es un usuario ni un actor autenticado en V1. Las tareas técnicas de soporte son responsabilidad operativa del Administrador y no constituyen un rol adicional del sistema.

## 3. Catálogo de permisos

### 3.1 Identidad, configuración y auditoría

| Permiso | Acción protegida | Roles con permiso |
|---|---|---|
| `usuarios.ver` | Consultar usuarios y su estado. | Administrador |
| `usuarios.crear` | Crear cuentas de usuario. | Administrador |
| `usuarios.editar` | Editar datos de usuarios. | Administrador |
| `usuarios.desactivar` | Activar o desactivar usuarios. | Administrador |
| `usuarios.restablecer_clave` | Iniciar la recuperación administrativa de credenciales. | Administrador |
| `roles.ver` | Consultar los tres roles y sus permisos fijos. | Administrador |
| `roles.asignar` | Asignar a un usuario uno o más de los tres roles de V1. | Administrador |
| `entidades_fiscales.ver` | Consultar datos de las entidades fiscales. | Administrador |
| `entidades_fiscales.editar` | Modificar datos y parámetros de una entidad fiscal. | Administrador |
| `parametros.gestionar` | Configurar impuestos, tarifas, series, umbrales y formas de pago. | Administrador |
| `auditoria.ver` | Consultar operaciones críticas y actividad de usuarios. | Administrador |

### 3.2 Datos maestros

| Permiso | Acción protegida | Roles con permiso |
|---|---|---|
| `clientes.ver` | Consultar clientes e historial permitido. | Administrador, Vendedor, Encargado del taller |
| `clientes.gestionar` | Crear y editar clientes. | Administrador, Vendedor, Encargado del taller |
| `clientes.desactivar` | Desactivar clientes sin eliminar historial. | Administrador |
| `vehiculos.ver` | Consultar vehículos e historial. | Administrador, Vendedor, Encargado del taller |
| `vehiculos.gestionar` | Crear, editar y cambiar el propietario vigente conservando sus períodos históricos. | Administrador, Encargado del taller |
| `vehiculos.desactivar` | Desactivar vehículos sin eliminar historial. | Administrador |
| `productos.ver` | Consultar catálogo, precios y existencias. | Administrador, Vendedor, Encargado del taller |
| `productos.ver_costos` | Consultar costos y costo promedio. | Administrador |
| `productos.gestionar` | Gestionar productos, presentaciones, unidades, categorías, marcas de producto y compatibilidades con marcas de vehículo. | Administrador |
| `productos.cambiar_precio` | Modificar precios de venta del catálogo. | Administrador |
| `productos.desactivar` | Activar o desactivar productos. | Administrador |
| `servicios.ver` | Consultar el catálogo de servicios. | Administrador, Vendedor, Encargado del taller |
| `servicios.gestionar` | Gestionar servicios y su precio referencial. | Administrador, Encargado del taller |
| `proveedores.ver` | Consultar proveedores. | Administrador |
| `proveedores.gestionar` | Gestionar proveedores. | Administrador |

### 3.3 Inventario e ingresos

| Permiso | Acción protegida | Roles con permiso |
|---|---|---|
| `ingresos.ver` | Consultar ingresos de mercadería. | Administrador |
| `ingresos.crear` | Crear y editar ingresos en borrador. | Administrador |
| `ingresos.confirmar` | Confirmar un ingreso y afectar existencias y costo promedio. | Administrador |
| `ingresos.anular` | Anular un ingreso mediante movimientos inversos. | Administrador |
| `inventario.ver` | Consultar existencias y Kardex sin costos restringidos. | Administrador, Vendedor, Encargado del taller |
| `inventario.ver_valorizacion` | Consultar costos y valorización de inventario. | Administrador |
| `inventario.ajustar` | Registrar y confirmar ajustes con motivo. | Administrador |
| `inventario.configurar_alertas` | Modificar umbrales de stock bajo. | Administrador |
| `inventario.desarmar_kit` | Confirmar el consumo de un kit y el ingreso de sus componentes reales con costo distribuido. | Administrador |
| `inventario.devolver_proveedor` | Registrar una salida vinculada al ingreso original. | Administrador |
| `inventario.consumo_interno` | Entregar y registrar presentaciones completas solicitadas para uso del taller. | Administrador, Vendedor |
| `inventario.reposicion_correccion` | Confirmar una salida sin cargo por responsabilidad del taller. | Administrador |

### 3.4 Proformas, ventas y pagos comerciales

| Permiso | Acción protegida | Roles con permiso |
|---|---|---|
| `proformas.ver` | Consultar proformas. | Administrador, Vendedor |
| `proformas.gestionar` | Crear y editar proformas. | Administrador, Vendedor |
| `proformas.anular` | Anular una proforma. | Administrador, Vendedor |
| `proformas.convertir` | Crear una venta desde una proforma válida. | Administrador, Vendedor |
| `ventas.ver` | Consultar ventas del RUC comercial. | Administrador, Vendedor; Encargado del taller solo para la venta vinculada a su mantenimiento |
| `ventas.crear` | Crear y editar ventas en borrador. | Administrador, Vendedor |
| `ventas.preparar_vinculada` | Preparar desde un mantenimiento una venta comercial vinculada. | Administrador, Encargado del taller |
| `ventas.confirmar` | Confirmar ventas, asignar secuencial y descontar existencias. | Administrador, Vendedor |
| `ventas.anular` | Anular una venta confirmada. | Administrador |
| `ventas.devolver` | Registrar devoluciones totales o parciales. | Administrador |
| `pagos_comerciales.ver` | Consultar pagos y saldos del RUC comercial. | Administrador, Vendedor |
| `pagos_comerciales.registrar` | Registrar pagos o abonos comerciales. | Administrador, Vendedor |
| `pagos_comerciales.anular` | Anular o corregir pagos comerciales de forma trazable. | Administrador |

### 3.5 Taller y pagos artesanales

| Permiso | Acción protegida | Roles con permiso |
|---|---|---|
| `mantenimientos.ver` | Consultar mantenimientos e historial. | Administrador, Encargado del taller; Vendedor solo cuando exista una venta vinculada |
| `mantenimientos.gestionar` | Crear y editar mantenimientos registrados. | Administrador, Encargado del taller |
| `mantenimientos.cambiar_precio_servicio` | Cambiar el precio aplicado de un servicio. | Administrador, Encargado del taller |
| `mantenimientos.gestionar_fotos` | Adjuntar o retirar fotografías antes del cierre. | Administrador, Encargado del taller |
| `mantenimientos.gestionar_repuestos` | Seleccionar repuestos y preparar la venta vinculada. | Administrador, Encargado del taller |
| `mantenimientos.finalizar` | Finalizar un mantenimiento. | Administrador, Encargado del taller |
| `mantenimientos.cancelar` | Cancelar un mantenimiento con motivo. | Administrador, Encargado del taller |
| `mantenimientos.reabrir` | Reabrir explícitamente un mantenimiento y agregar una intervención correctiva. | Administrador, Encargado del taller |
| `servicios_economicos.ver` | Consultar la operación económica del RUC artesanal. | Administrador, Encargado del taller |
| `servicios_economicos.confirmar` | Confirmar valores de servicios y asignar su secuencial. | Administrador, Encargado del taller |
| `servicios_economicos.anular` | Anular la operación económica de servicios. | Administrador |
| `pagos_artesanales.ver` | Consultar pagos y saldos del RUC artesanal. | Administrador, Encargado del taller |
| `pagos_artesanales.registrar` | Registrar pagos o abonos de servicios. | Administrador, Encargado del taller |
| `pagos_artesanales.anular` | Anular o corregir pagos de servicios. | Administrador |

### 3.6 Reportes y operación técnica

| Permiso | Acción protegida | Roles con permiso |
|---|---|---|
| `reportes.comerciales` | Consultar y exportar reportes del RUC comercial. | Administrador, Vendedor |
| `reportes.artesanales` | Consultar y exportar reportes del RUC artesanal. | Administrador, Encargado del taller |
| `reportes.inventario` | Consultar y exportar reportes de inventario. | Administrador, Vendedor, Encargado del taller |
| `reportes.auditoria` | Consultar reportes de anulaciones, ajustes y actividad crítica. | Administrador |
| `cierres.gestionar` | Confirmar cierres diarios separados por entidad fiscal y registrar diferencias explicadas. | Administrador |
| `operacion.ver_estado` | Consultar salud básica, versión y estado de respaldos. | Administrador |
| `operacion.respaldar` | Crear y verificar respaldos. | Administrador |
| `operacion.restaurar` | Restaurar un respaldo mediante el procedimiento autorizado. | Administrador |
| `operacion.actualizar` | Ejecutar el procedimiento técnico de actualización. | Administrador |

## 4. Resumen de permisos por rol

Leyenda: `✓` gestión o ejecución; `C` consulta; `V` acceso limitado al vínculo necesario; `—` sin acceso.

| Grupo de acciones | Administrador | Vendedor | Encargado del taller |
|---|:---:|:---:|:---:|
| Usuarios, roles y configuración | ✓ | — | — |
| Auditoría | ✓ | — | — |
| Clientes | ✓ | ✓ | ✓ |
| Vehículos | ✓ | C | ✓ |
| Productos, costos y precios | ✓ | C sin costos | C sin costos |
| Servicios | ✓ | C | ✓ |
| Proveedores e ingresos | ✓ | — | — |
| Inventario y Kardex | ✓ | C sin valorización | C sin valorización |
| Ajustes de inventario | ✓ | — | — |
| Desarme, devolución a proveedor y reposición correctiva | ✓ | — | — |
| Consumo interno | ✓ | ✓ | Solicita |
| Proformas | ✓ | ✓ | — |
| Ventas comerciales | ✓ | ✓ | V |
| Anulaciones y devoluciones comerciales | ✓ | — | — |
| Pagos comerciales | ✓ | ✓ | — |
| Mantenimientos y fotografías | ✓ | V | ✓ |
| Operaciones y pagos artesanales | ✓ | — | ✓ |
| Reportes comerciales | ✓ | C | — |
| Reportes artesanales | ✓ | — | C |
| Reportes de inventario | ✓ | C | C |
| Cierres diarios | ✓ | — | — |
| Respaldo, restauración y actualización | ✓ | — | — |

## 5. Separación de funciones críticas

- El Administrador concentra las tareas de configuración, control, auditoría, corrección y operación técnica que antes se distribuían entre roles adicionales.
- El Vendedor confirma y cobra las ventas comerciales, incluidas las originadas por repuestos usados en un mantenimiento.
- El Encargado del taller prepara los repuestos utilizados, pero no confirma ni cobra la venta comercial vinculada.
- La selección de repuestos del mantenimiento crea reservas; el Vendedor o Administrador confirma la venta o retira sus líneas antes de finalizar el mantenimiento.
- El Encargado solicita materiales para consumo interno y el Vendedor o Administrador registra su entrega.
- El Encargado puede reabrir el mantenimiento; solo el Administrador confirma una reposición de inventario sin cargo.
- El Encargado del taller confirma y cobra la operación artesanal de servicios; el Vendedor no gestiona esos cobros.
- Solo el Administrador anula ingresos, ventas, pagos u operaciones de servicios y registra devoluciones.
- Aunque el Administrador tenga acceso total, las acciones críticas continúan separadas y auditadas.

## 6. Reglas de denegación

El sistema debe denegar una acción cuando:

- El usuario no está autenticado, está inactivo o su sesión dejó de ser válida.
- Su rol no posee el permiso requerido.
- Intenta operar sobre una entidad fiscal o documento fuera de su ámbito.
- El estado del documento no permite la transición solicitada.
- Falta un motivo obligatorio o una validación requerida.
- La acción depende de una configuración o validación externa todavía no habilitada.

La denegación debe mostrar un mensaje comprensible sin revelar datos sensibles y registrarse cuando corresponda a una acción crítica o sospechosa.

## 7. Asuntos pendientes con efecto sobre permisos

| Decisión | Efecto sobre permisos |
|---|---|
| Tratamiento fiscal de reposiciones sin cargo | Puede exigir controles adicionales después de validación contable; en V1 la confirmación queda reservada al Administrador. |
| Facturación electrónica futura | Sus autorizaciones y correcciones requerirán permisos propios en un cambio posterior. |

## 8. Trazabilidad principal

- Reglas: `RN-SEG-001` a `RN-SEG-007`, `RN-FIS-005`, `RN-FIS-009`, `RN-INV-010`, `RN-INV-017` a `RN-INV-023`, `RN-VEN-004`, `RN-VEN-017`, `RN-TAL-003`, `RN-TAL-017` a `RN-TAL-020` y `RN-CON-007`.
- Requisitos relacionados: `RF-ACC-*` y los requisitos de autorización de cada módulo.
- Casos de uso relacionados: `CU-001`, `CU-002`, `CU-003`, `CU-009`, `CU-012`, `CU-014`, `CU-015`, `CU-017`, `CU-019`, `CU-020` y `CU-021`.
