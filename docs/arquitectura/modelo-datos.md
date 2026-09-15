# Modelo de datos de clientes, marcas y vehículos

| Campo | Valor |
|---|---|
| Capacidad | Registro de personas, vehículos y catálogo de marcas |
| Cambio OpenSpec | `gestionar-clientes-y-vehiculos` |
| Estado | Aprobado tras diseño de persistencia; no altera el modelo conceptual |
| Base de datos | PostgreSQL 16+ |
| Fecha | 2026-09-13 |

## 1. Propósito y alcance

Este documento especifica el modelo de datos relacional para el registro de **clientes**, **marcas de vehículo**, **vehículos** y **períodos de propiedad** en el backend Django/PostgreSQL de Sys-Taller. Concreta las decisiones de persistencia aprobadas en `design.md` (§2) del cambio `gestionar-clientes-y-vehiculos`.

No introduce tablas de ventas, facturación, órdenes de trabajo, inventario ni pagos. Dichas capacidades económicas y operativas se especificarán e implementarán en sus respectivos cambios OpenSpec. Tampoco altera las invariantes ni los conceptos del **modelo de dominio** conceptual (`docs/arquitectura/modelo-dominio.md`), el cual conserva su carácter de referencia de negocio.

## 2. Principios de diseño de persistencia

1. **Fichas compartidas entre entidades fiscales**: **clientes** y **vehículos** son transversales a ambos **RUC** (comercial y artesanal). Ninguna tabla de este módulo contiene columna de **entidad fiscal**.
2. **Propietario derivado del período abierto**: la tabla `Vehicle` no almacena una columna mutable redundante `owner_id`. El **propietario** vigente se deriva mediante relación relacional con `OwnershipPeriod` donde `ended_at IS NULL`.
3. **Integridad referencial protegida**: todas las relaciones de negocio utilizan `on_delete=models.PROTECT`. No se permite eliminación física (`DELETE`), garantizando preservación de auditoría e historia.
4. **Unicidad e inactividad en PostgreSQL**: las restricciones de unicidad (identificación por tipo, placa, VIN) se imponen a nivel de motor PostgreSQL y aplican tanto a registros activos como inactivos.
5. **Control de concurrencia optimista**: las entidades mutables (`Customer`, `VehicleBrand`, `Vehicle`) disponen de columna `version` entera autoincrementada bajo bloqueo para detectar modificaciones concurrentes obsoletas (`stale_record`).
6. **Manejo uniforme de nulos y vacíos**: textos obligatorios no admiten vacío; textos opcionales (`email`, `address`, `color`) se almacenan como cadena vacía `""`; campos opcionales sin semántica de cadena (`year`, `vin`, `ended_at`) admiten `NULL`.

## 3. Especificación de tablas

### 3.1 `customer_registry_customer` (Customer)

Representa a una persona natural o jurídica que interactúa como cliente del taller.

| Columna | Tipo PostgreSQL / Django | Nulo | Por defecto | Descripción / Restricción |
|---|---|---|---|---|
| `id` | `BIGSERIAL` / `BigAutoField` | No | Auto | Clave primaria autogenerada. |
| `person_type` | `VARCHAR(16)` / `CharField` | No | — | `NATURAL` o `JURIDICA`. |
| `name` | `VARCHAR(255)` / `CharField` | No | — | Nombre y apellidos o razón social. No vacío (`CHECK (LENGTH(name) > 0)`). |
| `identification_type` | `VARCHAR(8)` / `CharField` | No | — | `CI` (10 caracteres) o `RUC` (13 caracteres). |
| `identification` | `VARCHAR(32)` / `CharField` | No | — | Número normalizado (sin espacios exteriores, conserva ceros iniciales). No vacío. |
| `phone` | `VARCHAR(64)` / `CharField` | No | — | Teléfono de contacto obligatorio. No vacío (`CHECK (LENGTH(phone) > 0)`). |
| `email` | `VARCHAR(254)` / `CharField` | No | `""` | Correo electrónico opcional. Formato validado en dominio si está informado. |
| `address` | `VARCHAR(1024)` / `CharField` | No | `""` | Dirección física opcional. |
| `is_active` | `BOOLEAN` / `BooleanField` | No | `TRUE` | Estado de la ficha. Solo Administrador puede alterar. |
| `version` | `INTEGER` / `PositiveIntegerField`| No | `1` | Versión optimista incrementada en cada mutación. |
| `created_at` | `TIMESTAMPTZ` / `DateTimeField` | No | `now()` | Fecha y hora UTC de creación. |
| `updated_at` | `TIMESTAMPTZ` / `DateTimeField` | No | `now()` | Fecha y hora UTC de última actualización. |

**Restricciones e Índices:**
- `UNIQUE (identification_type, identification)`: unicidad obligatoria por tipo y número normalizado, aplicable a activos e inactivos.
- `CHECK (identification_type IN ('CI', 'RUC'))`.
- `CHECK (person_type IN ('NATURAL', 'JURIDICA'))`.
- `CHECK (LENGTH(TRIM(name)) > 0)`.
- `CHECK (LENGTH(TRIM(phone)) > 0)`.
- `CHECK (LENGTH(TRIM(identification)) > 0)`.
- `INDEX (is_active, name)`: aceleración de búsquedas y filtros por estado.

### 3.2 `customer_registry_vehiclebrand` (VehicleBrand)

Catálogo administrable de marcas de vehículo disponibles para asociar a los vehículos del taller.

| Columna | Tipo PostgreSQL / Django | Nulo | Por defecto | Descripción / Restricción |
|---|---|---|---|---|
| `id` | `BIGSERIAL` / `BigAutoField` | No | Auto | Clave primaria autogenerada. |
| `name` | `VARCHAR(255)` / `CharField` | No | — | Nombre de la marca. No vacío (`CHECK (LENGTH(TRIM(name)) > 0)`). |
| `is_active` | `BOOLEAN` / `BooleanField` | No | `TRUE` | Estado activo/inactivo. Administrador puede desactivar/reactivar. |
| `version` | `INTEGER` / `PositiveIntegerField`| No | `1` | Versión optimista. |
| `created_at` | `TIMESTAMPTZ` / `DateTimeField` | No | `now()` | Fecha y hora UTC de creación. |
| `updated_at` | `TIMESTAMPTZ` / `DateTimeField` | No | `now()` | Fecha y hora UTC de última actualización. |

**Restricciones e Índices:**
- `CHECK (LENGTH(TRIM(name)) > 0)`.
- `INDEX (is_active, name)`: listado y filtrado de marcas activas para selectores.
- *Nota de diseño:* No se impone unicidad estricta ni fusión automática de marcas en V1 conforme a las especificaciones aprobadas.

### 3.3 `customer_registry_vehicle` (Vehicle)

Representa un vehículo atendido en el taller.

| Columna | Tipo PostgreSQL / Django | Nulo | Por defecto | Descripción / Restricción |
|---|---|---|---|---|
| `id` | `BIGSERIAL` / `BigAutoField` | No | Auto | Clave primaria autogenerada. |
| `plate` | `VARCHAR(64)` / `CharField` | No | — | Placa normalizada (mayúsculas, sin espacios exteriores). No vacía. |
| `brand_id` | `BIGINT` / `ForeignKey` | No | — | Referencia a `customer_registry_vehiclebrand.id` (`on_delete=PROTECT`). |
| `model` | `VARCHAR(255)` / `CharField` | No | — | Modelo del vehículo. No vacío (`CHECK (LENGTH(TRIM(model)) > 0)`). |
| `color` | `VARCHAR(100)` / `CharField` | No | `""` | Color del vehículo opcional. |
| `year` | `INTEGER` / `PositiveIntegerField`| Sí | `NULL` | Año de fabricación opcional. |
| `vin` | `VARCHAR(64)` / `CharField` | Sí | `NULL` | Número de chasis/VIN opcional, normalizado en mayúsculas. |
| `is_active` | `BOOLEAN` / `BooleanField` | No | `TRUE` | Estado de la ficha del vehículo. |
| `version` | `INTEGER` / `PositiveIntegerField`| No | `1` | Versión optimista. |
| `created_at` | `TIMESTAMPTZ` / `DateTimeField` | No | `now()` | Fecha y hora UTC de creación. |
| `updated_at` | `TIMESTAMPTZ` / `DateTimeField` | No | `now()` | Fecha y hora UTC de última actualización. |

**Restricciones e Índices:**
- `UNIQUE (plate)`: placa única normalizada, aplicable a activos e inactivos.
- `UNIQUE (vin) WHERE vin IS NOT NULL`: índice único parcial para permitir múltiples registros sin VIN pero asegurar unicidad estricta cuando se informa.
- `CHECK (LENGTH(TRIM(plate)) > 0)`.
- `CHECK (LENGTH(TRIM(model)) > 0)`.
- `INDEX (brand_id)`: navegación de vehículos por marca.
- `INDEX (is_active, plate)`: búsquedas y listados vehiculares.

### 3.4 `customer_registry_ownershipperiod` (OwnershipPeriod)

Registra el intervalo temporal durante el cual un **cliente** es o ha sido **propietario** de un **vehículo**.

| Columna | Tipo PostgreSQL / Django | Nulo | Por defecto | Descripción / Restricción |
|---|---|---|---|---|
| `id` | `BIGSERIAL` / `BigAutoField` | No | Auto | Clave primaria autogenerada. |
| `vehicle_id` | `BIGINT` / `ForeignKey` | No | — | Referencia a `customer_registry_vehicle.id` (`on_delete=PROTECT`). |
| `customer_id` | `BIGINT` / `ForeignKey` | No | — | Referencia a `customer_registry_customer.id` (`on_delete=PROTECT`). |
| `started_at` | `TIMESTAMPTZ` / `DateTimeField` | No | — | Instante de inicio del período de propiedad. |
| `ended_at` | `TIMESTAMPTZ` / `DateTimeField` | Sí | `NULL` | Instante de finalización del período. `NULL` indica propiedad vigente. |
| `created_at` | `TIMESTAMPTZ` / `DateTimeField` | No | `now()` | Registro del período. |

**Restricciones e Índices:**
- `UNIQUE (vehicle_id) WHERE ended_at IS NULL`: índice único parcial crítico. Garantiza que ningún vehículo pueda tener más de un período de propiedad abierto simultáneamente.
- `CHECK (ended_at IS NULL OR ended_at >= started_at)`: coherencia temporal del intervalo.
- `INDEX (customer_id, ended_at)`: optimización de la consulta de vehículos de propiedad actual de un cliente.
- `INDEX (vehicle_id, started_at)`: consulta cronológica de períodos históricos de un vehículo.

## 4. Auditoría e Integración

1. **Eventos de auditoría**: las operaciones sobre estas tablas consumen el servicio `record_audit_event` de `identity.application.audit` dentro de la transacción de base de datos.
2. **Metadatos permitidos**: para la transferencia de propiedad, se registran exclusivamente los identificadores numéricos `previous_owner_id` y `new_owner_id`. Ningún dato personal (nombres, teléfonos, correos) se registra en los metadatos de auditoría.
3. **Secuencia de migración**:
   - `0001_initial.py` en la aplicación `customer_registry` (`Customer`).
   - `0002_vehiclebrand.py` en la aplicación `customer_registry` (`VehicleBrand`).
   - `0003_vehicle_ownershipperiod_and_more.py` en la aplicación `customer_registry` (`Vehicle`, `OwnershipPeriod`).
   - Las migraciones son independientes de las tablas de negocio futuras y respetan el esquema de identidad vigente.

## Módulo: workshop_configuration

Este módulo almacena la configuración de operaciones y reglas fiscales del taller.

### Tablas Principales
- **workshop_configuration_workshopconfiguration**: Estado global de inicialización (singleton pk=1) y su instalación.
- **workshop_configuration_fiscalentity**: Entidades fiscales (RUC comercial y artesanal). Inmutables por tipo.
- **workshop_configuration_warehouse**: Bodegas operativas (bodega principal).
- **workshop_configuration_taxdefinition**: Catálogo de impuestos (código, nombre).
- **workshop_configuration_taxperiod**: Vigencias de impuestos (`starts_on`, `ends_on`, `rate`), evita superposiciones temporales.
- **workshop_configuration_numberingscope**: Ámbitos de numeración (ej: Facturas).
- **workshop_configuration_documentseries**: Series de documentos asignadas a un ámbito (`code`, `last_number`, `is_active`).
- **workshop_configuration_configurationuse**: Registro de consumo de entidades o tasas en transacciones foráneas (garantiza idempotencia/inmutabilidad si están en uso).
- **workshop_configuration_configurationcommand**: Comandos de numeración para garantizar idempotencia por clave externa.

### Consideraciones de Integridad
- Todo registro expuesto tiene versión (`version` con control de concurrencia optimista).
- Asignación de secuencias utiliza bloqueos (`FOR UPDATE` con aislamiento repetible) para asegurar consistencia en concurrencia.
