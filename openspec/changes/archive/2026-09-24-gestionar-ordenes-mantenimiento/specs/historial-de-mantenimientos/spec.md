# Historial de mantenimientos

## Fuentes y alcance

Fuentes: propuesta aprobada el 2026-09-24, decisión DM-003 V1, spec principal `modelo-dominio-taller` (historial de propiedad), deltas `gestion-de-clientes` y `gestion-de-vehiculos-y-propiedad` del cambio de clientes y vehículos, reglas RN-CLI-009, requisitos RF-CLI-011 y RF-TAL-017, actores y roles §3.5, UI-070 y UI-075. Esta capacidad concreta la consulta operativa de órdenes desde las fichas de clientes y vehículos. No incluye reportes analíticos, exportaciones ni PDF. Estado: specs aprobadas el 2026-09-24 para crear diseño; el usuario respondió «haz commit, registra los cambios en la master y continua» a la solicitud expresa de aprobación de las cuatro specs (29 requisitos y 88 escenarios). Esta aprobación no abarca diseño, tareas ni implementación.

## ADDED Requirements

### Requirement: Historial por vehículo

Un usuario con `mantenimientos.ver` SHALL poder consultar, desde la ficha del vehículo, todas las órdenes de ese vehículo, sin importar qué cliente las solicitó ni quién es su propietario vigente. Cada resultado SHALL mostrar fecha de apertura, número, estado, cliente de la orden, kilometraje, resumen de servicios (nombres y cantidad de líneas) y total de servicios de la orden. SHALL ordenarse de la más reciente a la más antigua, paginarse en el servidor y permitir abrir el detalle de la orden. Trazabilidad: RF-CLI-011; RF-TAL-017; UI-070/075.

#### Scenario: Vehículo con órdenes de dos propietarios
- **DADO** un vehículo con una orden del cliente A, anterior a su transferencia, y otra del cliente B, posterior
- **CUANDO** un Encargado del taller consulta el historial del vehículo
- **ENTONCES** SHALL ver ambas órdenes, cada una con el cliente que correspondía.

#### Scenario: Abrir el detalle desde el historial
- **DADO** el historial de un vehículo
- **CUANDO** el usuario selecciona una orden
- **ENTONCES** la interfaz SHALL abrir su detalle conforme a los patrones de navegación existentes.

### Requirement: Historial por cliente

Un usuario con `mantenimientos.ver` SHALL poder consultar, desde la ficha del cliente, las órdenes en las que ese cliente es el cliente de la orden, incluidas las de vehículos que ya no le pertenecen. SHALL NOT incluir las órdenes de sus vehículos actuales solicitadas por propietarios anteriores. Cada resultado SHALL mostrar fecha de apertura, número, estado, placa conservada, resumen de servicios y total de servicios de la orden, con orden, paginación y acceso al detalle equivalentes al historial por vehículo. Trazabilidad: DM-003 V1; RN-CLI-009; RF-TAL-017.

#### Scenario: Cliente que vendió su vehículo
- **DADO** el cliente A con una orden de un vehículo transferido después al cliente B
- **CUANDO** se consulta el historial del cliente A
- **ENTONCES** SHALL incluir esa orden con la placa conservada, y el historial de B SHALL NOT incluirla.

### Requirement: Conservación del historial ante desactivaciones

El historial y el detalle de las órdenes SHALL permanecer disponibles aunque se desactiven posteriormente su cliente, su vehículo o sus servicios. SHALL mostrarse los datos conservados en la orden y SHALL indicarse el estado inactivo actual cuando corresponda. Las fichas inactivas SHALL seguir mostrando su historial a los usuarios autorizados. La desactivación SHALL NOT habilitar nuevas órdenes ni nuevas líneas con esas entidades. Trazabilidad: specs de catálogo y de clientes y vehículos (inactivación); RF-TAL-017.

#### Scenario: Consulta histórica después de desactivar entidades
- **DADO** una orden finalizada cuyo cliente, vehículo y servicio se desactivaron después
- **CUANDO** un usuario autorizado consulta el historial del cliente o del vehículo y abre la orden
- **ENTONCES** SHALL ver la orden completa con sus servicios, importes y fotografías conservados, e indicaciones de las entidades inactivas.

### Requirement: Autorización del historial

La ficha de un cliente o de un vehículo SHALL mostrar el historial de mantenimientos solo a usuarios con `mantenimientos.ver`. Poder consultar clientes o vehículos SHALL NOT conceder por sí solo acceso a sus órdenes ni a sus fotografías. Las consultas directas al historial sin ese permiso SHALL denegarse sin revelar la cantidad ni los datos de las órdenes. Trazabilidad: actores-y-roles §3.5; RF-TAL-017.

#### Scenario: Vendedor consulta la ficha de un cliente
- **DADO** un usuario con solo el rol Vendedor
- **CUANDO** abre la ficha de un cliente con órdenes de mantenimiento
- **ENTONCES** SHALL ver la ficha del cliente, pero no la sección de historial de mantenimientos, y una consulta directa al historial SHALL denegarse.

#### Scenario: Historial vacío
- **DADO** un vehículo sin órdenes y un usuario autorizado
- **CUANDO** consulta su historial
- **ENTONCES** la interfaz SHALL mostrar un estado vacío explicativo.
