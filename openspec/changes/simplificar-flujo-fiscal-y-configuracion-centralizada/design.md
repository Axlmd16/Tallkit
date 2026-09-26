## Context

Diseño de `simplificar-flujo-fiscal-y-configuracion-centralizada`, sujeto a aprobación antes de crear tareas. Sus dependencias normativas son la propuesta aprobada con modificaciones y las cinco specs delta, registradas en `master` (`d80ca93`). No autoriza implementación, emisión ni conexión externa.

### Fuentes consultadas

- Documentación y decisiones:
  - `AGENTS.md`, `openspec/config.yaml`, decisiones confirmadas (DP-001/003/006/018/019/025/027/029, CT-001) y modelo de dominio §11.6.
  - ADR-0004 (contrato transaccional de configuración) y ADR-0010 (módulo fiscal independiente).
  - Diseño archivado D1–D14 de `establecer-modulo-fiscal-independiente`.
- Backend:
  - `fiscal/application/preparations.py`, `snapshot_builder.py` e `identity.py`.
  - `fiscal/domain/payment_declaration.py` y `snapshot.py`.
  - `fiscal/api/urls.py`.
  - `workshop_configuration/models.py`, `application/fiscal_resolver.py`, `fiscal_tax_mapping.py`, `electronic_profiles.py` y `emission_locations.py`.
  - `sales/application/fiscal_source.py`, `payments.py` y el modelo `CommercialPayment`/`PaymentPart`/`PaymentCorrection`.
  - `workshop/application/fiscal_source.py`, `artisan_payments.py` y `ArtisanPayment`.
- Frontend:
  - `pages/fiscal/FiscalPreparationPage.tsx`, `features/fiscal/FiscalConfigurationSection.tsx`, `hooks.ts` y `types.ts`.
  - `pages/workshop-configuration/WorkshopConfigurationPage.tsx` y `shared/ui/navigation/Tabs.tsx`.
  - `pages/maintenance/MaintenanceOrderDetailPage.tsx`, que usa `?tab=`.

### Estado observado que condiciona el diseño

- **Borrador vacío.** `create_draft` crea el borrador sin datos. `update_draft` recibe del cliente `point_id`, `environment`, `reference_date`, `receiver` y `payments`.
- **Resolución fuera de configuración.** `resolve_fiscal_configuration` recibe `point_id` y `environment` como parámetros. Con `environment == "2"` solo lo marca como impedimento, no lo rechaza.
- **Catálogos fijos en el código:**
  - IVA en `IVA_CODES`, con versión `SRI-2.34-IVA-subset-v1` y tarifas incluidas en el código, por ejemplo `"4": 15`;
  - formas de pago en `SUPPORTED_PAYMENT_CODES = {"01", "20"}`.
- **Crédito bloqueado.** `validate_payment_declaration` marca como pendiente todo crédito sin plazo, y el snapshot lo convierte en impedimento.
- **Snapshot incompleto.** Conserva códigos de emisor, punto y versión de catálogo IVA, pero no la revisión del perfil, las versiones del punto o del establecimiento, ni las versiones de formas de pago.
- **Interfaz de configuración:**
  - el diálogo del perfil reenvía las condiciones sin permitir editarlas;
  - las correspondencias vigentes no se listan;
  - el código de tarifa se escribe a mano.
- **Pestañas.** `Tabs` solo renderiza el panel activo. Un error guardado en el estado de una mutación se pierde al cambiar de pestaña.
- **Cobros.** Existen `CommercialPayment` y `ArtisanPayment` con partes por medio (EFECTIVO/TRANSFERENCIA) y correcciones que anulan un pago original. `fiscal_source` no expone cobros.

### Discrepancia con la propuesta

La sección Impact de la propuesta dice que no se tocan `sales` ni `workshop`. Sin embargo, la spec aprobada exige sugerir formas de pago desde los cobros registrados. Para cumplirla sin romper fronteras, se amplían **solo** los servicios públicos de lectura `sales/application/fiscal_source.py` y `workshop/application/fiscal_source.py` con los importes cobrados por medio. No cambian modelos, escrituras, cobros ni reglas de esos módulos. Se corregirá la frase de Impact al actualizar la documentación del cambio.

## Goals / Non-Goals

**Goals:**
- La configuración fiscal centralizada por entidad resuelve todos los datos técnicos: punto predeterminado, ambiente de pruebas, catálogos oficiales como datos versionados con fuente, formas de pago habilitadas con una predeterminada, y estado del perfil explicado.
- La preparación precarga receptor, líneas y formas sugeridas, pide solo lo faltante y congela las referencias de configuración.
- La página de configuración queda organizada en pestañas sin cambiar las cuatro áreas existentes.

**Non-Goals:**
- Emisión, firma, transmisión o producción.
- Capturar plazo.
- Nuevos medios de cobro o roles.
- Cambios en modelos, escrituras o reglas de ventas, taller, entidades, bodega, impuestos internos o series.
- Migrar o reescribir preparaciones completadas.
- Rediseñar el archivo XML, las correcciones o la identidad de ensayo.

## Decisions

### D1. Propiedad de módulos

La frontera de ADR-0010 se conserva: configuración administra y resuelve, `fiscal` prepara y congela, y ventas y taller solo exponen lecturas públicas.

- **`workshop_configuration`**, propietario de la configuración centralizada:
  - catálogos oficiales;
  - habilitación de formas de pago;
  - valores predeterminados de preparación (punto y forma de pago);
  - evaluación del estado del perfil;
  - rechazo de producción.
- **`fiscal`**, propietario de:
  - la preparación;
  - la precarga;
  - la sugerencia de formas;
  - la revisión;
  - la instantánea.

  Consume la configuración solo mediante servicios públicos que devuelven valores inmutables (ADR-0004).
- **`sales` y `workshop`**: cada `fiscal_source` añade `collected_by_method`, un mapeo inmutable `{EFECTIVO|TRANSFERENCIA: Decimal}` con la suma de partes de pagos vigentes. Un pago es vigente si no fue anulado como original por una corrección; su reemplazo sí cuenta. No se escriben datos ni se importan modelos de `fiscal`.

### D2. Catálogos oficiales como datos versionados

Nuevo modelo `OfficialCatalogEntry` en `workshop_configuration`:

| Campo | Uso |
|---|---|
| `kind` | `TAX_RATE` o `PAYMENT_FORM` |
| `catalog_version` | Identificador interno de la versión incorporada |
| `code` | Código oficial como texto (`"4"`, `"01"`) |
| `description` | Descripción oficial tal como figura en la ficha |
| `display_name` | Nombre comprensible («IVA 15 %», «Efectivo»), redactado al incorporar |
| `tax_code`, `rate`, `treatment` | Solo `TAX_RATE`: impuesto `2`, tarifa decimal y ZERO, RATE, NOT_SUBJECT o EXEMPT |
| `source_document`, `source_version` | Ficha técnica del SRI y su versión exacta |
| `source_url`, `downloaded_on`, `source_file_sha256` | Procedencia verificable del archivo o manifiesto |
| `valid_from`, `valid_to` | Vigencia oficial |
| `is_active`, `incorporated_at` | Estado e incorporación al sistema |

Restricciones:
- unicidad `(kind, catalog_version, code)`;
- campos de procedencia no vacíos;
- `valid_to >= valid_from`;
- `rate` obligatorio solo en `TAX_RATE`.

Las entradas son inmutables mediante servicios: una corrección se registra como una nueva versión o se desactiva.

**Incorporación.** Un manifiesto versionado en el repositorio, `workshop_configuration/catalogs/sri-<version>.json`, contiene las entradas y su procedencia. Una migración de datos lo carga y comprueba el SHA-256 declarado. Si faltan campos de procedencia, falla sin cargar parcialmente. El manifiesto se construye desde la ficha técnica vigente descargada del SRI durante la implementación. Si la ficha difiere de la tabla de la spec, prevalece la ficha y la diferencia se registra en el manifiesto y en `cobertura-modulo-fiscal.md`.

**Vigencias no publicadas.** Si la ficha no publica la vigencia de una entrada, como ocurre con la Tabla 17 en la versión 2.34, `valid_from` queda vacío y `validity_note` lo explica. No se infieren fechas. Una entrada sin vigencia publicada se considera vigente mientras esté activa.

**Compatibilidad.** Las correspondencias existentes usan `catalog_version = "SRI-2.34-IVA-subset-v1"`. El manifiesto incorpora también esa versión, con su procedencia original (ficha 2.34), para que sigan siendo resolubles. `FiscalTaxMapping` recibe un FK nullable `catalog_entry`, que la migración rellena por `(catalog_version, percentage_code)`. Las nuevas correspondencias exigen `catalog_entry`, y `percentage_code` y `catalog_version` se derivan de la entrada. `resolve_mapping` consulta la entrada en lugar de `IVA_CODES`, y ambas constantes se eliminan.

**Alternativa descartada:** seguir con constantes en el código, porque contradice la decisión de catálogos versionados y obligaría a desplegar código para una actualización normativa.

### D3. Formas de pago habilitadas y valores predeterminados de preparación

- **`FiscalPaymentFormSetting(fiscal_entity, catalog_entry, enabled, version, updated_by, updated_at)`**:
  - registra solo las decisiones explícitas del Administrador;
  - es única por entidad y código dentro de la versión del catálogo.
- **`FiscalPreparationDefaults(fiscal_entity 1:1, default_point nullable, default_payment_code nullable, version, updated_by, updated_at)`**: guarda el punto y la forma de pago predeterminados.

La política V1 es una regla de dominio, no un catálogo (DP-003, RF-ACC-014): `V1_ENABLEABLE_PAYMENT_FORMS = {"01": EFECTIVO, "20": TRANSFERENCIA}`, que también fija la asociación con los medios internos.

- **Sin registro, aplica la política:** `01` y `20` quedan habilitadas y `01` es la predeterminada. Así las entidades existentes y futuras funcionan sin tocar la inicialización ni `FiscalEntity`.
- **Habilitar otro código** se rechaza con el error `payment_form_not_enableable_v1`.
- **Deshabilitar la forma predeterminada** exige designar antes otra habilitada.

**Punto efectivo:**
1. Si hay un punto designado, activo, con establecimiento activo y de la misma entidad, se usa ese.
2. Si no, y existe exactamente un punto activo en establecimiento activo, se usa ese.
3. Si no, se produce el impedimento `default_point_required`, dirigido al Administrador.

Designar un punto de otra entidad se rechaza. Deshabilitar el punto designado no borra la designación, pero la vuelve inutilizable hasta cambiarla.

**Alternativa descartada:** añadir un campo `is_default` en `FiscalEmissionPoint`, porque exige desnormalizar la entidad para garantizar un único predeterminado por RUC, y un modelo propio no toca tablas existentes.

### D4. Ambiente único de pruebas

`resolve_fiscal_configuration` deja de recibir `environment` y `point_id`: el ambiente es siempre `ENVIRONMENT_TEST = "1"` y el punto se resuelve según D3. Cualquier entrada de producción se rechaza con `production_disabled` en los servicios de configuración, en la edición del borrador y en la API. La identidad de ensayo sigue leyendo el ambiente desde el snapshot, sin cambios.

### D5. Flujo de preparación y contrato de API

**Creación (`POST /fiscal/preparations/`).** Conserva idempotencia, bloqueos y permisos. Además, escribe el borrador con `draft_format: 2`:
- el receptor, desde `customer_snapshot`: CI→`05`, RUC→`04`, junto con nombre, dirección y correo;
- `payments.forms`, calculado por el servicio de sugerencia;
- `payments.suggested: true`.

**Sugerencia (`fiscal/domain/payment_suggestion.py`, pura).** Recibe el total, `collected_by_method`, las formas habilitadas con su medio asociado y la forma predeterminada:
- si lo cobrado cubre el total, se sugiere el reparto por medio;
- si lo cobrado es menor, se sugiere el reparto más el resto con la forma predeterminada;
- si no hay cobros o lo cobrado supera el total (por reembolsos pendientes), se sugiere la forma predeterminada por el total;
- un medio cuya forma esté deshabilitada se suma al resto.

La sugerencia no registra ni modifica cobros.

**Consulta (`GET …/{id}/`).** Devuelve:
- `summary`: número interno, fecha, condición, líneas con descripción, cantidad y total, y totales;
- `issuer`: razón social y RUC;
- `receiver`, `payments` y `payment_options` (habilitadas, con `display_name` y código secundario);
- `missing_fields`.

No expone campos técnicos editables. Con el snapshot completado, añade `technical` (punto, ambiente y versiones) solo si el actor es Administrador, como información avanzada.

**Edición (`PATCH …/{id}/`, contrato existente).** Solo admite `expected_version`, `receiver`, `payments.forms[{payment_code, amount}]` y `additional_info`. Rechaza con 400 (`field_not_allowed`) `environment`, `point_id`, `reference_date`, `fiscal_entity_id`, `term_days` y `time_unit`, sin modificar el borrador. Es **BREAKING** solo para la interfaz propia, y OpenAPI se actualiza.

**Consulta por operación (`GET /fiscal/preparations/?source_kind=&source_id=`).** Añadida durante la implementación: devuelve la preparación activa (borrador o preparada) de una operación, o ninguna, para que la ficha de la venta o de la operación artesanal muestre «Borrador fiscal» o «Preparación local · Pendiente de emisión» en lugar de ofrecer siempre crear otra. Exige el permiso de consulta del ámbito.

**Revisión (`POST …/review/`):**
- calcula `reference_date` con el calendario de America/Guayaquil y resuelve la configuración vigente;
- valida el receptor y las formas: habilitadas, vigentes y con suma exacta;
- devuelve impedimentos `{field, audience: OPERATOR|ADMINISTRATOR, code, message}` con mensajes comprensibles, generados por un traductor de códigos en `fiscal/application/impediment_messages.py`;
- firma un token con la preparación, la versión, el actor, la fecha y una huella de configuración (revisión de perfil, versión de valores predeterminados, versiones de punto y establecimiento, versiones de catálogos, versiones de los registros de formas y correspondencias usadas).

**Preparar (`POST …/prepare/`).** Revalida bajo bloqueo y recalcula fecha y huella. Si difieren del token, responde 409 `review_stale` y exige revisar de nuevo, sin preparar con una mezcla de versiones.

**Plazo.** `validate_payment_declaration` elimina la rama de crédito pendiente y rechaza `term_days` y `time_unit`. La condición se conserva en el snapshot solo como dato interno.

**Borradores anteriores.** Se resuelven al leer, sin migración de datos:
- las claves antiguas (`point_id`, `environment`, `reference_date`, plazo) se ignoran y nunca llegan al snapshot;
- un borrador sin `receiver` o `payments` recibe en la consulta la precarga calculada, marcada como sugerencia, y queda persistida al guardarlo;
- `draft_format` ausente equivale a 1.

**Alternativa descartada:** una migración que reescriba borradores, porque exigiría calcular sugerencias con datos del momento de migrar y modificar JSON de usuarios sin revisión.

### D6. Instantánea con referencias de configuración

El snapshot añade `snapshot_format: 2` y un bloque `configuration`, conservando intactas las claves actuales de `issuer`, que consume `identity.py`:

```json
{
  "configuration": {
    "entity_version": 4, "profile_revision": 3,
    "defaults_version": 2,
    "establishment": {"id": 1, "code": "001", "version": 1},
    "point": {"id": 2, "code": "001", "version": 1},
    "environment": "1",
    "catalogs": {"TAX_RATE": "…", "PAYMENT_FORM": "…"}
  },
  "payments": {"forms": [{"payment_code": "01", "description": "…", "display_name": "Efectivo",
                           "catalog_version": "…", "amount": "30.00"}]}
}
```

Cada línea añade `catalog_entry_id` y `display_name` a lo que ya conservaba. Los snapshots sin `snapshot_format` se leen como formato 1: la consulta muestra «referencias de configuración no conservadas» y no las completa. `docs/tecnico/matriz-instantanea-fiscal.md` se actualiza con los campos nuevos.

### D7. Estado del perfil con causas

`workshop_configuration/application/electronic_status.py` expone `evaluate_electronic_status(entity_id, on)`. Es la única fuente de las causas: la usan tanto la consulta administrativa como `resolve_fiscal_configuration` para producir `preparation_issues`, así interfaz y preparación nunca discrepan.

| Estado | Regla (en orden) |
|---|---|
| `NOT_CONFIGURED` | Sin `ElectronicProfileRevision` |
| `INCOMPLETE` | Alguna causa de falta: condición desconocida, dirección matriz o de establecimiento vacía, sin punto efectivo (D3), definición tributaria interna vigente hoy sin correspondencia, o sin forma habilitada |
| `NEEDS_REVIEW` | Sin faltas, pero una condición o correspondencia necesaria está fuera de vigencia, aún no iniciada o apunta a una entrada de catálogo inactiva |
| `READY` | Ninguna de las anteriores |

Si hay faltas y también causas de revisión, prevalece `INCOMPLETE` y se listan todas las causas. El certificado produce `warnings` independientes (ausente, futuro o vencido) que no influyen en el estado. La respuesta incluye además `environment: "TEST"` y el punto y la forma predeterminados efectivos. Etiquetas de la interfaz: «Sin configurar», «Falta completar», «Lista para preparación local» y «Requiere revisión».

### D8. API de configuración fiscal

Se añaden bajo el prefijo existente `/api/v1/fiscal/configuration/`, con permiso `parametros.gestionar`:

| Recurso | Acciones |
|---|---|
| `entities/{id}/electronic-status/` | GET estado, causas, advertencias, ambiente y valores predeterminados efectivos |
| `entities/{id}/preparation-defaults/` | GET y PUT `{default_point_id?, default_payment_code?, expected_version}` |
| `catalogs/{kind}/` | GET entradas con procedencia; filtro `version`/`active` |
| `entities/{id}/tax-mappings/` | GET correspondencias vigentes e históricas con `display_name` |
| `tax-mappings/` | POST `{definition_id, catalog_entry_id, starts_on, ends_on?, source}`; se retira `percentage_code` (**BREAKING**, solo consumidor propio) |
| `entities/{id}/payment-forms/` | GET catálogo completo con habilitación efectiva |
| `entities/{id}/payment-forms/{code}/` | PUT `{enabled, expected_version}` |

Los endpoints de entidades, bodega, impuestos internos y series (`/api/v1/workshop-configuration/…`) no cambian. Las escrituras nuevas usan clave de idempotencia y versión esperada, igual que `save_profile`. Los conflictos responden 409 y las validaciones 400. Un Vendedor o un Encargado recibe 403.

**Orden de bloqueos.** Se ajusta a ADR-0004 y a D6 del diseño archivado:
- **Escrituras de configuración:** `FiscalEntity` → registro propio (valores predeterminados, forma o correspondencia) → establecimiento y punto referenciados.
- **Preparar y revisar:** recibo → origen → preparación → `FiscalEntity` → `TaxDefinition` por identificador → valores predeterminados y formas → establecimiento y punto.

Ninguna escritura de configuración llama a `fiscal`.

### D9. Frontend

**Página de configuración:**
- `WorkshopConfigurationPage` sustituye `ConfigurationMap` por `Tabs` con `?tab=` (`entidades`, `bodega`, `impuestos`, `series`, `facturacion`), siguiendo el patrón de `MaintenanceOrderDetailPage`:
  - sin parámetro, o con un valor desconocido, se abre `entidades`;
  - el contador de cada pestaña reemplaza las tarjetas del mapa.
- `EntitiesSection`, `WarehouseSection`, `TaxesSection` y `SeriesSection` se reubican sin cambios internos. Solo cambian el título «Identidades fiscales» → «Entidades fiscales», la descripción del encabezado y «Operación» → «Bodega».

**Componente `Tabs`:**
- añade una prop opcional `keepMounted`: todos los paneles se renderizan y los inactivos llevan el atributo `hidden`, así el estado y los errores sobreviven al cambio de pestaña;
- el valor por defecto conserva el comportamiento actual de mantenimiento;
- la barra de pestañas admite desplazamiento horizontal interno (`overflow-x-auto`, sin encoger texto) y hace `scrollIntoView` de la pestaña activa.

**Pestaña *Facturación electrónica*:**
- Muestra el aviso permanente, un selector de entidad (razón social y RUC) y subpestañas `pill` con `?seccion=` (`perfil`, `puntos`, `impuestos`, `formas-pago`, `certificado`).
- El subárbol de la entidad se monta con `key={entityId}`: al cambiar de entidad se descartan formularios, estados de mutación y errores, y las consultas usan claves por entidad sin datos provisionales de la anterior.
- Los componentes nuevos van en `features/fiscal/configuration/`:
  - `ElectronicStatusCard`, con estado, causas y advertencias;
  - `ProfileConditionsSection`, con formulario de condiciones, ayuda por condición y fuente;
  - `LocationsSection`, con designación del punto predeterminado;
  - `TaxMappingsSection`, con selector del catálogo por `display_name` (dato fijo si hay una sola definición), listado y el código en «Información avanzada»;
  - `PaymentFormsSection`, con tabla del catálogo, interruptor solo en `01`/`20` y la forma predeterminada;
  - `CertificateSection`, con campos opcionales y ayuda.
- `FiscalConfigurationSection` se reemplaza por esta composición.

**`FiscalPreparationPage`** es una página completa (formulario largo):
- el título es «Borrador fiscal» o «Preparación local», con el aviso obligatorio visible siempre;
- el resumen de la operación no es editable;
- el receptor se muestra como resumen, con campos solo para los datos faltantes; la elección de consumidor final es explícita;
- el editor de formas de pago (añadir, quitar, importe) ofrece solo formas habilitadas, marca «Sugerido desde los cobros» o «Sugerido» y muestra la diferencia con el total;
- las acciones son «Revisar datos para facturación» y «Guardar preparación local»;
- los impedimentos se agrupan en «Puede completarlo aquí» y «Debe resolverlo el Administrador»;
- las confirmaciones usan toast.

**Terminología:**
- estados: «Borrador fiscal», «Preparación local · Pendiente de emisión», «Cancelada localmente»;
- `FiscalPreparationLink`, `SaleDetailPage` y `ServiceOperationDetailPage` usan «Preparar datos fiscales»;
- una utilidad de prueba comprueba la ausencia de «factura emitida», «autorizada», «enviad(o|a) al SRI» y «aprobad(o|a)» en las vistas fiscales.

### D10. Datos y migraciones

Migraciones aditivas en `workshop_configuration`:
1. `OfficialCatalogEntry`.
2. Carga del manifiesto (TAX_RATE vigente y legado 2.34, PAYMENT_FORM Tabla 24).
3. `FiscalTaxMapping.catalog_entry` nullable con relleno por `(catalog_version, percentage_code)`. Si alguna fila no encuentra su entrada, la migración falla y la informa, sin inventar correspondencias.
4. `FiscalPaymentFormSetting` y `FiscalPreparationDefaults`, sin filas iniciales, ya que la política cubre la ausencia.

`fiscal` no necesita migración: el borrador es JSON y el snapshot solo añade claves nuevas. No se modifican `FiscalEntity`, `Warehouse`, `TaxDefinition`, `TaxPeriod`, `DocumentSeries`, `NumberAllocation`, preparaciones ni snapshots.

**Reversión:**
- el esquema es reversible;
- el relleno se revierte sin pérdida, porque `percentage_code` y `catalog_version` se conservan;
- la carga del catálogo se revierte solo si ninguna correspondencia la referencia.

### D11. Seguridad y permisos

La matriz de permisos no cambia. Configuración exige `parametros.gestionar`. La preparación exige `fiscal.comercial.preparar` o `fiscal.artesanal.preparar` según la entidad de la operación, nunca según un dato del cliente. Rechazar los campos técnicos en el backend impide que un cliente manipulado elija producción u otro punto. No se añaden secretos: el certificado sigue sin P12, claves ni contraseñas.

### D12. Estrategia de pruebas focalizada

Se sigue TDD y se ejecutan solo las pruebas de esta capacidad y sus regresiones directas, sin `make check`, `make test` ni todo Playwright.

**Backend (`uv run --frozen pytest --no-cov <archivo>`):**
- `tests/workshop_configuration/`:
  - `test_official_catalog.py`: procedencia obligatoria, carga del manifiesto, SHA, rechazo sin fuente y compatibilidad legado.
  - `test_payment_form_settings.py`: política V1, rechazo de `19`, forma predeterminada y concurrencia.
  - `test_preparation_defaults.py`: único punto, varios sin designación, otra entidad y punto deshabilitado.
  - `test_electronic_status.py`: cuatro estados, causas y certificado como advertencia.
  - Ajustes en `test_fiscal_tax_mapping.py`, `test_fiscal_resolver.py`, `test_fiscal_migrations.py` y `test_fiscal_permissions.py`.
- `tests/fiscal/`:
  - `test_payment_suggestion.py`, puro.
  - Ajustes en `test_payment_declaration.py` (sin plazo; rechazo de plazo), `test_snapshot.py` (bloque de configuración) y `test_api.py`:
    - precarga CI→05 y RUC→04;
    - rechazo de `environment`, `point_id` y plazo;
    - `review_stale` por cambio de configuración y por cambio de día en Guayaquil;
    - preparación inmutable tras cambiar el punto, el catálogo y los cobros;
    - borradores antiguos;
    - roles.
  - `test_openapi.py`.
- Regresión dirigida de las lecturas `fiscal_source` en `tests/sales` y `tests/workshop`, por caso.

**Frontend (vitest por archivo, `tsc` y ESLint de los archivos tocados, prettier):**
- `WorkshopConfigurationPage.test.tsx`: pestañas, `?tab=`, teclado, error persistente, entidades, bodega, impuestos, series sin regresión y denegación.
- `Tabs.test.tsx`: `keepMounted` y desplazamiento.
- Pruebas de las secciones nuevas de configuración, incluido el cambio de entidad.
- `FiscalPreparationPage.test.tsx`: resumen, solo faltantes, sugerencias, sin plazo, impedimentos por audiencia y terminología prohibida.
- Pruebas de `FiscalPreparationLink`, `SaleDetailPage` y `ServiceOperationDetailPage` para los textos.

**E2E:** solo los recorridos de preparación fiscal y configuración fiscal, en archivos existentes o nuevos que se confirmarán en las tareas.

La evidencia registrará lo ejecutado y lo no ejecutado.

### D13. ADR

No se crea un ADR nuevo. La decisión de catálogos como datos, valores predeterminados y ambiente único es local a la configuración fiscal y no cambia la arquitectura transversal. ADR-0004 y ADR-0010 siguen vigentes, y el orden de bloqueos de D8 los respeta. `docs/tecnico/` y el modelo de dominio §11.6 documentarán el punto predeterminado y los catálogos oficiales.

## Risks / Trade-offs

- **Ficha vigente distinta de la tabla aprobada o no disponible al implementar** → la tarea de manifiesto se bloquea hasta descargarla. No se cargan descripciones desde la spec ni desde proveedores.
- **Correspondencias legado sin entrada equivalente** → la migración falla y lo informa. Se resuelve incorporando la versión legado, sin inventar datos.
- **Sugerencia de pagos con correcciones o reembolsos complejos** → ante cualquier exceso sobre el total se usa la forma predeterminada. El usuario siempre confirma, y el snapshot conserva solo lo declarado.
- **El cambio de día invalida revisiones** → `review_stale` explícito; conviene revisar y completar en la misma sesión.
- **API BREAKING para la propia interfaz** → backend y frontend se despliegan juntos, con OpenAPI actualizado. No hay consumidores externos.
- **`keepMounted` mantiene montadas cinco pestañas con consultas** → las consultas son pequeñas y ya se cargaban en la página única actual. Las de *Facturación electrónica* se habilitan solo al abrirla por primera vez.
- **Choque de textos con el cambio activo `ajustar-venta-vinculada-vacia-y-textos-de-servicios`** en `ServiceOperationDetailPage.tsx` → se aplica sobre la versión integrada de ese cambio y se modifican solo los textos fiscales.

Referencia terminológica: [design-glossary-reference.md](design-glossary-reference.md).
