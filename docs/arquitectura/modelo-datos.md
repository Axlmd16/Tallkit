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
| `is_withholding_agent` | `BOOLEAN` / `BooleanField` | No | `FALSE` | Marca manual de agente de retención (`registrar-retenciones-recibidas-en-cobros`, migración `0004`); orienta el cobro y no se verifica ante el SRI. |
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
4. **Ensayo de migraciones (2026-09-20, PostgreSQL 17.11 del `compose.yaml`)**: se ejecutó `manage.py migrate` en dos bases desechables creadas y eliminadas durante el ensayo, sin tocar la base de desarrollo.
   - *Base limpia*: todas las migraciones se aplicaron sin errores y `makemigrations --check --dry-run` no detectó cambios.
   - *Base con identidad previa*: se aplicó solo `identity` (con sus dependencias de `auth`), se insertaron un usuario y un evento de auditoría sintéticos y después se migró el resto. Tras la migración se conservaron 1 usuario y 1 evento; las tablas de clientes, marcas, vehículos y períodos quedaron vacías, sin datos previos imprevistos.
   - Restricciones comprobadas en `pg_constraint`/`pg_indexes`: unicidad de identificación (`unique_customer_identification`), de placa (`vehicle_plate_unique`), de VIN informado (`vehicle_vin_unique_when_not_null`) y de período abierto (`ownership_unique_open_period`); comprobaciones de no vacío, tipos, versión y `ownership_ended_at_gte_started_at`; claves foráneas protegidas hacia marca, cliente y vehículo.
5. **Respaldo, despliegue y recuperación**:
   - Antes de migrar una base con datos, realizar un respaldo verificado con el procedimiento vigente del entorno; el procedimiento definitivo de respaldo y restauración local sigue abierto en DA-003 y este cambio no lo resuelve.
   - Orden de despliegue: respaldo → backend y `make migrate` → comprobaciones (`manage.py check`, sesiones, permisos de marcas, API y auditoría) → frontend. El contrato de errores ampliado (`errors`, `conflict`) es opcional, de modo que un frontend anterior sigue consumiéndolo.
   - Las migraciones solo crean tablas propias y no modifican identidad. Antes del uso operativo puede volverse al código anterior dejando las tablas sin uso. Después de registrar datos se prefiere la corrección hacia adelante; no se revierten migraciones ni se restaura una copia sin autorización expresa, y nunca se eliminan fichas automáticamente.
   - Si una base objetivo contiene tablas o datos de estas capacidades no previstos, detener la migración hasta contar con un plan de conservación.

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
- **workshop_configuration_electronicprofilerevision**: Revisión inmutable del perfil del emisor de una entidad fiscal (`fiscal_entity`, `revision ≥ 1` única por entidad, `conditions` JSON, `certificate` opcional, usuario y fecha).
  - `conditions_format` (entero pequeño, 1 por omisión, restricción `{1, 2}`; `estructurar-perfil-del-emisor-y-codigos-fiscales`, migración `0014`): 1 conserva condiciones escritas como texto libre (historia, solo lectura); 2 conserva valores cerrados. La migración no modifica ninguna fila existente.
  - Formato 2: cinco claves (`tax_regime`, `accounting_obligation`, `withholding_agent`, `special_taxpayer`, `artisan_qualification`) con `status`, `value`, `source`, `starts_on`, `ends_on` y, solo para la calificación, `issuing_body` y `ends_on` obligatorio. La leyenda del régimen no se guarda: se deriva.
- **workshop_configuration_receivedwithholdingsetting**: Ajustes de retenciones recibidas de una entidad fiscal (`registrar-retenciones-recibidas-en-cobros`, migración `0015`).
  - Campos: `fiscal_entity` (uno a uno, `PROTECT`), `registration_enabled` (verdadero por omisión), `warning_percentage` `numeric(5,2)` anulable (nulo = advertencia desactivada; restricción `> 0` y `≤ 100`; 20,00 por omisión), `version`, usuario y fecha.
  - La ausencia de fila equivale a los valores por omisión. No forma parte de las revisiones del perfil del emisor ni de la instantánea fiscal.
- **workshop_configuration_fiscalentitylogo**: Logotipo vigente de una entidad fiscal (`logotipos-por-ruc`, migración `0013`).
  - Campos: `fiscal_entity` (uno a uno, `PROTECT`), `storage_name` único (UUID), tipo (`image/png`, `image/jpeg` o `image/webp`), extensión, tamaño, dimensiones, SHA-256 del archivo recibido, `revision ≥ 1`, usuario y fecha de carga.
  - La fila existe solo mientras hay logotipo: quitarlo la elimina y la auditoría conserva el hecho.
  - `workshop_configuration_fiscalentity.logo_revision` (entero, 0 por omisión) numera las revisiones sin reutilizarlas y sin tocar `version`.

### Archivos privados de configuración
Los logotipos viven en `PRIVATE_MEDIA_ROOT/fiscal-logos/<entidad>/` (ADR-0007). El registro se crea solo con el archivo completo. El archivo reemplazado o quitado se borra al confirmar la transacción, y `manage.py purge_entity_logos` elimina de forma idempotente los que quedan sin registro. Cargas y retiros se serializan con un bloqueo de la fila de la entidad.

### Consideraciones de Integridad
- Todo registro expuesto tiene versión (`version` con control de concurrencia optimista).
- Asignación de secuencias utiliza bloqueos (`FOR UPDATE` con aislamiento repetible) para asegurar consistencia en concurrencia.

## Módulo: catalog y supplier_registry

Cambio OpenSpec `gestionar-catalogos-productos-servicios-proveedores`. Concreta las decisiones de persistencia de su `design.md` §2; el **modelo de dominio** sigue siendo la referencia conceptual. Migraciones iniciales: `catalog/0001_initial.py` y `supplier_registry/0001_initial.py`; solo crean tablas propias, sin datos iniciales, y dependen del usuario, de `customer_registry.VehicleBrand` y de `workshop_configuration.TaxDefinition`.

### Reglas comunes
- Todo registro editable tiene `is_active`, `version` (control de concurrencia optimista) y fechas `created_at`/`updated_at`. Sin eliminación física: todas las relaciones son `PROTECT`.
- Nombres únicos: restricción sobre `Lower(Trim(name))`, incluidos registros inactivos; no se quitan acentos ni espacios interiores.
- Importes en USD con `DecimalField(14, 2)`; contenido de presentación `DecimalField(18, 6)` mayor que cero. La API no redondea: rechaza el exceso de escala.
- Sin columnas de stock, costos, saldos, bodega ni proveedor único de producto.

### Tablas de `catalog`
| Tabla | Datos y restricciones |
|---|---|
| `catalog_productcategory` | `name`, `description`; nombre único normalizado; categorías planas. |
| `catalog_measurementunit` | `name`, `symbol` opcional; nombre único normalizado. |
| `catalog_productbrand` | `name`; único normalizado; independiente de las marcas de vehículo. |
| `catalog_product` | `code` (código interno) único (`Upper(Trim)`; el servicio exige hasta 25 caracteres al crear o cambiarlo, pero la columna admite 64 para conservar los códigos anteriores más largos, que se localizan con el filtro `code_over_limit`), `manufacturer_code` opcional (`''` si falta; migración `catalog/0002_product_manufacturer_code.py`; único por marca de producto con `Upper(Trim)` cuando no está vacío y, para productos sin marca, único entre ellos; restricciones `product_mfr_code_brand_unique` y `product_mfr_code_nobrand_unique`), `name`, `description`, `category`, `unit`, `product_brand` opcional, `content_quantity`, `sale_price`, `is_kit`, `tax_definition` (ámbito COMERCIAL validado en el servicio). Índices por estado/nombre y categoría/estado. |
| `catalog_productcompatibility` | Par único producto–marca de vehículo; informativa, sin modelo/año. |
| `catalog_service` | `code` único de hasta 25 caracteres (`SRV-` y un correlativo de al menos seis dígitos, asignado por el servicio y nunca editado; migraciones `catalog/0003` a `0005`: columna anulable, relleno en orden de creación y paso a obligatoria y única), `name` (repetible), `description`, `reference_price`, `tax_definition` (ámbito ARTESANAL validado en el servicio). |
| `catalog_servicecodecounter` | Fila única (`id = 1`) con `last_number`; se bloquea en la transacción del alta del servicio y devuelve el número si el alta se revierte. Los códigos no se reutilizan aunque el servicio se desactive. |
| `catalog_catalogcommand` | Recibo idempotente: actor, acción, clave, huella SHA-256, estado HTTP y resultado; único por actor/acción/clave. Interno, no expuesto. |

### Tablas de `supplier_registry`
| Tabla | Datos y restricciones |
|---|---|
| `supplier_registry_supplier` | `name`; `identification_type`/`identification` ambos `NULL` o ambos informados (CI de 10, RUC de 13 caracteres); unicidad parcial del par incluso inactivo; `phone`, `email`, `address` opcionales (cadena vacía). Varios proveedores sin identificación pueden coexistir. |
| `supplier_registry_suppliercommand` | Recibo idempotente propio; contiene respuestas con contacto, por lo que no se expone ni se copia a auditoría o registros. |

### Integridad y concurrencia
- Orden de bloqueos en comandos de producto: recibo, categorías, unidades, marcas de producto, marcas de vehículo (mediante `customer_registry.application.catalog_references`), producto. La baja de categoría bloquea su fila y rechaza si existen productos activos.
- Las consultas fiscales de solo lectura provienen de `workshop_configuration.application.catalog_options`; no crean `ConfigurationUse` ni numeración.
- Auditoría por servicio (`catalog.*`, `suppliers.*`) con solo nombres de campos cambiados.

### Carga inicial y operación
- Las tablas nacen vacías; ninguna migración inserta datos. Auxiliares y proveedores pueden cargarse sin configuración fiscal; productos y servicios exigen antes una definición de impuesto del ámbito correspondiente (comercial para productos, artesanal para servicios).
- Antes de desplegar: respaldo probado, backend y `make migrate`, comprobaciones y luego frontend. La ampliación es aditiva; ante problemas con registros reales se prefiere la corrección hacia adelante en lugar de deshacer migraciones o restaurar sin autorización.
- La retención de los recibos idempotentes (`catalog_catalogcommand`, `supplier_registry_suppliercommand`) no tiene purga automática en V1; su política operativa sigue pendiente.

## Módulos: inventory y purchasing

Cambio OpenSpec `gestionar-compras-entradas-inventario-kardex`. Concreta la persistencia de su `design.md` §2–§3; el **modelo de dominio** sigue siendo la fuente conceptual. Las tablas nacen vacías y ninguna migración inserta datos. Las claves foráneas entre módulos se declaran por nombre con `PROTECT` y `related_name='+'`; `inventory` nunca referencia `purchasing`. Migraciones: `inventory/0001_initial`, `0002_history_protection`, `0003_manual_operations`; `purchasing/0001_initial`, `0002_history_protection`. Dependencias reales: `catalog.0002_product_manufacturer_code`, `supplier_registry.0001_initial`, `workshop_configuration.0005_alter_configurationcommand_options_and_more` y el usuario intercambiable.

### Tablas de `inventory`
| Tabla | Datos y restricciones |
|---|---|
| `inventory_inventoryposition` | Producto y bodega (`PROTECT`); `quantity numeric(18,6)` entera y no negativa, `value numeric(38,6)` y `average numeric(24,6)` no negativos, `version`, `last_ordinal`, `last_effective_at`. Único `(product, warehouse)`; cantidad cero implica valor y promedio cero. Es proyección conciliable, no origen independiente de stock. |
| `inventory_inventoryoperation` | `kind` (`PURCHASE_RECEIPT`, `INITIAL_LOAD`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `REVERSAL`), `state` (`PREPARED`, `POSTED`, `REVERSED`), origen `(source_type, source_id)` único cuando `source_id` existe, motivo, observación, `external_reference`, `corrects_operation` opcional, actor, `fingerprint`, `version`, `reverses` único opcional. `REVERSAL` exige `reverses`; una compensación nunca pasa a `REVERSED`. |
| `inventory_inventoryoperationline` | Operación, `position`, producto, `quantity` entera positiva, `entry_value` opcional y `source_line_id`. Únicos `(operation, position)` y `(operation, product)`. |
| `inventory_inventorymovement` | Hecho inmutable: operación, posición, producto, bodega, `ordinal`, `movement_type`, `effective_at`, `quantity_in`/`quantity_out` (exactamente una positiva y entera), `value_delta`, `applied_unit_cost`, `rounding_adjustment`, cantidades/valores/promedios anterior y posterior, `product_snapshot` JSON con `schema_version`, actor y `reverses_movement` único opcional. Únicos `(position, ordinal)` y `(operation, product)`; índice único parcial que impide una segunda carga inicial por producto y bodega incluso tras compensarla. |
| `inventory_inventorycommand` | Recibo idempotente propio (actor, acción, clave 8–128 ASCII, huella SHA-256, estado y resultado); único por actor/acción/clave. Interno y no expuesto. |

Índices: movimientos `(product, effective_at, ordinal)`, `(product, movement_type, ordinal)`, `(actor, effective_at, id)` y por operación; operaciones `(kind, state, created_at, id)`.

### Tablas de `purchasing`
| Tabla | Datos y restricciones |
|---|---|
| `purchasing_purchasedocumentidentity` | Proveedor, `document_type` (`FACTURA`, `NOTA_DE_VENTA`, `OTRO`, `SIN_DOCUMENTO`), `reference` y `normalized_reference` (`strip().upper()`, conserva ceros y puntuación). Único `(supplier, document_type, normalized_reference)` salvo `SIN_DOCUMENTO`, que exige referencia vacía. |
| `purchasing_purchase` | Identidad externa, `document_date`, observación, explicación sin documento, `state` (`DRAFT`, `CONFIRMED`, `VOIDED`), `version`, `replaces` opcional, totales `numeric(38,2)` nulos mientras no sean calculables, snapshots de proveedor y fiscal, `internal_number` único, asignación de numeración, operaciones de inventario (confirmación y anulación), huellas de confirmación y revisión aplicada y metadatos de anulación. Únicos parciales: una sola compra raíz por identidad y una sola `CONFIRMED` por identidad. Un borrador no tiene número; confirmada o anulada sí. |
| `purchasing_purchaseline` | Compra, `position` única por compra, producto, `quantity` entera positiva, `unit_cost numeric(24,6)` no negativo, definición tributaria, `tax_treatment` (`RECOVERABLE`/`NON_RECOVERABLE`) y, al confirmar, snapshots de producto e impuesto, base, impuesto, total y valor inventariable. Varias líneas del mismo producto son válidas. |
| `purchasing_purchasecommand` | Recibo idempotente propio, con el mismo contrato que el de inventario. |

Índices de compras: `(state, document_date, id)`, `(document_identity, id)`, `(document_date, id)` y líneas `(product, purchase)`.

### Cambio `simplificar-entradas-de-stock-por-vendedor` (migraciones `inventory/0006`, `purchasing/0003`, `sales/0006`)
Persistencia aditiva de la entrada de stock (DP-030) y del costo ausente (ADR-0011). No se reescribe historia y los triggers no cambian.
- `purchasing_purchase`: `flow` (`LEGACY` por omisión, `SIMPLE`), `supplier` opcional, `external_reference` de texto libre sin unicidad, `content_signature` (huella de productos y cantidades), `confirmed_on` (día local de confirmación). `document_identity` y `document_date` admiten nulo. Restricciones: `LEGACY` exige identidad y fecha; `SIMPLE` las prohíbe y no admite reemplazo; una entrada confirmada exige `confirmed_on` y huella. Índice parcial `(content_signature, confirmed_on)` para `SIMPLE`. La entrada se inserta como borrador solo dentro de la transacción de registro y nunca persiste en ese estado.
- `purchasing_purchaseline`: `unit_cost`, `tax_definition` y `tax_treatment` admiten nulo (nulo en el costo = sin costo registrado; cero es un costo conocido). Definición y tratamiento tributario van juntos o ausentes.
- `inventory_inventoryposition.valued` (verdadero por omisión): falso solo con existencia positiva y valor y promedio cero.
- `inventory_inventorymovement`: `cost_known`, `valued_before`, `valued_after` y `regularization_value >= 0` (verdadero, verdadero, verdadero y cero por omisión).
- `sales_salecostallocation.cost_known` (verdadero por omisión).

### Historia inmutable (triggers PostgreSQL)
- `inventory_movement_immutable`: rechaza `UPDATE` y `DELETE` de movimientos.
- `inventory_line_guard`: solo admite cambios en líneas mientras su operación está `PREPARED`.
- `inventory_operation_guard`: una operación contabilizada solo transiciona `POSTED → REVERSED` sin alterar su contenido; `REVERSED` es final; solo una operación `PREPARED` puede eliminarse.
- `purchasing_line_guard` y `purchasing_purchase_guard`: congelan líneas y contenido económico tras confirmar; una compra confirmada solo admite los metadatos de anulación y `VOIDED` es final.
Son reversibles y no se desactivan en operación normal. No impiden que un administrador de base altere deliberadamente el esquema; sí evitan la sobrescritura accidental desde ORM, SQL de aplicación o Admin.

### Precisión y valoración
- Cantidades: presentaciones enteras hasta 999999999999. Costo de captura hasta 999999999999.999999. Cálculo puro con `Decimal` y contexto local de precisión 60.
- Promedio ponderado: `Q6(V'/Q')` HALF_UP; el residuo entre `V` y `Q×A` permanece en `V` hasta que la salida que agota la existencia lo absorbe. La reversión restituye el estado previo conservado en el movimiento original.

### Orden de bloqueo y concurrencia
Recibo, identidad y compras, operación original, proveedor, referencias de catálogo por ID, posiciones por producto, contexto de configuración (entidad, bodega, definiciones por ID, vigencias) y, al final, inserciones. Las posiciones se crean bajo el bloqueo del producto; las consultas nunca las crean. Los errores de deadlock, serialización y tiempo de bloqueo se traducen a `concurrent_operation` solo tras el rollback completo.

### Carga inicial y operación
- Las tablas nacen vacías. Una ficha sin movimientos proyecta cero real sin migración masiva ni posición.
- Si aparecieran tablas o saldos previos ajenos a este esquema (por ejemplo, restos de una implementación anterior de `purchasing`), detener la incorporación, inventariar el contenido y reconciliarlo con el Administrador; no importarlo automáticamente ni duplicarlo mediante carga inicial. Procedimiento: respaldo probado; `manage.py showmigrations purchasing inventory`; inventariar tablas `purchasing_*`/`inventory_*` inesperadas; decidir su destino de forma explícita; solo entonces aplicar `make migrate`.
- Conciliación de solo lectura: `manage.py reconcile_inventory` reconstruye cantidad y valor desde los movimientos, verifica la cadena anterior/posterior, ordinales, promedio y posición, y devuelve código distinto de cero si encuentra diferencias. No ofrece `--fix`.
- Los recibos idempotentes no tienen purga automática en V1.

## Módulo: sales (ventas comerciales, cobros y correcciones)

Modelo implementado por el cambio `gestionar-ventas-pagos-credito-simple` (migraciones `sales.0001`…`0004` e `inventory.0004`). Pertenece únicamente al RUC comercial. Las FK hacia cliente, catálogo, inventario, configuración e identidad usan `PROTECT` y `related_name="+"`; inventario nunca referencia ventas. **No se almacena** saldo, exceso ni estado de pago: se derivan de los hechos registrados.

### Tablas de `sales`
| Tabla | Datos y restricciones |
|---|---|
| `sales_sale` | Cliente, entidad fiscal y bodega, `condition` (`CONTADO`/`CREDITO`), notas, `state` (`DRAFT`, `CONFIRMED`, `VOIDED`), `version`, fecha operativa, totales `numeric(24,2)` (base, impuesto, total), snapshots de cliente y fiscal, `internal_number` único (nulo solo en borrador), asignación de numeración, operaciones de inventario de la salida y de la reversión, huellas de confirmación y revisión aplicada y metadatos de anulación. Checks: estado y condición válidos, versión ≥ 1, número acorde al estado, importes no negativos y fecha obligatorios al confirmar, snapshots con `schema_version`. |
| `sales_saleline` | Venta, `position` única por venta, producto, `quantity` entera positiva y, al confirmar, definición tributaria, snapshots de producto e impuesto, precio final, tarifa, base, impuesto y total (todos o ninguno, no negativos). Varias líneas del mismo producto son válidas. |
| `sales_salecostallocation` | Línea, movimiento agrupado de inventario (único por par), cantidad entera, costo publicado `numeric(24,6)` y valor realmente aplicado `numeric(38,6)`; suma verificable por movimiento. Inmutable. |
| `sales_commercialpayment`, `sales_paymentpart` | Pago con `operation_id` UUID único, importe positivo `numeric(24,2)`, fecha efectiva del sistema y actor; partes por medio (`EFECTIVO`/`TRANSFERENCIA`), una por medio, positivas. |
| `sales_paymentcorrection` | `operation_id` único, pago original (uno a uno: una corrección por pago), reemplazo opcional (uno a uno), motivo no vacío. El original se conserva íntegro. |
| `sales_commercialwithholding` | Retención recibida (migración `sales/0007`): `operation_id` UUID único (identidad de la acción de cobro, compartida con el pago cuando lo hay), venta, cliente, pago opcional (uno a uno), importe `> 0` `numeric(24,2)`, fecha efectiva del sistema y actor. Comprobante anulable: `voucher_number` (`NNN-NNN-NNNNNNNNN`) y `voucher_date` juntos; desglose opcional `income_tax_amount` y `vat_amount`, ambos o ninguno, no negativos y con suma igual al importe. Anulación en la misma fila (`voided_at`, `voided_by`, `void_reason` no vacío), terminal. Único parcial `(customer, voucher_number)` entre filas vigentes con número. El saldo de la venta descuenta las filas con `voided_at` nulo; nunca se almacena. |
| `sales_commercialwithholdingvoucherchange` | Corrección administrativa de un comprobante ya completado: `operation_id` único, retención, número, fecha y desglose anteriores, motivo no vacío y actor. |
| `sales_salereturn`, `sales_salereturnline` | Devolución con UUID único, motivo, fecha, actor y totales; líneas con cantidades aptas y no aptas enteras no negativas de suma positiva, importes históricos y valor de costo asignado a cada tramo (`numeric(38,6)`). Una línea por devolución. |
| `sales_commercialrefund`, `sales_refundpart` | Desembolso efectivo con UUID único, origen `RETURN` (con devolución) o `VOID` (sin ella), motivo, importe y partes por medio. |
| `sales_salevoid` | Una anulación por venta (uno a uno), motivo, actor, operación de reversión y reembolso opcional. |
| `sales_salescommand` | Recibo idempotente `(actor, action, idempotency_key)` único con formato 8…128 caracteres, huella canónica e identidad del resultado (tipo e ID); sin purga automática. |

Índices: ventas por `(customer, created_at, id)` y `(state, created_at, id)`, líneas por `(product, sale)`, y pagos, devoluciones y reembolsos por `(sale, effective_at, id)`; asignaciones por movimiento.

### Historia inmutable de `sales` (triggers PostgreSQL, `sales.0002`)
- `sales_<tabla>_immutable`: rechaza `UPDATE` y `DELETE` de pagos, partes, correcciones, asignaciones de costo, devoluciones, líneas de devolución, reembolsos, partes de reembolso y anulaciones.
- `sales_line_guard`: solo admite cambios en líneas mientras la venta es `DRAFT`.
- `sales_sale_guard`: una venta confirmada solo puede aumentar `version`/`updated_at` o pasar a `VOIDED` alterando únicamente los metadatos de anulación; `VOIDED` es final; solo un borrador puede eliminarse.
- Triggers de restricción **diferidos**: la suma de partes debe igualar el importe de cada pago y reembolso, y correcciones, reembolsos y líneas de devolución deben vincular hechos de la misma venta.
Son reversibles y no se desactivan en operación normal.

### Extensión de `inventory` (`inventory.0004`)
`OperationKind` incorpora `SALE_OUT` (salida) y `CUSTOMER_RETURN_IN` (entrada); ambos se admiten en los checks de operación y movimiento. La devolución referencia la salida original mediante `corrects_operation` y su origen (`source_type = SALE_RETURN`); no usa `reverses`/`reverses_movement`. La anulación reutiliza la reversión exacta existente. `operations.py` sigue aceptando solo carga inicial y ajustes manuales.

### Precisión y cálculo
Importes de venta y pago `numeric(24,2)`; cálculo puro con `Decimal` (precisión 60) y HALF_UP: total = cantidad × precio final; base = HALF_UP(total / (1 + tarifa/100), 2); impuesto = total − base; el documento suma líneas ya redondeadas. Devoluciones: base acumulada proporcional a la base histórica, impuesto por diferencia; costo por proporción acumulada a seis decimales con el residuo en el último tramo.

### Orden de bloqueo y concurrencia
Recibo del comando, venta (raíz de consistencia) y hechos comerciales, operación original de inventario, cliente, productos por ID ascendente, posiciones, entidad/bodega/definiciones tributarias y ámbito de numeración, e inserciones finales. Un pago o corrección bloquea siempre la venta antes que el pago. Los deadlocks se traducen a `concurrent_operation` solo tras el rollback completo.

### Conciliación y procedimiento de reversión
- `manage.py reconcile_sales` (solo lectura, sin `--fix`) verifica número y configuración, movimientos frente a asignaciones de costo, cantidades devueltas, E/P/R, partes, reembolsos y ausencia de pagos huérfanos; termina con código distinto de cero ante diferencias.
- Las tablas nacen vacías: no se siembran ventas, pagos, saldos iniciales ni movimientos comerciales, y ninguna numeración previa se renumera.
- **Reversión.** Antes del primer uso: retirar las rutas y revertir `sales` a `zero` y `inventory` a `0003` solo con las tablas nuevas vacías y sin operaciones `SALE_OUT`/`CUSTOMER_RETURN_IN`. Después de registrar ventas: no revertir destructivamente; detener nuevas escrituras comerciales, conservar esquema e historia, corregir hacia adelante o restaurar un respaldo completo con conciliación del dinero recibido desde ese respaldo. Una versión anterior de inventario no debe operar sobre tipos que desconoce.

## Módulo: workshop (órdenes de mantenimiento)

Modelo implementado por el cambio `gestionar-ordenes-mantenimiento` (migraciones `workshop.0001` y `workshop.0002`, esta última siembra el contador). Pertenece únicamente al RUC artesanal. Las FK hacia cliente, vehículo, servicio, entidad fiscal, definición tributaria e identidad usan `PROTECT` y `related_name="+"`; ningún módulo ajeno referencia `workshop`. **No se almacenan** subtotales ni totales: se calculan desde las líneas. No se crean ventas, pagos, deuda, documentos internos, reservas ni movimientos de inventario.

### Tablas de `workshop`
| Tabla | Datos y restricciones |
|---|---|
| `workshop_maintenancecounter` | Fila única (`id = 1`) con `last_number`; se bloquea en la transacción de creación para asignar `ART-OT-NNNNNN` sin huecos por rollback. Independiente de las series fiscales. |
| `workshop_maintenanceorder` | `sequence` y `number` únicos (`^ART-OT-[0-9]{6,}$`), entidad fiscal, cliente, vehículo, snapshots JSON de cliente (nombre, tipo e identificación) y vehículo (placa, marca, modelo) con `schema_version`, `opened_on`, `odometer_km` entero 0…9 999 999 con confirmación opcional (usuario y fecha), diagnóstico, observaciones, `state` (`REGISTERED`, `FINALIZED`, `REOPENED`), `version`, creador/actualizador y fechas, última finalización. **Índice único parcial** `(vehicle)` con estado abierto: una sola orden abierta por vehículo. Índices por fecha de apertura, cliente, vehículo y estado. |
| `workshop_intervention` | Orden, `kind` (`INITIAL`, `CORRECTIVE`), `ordinal` único por orden, causa (obligatoria en correctivas), trabajo realizado, observaciones, apertura y cierre. Únicos parciales: una inicial por orden y una sola abierta (`closed_at IS NULL`). |
| `workshop_serviceline` | Intervención, servicio, copia del código del servicio (`service_code`, hasta 25 caracteres, vacío solo en historia sin dato; migración `workshop/0005`), copia del nombre, `reference_price` y `applied_price` `numeric(14,2)` no negativos, `quantity` entera 1…9999, definición tributaria y su nombre copiado, posición y auditoría. Las líneas correctivas llevan precio aplicado 0,00 (regla de aplicación). |
| `workshop_orderphoto` | Orden, intervención, nombres privados únicos de original y miniatura (UUID), tipo (`image/jpeg`, `image/png`, `image/webp`), tamaño, dimensiones, SHA-256, descripción ≤ 200, carga y retiro (usuario y fecha). El retiro conserva el registro y elimina los archivos. |
| `workshop_statetransition` | Transición inmutable con pares permitidos `REGISTERED→FINALIZED`, `REOPENED→FINALIZED`, `FINALIZED→REOPENED`, intervención, causa (reapertura), actor y fecha. |
| `workshop_workshopcommand` | Recibo idempotente `(actor, action, idempotency_key)` único con formato 8…128 caracteres, huella e identidad del resultado; sin purga automática. |

### Orden de bloqueo y concurrencia
Recibo del comando → orden → cliente → vehículo → período de propiedad vigente (mismo orden que la transferencia de propiedad) → servicio → contador. Toda modificación de datos, líneas, intervención o estado exige `expected_version` e incrementa `version`; las fotografías respetan el estado bloqueado pero no cambian la versión. El índice único parcial respalda la regla de una orden abierta por vehículo frente a carreras.

### Archivos privados
Las fotografías viven fuera de la base, en `PRIVATE_MEDIA_ROOT/maintenance/<orden>/` (ADR-0007). Un registro solo existe con sus archivos completos; `manage.py purge_workshop_files` elimina de forma idempotente los archivos sin registro vigente más antiguos que el margen indicado. El volumen debe respaldarse junto con PostgreSQL.

### Reversión
Antes del primer uso: retirar las rutas y revertir `workshop` a `zero` con las tablas vacías. Después de registrar órdenes: no revertir destructivamente; conservar esquema, historia y archivos, y corregir hacia adelante.

## Integración: reservas, ventas vinculadas, operación artesanal y cobros por RUC

Cambio OpenSpec `integrar-mantenimiento-ventas-cobros-por-ruc` (ADR-0008 y ADR-0009). Migraciones aditivas: `inventory.0005`, `sales.0005` (depende de `workshop.0002`), `workshop.0003` y `workshop.0004`. La única escritura de datos es `workshop.0004`, que marca `predates_billing = true` en las órdenes existentes. Ninguna migración crea ventas, operaciones, deudas, cobros, reservas ni movimientos.

### Reservas en `inventory`
| Tabla o campo | Datos y restricciones |
|---|---|
| `inventory_inventoryposition.reserved` | `numeric(18,6)` entero; check `0 ≤ reserved ≤ quantity`. Garantiza en la base que ninguna salida, reversión o ajuste deje la disponibilidad negativa. |
| `inventory_inventoryreservation` | Posición, producto y bodega (`PROTECT`), `source_type` (`SALE_LINE`), `source_id` (línea de venta vinculada), `source_reference` JSON (venta, orden y número de la orden, para mostrar el origen sin que inventario lea ventas), `quantity` entera, `state` (`ACTIVE`, `RELEASED`, `CONSUMED`), `consumed_by` (operación de inventario) y marcas de tiempo. Índice único parcial `(source_type, source_id)` con `state = ACTIVE`. `reserved` debe igualar la suma de las reservas activas (`reconcile_inventory`). |

### Origen en `sales`
`sales_sale` añade `origin_type` (`DIRECT` por defecto en todas las filas existentes, o `MAINTENANCE`), `origin_order` (FK `workshop_maintenanceorder`, `PROTECT`, sin relación inversa) y `origin_reference` (número ART-OT copiado). Checks: `MAINTENANCE ⇔ origin_order` presente. **Índice único parcial** `(origin_order)` con `state = DRAFT`: una sola venta abierta por orden. `reconcile_sales` comprueba que las reservas activas correspondan 1:1 a las líneas de las ventas vinculadas abiertas.

### Operación artesanal y pagos en `workshop`
| Tabla | Datos y restricciones |
|---|---|
| `workshop_maintenanceorder.predates_billing` | Booleano; solo activa una advertencia al documentar servicios de órdenes anteriores. |
| `workshop_serviceoperation` | Orden, entidad fiscal y cliente (`PROTECT`), snapshots de cliente, vehículo y emisor, asignación de número, `internal_number` único (serie ART-SER), `condition` (`CONTADO`, `CREDITO`), `operational_date`, `base_total`, `tax_total` y `grand_total` con `grand_total = base + tax > 0`, `state` (`CONFIRMED`, `VOIDED`), `replaces` (cadena de reemplazo), huella revisada, anulación (motivo, usuario, fecha; coherente con el estado), `version` y auditoría. |
| `workshop_serviceoperationline` | Operación, `service_line` (`SET_NULL` para conservar la copia si la línea se retira tras una anulación), posición, servicio, copia del código del servicio (`service_code`; vacío si el servicio ya no existía al migrar), nombre, cantidad, precios referencial y aplicado, definición tributaria, snapshot tributario, tarifa, base, impuesto y total (`total = base + impuesto`), `is_current`. **Índice único parcial** `(service_line)` con `is_current`: una línea no se documenta dos veces mientras su operación esté vigente. |
| `workshop_artisanpayment` | `operation_id` UUID único (identidad del hecho), operación, importe `> 0`, fecha efectiva, usuario. |
| `workshop_artisanpaymentpart` | Pago, medio (`EFECTIVO`, `TRANSFERENCIA`) y importe `> 0`; único `(payment, method)`. |
| `workshop_artisanpaymentcorrection` | `operation_id` UUID único, operación, pago original (único), reemplazo opcional (único) y motivo obligatorio. El saldo se deriva: exigible vigente menos pagos sin corrección y menos retenciones vigentes; nunca se almacena. |
| `workshop_artisanwithholding` | Retención recibida del RUC artesanal (migración `workshop/0006`), con la misma forma y restricciones que `sales_commercialwithholding`, referida a la operación artesanal. |
| `workshop_artisanwithholdingvoucherchange` | Corrección administrativa del comprobante de una retención artesanal, con la misma forma que la comercial. |

### Orden de bloqueo global
Recibo → orden de mantenimiento → operación artesanal / líneas de servicio → venta → cliente/vehículo → productos → posiciones (por producto) → configuración → numeración → inserciones. Cada acción toma una subsecuencia ordenada; los cobros artesanales bloquean solo la operación.

### Reversión
Antes de usar la integración: retirar las líneas de las ventas vinculadas abiertas (libera las reservas) y revertir las migraciones con tablas vacías. Con operaciones, ventas vinculadas o cobros ya registrados, no revertir destructivamente: corregir hacia adelante con respaldo previo (DA-003).
