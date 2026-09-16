## ADDED Requirements

### Requirement: Registro y edición de servicios artesanales
El sistema DEBE permitir crear y editar servicios destinados al RUC artesanal, especificando nombre y precio referencial. El cambio de precio referencial no altera servicios ya aplicados a mantenimientos previos.

#### Scenario: Creación de servicio
- **WHEN** el administrador registra un servicio con nombre único y precio referencial
- **THEN** el servicio se guarda y queda disponible para su uso en mantenimientos

#### Scenario: Edición de precio referencial
- **WHEN** el administrador modifica el precio referencial de un servicio
- **THEN** el catálogo actualiza el precio para futuros mantenimientos
- **AND** los mantenimientos históricos conservan el precio con el que fueron confirmados

### Requirement: Activación y desactivación de servicios
El sistema DEBE permitir activar y desactivar servicios sin eliminarlos físicamente de la base de datos.

#### Scenario: Desactivación de un servicio
- **WHEN** el administrador desactiva un servicio
- **THEN** el servicio ya no aparece en el listado para agregar a nuevos mantenimientos
- **AND** los mantenimientos cerrados siguen mostrando el servicio correctamente

### Requirement: Búsqueda y filtrado de servicios
El sistema DEBE permitir buscar y localizar servicios activos e inactivos mediante su nombre y estado.

#### Scenario: Búsqueda por coincidencia parcial
- **WHEN** el usuario busca "cambio" en el catálogo de servicios
- **THEN** el sistema retorna todos los servicios cuyo nombre contenga esa palabra (ej. "Cambio de aceite")
