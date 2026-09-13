# Cobertura de clientes, vehículos y marcas

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `gestionar-clientes-y-vehiculos` |
| Estado | Inventario inicial de 69 escenarios; cobertura pendiente de implementación |
| Fecha | 2026-09-13 |
| Alcance | Gestión de clientes, catálogo de marcas de vehículo y gestión de vehículos y propiedad |

## 1. Resumen de trazabilidad y cobertura

| Capacidad | Requisitos | Escenarios | Tareas asociadas | Estado de cobertura |
|---|---|---|---|---|
| Catálogo de marcas de vehículo | 5 | 17 | Grupo 4 (4.1–4.5), Grupo 5 (5.5), Grupo 7 (7.3), Grupo 8 (8.1, 8.4) | Grupo 4 y 5 completados; 13 cumplidos, 4 pendientes |
| Gestión de clientes | 9 | 27 | Grupo 1 (1.2), Grupo 3 (3.1–3.7), Grupo 5 (5.3, 5.5), Grupo 7 (7.1, 7.4), Grupo 8 (8.1, 8.4) | Grupo 1, 3 y 5 completados; 21 cumplidos, 6 pendientes |
| Gestión de vehículos y propiedad | 8 | 25 | Grupo 5 (5.1–5.6), Grupo 6 (6.1–6.5), Grupo 7 (7.2, 7.4), Grupo 8 (8.1, 8.2, 8.4) | Grupo 5 completado; 15 cumplidos, 10 pendientes |
| **Total** | **22** | **69** | **Grupos 1 al 9** | **49 completados, 20 pendientes** |

---

## 2. Inventario individual de los 69 escenarios

### 2.1 Catálogo de marcas de vehículo (17 escenarios)

| N.º | Escenario | Requisito de spec | Grupo de tareas | Pruebas previstas | Cobertura |
|---|---|---|---|---|---|
| 1 | Consulta por los tres roles | Consulta y acceso por rol | Grupo 4 (4.2, 4.3, 4.4, 4.5) | Backend: `test_brand_api.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 2 | Crear y editar por Encargado del taller | Consulta y acceso por rol | Grupo 4 (4.2, 4.3, 4.4, 4.5) | Backend: `test_brand_api.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 3 | Escritura directa por Vendedor | Consulta y acceso por rol | Grupo 4 (4.2, 4.3, 4.5) | Backend: `test_brand_api.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 4 | Baja solicitada por Encargado del taller | Consulta y acceso por rol | Grupo 4 (4.2, 4.3, 4.5) | Backend: `test_brand_api.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 5 | Sesión sin autorización vigente | Consulta y acceso por rol | Grupo 4 (4.3) / Grupo 8 (8.2) | Backend: `test_brand_api.py`, `test_permissions_security_matrix.py`; Frontend: `SessionGuard.test.tsx` | **Cumplido** |
| 6 | Marca faltante durante el registro | Datos mínimos y administración básica | Grupo 5 (5.5, 5.6) | Frontend: `VehicleForm.test.tsx`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 7 | Nombre vacío | Datos mínimos y administración básica | Grupo 4 (4.1, 4.2, 4.3) | Backend: `test_brand_models.py`, `test_brand_services.py`, `test_brand_api.py` | **Cumplido** |
| 8 | Corrección de nombre referenciado | Datos mínimos y administración básica | Grupo 4 (4.2, 4.3, 4.4) | Backend: `test_brand_services.py`, `test_brand_api.py`; Frontend: `BrandForm.test.tsx` | **Cumplido** |
| 9 | Desactivar marca utilizada | Estado del registro y continuidad operativa | Grupo 7 (7.3) | Backend: `test_brand_services.py`, `test_brand_state.py` | **Cumplido** |
| 10 | Selección directa de marca inactiva | Estado del registro y continuidad operativa | Grupo 5 (5.2, 5.6) / Grupo 7 (7.3) | Backend: `test_vehicle_services.py`; Frontend: `VehicleForm.test.tsx`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 11 | Editar otros datos conservando marca inactiva | Estado del registro y continuidad operativa | Grupo 5 (5.2) / Grupo 7 (7.3) | Backend: `test_vehicle_services.py`, `test_vehicle_views.py` | **Cumplido** |
| 12 | Reactivar marca | Estado del registro y continuidad operativa | Grupo 4 (4.2, 4.3, 4.4, 4.5) / Grupo 7 | Backend: `test_brand_services.py`, `test_brand_api.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 13 | Baja auditada | Trazabilidad y auditoría | Grupo 4 (4.2, 4.3) | Backend: `test_brand_services.py`, `test_brand_api.py` | **Cumplido** |
| 14 | Fallo al guardar el evento | Trazabilidad y auditoría | Grupo 4 (4.2) | Backend: `test_brand_services.py` | **Cumplido** |
| 15 | Rechazo de permisos consultable | Trazabilidad y auditoría | Grupo 4 (4.2) / Grupo 8 (8.1, 8.2) | Backend: `test_brand_api.py`, `test_audit_api.py` | **Cumplido** |
| 16 | Formulario de marca en teléfono | Experiencia adaptable y formularios claros | Grupo 4 (4.4) / Grupo 8 (8.4) | E2E responsive: `responsive.spec.ts` (360 px) | Pendiente |
| 17 | Catálogo sin marcas disponibles | Experiencia adaptable y formularios claros | Grupo 4 (4.4) | Frontend: `VehicleBrandsPage.test.tsx` | **Cumplido** |

### 2.2 Gestión de clientes (27 escenarios)

| N.º | Escenario | Requisito de spec | Grupo de tareas | Pruebas previstas | Cobertura |
|---|---|---|---|---|---|
| 18 | Persona natural sin email ni dirección | Registro con datos mínimos | Grupo 3 (3.1, 3.2, 3.3, 3.4, 3.7) | Backend: `test_customer_services.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 19 | Persona jurídica con razón social | Registro con datos mínimos | Grupo 3 (3.1, 3.3, 3.4, 3.7) | Backend: `test_customer_services.py`; Frontend: `CustomerForm.test.tsx`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 20 | Falta de un dato obligatorio | Registro con datos mínimos | Grupo 3 (3.1, 3.4, 3.5) | Backend: `test_validation.py`; Frontend: `CustomerForm.test.tsx` | **Cumplido** |
| 21 | Longitudes válidas | Identificación y datos de contacto | Grupo 3 (3.1, 3.2) | Backend: `test_validation.py`, `test_customer_models.py` | **Cumplido** |
| 22 | Identificación inválida enviada directamente | Identificación y datos de contacto | Grupo 3 (3.1, 3.4) | Backend: `test_validation.py`, `test_customer_api.py` | **Cumplido** |
| 23 | Datos opcionales informados | Identificación y datos de contacto | Grupo 3 (3.1, 3.3, 3.4) | Backend: `test_customer_services.py`, `test_customer_api.py` | **Cumplido** |
| 24 | Identificación ya utilizada por un cliente inactivo | Unicidad y advertencia de posibles duplicados | Grupo 3 (3.2) / Grupo 7 (7.1) | Backend: `test_customer_models.py`, `test_customer_api.py` | **Cumplido** |
| 25 | Identificación duplicada al editar | Unicidad y advertencia de posibles duplicados | Grupo 3 (3.2, 3.3, 3.4) | Backend: `test_customer_services.py`, `test_customer_api.py` | **Cumplido** |
| 26 | Mismo teléfono sin identificación duplicada | Unicidad y advertencia de posibles duplicados | Grupo 3 (3.3, 3.4, 3.5, 3.7) | Backend: `test_customer_api.py`; Frontend: `CustomerForm.test.tsx`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 27 | Creaciones concurrentes de la misma identidad | Unicidad y advertencia de posibles duplicados | Grupo 3 (3.2, 3.3) | Backend: `test_customer_services.py` | **Cumplido** |
| 28 | Búsqueda por cada dato disponible | Búsqueda y consulta | Grupo 3 (3.3, 3.4, 3.6, 3.7) | Backend: `test_customer_queries.py`; Frontend: `CustomersPage.test.tsx`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 29 | Consulta de vehículos desde cliente | Búsqueda y consulta | Grupo 5 (5.3, 5.5, 5.6) | Backend: `test_vehicle_views.py`; Frontend: `CustomerDetailPage.test.tsx`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 30 | Ficha sin vehículos | Búsqueda y consulta | Grupo 5 (5.5) | Frontend: `CustomerDetailPage.test.tsx` | **Cumplido** |
| 31 | Edición válida | Modificación y ciclo de vida | Grupo 3 (3.3, 3.4, 3.5, 3.7) | Backend: `test_customer_services.py`, `test_customer_api.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 32 | Desactivación con vehículos asociados | Modificación y ciclo de vida | Grupo 7 (7.1, 7.4) | Backend: `test_customer_state.py`; Frontend: `CustomersPage.test.tsx` | **Cumplido** |
| 33 | Reactivación de la misma ficha | Modificación y ciclo de vida | Grupo 7 (7.1, 7.4, 7.5) | Backend: `test_customer_state.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 34 | Repetición de una transición ya aplicada | Modificación y ciclo de vida | Grupo 7 (7.1, 7.4) | Backend: `test_customer_state.py` | **Cumplido** |
| 35 | Operación permitida a los tres roles | Permisos y seguridad | Grupo 3 (3.3, 3.4, 3.6) | Backend: `test_customer_api.py`; Frontend: `CustomersPage.test.tsx` | **Cumplido** |
| 36 | Desactivación directa sin permiso | Permisos y seguridad | Grupo 7 (7.1, 7.5) | Backend: `test_customers_api_permissions.py` | **Cumplido** |
| 37 | Sesión invalidada | Permisos y seguridad | Grupo 3 (3.4) / Grupo 8 (8.2) | Backend: `test_customer_api.py`, `test_permissions_security_matrix.py`; E2E: `session-revocation.spec.ts` | **Cumplido** |
| 38 | Cambio y evento confirmados juntos | Auditoría y trazabilidad | Grupo 3 (3.3, 3.4) | Backend: `test_customer_services.py`, `test_customer_api.py` | **Cumplido** |
| 39 | Fallo al conservar auditoría exitosa | Auditoría y trazabilidad | Grupo 3 (3.3) | Backend: `test_customer_services.py` | **Cumplido** |
| 40 | Rechazo comprensible y documentado | Auditoría y trazabilidad | Grupo 3 (3.3) / Grupo 8 (8.1, 8.2) | Backend: `test_customer_services.py`, `test_customer_api.py` | **Cumplido** |
| 41 | Registro con error en teléfono | Experiencia de usuario adaptable | Grupo 3 (3.5) | Frontend: `CustomerForm.test.tsx` | **Cumplido** |
| 42 | Consulta fallida frente a lista vacía | Experiencia de usuario adaptable | Grupo 3 (3.6) | Frontend: `CustomersPage.test.tsx` | **Cumplido** |
| 43 | Revisión en dispositivos y teclado | Experiencia de usuario adaptable | Grupo 3 (3.6) / Grupo 8 (8.4) | E2E responsive: `responsive.spec.ts` | Pendiente |
| 44 | Dependencia aún abierta | Dependencia con sistema visual e identidad | Grupo 1 (1.2) | Cierre verificado en `master` commit `2c68d51` | **Cumplido** |

### 2.3 Gestión de vehículos y propiedad (25 escenarios)

| N.º | Escenario | Requisito de spec | Grupo de tareas | Pruebas previstas | Cobertura |
|---|---|---|---|---|---|
| 45 | Alta sin datos opcionales | Registro de vehículos con datos mínimos | Grupo 5 (5.1, 5.2, 5.3, 5.4, 5.6) | Backend: `test_vehicle_models.py`, `test_vehicle_services.py`, `test_vehicle_views.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 46 | Datos obligatorios ausentes | Registro de vehículos con datos mínimos | Grupo 5 (5.1, 5.2, 5.4) | Backend: `test_vehicle_models.py`, `test_vehicle_services.py`; Frontend: `VehicleForm.test.tsx` | **Cumplido** |
| 47 | Propietario no disponible | Registro de vehículos con datos mínimos | Grupo 5 (5.2, 5.4) | Backend: `test_vehicle_services.py`, `test_vehicle_views.py`; Frontend: `VehicleForm.test.tsx` | **Cumplido** |
| 48 | Placa equivalente existente | Unicidad y normalización | Grupo 5 (5.1, 5.2, 5.6) | Backend: `test_vehicle_models.py`, `test_vehicle_services.py`, `test_vehicle_views.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 49 | VIN repetido con placa diferente | Unicidad y normalización | Grupo 5 (5.1, 5.2) | Backend: `test_vehicle_models.py`, `test_vehicle_services.py`, `test_vehicle_views.py` | **Cumplido** |
| 50 | Vehículos sin VIN | Unicidad y normalización | Grupo 5 (5.1, 5.2) | Backend: `test_vehicle_models.py`, `test_vehicle_services.py`, `test_vehicle_views.py` | **Cumplido** |
| 51 | Edición o alta concurrente duplicada | Unicidad y normalización | Grupo 5 (5.1, 5.2, 5.3) | Backend: `test_vehicle_views.py` | **Cumplido** |
| 52 | Búsqueda parcial de placa | Consulta y búsqueda | Grupo 5 (5.3, 5.4, 5.6) | Backend: `test_vehicle_queries.py`; Frontend: `VehiclesPage.test.tsx`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 53 | Consulta del propietario desde vehículo | Consulta y búsqueda | Grupo 5 (5.3, 5.4, 5.6) | Backend: `test_vehicle_views.py`; Frontend: `VehicleDetailPage.test.tsx`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 54 | Transferencia válida | Transferencia de propiedad | Grupo 6 (6.1, 6.3, 6.4, 6.5) | Backend: `test_vehicle_services.py`, `test_vehicle_api.py`; Frontend: `VehicleDetailPage.test.tsx`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 55 | Nuevo propietario inválido | Transferencia de propiedad | Grupo 6 (6.1, 6.3) | Backend: `test_vehicle_services.py`, `test_vehicle_api.py` | **Cumplido** |
| 56 | Repetición hacia el propietario actual | Transferencia de propiedad | Grupo 6 (6.1, 6.3, 6.5) | Backend: `test_vehicle_services.py`, `test_vehicle_api.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 57 | Transferencias concurrentes | Transferencia de propiedad | Grupo 6 (6.2) | Backend: `test_ownership_concurrency.py` | **Cumplido** |
| 58 | Corrección de datos opcionales | Modificación y ciclo de vida | Grupo 5 (5.2, 5.3, 5.4) | Backend: `test_vehicle_services.py`, `test_vehicle_views.py`; Frontend: `VehicleForm.test.tsx` | **Cumplido** |
| 59 | Desactivación y consulta | Modificación y ciclo de vida | Grupo 7 (7.2, 7.4, 7.5) | Backend: `test_vehicle_state.py`; Frontend: `VehiclesPage.test.tsx` | **Cumplido** |
| 60 | Reactivación | Modificación y ciclo de vida | Grupo 7 (7.2, 7.4, 7.5) | Backend: `test_vehicle_state.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 61 | Gestión por Encargado del taller | Permisos y seguridad | Grupo 5 (5.2, 5.3, 5.4) | Backend: `test_vehicle_services.py`, `test_vehicle_views.py`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 62 | Escritura directa de Vendedor | Permisos y seguridad | Grupo 5 (5.2, 5.3, 5.4, 5.6) | Backend: `test_vehicle_services.py`, `test_vehicle_views.py`; Frontend: `VehicleDetailPage.test.tsx`; E2E: `customers-vehicles.spec.ts` | **Cumplido** |
| 63 | Unión de roles | Permisos y seguridad | Grupo 5 (5.2) / Grupo 8 (8.2) | Backend: `test_vehicle_services.py` | **Cumplido** |
| 64 | Solicitud sin sesión vigente | Permisos y seguridad | Grupo 5 (5.3) / Grupo 8 (8.2) | Backend: `test_vehicles_api.py`, `test_permissions_security_matrix.py`; Frontend: `SessionGuard.test.tsx` | **Cumplido** |
| 65 | Auditoría de transferencia | Auditoría de cambios vehiculares | Grupo 6 (6.1, 6.3) | Backend: `test_vehicle_services.py`, `test_vehicle_api.py` | **Cumplido** |
| 66 | Fallo durante la transferencia | Auditoría de cambios vehiculares | Grupo 6 (6.1, 6.2) | Backend: `test_vehicle_services.py`, `test_ownership_concurrency.py` | **Cumplido** |
| 67 | Error de placa documentado | Auditoría de cambios vehiculares | Grupo 5 (5.2) / Grupo 8 (8.1) | Backend: `test_vehicle_services.py` | **Cumplido** |
| 68 | Transferencia en pantalla estrecha | Experiencia visual adaptable | Grupo 6 (6.4) / Grupo 8 (8.4) | E2E responsive: `responsive.spec.ts` (360 px) | Pendiente |
| 69 | Formulario con errores | Experiencia visual adaptable | Grupo 5 (5.4) | Frontend: `VehicleForm.test.tsx` | **Cumplido** |
