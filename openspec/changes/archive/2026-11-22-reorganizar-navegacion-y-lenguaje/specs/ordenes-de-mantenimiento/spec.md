## MODIFIED Requirements

### Requirement: Listado, búsqueda y filtros de órdenes

Un usuario con `mantenimientos.ver` SHALL poder listar órdenes con paginación en el servidor, un total de resultados y un orden estable: la fecha de apertura más reciente primero y luego el número descendente. SHALL poder buscar por coincidencia parcial del número, del nombre o la identificación del cliente, y de la placa, sin distinguir mayúsculas ni espacios exteriores. SHALL poder filtrar por estado y por un rango de fechas de apertura. Cada resultado SHALL mostrar número, fecha de apertura, cliente, placa, kilometraje, estado y total de servicios de la orden. SHALL NOT mostrar saldos ni importes por cobrar. La lista SHALL ofrecer segmentos por estado (todas, abiertas y finalizadas) y cada segmento SHALL mostrar el número de órdenes que contiene, calculado por el servidor con la misma búsqueda y el mismo rango de fechas, de modo que el número coincida con el total de la lista al elegirlo. Filtros o parámetros inválidos SHALL rechazarse con un error comprensible. Trazabilidad: RF-TAL-017; UI-070; `DP-036`, regla 1; `docs/cambios-pendientes.md`, U4.

#### Scenario: Buscar por placa y filtrar por estado
- **DADO** órdenes registradas y finalizadas de varios vehículos
- **CUANDO** se busca «abc» con el estado «finalizado»
- **ENTONCES** el sistema SHALL devolver solo las órdenes finalizadas cuya placa, cliente o número coincidan, paginadas y con su total.

#### Scenario: Rango de fechas inválido
- **DADO** un filtro cuya fecha inicial es posterior a la final
- **CUANDO** se consulta el listado
- **ENTONCES** el sistema SHALL rechazar el filtro con un error comprensible.

#### Scenario: Lista vacía
- **DADO** que ninguna orden coincide con la búsqueda
- **CUANDO** se consulta el listado
- **ENTONCES** la interfaz SHALL mostrar un estado vacío explicativo sin errores.

#### Scenario: Contador de cada segmento
- **DADO** cuatro órdenes abiertas (registradas o reabiertas) y cinco finalizadas
- **CUANDO** se abre la lista
- **ENTONCES** los segmentos SHALL mostrar 9, 4 y 5, y al elegir «abiertas» el total de la lista SHALL ser 4.

#### Scenario: Contador con búsqueda
- **DADO** la búsqueda de una placa con una orden abierta y una finalizada
- **CUANDO** se aplica
- **ENTONCES** los segmentos SHALL reflejar solo esa búsqueda y no las órdenes de otros vehículos.
