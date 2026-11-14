## ADDED Requirements

### Requirement: Menú de nueve entradas sin grupos plegables

La navegación principal SHALL ofrecer nueve entradas, todas visibles a la vez y sin grupos plegables: **Inicio**, **Mantenimientos**, **Ventas**, **Facturas**, **Clientes**, **Productos**, **Servicios**, **Cuentas** y **Ajustes**. Cada entrada SHALL mostrarse únicamente si los permisos efectivos del usuario permiten alguna de las pantallas que contiene; Inicio SHALL mostrarse siempre. Ninguna pantalla ni permiso existente SHALL perderse: lo que ya no tiene entrada propia SHALL alcanzarse desde la entrada que lo contiene. El servidor SHALL seguir decidiendo la autorización de cada acción, y el menú SHALL ser solo una ayuda de interfaz.

Trazabilidad: `DP-036`, reglas 1 y 8; `CT-001`; `RN-SEG-004`; `RF-ACC-008`; `autorizacion-y-navegacion` («Navegación conforme a permisos»); `docs/analisis-del-sistema.md` §8.1; propuesta, decisión 1.

#### Scenario: Usuaria diaria con los tres roles
- **DADO** un usuario con los roles Administrador, Vendedor y Encargado del taller
- **CUANDO** abre cualquier pantalla en escritorio, tableta o teléfono
- **ENTONCES** SHALL ver las nueve entradas a la vez, sin grupos que expandir, con la entrada de la pantalla actual marcada.

#### Scenario: Usuario con un solo rol
- **DADO** un usuario que solo tiene el rol Vendedor, y otro que solo tiene el rol Encargado del taller
- **CUANDO** cada uno abre el menú
- **ENTONCES** SHALL ver solo las entradas que contienen alguna pantalla permitida a sus roles, sin «Ajustes» si ninguna de sus opciones le corresponde, y el servidor SHALL seguir rechazando cualquier acción no concedida.

#### Scenario: Ruta anterior
- **DADO** una dirección de una pantalla que antes tenía entrada propia en el menú (por ejemplo, Vehículos, Proformas, Entradas, Inventario, Proveedores o Cobros de servicios)
- **CUANDO** se abre esa dirección o un enlace guardado
- **ENTONCES** SHALL mostrarse la misma pantalla, o llevar a la pantalla equivalente dentro de la entrada que ahora la contiene, con la entrada correcta marcada.

### Requirement: Contenido de cada entrada del menú

Cada entrada SHALL contener lo siguiente, sin mezclar entidades fiscales dentro de una misma lista, documento o total:

| Entrada | Contiene |
|---|---|
| Inicio | Resumen de trabajo de la página de inicio |
| Mantenimientos | Lista y ficha de mantenimientos |
| Ventas | Ventas de repuestos y proformas |
| Facturas | Lista de facturas (ver «Facturas antes de la emisión real») |
| Clientes | Clientes y vehículos, con la ficha del cliente |
| Productos | Productos con su existencia, los movimientos (Kardex) de cada producto y las entradas de mercadería |
| Servicios | Catálogo de servicios |
| Cuentas | Cuentas por cobrar y retenciones, con una pestaña por negocio |
| Ajustes | Proveedores, marcas, categorías y unidades, usuarios, auditoría, configuración y estado técnico |

Vehículos, proformas, entradas e inventario SHALL NOT tener entrada propia. Las cuentas por cobrar de cada negocio SHALL presentarse en pestañas separadas y SHALL NOT sumarse en una lista ni en un total conjunto. «Ajustes» SHALL agrupar las opciones de uso poco frecuente y los datos que la configuración y la administración necesitan, y el RUC de cada entidad SHALL poder consultarse allí.

Trazabilidad: `DP-036`, reglas 1 y 3; `RF-REP-006` y `UI-062` (se mantienen como pestañas); `RN-FIS-009`; invariantes 1 y 2 del modelo de dominio; `objetivos-de-uso-diario`; propuesta, decisión 2.

#### Scenario: Cuentas de los dos negocios
- **DADO** un usuario que puede cobrar en ambos negocios
- **CUANDO** abre «Cuentas»
- **ENTONCES** SHALL ver una pestaña por negocio, cada una con sus saldos y retenciones, y SHALL NOT ver una lista mezclada ni un total de ambos.

#### Scenario: Usuario con permiso sobre un solo negocio
- **DADO** un usuario con permiso para consultar cuentas de un solo negocio
- **CUANDO** abre «Cuentas»
- **ENTONCES** SHALL ver únicamente la pestaña de ese negocio.

#### Scenario: Pantallas de uso poco frecuente
- **DADO** un Administrador
- **CUANDO** abre «Ajustes»
- **ENTONCES** SHALL llegar a proveedores, marcas, categorías, unidades, usuarios, auditoría, configuración y estado técnico, cada una solo si su permiso lo permite.

### Requirement: Facturas antes de la emisión real

La entrada «Facturas» SHALL mostrar, en solo lectura, las preparaciones locales de factura de los negocios que el usuario pueda consultar, mientras la emisión real no esté habilitada. Cada fila SHALL identificar el negocio, el número de la operación, el cliente, el total, la fecha y el estado local. La lista SHALL poder filtrarse por negocio y por estado local, y SHALL mostrar un estado vacío que explique que todavía no se emiten facturas autorizadas. Ninguna fila ni texto SHALL presentar una preparación local como enviada, autorizada o emitida ante el SRI. Un usuario SHALL ver únicamente las filas de los negocios cuya consulta fiscal le conceden sus permisos, y la lista SHALL NOT incluir un total conjunto.

Trazabilidad: `DP-034`, regla 8; `DP-036`, reglas 3 y 8; `RN-FIS-009`; `RF-FIS-002`; `preparacion-y-seguimiento-fiscal` («Estados locales distintos de autorización y pago»); propuesta, decisión 3.

#### Scenario: Preparaciones de ambos negocios
- **DADO** una preparación borrador del negocio comercial y otra preparada del negocio artesanal, y un usuario que puede consultar ambos
- **CUANDO** abre «Facturas»
- **ENTONCES** SHALL ver las dos con su negocio y su estado local, sin ninguna marca de autorización.

#### Scenario: Usuario con un solo negocio
- **DADO** un usuario que solo puede consultar las preparaciones del negocio artesanal
- **CUANDO** abre «Facturas»
- **ENTONCES** SHALL ver solo las del artesanal, y consultar el negocio comercial por la API directamente SHALL ser rechazado por el servidor.

#### Scenario: Sin preparaciones
- **DADO** que no existe ninguna preparación local
- **CUANDO** se abre «Facturas»
- **ENTONCES** SHALL mostrarse un estado vacío que explique que todavía no hay facturas, sin afirmar que haya una conexión con el SRI.
