## MODIFIED Requirements

### Requirement: Acceso exclusivo de administración a proveedores

Solo Administrador SHALL consultar proveedores con `proveedores.ver` y crear, editar o cambiar estado con `proveedores.gestionar`. SHALL verificarse sesión, autorización vigente, protección de escrituras y unión de roles. Como única excepción, quien pueda registrar entradas mediante `ingresos.crear` SHALL disponer de una selección mínima de proveedores activos que entregue solo el identificador y el nombre, con búsqueda por nombre, para elegir uno al registrar una entrada. Esa selección SHALL NOT incluir identificación, contacto, dirección, proveedores inactivos, coincidencias de identificación ni permitir escrituras. Vendedor sin Administrador SHALL NOT recibir lista, ficha ni navegación del catálogo de proveedores; Encargado del taller sin otro rol SHALL NOT recibir dato alguno de proveedores. Trazabilidad: CT-001; actores-y-roles §3.3; RN-SEG-001…007; RN-CAT-010; autorizacion-y-navegacion; proposal R4.

#### Scenario: Consulta y gestión autorizadas
- **GIVEN** un Administrador autenticado
- **WHEN** consulta o administra un proveedor válido
- **THEN** SHALL permitirse según su permiso

#### Scenario: Selección mínima del Vendedor
- **GIVEN** un Vendedor sin Administrador y proveedores activos e inactivos
- **WHEN** busca un proveedor por nombre al registrar una entrada
- **THEN** SHALL recibir solo identificador y nombre de los activos coincidentes, sin identificación, contacto ni inactivos

#### Scenario: Acceso operativo directo al catálogo
- **GIVEN** un Vendedor o Encargado sin Administrador
- **WHEN** solicita lista, ficha, coincidencias o escritura del catálogo de proveedores
- **THEN** SHALL rechazarse sin revelar datos ni cambiar registros

#### Scenario: Encargado solicita la selección mínima
- **GIVEN** un Encargado del taller sin `ingresos.crear`
- **WHEN** solicita la selección mínima de proveedores
- **THEN** SHALL denegarse sin devolver nombres

#### Scenario: Sesión inválida
- **GIVEN** un usuario sin sesión vigente
- **WHEN** accede al catálogo
- **THEN** SHALL exigirse autenticación sin devolver datos

#### Scenario: Unión de roles
- **GIVEN** un Administrador que también es Vendedor
- **WHEN** consulta proveedores
- **THEN** SHALL conservar su permiso de Administrador

Referencia terminológica: [spec-glossary-reference.md](spec-glossary-reference.md).
