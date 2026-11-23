## 1. Puerto neutral del proveedor, adaptador simulado y pruebas de contrato (Riesgo: Estricto · TDD)

- [ ] 1.1 Escribir pruebas TDD primero en `backend/tests/fiscal/test_boundaries.py` y `backend/tests/fiscal/test_emission_adapter_contract.py` para:
  - fronteras AST del registro y de la carpeta de cada adaptador (`fiscal/infrastructure/adapters/<proveedor>/` no puede importarse directamente fuera de su paquete y de `registry.py`; `fiscal/domain/` libre de Django, DRF y librerías de red);
  - estados canónicos `EmissionState` (`no_solicitada`, `pendiente`, `en_proceso`, `error_temporal`, `autorizada`, `no_autorizada`, `anulada`) y transiciones válidas;
  - batería de pruebas de contrato reutilizable sobre `EmissionProviderPort` y el adaptador `simulated`: capacidades declaradas (`ProviderCapabilities`), emisión idempotente por `idempotency_reference`, generación de XML de factura 2.1.0 válido contra `factura-2.1.0.xsd` con envoltorio `<autorizacion>`, generación de RIDE PDF válido (`%PDF-1.4`) y simulación determinista de `EN_PROCESO`, `AUTORIZADA`, `NO_AUTORIZADA` y `ERROR_TEMPORAL`.
- [ ] 1.2 Implementar `EmissionState` y sus reglas de transición en `backend/src/fiscal/domain/states.py` y el contrato neutral `EmissionProviderPort`, `ProviderCapabilities`, `ProviderEmissionRequest`, `ProviderStatusResponse` y `ProviderArtifacts` en `backend/src/fiscal/domain/emission_provider.py`.
- [ ] 1.3 Implementar el adaptador simulado aislado en `backend/src/fiscal/infrastructure/adapters/simulated/` (`adapter.py`, `xml_builder.py`, `ride_builder.py`) y el selector de adaptadores en `backend/src/fiscal/infrastructure/adapters/registry.py`.
- [ ] 1.4 Verificar Grupo 1: `cd backend && uv run pytest tests/fiscal/test_boundaries.py tests/fiscal/test_states.py tests/fiscal/test_emission_adapter_contract.py`.

## 2. Modelos, migraciones, permisos y configuración de activación por entidad fiscal (Riesgo: Estricto · TDD)

- [ ] 2.1 Escribir pruebas TDD primero en `backend/tests/fiscal/test_emission_permissions_and_config.py` cubriendo:
  - permisos `fiscal.comercial.emitir` (`ADMINISTRADOR`, `VENDEDOR`) y `fiscal.artesanal.emitir` (`ADMINISTRADOR`, `ENCARGADO_TALLER`), unión de roles y denegación cruzada entre entidades;
  - declaración de punto de emisión exclusivo (`is_electronic_exclusive`, `NOR-007`) y registro/avance del último secuencial autorizado portable sin permitir retrocederlo;
  - activación independiente de emisión por entidad fiscal en ambiente de *Pruebas* (`1`) exigiendo perfil en estado `READY` y punto predeterminado exclusivo;
  - rechazo estricto de selección o activación del ambiente de *Producción* (`2`) conforme a `DP-034` regla 8.
- [ ] 2.2 Añadir los permisos `fiscal.comercial.emitir` y `fiscal.artesanal.emitir` en `backend/src/identity/domain/authorization.py`.
- [ ] 2.3 Extender `backend/src/workshop_configuration/models.py` con `FiscalEmissionPoint.is_electronic_exclusive` y el modelo `FiscalEmissionSettings`, generar la migración `backend/src/workshop_configuration/migrations/0016_emission_settings_and_exclusive_point.py` e implementar el servicio `backend/src/workshop_configuration/application/emission_settings.py` (y ajuste en `emission_locations.py` / `electronic_status.py`).
- [ ] 2.4 Extender `backend/src/fiscal/models.py` con `FiscalPreparation.emission_state` (valor por defecto `"no_solicitada"`), `FiscalEmissionReference`, `FiscalEmissionAttempt`, ampliación de `FiscalXmlDossier` (`origin`, `adapter_key`, niveles `SIMULATED_TEST_AUTHORIZED` y `PROVIDER_AUTHORIZED`) y `FiscalXmlEvidence.kind` con `"RIDE_PDF"`, y generar la migración `backend/src/fiscal/migrations/0010_fiscal_emission_reference_and_ride_archive.py`.
- [ ] 2.5 Verificar Grupo 2: `cd backend && uv run python manage.py makemigrations --check --dry-run && uv run pytest tests/fiscal/test_migrations.py tests/fiscal/test_emission_permissions_and_config.py`.

## 3. Núcleo de emisión, archivo automático de XML + RIDE y cola fuera de transacciones económicas (Riesgo: Estricto · TDD)

- [ ] 3.1 Escribir pruebas TDD primero en `backend/tests/fiscal/test_emission_service.py`, `backend/tests/fiscal/test_emission_archive.py` y `backend/tests/fiscal/test_emission_queue.py` cubriendo:
  - elegibilidad de emisión: entidad activa en pruebas, preparación en estado `PREPARED` con `snapshot_format >= 4`, y bloqueo con orientación de reemplazo (`preparation_replacement_required`) para preparaciones anteriores al cambio 2 sin correo en receptor identificado o sin plazo en crédito con saldo pendiente;
  - regla `NOR-001`: un comprobante en `en_proceso` nunca se reenvía como nueva emisión ni genera otro secuencial/clave de acceso, solo consulta estado; y bloqueo de `cancel` / `replace` locales cuando `emission_state` es `en_proceso` o `autorizada`;
  - vigencia diaria en `America/Guayaquil` (`NOR-008`, `V-1`): reintento permitido el mismo día calendario, bloqueo `emission_date_expired` si cruza al día siguiente sin haber sido recibido por el proveedor, y consulta permitida al día siguiente si ya estaba `en_proceso`;
  - archivo automático e idempotente en `FiscalXmlDossier` / `FiscalXmlEvidence` / `FiscalXmlContent` del XML autorizado (`DOCUMENT` + `WRAPPER`) y del PDF del RIDE (`RIDE_PDF`) con validación XSD y `SHA-256`, actualización atómica de `FiscalNumberingScope.last_sequential` y recuperación cuando falla temporalmente solo la descarga de archivos (`archive_pending=True`);
  - procesamiento concurrente de la cola (`process_emission_queue`) y comando `process_fiscal_emission_queue` sin duplicar envíos.
- [ ] 3.2 Extender `backend/src/fiscal/application/xml_archive.py` con `archive_authorized_emission` (incorporación transaccional e idempotente de XML autorizado + RIDE PDF en ambiente `"1"`, rechazando ambiente `"2"`).
- [ ] 3.3 Implementar el servicio de emisión y cola en `backend/src/fiscal/application/emission.py` (`request_emission`, `check_emission_status`, `process_emission_queue`, `emit_from_checkout`) con transacciones cortas fuera de la llamada al adaptador, actualización de `FiscalNumberingScope.last_sequential` y registro en `FiscalEmissionAttempt` y auditoría.
- [ ] 3.4 Actualizar `cancel`, `replace`, `get_preparation`, `find_active_preparation` y `list_preparations` en `backend/src/fiscal/application/preparations.py` y `backend/src/fiscal/application/listing.py` para proteger comprobantes `en_proceso` / `autorizada` y proyectar los datos y filtros de la referencia fiscal.
- [ ] 3.5 Crear el comando de gestión `backend/src/fiscal/management/commands/process_fiscal_emission_queue.py`.
- [ ] 3.6 Verificar Grupo 3: `cd backend && uv run pytest tests/fiscal/test_emission_service.py tests/fiscal/test_emission_archive.py tests/fiscal/test_emission_queue.py tests/fiscal/test_xml_archive.py`.

## 4. API fiscal, integración con `checkout` («Cobrar y facturar») y OpenAPI (Riesgo: Estricto · TDD)

- [ ] 4.1 Escribir pruebas TDD primero en `backend/tests/fiscal/test_emission_api.py` y `backend/tests/checkout/test_checkout_flow.py` cubriendo:
  - endpoints `POST /api/v1/fiscal/preparations/<id>/emit/`, `POST /api/v1/fiscal/preparations/<id>/check-status/`, `POST /api/v1/fiscal/emission-queue/process/` y `GET/PUT /api/v1/fiscal/configuration/entities/<id>/emission-settings/`;
  - listado `/api/v1/fiscal/preparations/list/` con filtro `emission_state` y campos de emisión;
  - integración en `POST /api/v1/checkout/execute/`: cuando la entidad fiscal tiene emisión activa en pruebas, solicita la emisión tras preparar la factura; cuando está inactiva, la deja en `PREPARED` (`no_solicitada`); y cuando la emisión queda en `error_temporal` o `no_autorizada`, la venta, la operación artesanal y los cobros quedan confirmados en firme (`DP-034`, regla 5).
- [ ] 4.2 Exponer serializers, vistas y rutas en `backend/src/fiscal/api/serializers.py`, `backend/src/fiscal/api/views.py` y `backend/src/fiscal/api/urls.py`; actualizar `ALLOWED_CROSS_MODULES` en `backend/tests/fiscal/test_boundaries.py`.
- [ ] 4.3 Integrar el paso 4 de emisión en `backend/src/checkout/application/execute.py`, `backend/src/checkout/application/preview.py` y `backend/src/checkout/api/serializers.py`; actualizar `ALLOWED_CROSS_MODULE` en `backend/tests/checkout/test_boundaries.py`.
- [ ] 4.4 Regenerar `backend/schema.yml` con `cd backend && uv run python manage.py spectacular --file schema.yml`.
- [ ] 4.5 Verificar Grupo 4: `cd backend && uv run ruff check src tests && uv run mypy src && uv run pytest tests/fiscal/ tests/checkout/ tests/api/test_openapi.py`.

## 5. Frontend: emisión en «Facturas», preparación fiscal, «Cobrar y facturar» y Ajustes (Riesgo: Prueba al final)

- [ ] 5.1 Actualizar tipos, cliente HTTP y hooks en `frontend/src/features/fiscal/types.ts`, `frontend/src/features/fiscal/api.ts`, `frontend/src/features/fiscal/hooks.ts` y `frontend/src/features/checkout/types.ts` para soportar estados de emisión (`no_solicitada`, `pendiente`, `en_proceso`, `error_temporal`, `autorizada`, `no_autorizada`), llamadas a `emit`, `checkStatus`, configuración de emisión por entidad y punto exclusivo.
- [ ] 5.2 Actualizar `frontend/src/pages/fiscal/FiscalPreparationPage.tsx` y `frontend/src/features/fiscal/FiscalPreparationLink.tsx` para mostrar el estado de emisión, el aviso visible de **«Ambiente de pruebas (sin validez tributaria)»**, el número fiscal y clave de acceso cuando existan, y las acciones «Facturar», «Consultar estado» (sin reenvío en `en_proceso`), «Reintentar envío» o «Reemplazar datos» (para rechazos o preparaciones previas al formato 4).
- [ ] 5.3 Actualizar `frontend/src/pages/invoices/InvoicesPage.tsx` para filtrar por estado de emisión, mostrar en cada fila y en la vista previa el estado de la referencia fiscal, el número fiscal y el ambiente de pruebas, y permitir ejecutar «Facturar», «Consultar estado» o «Reintentar envío» según los permisos del usuario.
- [ ] 5.4 Actualizar `frontend/src/pages/checkout/CheckoutPage.tsx` para reflejar cuando un negocio tiene emisión en pruebas activa y mostrar en el resultado final por negocio si la factura quedó «Autorizada en pruebas (sin validez tributaria)», «Enviada al SRI (en proceso)», «Factura preparada (sin enviar)» o con error pendiente de reintento.
- [ ] 5.5 Actualizar `frontend/src/features/fiscal/configuration/LocationsSection.tsx` (y sección de estado fiscal en Ajustes) para que el Administrador pueda declarar el uso exclusivo del punto predeterminado (`NOR-007`), registrar el último secuencial autorizado inicial y activar/desactivar la emisión en ambiente de *Pruebas* por entidad fiscal (mostrando que *Producción* permanece bloqueado hasta el cambio 4).
- [ ] 5.6 Agregar y actualizar pruebas en `frontend/src/pages/invoices/InvoicesPage.test.tsx`, `frontend/src/pages/fiscal/FiscalPreparationPage.test.tsx`, `frontend/src/features/fiscal/FiscalPreparationLink.test.tsx`, `frontend/src/pages/checkout/CheckoutPage.test.tsx` y `frontend/src/features/fiscal/configuration/LocationsSection.test.tsx`.
- [ ] 5.7 Verificar Grupo 5: `cd frontend && npx vitest run src/pages/invoices/InvoicesPage.test.tsx src/pages/fiscal/FiscalPreparationPage.test.tsx src/features/fiscal/FiscalPreparationLink.test.tsx src/pages/checkout/CheckoutPage.test.tsx src/features/fiscal/configuration/LocationsSection.test.tsx && npm run lint && npm run typecheck && npm run build`.

## 6. Documentación arquitectónica (`ADR-0015`), C4, dominio y trazabilidad (Riesgo: Sin prueba nueva)

- [ ] 6.1 Crear `docs/adr/0015-nucleo-de-emision-independiente-del-proveedor-y-cola-fiscal.md` y actualizar la referencia en `docs/adr/0010-modulo-fiscal-independiente-y-archivo-transaccional.md` y `docs/cambios-pendientes.md`.
- [ ] 6.2 Actualizar `docs/architecture/c4-containers.md` con el adaptador de emisión y la conexión de salida hacia el proveedor de emisión / SRI.
- [ ] 6.3 Sincronizar `docs/arquitectura/modelo-dominio.md` (§7 estados canónicos de la referencia fiscal y §11.8), `docs/negocio/requisitos/actores-y-roles.md` (§3 y §7 permisos `fiscal.comercial.emitir` y `fiscal.artesanal.emitir`), `docs/tecnico/operacion-archivo-fiscal.md`, `docs/negocio/producto/glosario.md` / `docs/tecnico/glosario-tecnico.md` (si aplica término técnico nuevo), `docs/negocio/requisitos/cobertura-modulo-fiscal.md` (una fila por requisito nuevo con su prueba) y `docs/negocio/requisitos/matriz-trazabilidad.md`.
- [ ] 6.4 Verificar Grupo 6: `openspec validate "emitir-comprobantes-electronicos"`.
