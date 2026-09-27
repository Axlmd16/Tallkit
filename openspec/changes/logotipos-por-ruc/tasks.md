## 1. Preparación y política de verificación

Dependencias: propuesta, specs y diseño aprobados y registrados en `master` antes de aplicar.

Por instrucción del usuario, solo se ejecutan pruebas focalizadas:

- **Backend:** `cd backend && uv run pytest tests/workshop_configuration/test_entity_logos.py tests/workshop_configuration/test_logo_rules.py tests/workshop_configuration/test_api.py tests/workshop_configuration/test_entity_warehouse_services.py tests/workshop_configuration/test_fiscal_migrations.py`, más `uv run ruff check` y `uv run ruff format --check` sobre los archivos tocados, `uv run mypy` sobre el módulo y `uv run python manage.py makemigrations --check --dry-run`.
- **Frontend:** `cd frontend && npx vitest run <archivos afectados>`, `npx tsc --noEmit -p tsconfig.app.json`, y `npx eslint` y `npx prettier --check` sobre los archivos tocados.
- **E2E:** solo los casos nuevos o afectados de `e2e/workshop-configuration.spec.ts`, `e2e/sales-payments.spec.ts` y `e2e/maintenance-billing.spec.ts`.

No se ejecutan `make check`, `make test` ni Playwright completo. Si una tarea los pide, se registra qué se ejecutó y qué no. Cada tarea de comportamiento sigue TDD: prueba roja por la razón esperada, implementación mínima, refactorización y prueba verde.

- [x] 1.1 Comprobar el estado Git y que los artefactos de este cambio estén en `master`. Revisar `git log` por si hay cambios ajenos en `workshop_configuration/`, `DocumentSheet.tsx` o `EntitiesSection.tsx`, y registrar cualquier contradicción nueva.
- [x] 1.2 Ejecutar la línea base focalizada antes de tocar código y registrar el resultado:
  - backend: `uv run pytest tests/workshop_configuration/test_api.py tests/workshop_configuration/test_entity_warehouse_services.py`;
  - frontend: `npx vitest run src/shared/ui/business/DocumentSheet.test.tsx src/pages/workshop-configuration`.
  - Evidencia (2026-09-27): no hay cambios ajenos pendientes (árbol limpio en `develop`). Backend: 57 aprobadas; el umbral global de cobertura falla solo por ser una ejecución parcial. Frontend: 3 archivos y 22 pruebas aprobadas.

## 2. Datos y reglas del logotipo (backend)

Dependencias: grupo 1. Diseño D1 y D2; spec `configuracion-operativa-y-fiscal` («Logotipo opcional por entidad fiscal», «Validación del archivo del logotipo»).

- [x] 2.1 Escribir `backend/tests/workshop_configuration/test_logo_rules.py` con los formatos admitidos, el límite de 2 MiB y el de 25 megapíxeles. Después, crear `backend/src/workshop_configuration/domain/logo_rules.py`, sin dependencias de Django.
- [x] 2.2 Escribir en `test_fiscal_migrations.py`, o en un archivo nuevo de modelos, estas pruebas:
  - `FiscalEntityLogo` único por entidad y `storage_name` único;
  - `FiscalEntity.logo_revision` inicia en 0;
  - la migración deja ambas entidades sin logotipo y no altera `version`.

  Después, añadir los modelos y la migración `workshop_configuration/0013_fiscal_entity_logo`.
- [x] 2.3 Escribir las pruebas de inspección en `test_entity_logos.py`:
  - aceptación: PNG con alfa, JPEG y WebP estáticos;
  - rechazo: SVG, SVG renombrado a `.png`, GIF, WebP animado, PDF, ejecutable con extensión `.jpg`, archivo dañado, 2,5 MiB y 30 MP, cada uno con su código y mensaje;
  - la imagen normalizada no conserva EXIF y PNG y WebP conservan la transparencia.

  Después, crear `backend/src/workshop_configuration/application/logo_storage.py`:
  - `inspect_logo`, que vuelve a codificar la imagen en el mismo formato;
  - `store_logo`, con prefijo `fiscal-logos/<entity_id>/<uuid>.<ext>` en `PRIVATE_MEDIA_ROOT`;
  - `delete_files`, `open_file` e `iter_logo_files`.
- [x] 2.4 Verificar: `uv run pytest` de los archivos de 2.1 a 2.3, `ruff`, `mypy` y `makemigrations --check --dry-run`.
  - Evidencia (2026-09-27): `uv run pytest --no-cov tests/workshop_configuration/test_logo_rules.py test_logo_storage.py test_entity_logo_models.py` → 25 aprobadas. `ruff check` y `ruff format` sin hallazgos, `mypy src/workshop_configuration` sin errores y `makemigrations --check --dry-run` sin cambios.
  - Las pruebas de inspección quedaron en `test_logo_storage.py` y las del modelo y la migración en `test_entity_logo_models.py`, en lugar de `test_entity_logos.py`, que se reserva para los comandos y la API.
  - Se usa `--no-cov` porque el umbral global de cobertura no aplica a ejecuciones parciales.

## 3. Comandos de carga, reemplazo y retiro (backend)

Dependencias: grupo 2. Diseño D3; spec `configuracion-operativa-y-fiscal` («Reemplazo y retiro del logotipo», «Consistencia del logotipo ante fallos y concurrencia», «Logotipo opcional por entidad fiscal»).

- [x] 3.1 Escribir las pruebas de permisos:
  - el Administrador puede;
  - Vendedor, Encargado del taller y la combinación Vendedor + Encargado no pueden: se deniega, se audita y no quedan archivos ni registros.
- [x] 3.2 Escribir las pruebas de `upload_entity_logo`:
  - carga inicial;
  - reemplazo: `logo_revision` se incrementa y el archivo anterior se borra en `on_commit`;
  - la otra entidad no cambia;
  - `FiscalEntity.version` no cambia;
  - auditoría `fiscal_entity_logo_uploaded` o `_replaced` sin contenido de imagen;
  - rechazo auditado con `fiscal_entity_logo_rejected`.
- [x] 3.3 Escribir las pruebas de idempotencia:
  - misma clave y mismo archivo: un solo registro y un solo evento, sin escribir un archivo nuevo;
  - misma clave y otro archivo: `idempotency_conflict`;
  - clave inválida: error de validación.
- [x] 3.4 Escribir las pruebas de `remove_entity_logo`:
  - retiro auditado y archivo borrado en `on_commit`;
  - retiro sin logotipo: 200, sin evento;
  - retiro repetido con otra clave: inocuo.
- [x] 3.5 Escribir las pruebas de fallos:
  - error de almacenamiento al escribir: se conserva el logotipo anterior y no hay registro nuevo;
  - error dentro de la transacción: se borra el archivo nuevo y se conserva el anterior.
- [x] 3.6 Escribir la prueba de concurrencia (`transaction=True`) en `test_entity_logos.py` o `test_concurrency.py`: dos cargas simultáneas sobre la misma entidad terminan con un único registro vigente con archivo, y el otro archivo borrado o limpiable.
- [x] 3.7 Implementar `backend/src/workshop_configuration/application/entity_logos.py` según D3:
  - `require_permission("entidades_fiscales.editar")`;
  - recibo `ConfigurationCommand` con huella `{entity_id, sha256}` o `{entity_id}`;
  - archivo escrito fuera de la transacción;
  - `select_for_update` sobre `FiscalEntity`;
  - `on_commit` para el archivo anterior;
  - limpieza del archivo nuevo ante cualquier excepción.
- [x] 3.8 Escribir las pruebas y crear el comando `purge_entity_logos` en `backend/src/workshop_configuration/management/commands/`, un paquete nuevo con sus `__init__.py`:
  - solo borra archivos de `fiscal-logos/` sin registro y más antiguos que el margen;
  - una segunda ejecución no falla;
  - no toca `maintenance/` ni logotipos vigentes.
- [x] 3.9 Verificar: `uv run pytest tests/workshop_configuration/test_entity_logos.py tests/workshop_configuration/test_concurrency.py`, `ruff` y `mypy`.
  - Evidencia (2026-09-27): `uv run pytest --no-cov tests/workshop_configuration/test_entity_logos.py tests/workshop_configuration/test_concurrency.py` → 26 aprobadas. La concurrencia de dos cargas está en `test_entity_logos.py` con `run_parallel` y `transaction=True`. `ruff check`, `ruff format --check` y `mypy src/workshop_configuration` sin hallazgos.

## 4. API y contrato (backend)

Dependencias: grupo 3. Diseño D5; spec `configuracion-operativa-y-fiscal` («Entrega privada del logotipo»).

- [x] 4.1 Escribir las pruebas de API en `test_entity_logos.py`:
  - `POST entities/<id>/logo/` en multipart: 200 con `logo`; 400 con el detalle en `file`; 403 para roles sin permiso; 409 por conflicto de clave;
  - `POST entities/<id>/logo/remove/`: 200 con `logo: null`;
  - `GET entities/` y `GET entities/<id>/`: incluyen `logo` o `null`.
- [x] 4.2 Escribir las pruebas de entrega:
  - `GET entity-logos/` para Administrador, Vendedor y Encargado devuelve `COMERCIAL` y `ARTESANAL` con `url`, `width`, `height` y `legal_name`, o `null` sin logotipo;
  - `GET entity-logos/<entity_type>/<revision>/` con sesión devuelve 200, el `Content-Type` real y las cabeceras `Cache-Control: private, max-age=31536000, immutable`, `nosniff` y `CSP default-src 'none'`;
  - sin sesión: denegada sin revelar existencia;
  - revisión antigua, tipo desconocido o entidad sin logotipo: 404.
- [x] 4.3 Implementar las vistas y serializadores en `backend/src/workshop_configuration/api/views.py`, registrar las rutas en `api/urls.py` y ampliar `_entity_data` con `logo`. Las vistas deben quedar delgadas y delegar en `entity_logos`.
- [x] 4.4 Regenerar `backend/schema.yml` con `drf-spectacular` y comprobar que no queden diferencias pendientes.
- [x] 4.5 Verificar: `uv run pytest` de los archivos del grupo más `tests/workshop_configuration/test_api.py` y `test_entity_warehouse_services.py` (regresión de la edición de entidad), `ruff` y `mypy`.
  - Evidencia (2026-09-27): `uv run pytest --no-cov tests/workshop_configuration/test_entity_logo_api.py test_entity_logos.py test_api.py test_entity_warehouse_services.py` → 88 aprobadas. `ruff check`, `ruff format --check` y `mypy` sin hallazgos. Las pruebas HTTP quedaron en `test_entity_logo_api.py`.
  - El resumen `entity-logos/` devuelve por entidad `entity_id`, `legal_name` y `logo`; el diseño D5 se ajustó a esa forma.
  - Brecha previa: el `backend/schema.yml` versionado estaba desactualizado y no incluía 31 rutas existentes, entre ellas las del módulo fiscal. Se regeneró completo con `manage.py spectacular`: no se elimina ninguna ruta y se añaden las 4 de este cambio más esas 31.

## 5. Hoja del documento con la identidad del emisor (frontend)

Dependencias: grupo 4. Diseño D5 y D6; specs `patrones-de-pantalla-frontend` (PPF-05 y PPF-09), `ventas-comerciales`, `operacion-artesanal-de-servicios` y `sistema-visual-frontend`.

- [x] 5.1 Escribir las pruebas de `useEntityLogos` y sus tipos, y crear `frontend/src/shared/api/entity-logos.ts` (TanStack Query, `staleTime` largo, clave `entity-logos`).
- [x] 5.2 Ampliar `src/shared/ui/business/DocumentSheet.test.tsx`:
  - con logotipo: `img` con alt «Logo de {nombre}» y el nombre visible;
  - sin logotipo: solo el nombre y ningún isotipo de Tallkit;
  - si la imagen falla, se muestra el nombre sin imagen rota;
  - una hoja `ARTESANAL` nunca usa la URL comercial;
  - pie «Generado con Tallkit»;
  - el logotipo muy ancho queda acotado por clase o estilo.
- [x] 5.3 Implementar en `DocumentSheet.tsx`:
  - la propiedad `issuer: { scope, name }`;
  - retirar la importación del isotipo;
  - encabezado con logotipo o nombre, y pie «Generado con Tallkit»;
  - estilos en `document-sheet.css`, incluidas las reglas de impresión A4 y la legibilidad en blanco y negro.
- [x] 5.4 Escribir las pruebas y crear `useSheetBrandReady`: queda listo cuando el resumen se resolvió y la imagen cargó o falló, con un máximo de 5 s.
- [x] 5.5 Actualizar los consumidores y sus pruebas:
  - `features/sales/SalesDocument.tsx`: `scope: 'COMERCIAL'` y nombre `issuer.legal_name`;
  - `pages/maintenance/ServiceOperationDocumentPage.tsx`: `scope: 'ARTESANAL'`;
  - `features/purchases/PurchaseDocument.tsx` y `pages/purchases/PurchaseEditorPage.tsx`: nombre conservado del ingreso confirmado o razón social vigente en borrador.

  Si el detalle del ingreso confirmado no expone el nombre conservado, añadir primero, con TDD, su lectura en `backend/src/purchasing` y registrarlo en la evidencia.
- [x] 5.6 Deshabilitar «Imprimir comprobante» con estado ocupado accesible hasta `useSheetBrandReady` en `SaleDocumentPage.tsx` y `ServiceOperationDocumentPage.tsx`, con sus pruebas.
- [x] 5.7 Actualizar el catálogo visual interno (`src/dev/visual-catalog/previews.tsx`) con la hoja con logotipo y sin logotipo.
- [x] 5.8 Verificar: `npx vitest run` de `DocumentSheet.test.tsx`, `src/shared/api`, `src/features/sales`, `src/features/purchases`, `src/pages/sales`, `src/pages/maintenance` y `src/pages/purchases`, más `tsc`, ESLint y prettier sobre los archivos tocados.
  - Evidencia (2026-09-27): `npx vitest run src/shared/ui/business src/shared/api src/features/sales src/features/purchases src/pages/sales src/pages/maintenance src/pages/purchases src/dev` → 243 aprobadas y 2 fallidas. `npx tsc --noEmit -p tsconfig.app.json`, ESLint y prettier sin hallazgos sobre los archivos tocados.
  - Las 2 fallas son previas y ajenas al cambio: `ServiceOperationDetailPage` en `billingPages.test.tsx` falla igual con el árbol limpio (`git stash -u`) por «No QueryClient set».
  - 5.1 se implementó como `useIssuerBrand(scope)`, en lugar de `useEntityLogos`, y `DocumentSheet` recibe `issuer: { name, logoUrl }`; se ajustó D6.
  - 5.5: el editor de ingresos solo presenta borradores, porque los confirmados redirigen al detalle. Por eso se usa la razón social vigente y no fue necesario cambiar `backend/src/purchasing`.

## 6. Fila «Logo» y modal en la configuración (frontend)

Dependencias: grupo 4 y tarea 5.1. Diseño D7; spec `organizacion-de-la-configuracion` («Administración del logotipo en modal», «Entidades fiscales en fichas de consulta paralelas»).

- [x] 6.1 Ampliar los tipos y la API de entidades con `logo` y añadir las mutaciones de subir y quitar. Al terminar con éxito, invalidan `entities` y `entity-logos`.
- [x] 6.2 Escribir las pruebas de `EntityLogoModal`:
  - selector con `accept` de PNG, JPEG y WebP;
  - vista previa local del archivo elegido y URL liberada al cerrar;
  - aviso desplegable con formatos y límites;
  - la misma clave de idempotencia en los reintentos del mismo archivo y una nueva al cambiar de archivo;
  - un rechazo del servidor mantiene el modal abierto con el error junto al selector y conserva el archivo;
  - el éxito cierra el modal y muestra un toast.
- [x] 6.3 Crear `frontend/src/features/fiscal/configuration/EntityLogoModal.tsx` sobre `FormModal` y `HintPopover`.
- [x] 6.4 Escribir las pruebas de la fila «Logo» en `EntitiesSection`:
  - «Sin logo» con «Subir logo»;
  - vista previa con alt, más «Cambiar» y «Quitar»;
  - «Quitar» pide confirmación y, al confirmar, muestra «Sin logo» y un toast;
  - cancelar conserva el logotipo y devuelve el foco a «Quitar»;
  - un logotipo de 2000 × 200 px no se deforma ni desborda;
  - a 360 px las acciones siguen visibles.
- [x] 6.5 Implementar la fila en `pages/workshop-configuration/sections/EntitiesSection.tsx` y la confirmación con `ConfirmationPanel`.
- [x] 6.6 Verificar: `npx vitest run src/pages/workshop-configuration src/features/fiscal/configuration`, más `tsc`, ESLint y prettier sobre los archivos tocados.
  - Evidencia (2026-09-27): `npx vitest run src/pages/workshop-configuration src/features/workshop-configuration src/features/fiscal/configuration` → 9 archivos y 52 pruebas aprobadas. `tsc`, ESLint y prettier sin hallazgos.
  - `EntityLogoModal` quedó en `src/features/workshop-configuration/`, junto a sus mutaciones, en lugar de `features/fiscal/configuration/`.
  - Un fallo al quitar se comunica con `toast.info`, porque el sistema de toasts no tiene variante de error.
  - La visibilidad a 360 px se cubre con `flex-wrap` en la fila; no hay una prueba de viewport específica.

## 7. Recorridos E2E focalizados

Dependencias: grupos 5 y 6.

- [x] 7.1 Añadir a `frontend/e2e/workshop-configuration.spec.ts` el caso de subir un PNG válido, verlo en la ficha, rechazar un SVG con el modal abierto y quitarlo con confirmación. Usar imágenes de prueba en `frontend/e2e/fixtures/`, generadas y pequeñas.
- [x] 7.2 Añadir a `e2e/sales-payments.spec.ts` y `e2e/maintenance-billing.spec.ts` un caso que compruebe el encabezado del comprobante: logotipo de su entidad cuando existe y nombre cuando no.
- [x] 7.3 Verificar: ejecutar solo esos casos (`npx playwright test e2e/workshop-configuration.spec.ts` y los casos nuevos de los otros dos archivos con `-g`) y registrar el resultado.
  - Evidencia (2026-09-27), con el backend real de `testserver`:
    - `npx playwright test e2e/workshop-configuration.spec.ts` → 12 aprobadas, incluido el caso nuevo de subir, rechazar un SVG y quitar;
    - `npx playwright test e2e/sales-payments.spec.ts -g "logo comercial"` → 1 aprobada;
    - `npx playwright test e2e/maintenance-billing.spec.ts` → 1 aprobada, con el paso nuevo del comprobante artesanal.
  - No se ejecutó el resto de `sales-payments.spec.ts` ni el resto de Playwright.
  - Las imágenes de prueba se generan en `e2e/logo-helpers.ts`, un PNG de 1 × 1 en base64 y un SVG en memoria, en lugar de archivos en `e2e/fixtures/`. ESLint y prettier sin hallazgos.

## 8. Documentación, trazabilidad y operación

Dependencias: grupos 2 a 7.

- [x] 8.1 Actualizar las consecuencias de `docs/adr/0007-almacenamiento-privado-fotografias.md`:
  - reutilización para logotipos con el prefijo `fiscal-logos/` y `purge_entity_logos`;
  - entrega a cualquier usuario autenticado con caché privada por revisión;
  - consolidación futura de la inspección en `shared/`.

  Actualizar también su archivo de glosario.
- [x] 8.2 Actualizar `docs/arquitectura/modelo-datos.md` con `FiscalEntityLogo`, `logo_revision` y la ubicación `PRIVATE_MEDIA_ROOT/fiscal-logos/`, y `README.md` con el comando `purge_entity_logos` junto a `purge_workshop_files`.
- [x] 8.3 Añadir «Logotipo de entidad fiscal» a `docs/negocio/producto/glosario.md`.
- [x] 8.4 Actualizar `docs/negocio/requisitos/interfaz-y-navegacion.md`:
  - UI-014: fila «Logo»;
  - UI-058 y UI-077: encabezado con el logotipo del emisor;
  - la vista previa del ingreso.
- [x] 8.5 Actualizar `docs/negocio/requisitos/matriz-trazabilidad.md` y `docs/negocio/requisitos/cobertura-modulo-fiscal.md` con cada requisito y escenario y su prueba o recorrido que lo cubre.
- [x] 8.6 Verificar: `openspec validate logotipos-por-ruc --strict`, y comprobar que todos los enlaces y archivos de glosario de los documentos tocados existen.
  - Evidencia (2026-09-27): `openspec validate logotipos-por-ruc --strict` → válido. Se añadió «Logotipo de entidad fiscal» a `glosario.md` y a los glosarios compañeros de ADR-0007, `modelo-datos.md`, `interfaz-y-navegacion.md`, `matriz-trazabilidad.md` y `cobertura-modulo-fiscal.md`.
  - UI-041, la vista previa del ingreso, también se actualizó.
  - Los enlaces de cobertura apuntan a `openspec/changes/logotipos-por-ruc/`, igual que las filas de cambios anteriores.

## 9. Cierre de la aplicación

- [x] 9.1 Ejecutar la verificación focalizada final: backend (`pytest` de los archivos del grupo 1, más `ruff`, `mypy` y `makemigrations --check`), frontend (vitest de los archivos afectados, `tsc`, ESLint y prettier) y los E2E del grupo 7. Registrar en la evidencia qué se ejecutó y qué no, en particular que no se ejecutaron `make check`, `make audit` ni Playwright completo.
  - Evidencia (2026-09-27):
    - backend: `uv run pytest --no-cov` de los 9 archivos de `tests/workshop_configuration` del cambio y de regresión → 124 aprobadas; `ruff check src tests`, `ruff format --check`, `mypy src` (265 archivos) y `makemigrations --check --dry-run` sin hallazgos;
    - frontend: `npx vitest run` de 11 carpetas afectadas → 295 aprobadas y 2 fallidas, las mismas previas y ajenas de `ServiceOperationDetailPage` («No QueryClient set»); `tsc`, ESLint y prettier sin hallazgos sobre los archivos cambiados respecto de `master`;
    - E2E: los del grupo 7.
  - No se ejecutaron `make check`, `make test`, `make audit` ni Playwright completo.
- [x] 9.2 Revisar la aplicación con la interfaz en ejecución: ficha con y sin logotipo, modal, comprobantes de venta, servicios e ingreso en pantalla y en vista de impresión. Registrar las observaciones.
  - Evidencia (2026-09-27): capturas con Playwright y el backend real en 1440 y 360 px del modal con vista previa, la ficha con y sin logo, la vista previa de venta y la de ingreso con el logo del emisor. Se vieron correctos el logo acotado, el nombre del emisor y la mención «Generado con Tallkit» al pie.
  - Corrección: en escritorio, «Cambiar» y «Quitar» se apilaban con mucho alto; ahora son botones compactos que solo saltan de línea si no caben.
  - Queda para el usuario revisar la impresión física en A4.

## Verificación (2026-09-27)

`/opsx:verify`:
- tareas: 45 de 45;
- requisitos: 13 de 13 con implementación y pruebas;
- escenarios: 52 cubiertos.

Durante la verificación se añadió la prueba del escenario «Operación anulada antes de un cambio de logotipo» en `billingPages.test.tsx`.

Advertencias abiertas, que no bloquean:
- las 2 pruebas de `ServiceOperationDetailPage` que ya fallaban antes del cambio;
- la impresión física en A4 no se verificó;
- el tiempo máximo de 5 s para imprimir empieza a contar al montar la página, así que una carga del documento muy lenta puede habilitar la impresión sin logotipo y mostrar el nombre.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
