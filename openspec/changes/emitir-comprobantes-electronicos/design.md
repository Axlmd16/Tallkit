## Context

Con los cambios 1 (`incorporar-facturacion-electronica-en-v1`), 2 (`alinear-datos-del-comprobante-con-sri`) y U6 (`cobrar-y-facturar-en-un-paso`) archivados en `master`, Tallkit ya arma una instantánea fiscal inmutable de formato 4 (`SNAPSHOT_FORMAT = 4` en `backend/src/fiscal/domain/snapshot.py`) desde una venta comercial (`sales.Sale`) o una operación artesanal (`workshop.ServiceOperation`), y el flujo «Cobrar y facturar» (`backend/src/checkout/application/execute.py`) la invoca mediante `prepare_from_checkout` como paso posterior e independiente de las transacciones de confirmación y cobro (`ADR-0010`, `ADR-0014`).

Sin embargo, el módulo `fiscal` aún termina en el estado local `PREPARED` (`official_submission: "NOT_PERFORMED"`):

1. No existe el puerto neutral de **proveedor de emisión** ni la declaración de capacidades (`DP-034`, reglas 2 y 3; regla de independencia del proveedor en `docs/cambios-pendientes.md`).
2. No existe la entidad persistente **referencia fiscal** con estados canónicos propios (`no_solicitada`, `pendiente`, `en_proceso`, `error_temporal`, `autorizada`, `no_autorizada`, `anulada`) separados de la referencia técnica externa del proveedor.
3. No existe la **cola de emisión** fuera de las transacciones comerciales que garantice `NOR-001` (nunca reenviar ni asignar nuevo número a un comprobante `en_proceso`; solo consultar su estado hasta por 24 horas) y la vigencia diaria en `America/Guayaquil` (`NOR-008`, `V-1`) para comprobantes en espera sin Internet.
4. `FiscalXmlDossier` y `FiscalXmlEvidence` (`backend/src/fiscal/models.py`) solo aceptan hoy cargas manuales con `verification_level="EXTERNAL_UNVERIFIED"` y `kind__in=["DOCUMENT", "WRAPPER"]`, sin conservar el PDF del **RIDE** ni admitir incorporación automática desde el núcleo de emisión (`RF-FIS-010`).
5. `workshop_configuration` aún no persiste por entidad fiscal el estado de activación de emisión ni la marca de **punto de emisión exclusivo** (`NOR-007`).

## Goals / Non-Goals

**Goals:**

- Diseñar el núcleo de emisión electrónica dentro de `fiscal` con un puerto de dominio neutral (`EmissionProviderPort`), capacidades declaradas (`ProviderCapabilities`), un registro de adaptadores por configuración y una carpeta aislada por proveedor (`backend/src/fiscal/infrastructure/adapters/simulated/`), protegida por pruebas de fronteras AST.
- Incorporar el **adaptador simulado** (`simulated`) que opera sin red ni consumo de cupo, genera un XML de factura 2.1.0 válido contra `factura-2.1.0.xsd` con envoltorio `<autorizacion>` y un PDF RIDE sintético válido, y permite ejercitar determinísticamente `en_proceso`, `autorizada`, `no_autorizada` y `error_temporal` bajo una batería reutilizable de **pruebas de contrato**.
- Persistir la **referencia fiscal** (`FiscalEmissionReference`) y su bitácora de intentos (`FiscalEmissionAttempt`), manteniendo aislados los datos oficiales (clave de acceso, secuencial, ambiente, fecha de autorización) de los datos técnicos del proveedor (`adapter_key`, `external_id`, `idempotency_reference`, diagnóstico sin secretos).
- Implementar la **cola de emisión** y el comando administrativo/tarea programada (`process_fiscal_emission_queue`) con bloqueo por fila (`select_for_update(skip_locked=True)`), cumpliendo `NOR-001` (prohibición absoluta de reenvío cuando el estado es `en_proceso`) y la regla diaria en `America/Guayaquil` (`NOR-008`, `V-1`).
- Extender el archivo fiscal transaccional en PostgreSQL (`ADR-0010`) para archivar automáticamente al autorizarse tanto el XML autorizado (`DOCUMENT` + `WRAPPER`) como el PDF del RIDE (`RIDE_PDF`), con validación `SHA-256` y actualización atómica del **último secuencial autorizado** portable.
- Añadir la configuración de activación de emisión por entidad fiscal y de punto exclusivo (`NOR-007`), manteniendo **bloqueado en el servidor el ambiente de *Producción* (`2`)** durante el cambio 3 (`DP-034`, regla 8).
- Integrar la solicitud de emisión en `checkout` (paso 4 de «Cobrar y facturar»), en la ficha de preparación fiscal, en las fichas de venta comercial y operación artesanal, y en la página «Facturas».
- Registrar la decisión arquitectónica duradera en **`ADR-0015`** (ya que `ADR-0013` y `ADR-0014` están ocupados) y actualizar `docs/architecture/c4-containers.md`.

**Non-Goals:**

- Implementar el adaptador HTTP real de Factuplan, sus credenciales o la excepción de la prueba real supervisada en producción (`RN-FIS-018`), que pertenecen al **cambio 4** (`conectar-emision-factuplan`).
- Habilitar la emisión en ambiente de *Producción* (`2`) en este cambio (`DP-034`, regla 8).
- Visualización/descarga del RIDE para entrega al comprador, convivencia del documento interno con el RIDE impreso o estado de entrega del correo al cliente (**cambio 5**).
- Venta a consumidor final sin cliente registrado (**cambio 6**) y emisión oficial de notas de crédito o anulaciones en línea (**cambio 7**).

## Decisions

### D1. Puerto neutral del proveedor, capacidades declaradas y aislamiento AST (`ADR-0015`)

- **Ubicación:**
  - Contrato y objetos de valor puros en `backend/src/fiscal/domain/emission_provider.py` (sin dependencias de Django, DRF, HTTP ni librerías de red):
    - `EmissionState(StrEnum)`: `NO_SOLICITADA = "no_solicitada"`, `PENDIENTE = "pendiente"`, `EN_PROCESO = "en_proceso"`, `ERROR_TEMPORAL = "error_temporal"`, `AUTORIZADA = "autorizada"`, `NO_AUTORIZADA = "no_autorizada"`, `ANULADA = "anulada"`.
    - `ProviderCapabilities`: `sends_email: bool`, `assigns_numbering: bool`, `adds_provider_ruc: bool`, `supports_external_credit_notes: bool`.
    - `ProviderEmissionRequest`: construido exclusivamente a partir del snapshot de formato 4 (`preparation_id`, `idempotency_reference`, `environment`, `snapshot`, `next_sequential_hint`).
    - `ProviderStatusResponse`: `outcome: Literal["EN_PROCESO", "AUTORIZADA", "NO_AUTORIZADA", "ERROR_TEMPORAL"]`, `external_id: str | None`, `access_key: str | None`, `sequential: str | None`, `authorized_at: str | None`, `rejection_code: str | None`, `rejection_message: str | None`, `diagnostic: dict[str, Any]`.
    - `ProviderArtifacts`: `xml_bytes: bytes`, `ride_pdf_bytes: bytes`.
    - `EmissionProviderPort(Protocol)`: `adapter_key: str`, `capabilities: ProviderCapabilities`, `submit_invoice(request: ProviderEmissionRequest) -> ProviderStatusResponse`, `check_status(external_id: str, idempotency_reference: str, ruc: str) -> ProviderStatusResponse`, `download_artifacts(external_id: str, access_key: str, ruc: str) -> ProviderArtifacts`.
  - Registro y resolución de adaptadores en `backend/src/fiscal/infrastructure/adapters/registry.py`.
  - Adaptador simulado en `backend/src/fiscal/infrastructure/adapters/simulated/adapter.py` (y generadores locales `xml_builder.py` y `ride_builder.py` dentro de esa misma carpeta).
- **Prueba de fronteras (`backend/tests/fiscal/test_boundaries.py`):**
  - Ningún archivo fuera de `fiscal/infrastructure/adapters/<proveedor>/` y `fiscal/infrastructure/adapters/registry.py` puede importar submódulos de un adaptador concreto.
  - `fiscal/domain/` sigue sin importar Django, DRF, `requests`, `httpx` ni infraestructura.
- **Alternativas descartadas:**
  - *Llamar al proveedor desde `sales`, `workshop` o `checkout`*: rompería la cohesión del módulo `fiscal` y acoplaría los flujos comerciales a detalles externos (`ADR-0010`).

### D2. Adaptador simulado determinista y batería de pruebas de contrato

- El adaptador `simulated` declara `ProviderCapabilities(sends_email=True, assigns_numbering=True, adds_provider_ruc=True, supports_external_credit_notes=True)` y opera solo en ambiente `1` (*Pruebas*).
- **Construcción del XML 2.1.0 y del RIDE PDF:**
  - `xml_builder.py` serializa con `lxml.etree` un `<factura id="comprobante" version="2.1.0">` fiel a los campos del snapshot de formato 4 (`infoTributaria` con `contribuyenteRimpe` y `agenteRetencion` cuando aplican, `infoFactura` con `contribuyenteEspecial`, `obligadoContabilidad`, `pagos` con `plazo` y `unidadTiempo`, `detalles` con `detAdicional` para detalle de servicio, e `infoAdicional` con `Gran Contribuyente`, `RUC Proveedor` simulado `9999999999001` y los pares del usuario), lo valida con `parse_fiscal_xml` contra `factura-2.1.0.xsd` y lo envuelve en `<autorizacion><estado>AUTORIZADO</estado>...`.
  - `ride_builder.py` construye un PDF mínimo válido (`%PDF-1.4 ... %%EOF`) determinista con la clave de acceso, número y total del comprobante, sin añadir dependencias externas a `pyproject.toml`.
- **Control determinista de estados en pruebas:**
  - Por omisión, `submit_invoice` autoriza inmediatamente en pruebas (`AUTORIZADA`).
  - Para ejercitar la máquina de estados en pruebas de contrato, unitarias y de integración sin mocks invasivos, el adaptador simulado soporta directivas de simulación configurables en memoria (o por nota de prueba en entorno de test) para responder `EN_PROCESO` (que pasa a `AUTORIZADA` al invocar `check_status`), `NO_AUTORIZADA` (con código y motivo) o `ERROR_TEMPORAL`.
- **Pruebas de contrato (`backend/tests/fiscal/AdapterContractMixin` o fixture parametrizada en `test_emission_adapter_contract.py`):**
  - Valida cualquier implementación de `EmissionProviderPort`: capacidades bien formadas, idempotencia de `submit_invoice` con el mismo `idempotency_reference`, transición `EN_PROCESO -> AUTORIZADA`, preservación de `NO_AUTORIZADA`, manejo de `ERROR_TEMPORAL`, y validez XSD + `SHA-256` de `download_artifacts`. El cambio 4 ejecutará esta misma batería sobre el adaptador de Factuplan.

### D3. Modelo de datos de la referencia fiscal, configuración de emisión y archivo de RIDE

1. **Referencia fiscal e intentos (`backend/src/fiscal/models.py`):**
   - `FiscalEmissionReference`:
     - `id = UUIDField(primary_key=True, default=uuid.uuid4)`
     - `preparation = OneToOneField(FiscalPreparation, on_delete=PROTECT, related_name="emission_reference")`
     - `fiscal_entity = ForeignKey("workshop_configuration.FiscalEntity", on_delete=PROTECT, related_name="+")`
     - `state = CharField(max_length=24, choices=..., default=EmissionState.PENDIENTE)` (cuando una preparación no tiene fila en `FiscalEmissionReference`, su estado proyectado de dominio es `no_solicitada`; la fila se crea al solicitar por primera vez la emisión o se inicializa en `no_solicitada` / `pendiente`, ver abajo: para simplificar consultas y filtros en `PreparationListView`, `FiscalPreparation` tendrá además un campo desnormalizado o relación 1-a-1; **decisión concreta**: crear o mantener `emission_state` en `FiscalPreparation` sincronizado en la misma transacción con `FiscalEmissionReference`, con valor inicial `"no_solicitada"` en toda preparación, lo que permite filtrar en `list_preparations` con índice directo sin `LEFT JOIN` ambiguo, mientras `FiscalEmissionReference` guarda el ciclo de emisión cuando ya fue solicitada).
     - Datos oficiales en `FiscalEmissionReference`:
       - `environment = CharField(max_length=1)` (`"1"` o `"2"`, con `CheckConstraint` y bloqueo de `"2"` en aplicación durante cambio 3)
       - `document_type = CharField(max_length=2, default="01")`
       - `establishment_code = CharField(max_length=3)`
       - `emission_point_code = CharField(max_length=3)`
       - `reference_date = DateField()` (fecha fiscal congelada de la instantánea en `America/Guayaquil`)
       - `sequential = CharField(max_length=9, null=True, blank=True)`
       - `access_key = CharField(max_length=49, null=True, blank=True, unique=True)`
       - `authorized_at = DateTimeField(null=True, blank=True)`
       - `dossier = OneToOneField(FiscalXmlDossier, on_delete=PROTECT, null=True, blank=True, related_name="emission_reference")`
       - `archive_pending = BooleanField(default=False)` (verdadero si el proveedor reportó `AUTORIZADA` pero falló temporalmente la descarga del XML o del RIDE)
     - Datos externos separados (en la misma fila bajo prefijo explícito o subestructura):
       - `adapter_key = CharField(max_length=32)` (ej. `"simulated"`)
       - `idempotency_reference = CharField(max_length=64, unique=True)` (determinista por preparación/intento de envío, usado como `devReference` ante proveedores externos)
       - `external_id = CharField(max_length=128, null=True, blank=True)`
       - `last_error_code = CharField(max_length=64, blank=True, default="")`
       - `last_error_message = CharField(max_length=500, blank=True, default="")`
       - `attempt_count = PositiveIntegerField(default=0)`
       - `last_attempt_at = DateTimeField(null=True, blank=True)`
       - `requested_by = ForeignKey(settings.AUTH_USER_MODEL, on_delete=PROTECT, related_name="+")`
       - `created_at`, `updated_at`, `version = PositiveBigIntegerField(default=1)`
   - `FiscalEmissionAttempt`:
     - Bitácora inmutable por cada llamada de envío, consulta o descarga (`reference`, `sequence`, `operation` `SUBMIT | CHECK_STATUS | DOWNLOAD_ARTIFACTS`, `actor` opcional cuando es tarea programada, `outcome_state`, `external_id`, `error_code`, `error_message`, `diagnostic` JSON sin secretos, `created_at`).
2. **Extensión del archivo fiscal (`FiscalXmlDossier` y `FiscalXmlEvidence` en `backend/src/fiscal/models.py`):**
   - `FiscalXmlDossier.verification_level`: ampliar el `CheckConstraint` `fiscal_xml_verification_level_local` para admitir:
     - `"EXTERNAL_UNVERIFIED"` (cargas manuales del Administrador, `RF-FIS-004`),
     - `"SIMULATED_TEST_AUTHORIZED"` (emisión propia autorizada en ambiente de pruebas `1` con el adaptador simulado),
     - `"PROVIDER_AUTHORIZED"` (preparado para el cambio 4 cuando un adaptador externo autorice).
   - `FiscalXmlDossier`: añadir `origin = CharField(max_length=24, default="EXTERNAL_UPLOAD")` (`"EXTERNAL_UPLOAD"` | `"EMISSION_CORE"`) y `adapter_key = CharField(max_length=32, blank=True, default="")`.
   - `FiscalXmlEvidence.kind`: ampliar el `CheckConstraint` `fiscal_xml_evidence_kind_valid` de `["DOCUMENT", "WRAPPER"]` a `["DOCUMENT", "WRAPPER", "RIDE_PDF"]`. Así el PDF del RIDE se almacena en `FiscalXmlContent` con exactamente las mismas garantías transaccionales de inmutabilidad (`save`/`delete` bloqueados), límite de 2 MiB y verificación `SHA-256` que el XML, y se respalda con `pg_dump` (`ADR-0010`, `ADR-0013`).
   - En `create_draft` (`backend/src/fiscal/application/preparations.py:253`), el chequeo `FiscalXmlDossier.objects.filter(**linked_filter).exists()` sigue impidiendo crear otra preparación cuando una operación ya tiene un comprobante archivado (sea externo o emitido).
3. **Configuración de emisión y punto exclusivo (`backend/src/workshop_configuration/models.py`):**
   - En `FiscalEmissionPoint`: añadir `is_electronic_exclusive = BooleanField(default=False)` (`NOR-007`: declaración del Administrador de que ese punto es exclusivo para facturación electrónica y no se usa en paralelo en el Facturador gratuito del SRI).
   - Nuevo modelo `FiscalEmissionSettings` (1-a-1 con `FiscalEntity`, siguiendo el patrón de `FiscalPreparationDefaults` y `ReceivedWithholdingSetting`):
     - `fiscal_entity = OneToOneField(FiscalEntity, on_delete=PROTECT, related_name="emission_settings")`
     - `is_active = BooleanField(default=False)`
     - `environment = CharField(max_length=1, default="1")` (`"1"` pruebas, `"2"` producción; constraint `environment__in=["1", "2"]`, y validación de dominio/aplicación que rechaza `"2"` en el cambio 3 con `ProductionEmissionDisabledError`)
     - `adapter_key = CharField(max_length=32, default="simulated")`
     - `version = PositiveBigIntegerField(default=1)`
     - `updated_by = ForeignKey(settings.AUTH_USER_MODEL, on_delete=PROTECT, related_name="+")`
     - `updated_at = DateTimeField(auto_now=True)`
   - **Numeración portable (`FiscalNumberingScope`):**
     - `FiscalNumberingScope.last_sequential` ya existe por `(fiscal_entity, document_type, establishment_code, emission_point_code, environment)`.
     - Se añade en `workshop_configuration` / `fiscal` la acción administrativa para inicializar o adelantar el `last_sequential` del punto predeterminado (nunca retrocederlo) a partir del último número usado fuera del sistema, y al autorizarse cada comprobante en el núcleo de emisión se actualiza `scope.last_sequential = max(scope.last_sequential, authorized_sequential)` dentro de la transacción de archivo.

### D4. Límites transaccionales, concurrencia, `NOR-001` y vigencia diaria (`NOR-008`)

El flujo de emisión separa estrictamente las transacciones de base de datos de las llamadas al adaptador (`ADR-0010`):

```mermaid
sequenceDiagram
    participant U as Usuario / Checkout / Cola
    participant S as EmissionService (fiscal)
    participant DB as PostgreSQL (transacción corta)
    participant A as Adaptador (simulated / futuro proveedor)

    U->>S: request_emission(preparation_id, idempotency_key)
    activate S
    S->>DB: Tx 1: Bloquea FiscalPreparation + valida elegibilidad (PREPARED, formato 4, entidad activa en pruebas, correo/plazo)
    alt Ya existe FiscalEmissionReference en EN_PROCESO
        S->>DB: Tx 1: No reenvía (NOR-001); selecciona modo CHECK_STATUS
    else En NO_SOLICITADA / PENDIENTE / ERROR_TEMPORAL
        S->>DB: Tx 1: Verifica fecha fiscal == hoy en America/Guayaquil (NOR-008)
        S->>DB: Tx 1: Reserva/asigna identidad y deja referencia en PENDIENTE con lock lógico
    end
    DB-->>S: Datos de envío o consulta
    alt Modo SUBMIT (fuera de Tx 1)
        S->>A: submit_invoice(ProviderEmissionRequest)
        A-->>S: ProviderStatusResponse
    else Modo CHECK_STATUS (fuera de Tx 1)
        S->>A: check_status(external_id, idempotency_reference, ruc)
        A-->>S: ProviderStatusResponse
    end
    alt Respuesta es AUTORIZADA
        S->>A: download_artifacts(external_id, access_key, ruc)
        A-->>S: XML autorizado + RIDE PDF
        S->>DB: Tx 2: Registra intento, archiva XML + RIDE (SHA-256), actualiza last_sequential y pasa a AUTORIZADA
    else Respuesta es EN_PROCESO / NO_AUTORIZADA / ERROR_TEMPORAL
        S->>DB: Tx 2: Registra intento y actualiza estado de FiscalEmissionReference y FiscalPreparation.emission_state
    end
    S-->>U: EmissionResult
    deactivate S
```

- **Protección contra envíos concurrentes (doble clic o cola simultánea):**
  - En `process_emission_queue` se usa `FiscalEmissionReference.objects.select_for_update(skip_locked=True)` por lote; cada comprobante se reclama en una transacción corta, se ejecuta el adaptador fuera del lock prolongado (o con marca `in_flight` / timestamp) y se persiste el resultado en la transacción de cierre.
  - Cuando el adaptador declara `assigns_numbering=True` en ambiente de pruebas (`simulated`), la identidad de pruebas (`FiscalDocumentIdentity` y `FiscalNumberingScope`) se asigna de forma atómica e idempotente por preparación antes de enviar, reutilizando la misma clave de acceso y secuencial en cualquier reintento de `error_temporal`.
- **Bloqueo de cancelación local en `en_proceso` y `autorizada`:**
  - `cancel()` y `replace()` en `backend/src/fiscal/application/preparations.py` verificarán `preparation.emission_state`: si es `"en_proceso"` o `"autorizada"`, rechazarán con `PreparationStateError` explicando que un comprobante en procesamiento ante el SRI o ya autorizado no puede cancelarse localmente. Si es `"no_solicitada"`, `"pendiente"`, `"error_temporal"` o `"no_autorizada"`, se permite cancelar y reemplazar localmente (marcando la referencia anterior como cerrada por reemplazo de su preparación).
- **Regla de vigencia diaria en `America/Guayaquil` (`NOR-008`, `V-1`):**
  - Antes de hacer `submit_invoice` (tanto en solicitud inicial como en reintento desde `pendiente` o `error_temporal`), el dominio compara `date.fromisoformat(snapshot["reference_date"])` con la fecha actual en `America/Guayaquil`.
  - Si `today_guayaquil > reference_date` y el comprobante **nunca fue recibido por el proveedor** (estado `no_solicitada`, `pendiente` o `error_temporal` sin recepción en procesamiento), el envío se rechaza con `ExpiredPreparationDateError` (`code="emission_date_expired"`) sin llamar al adaptador ni cambiar la fecha, informando que debe cancelarse y reemplazarse la preparación con la fecha actual.
  - Si el comprobante ya estaba en `en_proceso` (fue recibido dentro de su día), `check_status` y `download_artifacts` se permiten aunque haya cambiado el día calendario (`NOR-001`, hasta 24 horas).
- **Validación de preparaciones anteriores al formato 4:**
  - Si `snapshot.get("snapshot_format", 1) < 4`, o si el receptor es identificado (`04`, `05`, `06`, `08`) y carece de correo válido, o si la operación de origen es a crédito con saldo pendiente y ninguna forma de pago tiene `term_days`, `request_emission` rechaza con `LegacyPreparationReplacementRequiredError` (`code="preparation_replacement_required"`) orientando a cancelar y reemplazar la preparación.

### D5. Permisos por rol e integración con API, `checkout` y Frontend

1. **Permisos (`backend/src/identity/domain/authorization.py`):**
   - Añadir `"fiscal.comercial.emitir"` a `Role.ADMINISTRADOR` y `Role.VENDEDOR`.
   - Añadir `"fiscal.artesanal.emitir"` a `Role.ADMINISTRADOR` y `Role.ENCARGADO_TALLER`.
   - La configuración de activación de emisión por entidad, punto exclusivo, último secuencial autorizado y ejecución manual global de la cola usa `"parametros.gestionar"` / `"entidades_fiscales.editar"` (exclusivos de `Role.ADMINISTRADOR`).
2. **Endpoints HTTP bajo `/api/v1/fiscal/` (`backend/src/fiscal/api/urls.py` y `views.py`):**
   - `POST /api/v1/fiscal/preparations/<uuid:preparation_id>/emit/` (cabecera `Idempotency-Key`): solicita emisión o reintenta si estaba en `pendiente` / `error_temporal`; si ya estaba `en_proceso`, ejecuta únicamente consulta de estado (`NOR-001`); si ya estaba `autorizada` con `archive_pending=True`, completa la descarga de XML/RIDE; si ya estaba `autorizada` completa, devuelve el resultado idempotente.
   - `POST /api/v1/fiscal/preparations/<uuid:preparation_id>/check-status/`: consulta explícita de estado para una preparación `en_proceso` (o `autorizada` con archivo pendiente).
   - `POST /api/v1/fiscal/emission-queue/process/` (solo Administrador, con `Idempotency-Key`): procesa un lote de la cola de emisión y devuelve el resumen (`processed`, `authorized`, `in_process`, `rejected`, `temporary_errors`, `expired_dates`).
   - `GET/PUT /api/v1/fiscal/configuration/entities/<int:entity_id>/emission-settings/` (con `Idempotency-Key` en `PUT`): consulta y actualiza el estado de activación de emisión en pruebas, el ambiente (`"1"`, rechazando `"2"` con 409/400 y mensaje claro de `DP-034` regla 8), la declaración de exclusividad del punto predeterminado y el último secuencial autorizado inicial.
   - Extensión de respuestas existentes:
     - `GET /api/v1/fiscal/preparations/list/`: acepta filtro opcional `emission_state` y devuelve en cada fila `emission_state`, `fiscal_number` (`001-001-000000001` cuando existe), `access_key`, `environment` (`"1"`) y `can_emit`.
     - `GET /api/v1/fiscal/preparations/<uuid:preparation_id>/` y `GET /api/v1/fiscal/preparations/?source_kind=...&source_id=...`: incluyen el bloque `emission` (`state`, `environment`, `fiscal_number`, `access_key`, `authorized_at`, `last_error_code`, `last_error_message`, `archive_dossier_id`, `has_xml`, `has_ride`, `can_emit`, `can_check_status`, `can_retry`, `entity_emission_active`).
3. **Comando de gestión Django para tarea programada:**
   - `backend/src/fiscal/management/commands/process_fiscal_emission_queue.py`: invoca `process_emission_queue(actor=None, limit=50)` para que el programador de tareas de Windows (`ADR-0013`) o el operador local puedan ejecutar `uv run python manage.py process_fiscal_emission_queue`.
4. **Integración con `checkout` (`backend/src/checkout/`):**
   - `ALLOWED_CROSS_MODULE` en `backend/tests/checkout/test_boundaries.py` añade `"fiscal.application.emission"` y `"workshop_configuration.application.emission_settings"`.
   - En `backend/src/checkout/application/execute.py`: tras completar `prepare_from_checkout` (paso 3), si `include_invoices` es verdadero, la entidad fiscal tiene `emission_settings.is_active == True` y el actor tiene `fiscal.<ambito>.emitir`, el orquestador invoca `emit_from_checkout(actor=actor, preparation_id=prep.preparation_id, idempotency_key=_step_key(base_key, "<com|art>-emit"))` dentro de un bloque `try/except`:
     - Si queda `autorizada`, `result["fiscal_state"] = "AUTHORIZED_TEST"`, `result["emission_state"] = "autorizada"`, `result["fiscal_number"] = ...`.
     - Si queda `en_proceso`, `result["fiscal_state"] = "IN_PROCESS"`, `result["emission_state"] = "en_proceso"`.
     - Si queda `error_temporal` o `no_autorizada` o lanza `FiscalEmissionError`, **la venta y el cobro permanecen intactos** (`DP-034`, regla 5), `had_partial_failure = True`, `result["fiscal_state"] = "EMISSION_PENDING"` o `"EMISSION_REJECTED"` y `result["fiscal_error"]` explica el motivo.
     - Si la entidad fiscal no tiene la emisión activada, se mantiene el comportamiento de U6: `result["fiscal_state"] = "PREPARED"` («Factura preparada (sin enviar)») y `result["emission_state"] = "no_solicitada"`.
5. **Frontend (`frontend/src/`):**
   - `FiscalPreparationPage.tsx` y `FiscalPreparationLink.tsx`: muestran el estado de emisión de la referencia fiscal, la insignia de ambiente **«Ambiente de pruebas (sin validez tributaria)»** cuando fue emitida en ambiente `1`, y el botón correspondiente según estado y permiso: **«Facturar»** (`no_solicitada` con entidad activa), **«Consultar estado»** (`en_proceso`), **«Reintentar envío»** (`pendiente` / `error_temporal`) o **«Reemplazar datos para corregir»** (`no_autorizada` o preparación anterior al formato 4).
   - `InvoicesPage.tsx`: incorpora en la tabla y en el panel lateral (`InvoicePreview`) el estado de emisión, el número fiscal del comprobante cuando ya fue asignado, el filtro por estado de emisión y el botón rápido «Facturar» / «Consultar estado» / «Reintentar envío».
   - `CheckoutPage.tsx`: refleja en el resumen final y en las tarjetas de negocio si la factura quedó «Autorizada en pruebas (sin validez tributaria)», «Enviada al SRI (en proceso)», «Factura preparada (sin enviar)» o «Pendiente de reintento».
   - Configuración fiscal (`LocationsSection.tsx` / `FiscalConfigurationSection.tsx`): permite al Administrador marcar el punto predeterminado como exclusivo para facturación electrónica (`NOR-007`), consultar/fijar el último secuencial autorizado inicial y activar/desactivar la emisión en ambiente de *Pruebas* por entidad fiscal.

## Estrategia de migración y compatibilidad de datos

- **Migración en `workshop_configuration` (`0016_emission_settings_and_exclusive_point.py`):**
  - Añade `is_electronic_exclusive = BooleanField(default=False)` a `FiscalEmissionPoint`.
  - Crea `FiscalEmissionSettings` (sin filas iniciales obligatorias: la ausencia de fila equivale a emisión inactiva en ambiente `"1"` con adaptador `"simulated"`).
- **Migración en `fiscal` (`0010_fiscal_emission_reference_and_ride_archive.py`):**
  - Añade `emission_state = CharField(max_length=24, default="no_solicitada")` a `FiscalPreparation` con `CheckConstraint` de los 7 estados canónicos. Todas las preparaciones existentes reciben `"no_solicitada"` sin alterar sus snapshots ni sus estados locales (`DRAFT`, `PREPARED`, `CANCELLED`).
  - Crea `FiscalEmissionReference` y `FiscalEmissionAttempt`.
  - Actualiza en `FiscalXmlDossier` los campos `origin`, `adapter_key` y el `CheckConstraint` de `verification_level`, y en `FiscalXmlEvidence` el `CheckConstraint` de `kind` para admitir `"RIDE_PDF"`.
- **Compatibilidad:** ninguna migración es destructiva ni reescribe snapshots históricos; las preparaciones previas al formato 4 siguen siendo consultables y, si se intenta emitirlas, el servicio solicita su reemplazo trazable.

## Estrategia de pruebas según el riesgo (`AGENTS.md`)

| Nivel | Alcance en este cambio | Pruebas |
|---|---|---|
| **Estricto (TDD: prueba que falla antes del código)** | 1. Fronteras AST del adaptador (`test_boundaries.py`).<br>2. Contrato del puerto neutral y del adaptador simulado (`test_emission_adapter_contract.py`): XML 2.1.0 válido contra XSD, RIDE PDF válido, estados `en_proceso`, `autorizada`, `no_autorizada`, `error_temporal`.<br>3. Máquina de estados de la referencia fiscal, prohibición de reenvío en `en_proceso` (`NOR-001`) y bloqueo de cancelación local (`test_emission_service.py`).<br>4. Vigencia diaria en `America/Guayaquil` (`NOR-008`, `V-1`) y rechazo de preparaciones previas al formato 4 sin correo/plazo (`test_emission_eligibility.py`).<br>5. Archivo automático transaccional de XML + RIDE con `SHA-256`, actualización del último secuencial autorizado portable y recuperación de descarga pendiente (`test_emission_archive.py`).<br>6. Activación por entidad fiscal en pruebas, bloqueo de producción (`DP-034`, regla 8), punto exclusivo (`NOR-007`) y permisos por rol/RUC (`test_emission_permissions_and_config.py`).<br>7. Cola de emisión concurrente e integración con `checkout` preservando ventas y cobros ante fallos de emisión (`test_emission_queue.py`, `test_checkout_flow.py`). | `uv run pytest backend/tests/fiscal/ backend/tests/checkout/` |
| **Prueba al final** | Pantallas y componentes React (`InvoicesPage.test.tsx`, `FiscalPreparationPage.test.tsx`, `FiscalPreparationLink.test.tsx`, `CheckoutPage.test.tsx`, `LocationsSection.test.tsx`): acción «Facturar», «Consultar estado», «Reintentar envío», aviso de ambiente de pruebas y activación por entidad. | `npm --prefix frontend run test` |
| **Sin prueba nueva** | Actualización de `ADR-0015`, `ADR-0010`, `c4-containers.md`, `modelo-dominio.md`, `actores-y-roles.md`, `operacion-archivo-fiscal.md` y `cambios-pendientes.md`. | Revisión documental y `openspec validate` |

## Risks / Trade-offs

- **Almacenar el PDF del RIDE en PostgreSQL (`FiscalXmlContent`) junto con el XML:**
  - *Trade-off:* un RIDE PDF ocupa entre 15 KiB y 150 KiB (muy por debajo del límite de 2 MiB de `FiscalXmlContent`). Guardarlo en la misma tabla transaccional que el XML garantiza atomicidad (`ADR-0010`), verificación `SHA-256` idéntica y respaldo unificado en `pg_dump` (`ADR-0013`) sin coordinar archivos huérfanos en disco para un documento legal que debe conservarse 7 años.
- **Vigencia diaria en `America/Guayaquil` para comprobantes no enviados (`NOR-008`):**
  - *Trade-off:* mientras `V-1` no tenga respuesta externa, bloquear el envío automático al día siguiente si el comprobante nunca salió al proveedor exige un clic del usuario para reemplazar la preparación con fecha del día actual, pero evita emitir un comprobante con fecha de emisión de un día anterior infringiendo el art. 7 reformado de `NAC-DGERCGC18-00000233`.

## Open Questions

- Ninguna que bloquee este cambio: las recomendaciones 1 a 9 del `proposal.md` quedaron plasmadas en las `specs` aprobadas. Las validaciones externas `V-1` (fuerza mayor y fecha tras caída de Internet), `V-2` (registro de proveedor), `V-5` (redondeo IVA comercial) y `V-6` (plazo en crédito sin fecha) mantienen su seguimiento en la matriz de normas para la activación productiva del cambio 4.
