## ADDED Requirements

### Requirement: Registro de proveedores
El sistema DEBE permitir registrar, editar y buscar proveedores para asociarlos a ingresos de mercadería.

#### Scenario: Proveedor recurrente con datos completos
- **WHEN** el administrador registra un proveedor con nombre, identificación y datos de contacto
- **THEN** el proveedor se guarda correctamente y puede seleccionarse en los ingresos de mercadería

#### Scenario: Proveedor ocasional con datos mínimos
- **WHEN** el administrador registra un proveedor ocasional proporcionando únicamente el nombre (sin identificación ni teléfono)
- **THEN** el sistema guarda el proveedor sin requerir los campos opcionales

### Requirement: Activación y desactivación de proveedores
El sistema DEBE permitir activar y desactivar proveedores. Un proveedor inactivo queda en el historial y no puede seleccionarse para nuevos ingresos.

#### Scenario: Desactivación de proveedor
- **WHEN** el administrador desactiva un proveedor
- **THEN** el proveedor no está disponible en la lista de selección al crear un nuevo ingreso de mercadería
- **AND** los ingresos confirmados previamente mantienen la referencia visible al proveedor inactivo
