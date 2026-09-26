## 1. Preparación, catálogo oficial y política de verificación

Dependencias:
- propuesta, specs y diseño aprobados, disponibles en `master` (`112e5f5`);
- el cambio `ajustar-venta-vinculada-vacia-y-textos-de-servicios`, integrado o coordinado antes de tocar `ServiceOperationDetailPage.tsx`.

Por instrucción del usuario se ejecutan solo pruebas focalizadas:
- backend: `cd backend && uv run --frozen pytest --no-cov <archivo o nodeid>`;
- frontend: `cd frontend && npx vitest run <archivo>`, más `tsc`, ESLint y prettier sobre los archivos tocados;
- E2E: solo `e2e/fiscal.spec.ts` y `e2e/workshop-configuration.spec.ts`.

No se ejecutan `make check`, `make test` ni Playwright completo; si una tarea los pide, se registra qué se ejecutó y qué no. Cada tarea de comportamiento sigue TDD: prueba roja por la razón esperada, implementación mínima, refactorización y prueba verde.

- [x] 1.1 Comprobar el estado Git, que los artefactos aprobados estén en `master` y el estado del cambio activo `ajustar-venta-vinculada-vacia-y-textos-de-servicios`. Registrar cualquier contradicción nueva sin cambiar reglas de negocio.
- [x] 1.2 Ampliar `docs/negocio/requisitos/cobertura-modulo-fiscal.md` con los requisitos y escenarios de las cinco specs delta, enlazando cada uno con su tarea y su prueba o evidencia en estado pendiente.
- [x] 1.3 Descargar desde el sitio del SRI la ficha técnica vigente de facturación electrónica y registrar la versión exacta, la URL, la fecha de descarga y el SHA-256 del archivo. Extraer de ella las tarifas de IVA (códigos, descripciones, tarifas, tratamientos y vigencias) y las formas de pago de la Tabla 24. Anotar toda diferencia con la tabla de la spec, sabiendo que prevalece la ficha.
  - **Si la ficha no está disponible:** marcar la tarea como bloqueada y continuar con los grupos que no dependen del contenido. No se usan valores de la spec ni de proveedores.
  - **Evidencia:** procedencia registrada en el manifiesto y en `cobertura-modulo-fiscal.md`.
- [x] 1.4 Crear `backend/src/workshop_configuration/catalogs/sri-<version>.json` con las entradas vigentes de 1.3. Incluir también la versión legado `SRI-2.34-IVA-subset-v1` con su procedencia original (ficha 2.34), para mantener resolubles las correspondencias existentes. Cada entrada lleva `display_name` comprensible.

## 2. Catálogo oficial versionado (backend)

Dependencias: 1.3 y 1.4 para la carga de datos; el modelo y las validaciones pueden empezar antes. Diseño D2/D10; spec `configuracion-operativa-y-fiscal` (correspondencias y formas de pago).

- [x] 2.1 Escribir `backend/tests/workshop_configuration/test_official_catalog.py`:
  - procedencia obligatoria (versión de ficha, URL, fecha de descarga, SHA);
  - unicidad `(kind, catalog_version, code)`;
  - vigencia válida y `rate` solo en `TAX_RATE`;
  - inmutabilidad mediante servicios;
  - rechazo de una entrada sin fuente.
- [x] 2.2 Crear `OfficialCatalogEntry` en `workshop_configuration/models.py` con sus restricciones y la migración de esquema. Criterio: las pruebas de 2.1 del modelo pasan y `uv run python manage.py makemigrations --check` no detecta cambios pendientes.
- [x] 2.3 Crear el servicio de lectura `application/official_catalog.py` (listar por tipo, versión y estado activo; obtener una entrada) y la migración de datos que carga el manifiesto.
  - La migración verifica el SHA declarado y falla sin carga parcial si falta procedencia.
  - Probar la carga, el fallo por manifiesto alterado y la reversión.
- [x] 2.4 Probar y añadir `FiscalTaxMapping.catalog_entry` (nullable), con relleno por `(catalog_version, percentage_code)`.
  - Si una fila queda sin entrada, la migración falla y la informa.
  - Ampliar `test_fiscal_migrations.py` con datos previos y la reversión.
- [x] 2.5 Adaptar `application/fiscal_tax_mapping.py` para exigir `catalog_entry_id` en las correspondencias nuevas y derivar código y versión de la entrada. `resolve_mapping` debe resolver desde la entrada y comparar la tarifa histórica, y deben eliminarse `IVA_CODES`, `CATALOG_VERSION` y `CATALOG_SOURCE`.
  - Actualizar `test_fiscal_tax_mapping.py`: tarifa incompatible, solapamiento, entrada inactiva y tratamientos cero, no objeto y exento distintos.
  - Probar la resolución de una correspondencia legado.

## 3. Formas de pago, valores predeterminados, ambiente y estado del perfil (backend)

Dependencias: grupo 2. Diseño D3/D4/D7/D8/D11; specs `configuracion-operativa-y-fiscal` y `preparacion-y-seguimiento-fiscal`.

- [x] 3.1 Escribir `test_payment_form_settings.py`:
  - política V1 sin registros (`01` y `20` habilitadas, `01` predeterminada);
  - habilitar o deshabilitar `01` y `20`;
  - rechazo `payment_form_not_enableable_v1` para `16` y `19`;
  - rechazo al deshabilitar la forma predeterminada sin sustituto;
  - versión esperada, idempotencia, permiso de Administrador y denegación a Vendedor y Encargado.
- [x] 3.2 Crear `FiscalPaymentFormSetting`, la política `V1_ENABLEABLE_PAYMENT_FORMS` en el dominio de configuración y el servicio de habilitación. Bloqueo: `FiscalEntity` y luego el registro propio. Migración aditiva sin filas iniciales.
- [x] 3.3 Escribir `test_preparation_defaults.py`:
  - un único punto activo se usa sin designación;
  - varios puntos sin designación producen `default_point_required`;
  - la designación válida se usa;
  - un punto de otra entidad se rechaza;
  - el punto designado deshabilitado es inutilizable;
  - designación concurrente;
  - forma predeterminada no habilitada rechazada.
- [x] 3.4 Crear `FiscalPreparationDefaults`, su migración, el servicio de escritura con versión e idempotencia y el resolvedor de punto efectivo y forma predeterminada efectiva.
- [x] 3.5 Probar y adaptar `application/fiscal_resolver.py`:
  - quitar los parámetros `environment` y `point_id`;
  - usar siempre el ambiente de pruebas y el punto efectivo;
  - devolver las formas habilitadas y la huella de configuración.

  Probar el rechazo `production_disabled` en toda escritura de configuración que reciba un ambiente. Actualizar `test_fiscal_resolver.py` y verificar el orden de bloqueos de D8 en `test_lock_order.py`.
- [x] 3.6 Escribir `test_electronic_status.py` y crear `application/electronic_status.py`:
  - estados `NOT_CONFIGURED`, `INCOMPLETE`, `NEEDS_REVIEW` y `READY`, con causas;
  - prioridad de `INCOMPLETE` cuando también hay causas de revisión;
  - condición o correspondencia fuera de vigencia;
  - entrada de catálogo inactiva;
  - definición tributaria sin correspondencia;
  - certificado ausente o vencido solo como advertencia, con el estado `READY` intacto.

  El resolvedor debe derivar `preparation_issues` de esta misma evaluación.
- [x] 3.7 Probar y exponer la API de D8 en `fiscal/api`:
  - `electronic-status`;
  - `preparation-defaults` (GET y PUT);
  - `catalogs/{kind}`;
  - listado `entities/{id}/tax-mappings/`;
  - alta de correspondencia con `catalog_entry_id`;
  - `payment-forms` (GET y PUT).

  Probar las respuestas 400, 403, 409 y la matriz de roles y sus combinaciones en `test_fiscal_permissions.py` y `tests/fiscal/test_api.py`. Actualizar OpenAPI y `test_openapi.py`.

Evidencia: pruebas focalizadas de `backend/tests/workshop_configuration/` y los casos de API afectados; `makemigrations --check`.

## 4. Preparación simplificada e instantánea (backend)

Dependencias: grupo 3. Diseño D1/D5/D6; spec `preparacion-y-seguimiento-fiscal`.

- [x] 4.1 Probar y añadir `collected_by_method` en `sales/application/fiscal_source.py` y `workshop/application/fiscal_source.py`, como lectura pura:
  - suma de partes de pagos vigentes por medio;
  - un pago original corregido se excluye y su reemplazo se incluye;
  - la lectura no escribe ni importa `fiscal`.

  Ampliar `backend/tests/sales/test_fiscal_source.py`, `backend/tests/workshop/test_fiscal_source.py` y `tests/fiscal/test_boundaries.py`.
- [x] 4.2 Escribir `tests/fiscal/test_payment_suggestion.py` y crear `fiscal/domain/payment_suggestion.py`, pura:
  - cobro total por medio;
  - cobro parcial más el resto con la forma predeterminada;
  - sin cobros;
  - exceso sobre el total;
  - medio con forma deshabilitada;
  - importes exactos a centavos.
- [x] 4.3 Adaptar `fiscal/domain/payment_declaration.py` y `test_payment_declaration.py`:
  - una o varias formas habilitadas y vigentes con suma exacta;
  - `term_days` y `time_unit` rechazados;
  - crédito sin impedimento;
  - forma deshabilitada rechazada.

  Retirar `SUPPORTED_PAYMENT_CODES`: las formas admitidas llegan desde la configuración resuelta.
- [x] 4.4 Probar y adaptar `create_draft`:
  - precarga del receptor desde `customer_snapshot` (CI→`05`, RUC→`04`, nombre, dirección, correo);
  - sugerencia de formas;
  - `draft_format: 2`;
  - entidad tomada del origen.

  Mantener idempotencia, bloqueos y el rechazo por evidencia externa. Cubrir la venta comercial y la operación artesanal.
- [x] 4.5 Probar y adaptar `update_draft` y `PATCH` del detalle:
  - aceptar solo `expected_version`, `receiver`, `payments.forms[{payment_code, amount}]` y `additional_info`;
  - rechazar con 400 `field_not_allowed` los campos `environment`, `point_id`, `reference_date`, `fiscal_entity_id`, `term_days` y `time_unit`, sin cambiar la versión.
- [x] 4.6 Probar y adaptar la revisión:
  - fecha fiscal calculada con `America/Guayaquil` (caso `2026-09-27T03:30:00Z` → `2026-09-26`);
  - impedimentos con `audience` y mensajes comprensibles de `fiscal/application/impediment_messages.py`;
  - token con fecha y huella de configuración.
- [x] 4.7 Probar y adaptar la preparación: 409 `review_stale` cuando cambia la configuración (perfil, punto, forma, correspondencia) o el día entre la revisión y la preparación, sin preparar con versiones mezcladas.
- [x] 4.8 Probar y adaptar `snapshot_builder.py` y `fiscal/domain/snapshot.py`:
  - `snapshot_format: 2` con el bloque `configuration`, formas con descripción, nombre y versión del catálogo, y líneas con `catalog_entry_id` y `display_name`;
  - `issuer` intacto para `identity.py`;
  - lectura compatible del formato 1;
  - inmutabilidad frente a cambios posteriores de punto, catálogo, habilitación, cobros y cliente.
- [x] 4.9 Probar y adaptar la consulta del detalle y los borradores anteriores:
  - `summary`, `issuer`, `receiver`, `payments`, `payment_options` y `missing_fields`;
  - `technical` solo para el Administrador en preparaciones completadas;
  - un borrador de formato 1 ignora `environment`, `point_id`, fecha y plazo, y recibe la precarga en la consulta sin escribirla;
  - una preparación antigua completada se muestra sin completar referencias.

  Actualizar OpenAPI.

Evidencia: casos focalizados de `tests/fiscal/test_api.py`, `test_snapshot.py`, `test_payment_*.py` y las lecturas de `sales` y `workshop` por nodeid; ninguna prueba altera deuda, inventario ni numeración interna.

## 5. Pestañas de configuración (frontend)

Dependencias: ninguna del backend; puede avanzar en paralelo con el grupo 2. Diseño D9; spec `organizacion-de-la-configuracion`.

- [ ] 5.1 Probar en `shared/ui/navigation/Tabs.test.tsx` y añadir a `Tabs.tsx`:
  - prop opcional `keepMounted`, con paneles inactivos marcados `hidden` y conservando el estado;
  - barra con desplazamiento horizontal interno y la pestaña activa visible;
  - sin cambio de comportamiento por defecto.

  Ejecutar también la prueba de `MaintenanceOrderDetailPage` como regresión.
- [ ] 5.2 Probar en `WorkshopConfigurationPage.test.tsx`:
  - las cinco pestañas en orden;
  - *Entidades fiscales* inicial y con un `?tab=` desconocido;
  - enlace directo y restauración con `?tab=facturacion`;
  - teclado (flechas, Inicio, Fin);
  - relación accesible entre pestaña y panel;
  - error de impuestos que persiste al cambiar de pestaña;
  - «Entidades fiscales» presente e «Identidades fiscales» ausente;
  - series internas sin puntos fiscales.
- [ ] 5.3 Reorganizar `pages/workshop-configuration/WorkshopConfigurationPage.tsx`:
  - `Tabs` con `keepMounted` y `?tab=`, y contadores en las pestañas;
  - retirar `ConfigurationMap` de esta página;
  - reubicar `EntitiesSection`, `WarehouseSection`, `TaxesSection` y `SeriesSection` sin cambios internos;
  - cambiar solo títulos y descripciones («Entidades fiscales», «Bodega»).
- [ ] 5.4 Ejecutar las pruebas existentes de entidades, bodega, impuestos y series sin modificar sus expectativas funcionales (solo etiquetas), y la prueba de acceso denegado a Vendedor y Encargado con enlace directo.

Evidencia: vitest de los archivos tocados, `tsc` y ESLint sobre ellos.

## 6. Facturación electrónica en la configuración (frontend)

Dependencias: grupos 3 y 5. Diseño D7/D8/D9; specs `configuracion-operativa-y-fiscal` y `organizacion-de-la-configuracion`.

- [ ] 6.1 Actualizar `features/fiscal/types.ts`, `api.ts` y `hooks.ts` para los endpoints de D8, con claves de consulta por entidad, y sus pruebas (`api.test.ts`, `hooks.test.tsx`).
- [ ] 6.2 Probar y crear `features/fiscal/configuration/ElectronicStatusCard.tsx`:
  - los cuatro estados con sus causas en texto;
  - «Sin configurar» en lugar de «Revisión 0»;
  - advertencia de certificado separada;
  - ambiente *Pruebas* con la explicación de que la emisión real no está disponible.
- [ ] 6.3 Probar y crear `ProfileConditionsSection.tsx`:
  - declaración de las seis condiciones con estado (desconocida, aplicable, no aplicable), valor, fuente y vigencia;
  - ayuda contextual por condición;
  - sin deducir condiciones del tipo de entidad.
- [ ] 6.4 Probar y crear `LocationsSection.tsx`: alta de establecimientos y puntos conservada, designación del punto predeterminado, e impedimento visible cuando hay varios puntos sin designación.
- [ ] 6.5 Probar y crear `TaxMappingsSection.tsx`:
  - selector del catálogo por `display_name`, sin campo de código libre, con el código en «Información avanzada»;
  - dato fijo si hay una sola definición;
  - mensaje «Primero debe configurarse el catálogo tributario de esta entidad»;
  - «Fundamento» con su explicación;
  - listado de correspondencias vigentes e históricas.
- [ ] 6.6 Probar y crear `PaymentFormsSection.tsx`:
  - catálogo completo con código, descripción, fuente, versión de la ficha, fecha de descarga y vigencia;
  - interruptor solo en `01` y `20`, y el resto deshabilitado con explicación;
  - selección de la forma predeterminada;
  - error al deshabilitar la predeterminada.
- [ ] 6.7 Probar y crear `CertificateSection.tsx`:
  - campos opcionales con nombres y ayuda de la spec;
  - explicación de que no equivale a firma ni autorización;
  - sin carga de archivos ni contraseñas;
  - guardado vacío admitido.
- [ ] 6.8 Componer la pestaña *Facturación electrónica*:
  - aviso permanente y selector de entidad con razón social y RUC;
  - subpestañas `pill` con `?seccion=`;
  - subárbol montado con `key={entityId}`.

  Sustituir `FiscalConfigurationSection` y retirar su prueba obsoleta. Probar el cambio de comercial a artesanal: datos, formulario sin guardar y error de la otra entidad.

Evidencia: vitest por archivo de `features/fiscal/configuration/` y de la página, más `tsc` y ESLint.

## 7. Preparación simplificada y terminología (frontend)

Dependencias: grupo 4. Diseño D5/D9; specs `preparacion-y-seguimiento-fiscal`, `ventas-comerciales` y `operacion-artesanal-de-servicios`.

- [ ] 7.1 Actualizar los tipos y hooks de la preparación: `DraftUpdate` sin campos técnicos; detalle con `summary`, `payment_options`, `missing_fields` y `technical` opcional; impedimentos con `audience`.
- [ ] 7.2 Probar en `FiscalPreparationPage.test.tsx`:
  - resumen no editable;
  - solo se piden los datos faltantes del receptor;
  - ausencia de ambiente, punto, códigos, fecha y plazo;
  - sugerencia marcada y editable, con varias formas y diferencia con el total;
  - solo formas habilitadas;
  - impedimentos agrupados por audiencia;
  - `review_stale`;
  - información avanzada solo para el Administrador;
  - aviso obligatorio y ausencia de términos prohibidos en los tres estados.
- [ ] 7.3 Reescribir `pages/fiscal/FiscalPreparationPage.tsx` según D9, con confirmaciones en toast y errores persistentes junto a su dato.
- [ ] 7.4 Probar y ajustar textos en `FiscalPreparationLink.tsx`, `SaleDetailPage.tsx` y `ServiceOperationDetailPage.tsx`: «Preparar datos fiscales» y «Preparación local · Pendiente de emisión». Modificar solo textos fiscales, respetando los del cambio activo de servicios.
- [ ] 7.5 Añadir una utilidad de prueba compartida que falle ante «factura emitida», «autorizada», «enviada al SRI» o «aprobada» en las vistas fiscales, y aplicarla en las pruebas de 7.2 y 7.4.

Evidencia: vitest de los archivos tocados, más `tsc`, ESLint y prettier.

## 8. Recorridos E2E focalizados

Dependencias: grupos 4, 6 y 7.

- [ ] 8.1 Ampliar `frontend/e2e/workshop-configuration.spec.ts`:
  - pestañas, enlace directo y teclado;
  - vista de 360 px sin desplazamiento de la página;
  - designación del punto predeterminado y catálogo de formas;
  - cambio de entidad;
  - denegación a un Vendedor.
- [ ] 8.2 Ampliar `frontend/e2e/fiscal.spec.ts`:
  - venta confirmada, «Preparar datos fiscales», resumen precargado, solo faltantes, sugerencia de formas, revisión y preparación local con el aviso;
  - operación artesanal preparada por el Encargado;
  - preparación intacta tras cambiar el punto predeterminado.
- [ ] 8.3 Ejecutar solo esos dos archivos E2E y registrar el resultado; no ejecutar el resto de Playwright.

## 9. Documentación, trazabilidad y cierre

Dependencias: grupos 2 a 8.

- [ ] 9.1 Actualizar `docs/negocio/producto/glosario.md` con «Preparación local», «Borrador fiscal», «Pendiente de emisión», «Punto predeterminado», «Forma de pago predeterminada» y «Catálogo oficial».
- [ ] 9.2 Actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md` (pestañas de configuración, preparación simplificada), `casos-de-uso.md` (CU-003 y CU-012), `matriz-trazabilidad.md` y `cobertura-modulo-fiscal.md` con las pruebas reales.
- [ ] 9.3 Actualizar `docs/tecnico/matriz-instantanea-fiscal.md` (snapshot formato 2) y `docs/arquitectura/modelo-dominio.md` §11.6 (punto predeterminado, catálogos oficiales, formas habilitadas).
- [ ] 9.4 Corregir en la sección Impact de la propuesta la frase sobre `sales` y `workshop` (solo lecturas `fiscal_source`), según la discrepancia registrada en el diseño.
- [ ] 9.5 Verificación final focalizada:
  - backend: `uv run ruff format --check` y `uv run ruff check` sobre los archivos tocados, `mypy` sobre los paquetes afectados, `manage.py check`, `makemigrations --check`, OpenAPI y cobertura de `workshop_configuration` y `fiscal` en la selección ejecutada;
  - frontend: `npm run build`;
  - `openspec validate simplificar-flujo-fiscal-y-configuracion-centralizada --strict`.

  Registrar comandos, resultados y lo no ejecutado (suite completa y Playwright completo).

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
