## MODIFIED Requirements

### Requirement: Consulta y búsqueda de clientes
El sistema SHALL permitir consultar fichas y buscar por coincidencias parciales de nombre o razón social, identificación y teléfono, con filtros de estado, paginación, conteo y limpieza de filtros. La ficha SHALL mostrar los vehículos de propiedad actual y permitir abrirlos según permisos; volver a la lista SHALL conservar el contexto de búsqueda. La ficha SHALL mostrar además las **compras** del cliente (ventas de repuestos y mantenimientos) y su **deuda**, siempre separadas por negocio: cada negocio SHALL aparecer con su nombre, sus operaciones y su saldo pendiente, y la ficha SHALL NOT sumar ambos saldos ni presentar un total conjunto. Cada negocio SHALL mostrarse únicamente a quien tenga permiso para consultar sus operaciones; el servidor SHALL omitir los datos del negocio no permitido. El saldo SHALL ser el saldo pendiente vigente de las operaciones del cliente, derivado de sus pagos y retenciones, y SHALL NOT crear vencimientos, mora ni intereses. La ficha SHALL NOT mostrar la versión de registro. Trazabilidad: `RF-CLI-002/006`, `CU-004`, `UI-020/021`, `RNF-REN-005`, `RNF-USA-011`; `DP-036`, reglas 1 y 3; `RN-FIS-009`; `RN-VEN-008…016`; invariantes 1, 2 y 16 del modelo de dominio.

#### Scenario: Búsqueda por cada dato disponible
- **GIVEN** varios clientes registrados
- **WHEN** un usuario autorizado busca un fragmento de nombre, identificación o teléfono y filtra por estado
- **THEN** el sistema SHALL devolver únicamente las coincidencias del criterio y estado seleccionados, con paginación y conteo

#### Scenario: Consulta de vehículos desde cliente
- **GIVEN** un cliente propietario actual de dos vehículos y antiguo propietario de otro
- **WHEN** se consulta su ficha
- **THEN** SHALL mostrarse los dos vehículos actuales, incluidos sus estados, sin presentar el antiguo como propiedad vigente

#### Scenario: Ficha sin vehículos
- **GIVEN** un cliente sin vehículos
- **WHEN** se consulta su ficha
- **THEN** SHALL mostrarse un estado vacío comprensible y la acción de registrar vehículo únicamente si el usuario tiene permiso

#### Scenario: Compras y deuda de dos negocios
- **GIVEN** un cliente con una venta de repuestos a crédito con saldo 30.00 y un mantenimiento con saldo 50.00
- **WHEN** un usuario autorizado en ambos negocios consulta su ficha
- **THEN** SHALL ver la deuda de 30.00 bajo el negocio comercial y la de 50.00 bajo el artesanal, sin un total de 80.00, y cada compra con su negocio.

#### Scenario: Usuario con permiso sobre un solo negocio
- **GIVEN** el mismo cliente y un usuario que solo puede consultar el negocio comercial
- **WHEN** consulta la ficha, por la interfaz o llamando directamente a la API
- **THEN** SHALL recibir únicamente las compras y la deuda del negocio comercial, sin el mantenimiento ni su saldo.
