# Especificación: Búsqueda global

## Purpose

Define la búsqueda global de solo lectura desde cualquier pantalla sobre vehículos, clientes, facturas locales y productos, con autorización decidida en el servidor por rol y entidad fiscal, sin mezclar totales entre negocios ni exponer costos ni estados de autorización inexistentes.

## Requirements

### Requirement: Consulta global de solo lectura en cuatro grupos

El sistema SHALL ofrecer una búsqueda global de solo lectura que consulte en el servidor coincidencias agrupadas en hasta cuatro categorías: **Vehículos** (por placa, marca, modelo o nombre del propietario), **Clientes** (por nombre o razón social y número de identificación), **Facturas** (por número de operación origen, número fiscal de ensayo si existe o nombre del cliente) y **Productos** (por nombre, código interno o código del fabricante). La coincidencia SHALL ser insensible a mayúsculas, minúsculas y tildes, y en placas SHALL tolerar la ausencia de guion o espacios. Cada grupo SHALL devolver hasta cinco resultados junto con el conteo total de coincidencias del grupo. Consultar la búsqueda global SHALL NOT crear, editar, reservar ni numerar registros.

Trazabilidad: `DP-036`, regla 5; `DP-008`; `interfaz-y-navegacion.md` §2.1; `docs/prototipo/Buscar.dc.html`; propuesta, decisiones 1 y 5.

#### Scenario: Coincidencias agrupadas con tolerancia de formato
- **DADO** que existen el vehículo con placa `GBA-1234` de «Carlos Mendoza», el cliente «Carlos Mendoza», una preparación de factura para «Carlos Mendoza» y un producto cuyo nombre lleva tilde («Bujía estándar»)
- **CUANDO** un usuario autorizado busca «gba1234», «mendoza» o «bujia»
- **ENTONCES** el sistema SHALL devolver los resultados agrupados por categoría con su conteo, encontrando la placa sin guion y el producto sin tilde.

#### Scenario: Límite de resultados por grupo
- **DADO** que existen ocho productos que coinciden con «filtro»
- **CUANDO** un usuario autorizado busca «filtro»
- **ENTONCES** el grupo **Productos** SHALL entregar como máximo cinco resultados junto con el conteo total `8` para indicar que puede afinar la búsqueda.

#### Scenario: Consulta estrictamente de solo lectura
- **DADO** cualquier estado del sistema
- **CUANDO** un usuario ejecuta múltiples búsquedas globales
- **ENTONCES** SHALL NOT modificarse ninguna operación, existencia, reserva, saldo ni secuencia.

### Requirement: Autorización en el servidor por rol y entidad fiscal

La búsqueda global SHALL exigir una sesión vigente de un usuario activo. El servidor SHALL decidir en cada consulta qué grupos, registros y campos devuelve según los **permisos efectivos** del usuario (unión de sus roles fijos). Un grupo o entidad fiscal no autorizados SHALL NOT entregarse con datos ni filtrarse mediante consultas directas. En **Productos**, el precio final de venta SHALL entregarse a quien pueda consultar productos, la existencia («Quedan n») SHALL entregarse únicamente si el usuario tiene permiso de consulta de inventario (`inventario.ver`), y el costo, costo promedio, valoración o margen SHALL NOT entregarse a ningún rol. En **Vehículos**, el indicador de mantenimiento abierto SHALL entregarse únicamente si el usuario puede consultar mantenimientos (`mantenimientos.ver`).

Trazabilidad: `DP-036`, reglas 1 y 5; `CT-001`; `DP-030`; `RN-SEG-001`, `RN-SEG-003`, `RN-SEG-004`, `RN-FIS-009`; `RF-ACC-001`, `RF-ACC-008`; `RNF-SEG-002`, `RNF-SEG-003`; `actores-y-roles.md` §3 y §4; `autorizacion-y-navegacion`.

#### Scenario: Acceso sin sesión o con sesión invalidada
- **DADO** una persona sin sesión vigente o una sesión invalidada por desactivación o reducción de roles
- **CUANDO** solicita la búsqueda global
- **ENTONCES** el servidor SHALL rechazar la consulta sin revelar registros y la interfaz SHALL solicitar un nuevo inicio de sesión.

#### Scenario: Usuario con solo rol Vendedor
- **DADO** un usuario que solo tiene el rol Vendedor, un vehículo con un mantenimiento abierto, una preparación de factura comercial y una preparación de factura artesanal del mismo cliente
- **CUANDO** busca el nombre de ese cliente
- **ENTONCES** el servidor SHALL devolver el cliente, el vehículo sin estado de mantenimiento abierto no autorizado y únicamente la preparación de factura del negocio comercial, y SHALL NOT entregar la preparación artesanal.

#### Scenario: Usuario con solo rol Encargado del taller
- **DADO** un usuario que solo tiene el rol Encargado del taller, una preparación de factura comercial y una preparación de factura artesanal del mismo cliente
- **CUANDO** busca el nombre de ese cliente
- **ENTONCES** el servidor SHALL devolver el cliente, sus vehículos con estado de mantenimiento abierto si corresponde y únicamente la preparación de factura del negocio artesanal, y SHALL NOT entregar la preparación comercial.

#### Scenario: Roles acumulados sin mezclar entidades
- **DADO** un usuario con roles Vendedor y Encargado del taller (o con los tres roles de la usuaria diaria)
- **CUANDO** busca un cliente que tiene preparaciones en ambos negocios
- **ENTONCES** el servidor SHALL devolver las preparaciones de ambos negocios, cada una identificada con su negocio, y SHALL NOT incluir un total conjunto.

#### Scenario: Existencia condicionada y exclusión de costos en productos
- **DADO** un producto activo con existencia y costo promedio registrado, y tres usuarios: Administrador, Vendedor y un usuario sin permiso de consulta de inventario
- **CUANDO** cada uno busca ese producto
- **ENTONCES** ninguno SHALL recibir costo, costo promedio ni valoración; el Administrador y el Vendedor SHALL recibir la existencia; y el usuario sin permiso de inventario SHALL NOT recibir la existencia.

### Requirement: Facturas en búsqueda antes de la emisión real

Mientras la emisión electrónica real no esté habilitada, el grupo **Facturas** SHALL consultar únicamente las preparaciones locales de factura de los negocios que el usuario pueda consultar. Cada resultado SHALL identificar el negocio por su nombre comercial (o razón social si no tiene nombre comercial), el número de documento, el cliente, la fecha, el estado local («Borrador», «Preparada, sin enviar» o «Cancelada») y el total de esa preparación. Ningún resultado SHALL presentarse como enviado, solicitado o autorizado ante el SRI, ni SHALL mostrar un total conjunto entre negocios.

Trazabilidad: `DP-034`, regla 8; `DP-036`, reglas 3, 5 y 8; `RN-FIS-009`; `RF-FIS-002`; `navegacion-de-uso-diario` («Facturas antes de la emisión real»); propuesta, decisión 2.

#### Scenario: Preparaciones locales sin marcas de autorización
- **DADO** una preparación local en estado borrador del negocio comercial y otra en estado preparada del negocio artesanal
- **CUANDO** un usuario autorizado para ambos negocios las localiza en la búsqueda global
- **ENTONCES** cada resultado SHALL mostrar el nombre comercial de su negocio y su estado local, y SHALL NOT mostrar «Solicitada», «Autorizada» ni una suma de ambos importes.

### Requirement: Navegación directa desde cada resultado

Al seleccionar un resultado en la búsqueda global, la interfaz SHALL cerrar el diálogo y conducir directamente a la pantalla correspondiente: para un **Cliente**, su ficha; para un **Producto**, su ficha; para una **Factura**, la consulta de facturas enfocada en esa preparación; y para un **Vehículo**, su mantenimiento abierto (`registrado` o `reabierto`) cuando exista y el usuario pueda consultar mantenimientos, o en caso contrario la ficha del vehículo o de su propietario.

Trazabilidad: `DP-036`, regla 5; `docs/prototipo/Buscar.dc.html`; propuesta, decisión 3.

#### Scenario: Vehículo con mantenimiento abierto y sin mantenimiento abierto
- **DADO** un vehículo A con un mantenimiento en estado `registrado` y un vehículo B sin mantenimientos abiertos
- **CUANDO** un Encargado del taller selecciona el vehículo A en la búsqueda global
- **ENTONCES** SHALL llegar a la ficha del mantenimiento abierto del vehículo A; y cuando selecciona el vehículo B (o cuando un Vendedor sin acceso a mantenimientos selecciona el vehículo A), SHALL llegar a la ficha del vehículo o de su cliente propietario.

#### Scenario: Selección de cliente, producto o factura
- **DADO** resultados visibles de cliente, producto y factura local
- **CUANDO** el usuario selecciona cualquiera de ellos
- **ENTONCES** el diálogo SHALL cerrarse y SHALL abrirse la pantalla correspondiente a ese registro.

### Requirement: Estados de consulta, recientes de sesión y accesibilidad

El diálogo de búsqueda global SHALL distinguir con claridad estado inicial, carga, resultados, ausencia de coincidencias (con sugerencia para afinar la búsqueda) y error recuperable con opción de reintento, sin mostrar datos inventados ni resultados vencidos de otra consulta. Si ofrece «Buscados hace poco», SHALL conservar esos accesos únicamente durante la sesión activa del usuario actual en ese navegador y SHALL limpiarlos al cerrar o invalidar la sesión para no exponer información a otro usuario en un equipo compartido. El diálogo SHALL operarse por completo con teclado (escribir, recorrer resultados, elegir y cerrar con `Escape`), mantener foco visible, ofrecer objetivos táctiles de al menos 44 px y adaptarse desde 360 px de ancho sin desplazamiento horizontal.

Trazabilidad: `RNF-USA-004`, `RNF-USA-006`, `RNF-USA-007`, `RNF-USA-008`, `RNF-USA-011`; `PPF-07`; `sistema-visual-frontend`; `experiencia-adaptable-frontend`; propuesta, decisión 4.

#### Scenario: Sin resultados y error recuperable
- **DADO** el diálogo de búsqueda abierto
- **CUANDO** el usuario busca un texto sin coincidencias, y en otro intento la consulta al servidor falla por un error recuperable
- **ENTONCES** en el primer caso SHALL ver un mensaje claro de ausencia de coincidencias con sugerencia de búsqueda, y en el segundo SHALL ver un error comprensible con acción «Reintentar» sin mostrar resultados falsos.

#### Scenario: Limpieza de recientes al cerrar sesión en equipo compartido
- **DADO** un usuario que abrió un vehículo y un cliente desde la búsqueda global y los ve en «Buscados hace poco»
- **CUANDO** cierra sesión (o su sesión se invalida) e inicia sesión otro usuario en el mismo navegador
- **ENTONCES** el segundo usuario SHALL NOT ver los elementos recientes del primer usuario.

#### Scenario: Operación con teclado y pantalla estrecha
- **DADO** el diálogo de búsqueda abierto en escritorio con teclado o en un teléfono de 360 px de ancho
- **CUANDO** el usuario recorre los resultados con teclado o los selecciona en pantalla táctil, o pulsa `Escape`
- **ENTONCES** cada elemento SHALL mantener foco visible y área táctil mínima de 44 px sin desplazamiento horizontal, `Enter` SHALL abrir el resultado seleccionado y `Escape` SHALL cerrar el diálogo devolviendo el foco al disparador.
