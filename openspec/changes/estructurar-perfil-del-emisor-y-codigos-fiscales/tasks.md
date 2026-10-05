## 1. Preparación y línea base focalizada

Dependencias: propuesta, specs y diseño aprobados y registrados en `master`, conforme a `AGENTS.md`.

Por instrucción del usuario se ejecutan solo pruebas focalizadas. Cada tarea de comportamiento sigue TDD: prueba roja por la razón esperada, implementación mínima, refactorización y prueba verde. No se ejecutan `make check`, `make test`, pytest completo, Vitest completo ni toda la suite de Playwright; el resumen final indica qué se ejecutó y qué no.

- [x] 1.1 Comprobar `git status --short`, la rama vigente y que este cambio esté en `master` sin modificaciones pendientes. Registrar cambios ajenos en las rutas afectadas; no crear ramas ni merges sin autorización.
- [x] 1.2 Tomar un respaldo de la base de desarrollo antes de migrar y anotar su ubicación (diseño, Migration Plan).
- [x] 1.3 Ejecutar y registrar la línea base: `cd backend && uv run --frozen pytest --no-cov tests/workshop_configuration/test_electronic_profile.py tests/workshop_configuration/test_electronic_profile_services.py tests/workshop_configuration/test_electronic_status.py tests/workshop_configuration/test_fiscal_resolver.py tests/fiscal/test_snapshot.py tests/fiscal/test_snapshot_amounts.py tests/fiscal/test_api.py tests/catalog/test_catalog_validation.py tests/catalog/test_catalog_services.py tests/catalog/test_catalog_api.py`.
- [x] 1.4 Consultar en la base de desarrollo cuántos productos tienen código de más de 25 caracteres, cuántas revisiones de perfil existen por entidad y cuántos servicios y líneas artesanales hay, y anotar los resultados para contrastar las migraciones.
- [x] 1.5 Añadir a `docs/negocio/requisitos/cobertura-modulo-fiscal.md` y `cobertura-catalogos.md` una matriz pendiente que relacione cada requirement y escenario de las cuatro specs delta con los grupos y archivos de prueba de este checklist.

Evidencia del grupo: estado Git, respaldo anotado, comandos de línea base con resultado real, conteos de 1.4 y matriz de cobertura pendiente.

Resultado registrado (2026-10-04):
- 1.1: rama `develop`, árbol limpio y las cuatro fases del cambio en `master` (commit `640e68d`).
- 1.2: respaldo `pg_dump -Fc` de `sys_taller` (contenedor `sys-taller-db-1`) en el scratchpad de la sesión, `sys_taller-antes-perfil-emisor.dump` (543 KB); no se versiona.
- 1.3: 138 pruebas pasan en 45 s con el comando de la tarea.
- 1.4: 5 productos (0 con código de más de 25 caracteres), 6 servicios, 8 líneas de servicio y 6 líneas de operación artesanal, 0 revisiones de perfil y 2 preparaciones fiscales.
- 1.5: matrices pendientes añadidas a `cobertura-modulo-fiscal.md` y `cobertura-catalogos.md`.

## 2. Perfil del emisor con valores cerrados (dominio)

Dependencias: grupo 1. Diseño 1; spec `configuracion-operativa-y-fiscal`, «Perfil fiscal adicional…» y «Calificación artesanal con número y vencimiento».

- [x] 2.1 Escribir primero en `backend/tests/workshop_configuration/test_electronic_profile.py` casos rojos del formato 2: régimen solo entre los tres valores; contabilidad solo `SI`/`NO`; agente de retención con resolución de 1 a 8 dígitos y rechazo de `NAC-0012`, nueve dígitos y ausencia de número; contribuyente especial alfanumérico de 1 a 13; rechazo de la clave `rimpe` y de texto libre como «Sí, desde 2024».
- [x] 2.2 Añadir casos rojos de la calificación artesanal: número de 1 a 50 sin espacios exteriores, organismo obligatorio, vencimiento obligatorio y posterior al inicio, y *No aplica* sin datos.
- [x] 2.3 Añadir casos rojos de la función pura de leyenda: `RIMPE_EMPRENDEDOR` produce `CONTRIBUYENTE RÉGIMEN RIMPE`, `GENERAL` ninguna.
- [x] 2.4 Implementar en `backend/src/workshop_configuration/domain/electronic_profile.py` los analizadores por clave del formato 2 y la leyenda derivada, conservando el analizador de formato 1 solo para lectura; hacer pasar 2.1–2.3 y refactorizar.
- [x] 2.5 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/workshop_configuration/test_electronic_profile.py`, Ruff sobre los archivos tocados y mypy sobre `src/workshop_configuration`.

Evidencia del grupo: rojo y verde registrados; el dominio no importa Django ni DRF.

Resultado registrado (2026-10-04): 55 de 69 pruebas rojas por `AttributeError` (las funciones no existían) y 69 de 69 verdes tras implementar `parse_closed_condition`, `parse_profile_conditions`, `condition_payload` y `regime_legend`; Ruff y mypy sin hallazgos en `src/workshop_configuration`. Los errores de campo del perfil completo se califican como `<condición>.<campo>`.

## 3. Revisiones del perfil, estado y avisos

Dependencias: grupo 2. Diseño 1, 2 y 3; misma spec.

- [x] 3.1 Crear la migración de `workshop_configuration` que añade `ElectronicProfileRevision.conditions_format` con valor por defecto 1 y su restricción a `{1, 2}`, sin modificar filas. Añadir una prueba de migración que confirme que las revisiones previas quedan en formato 1 con su JSON intacto.
- [x] 3.2 Escribir primero en `tests/workshop_configuration/test_electronic_profile_services.py` casos rojos: `save_profile` guarda formato 2, rechaza un cuerpo de formato 1 sin crear revisión ni recibo, y conserva idempotencia, `expected_revision` y auditoría.
- [x] 3.3 Escribir primero en `tests/workshop_configuration/test_electronic_status.py` casos rojos: revisión vigente en formato 1 produce *Falta completar* con la causa `profile.legacy_format` y no interpreta sus textos; régimen `RIMPE_NEGOCIO_POPULAR` produce la causa `conditions.tax_regime.unsupported`; calificación con 60 días restantes advierte y con 61 no; con 45 muestra fecha y días; vencida ayer produce *Requiere revisión*; el perfil real del taller queda *Lista para preparación local*.
- [x] 3.4 Implementar en `application/electronic_profiles.py` y `application/electronic_status.py` el guardado en formato 2, las causas nuevas y la advertencia `artisan_qualification_expiring`, con el umbral de 60 días como constante de dominio; hacer pasar 3.2–3.3.
- [x] 3.5 Escribir primero en `tests/workshop_configuration/test_fiscal_resolver.py` casos rojos: negocio popular y formato 1 aparecen en `preparation_issues`; la advertencia de calificación no entra en `future_emission_issues` ni bloquea. Ajustar `application/fiscal_resolver.py` para separar ambas listas.
- [x] 3.6 Escribir primero en `tests/workshop_configuration/test_api.py` casos rojos del contrato: consulta con `conditions_format`, `regime_legend` y opciones admitidas; revisión de formato 1 devuelta en solo lectura; guardado de formato 2; Vendedor y Encargado del taller reciben 403 sin número ni fechas de la calificación. Implementar en `api/serializers.py` y `api/views.py`.
- [x] 3.7 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/workshop_configuration/test_electronic_profile_services.py tests/workshop_configuration/test_electronic_status.py tests/workshop_configuration/test_fiscal_resolver.py tests/workshop_configuration/test_api.py tests/workshop_configuration/test_audit_integration.py`, Ruff y mypy sobre `src/workshop_configuration`, y `uv run python manage.py makemigrations --check --dry-run`.

Evidencia del grupo: migración aplicada y revertida en desarrollo, estados probados en los límites, permisos positivos y negativos.

Resultado registrado (2026-10-05):
- Rojo inicial por la razón esperada: `NodeNotFoundError` (migración inexistente), `DID NOT RAISE` (el servicio aceptaba texto libre y `rimpe`), `ImportError` y `KeyError: 'conditions_format'`; todo verde después de implementar.
- Migración `0014_electronicprofilerevision_conditions_format`: aplicada, revertida a `0013` y reaplicada en la base de desarrollo (columna `smallint`, restricción `{1, 2}`); las revisiones previas quedan en formato 1 con su JSON intacto (prueba de migración).
- Verificación 3.7: 208 pruebas pasan en 46 s (servicios, estado, resolvedor, dominio, migraciones, auditoría, API de configuración, límites de módulo, OpenAPI y `test_fiscal_prepare_flow.py`); Ruff sin hallazgos; `makemigrations --check` sin cambios.
- Las pruebas existentes que guardaban el perfil en formato 1 (`test_electronic_status.py`, `test_fiscal_resolver.py`, `tests/sales/test_fiscal_prepare_flow.py`) se actualizaron al formato 2 con el helper `tests/workshop_configuration/profile_helpers.py`; `rimpe` se sustituyó por la retención o la calificación.
- mypy sobre `src/workshop_configuration`, `src/fiscal` y sus pruebas: 81 errores que ya existían antes de este cambio (se contaron con `git stash`) y ninguno nuevo.
- Hallazgo ajeno al cambio: `tests/fiscal/test_migrations.py::test_readiness_migration_preserves_existing_archive_and_internal_series` falla con `null value in column "logo_revision"`, también sin los cambios de este cambio (el modelo antiguo no conoce la columna que añadió `logotipos-por-ruc`). No se modificó.
- El aviso de calificación no entra en `future_emission_issues`: el resolvedor solo arrastra las advertencias del certificado.

## 4. Código de producto de hasta 25 caracteres

Dependencias: grupo 1. Diseño 7; spec `catalogo-de-productos-y-categorias`.

- [x] 4.1 Escribir primero en `backend/tests/catalog/test_catalog_validation.py` casos rojos: alta con 25 caracteres aceptada y con 26 rechazada con error en `code`; el código del fabricante sigue admitiendo 64.
- [x] 4.2 Escribir primero en `tests/catalog/test_catalog_services.py` casos rojos de edición: producto existente con 40 caracteres guarda otro campo sin tocar el código; cambiarlo a 12 se acepta y las líneas históricas conservan su instantánea; cambiarlo a 30 se rechaza conservando el anterior.
- [x] 4.3 Implementar en `backend/src/catalog/domain/validation.py` las constantes `PRODUCT_CODE_MAX = 25` y `MANUFACTURER_CODE_MAX = 64` y el paso del código vigente a `validate_product`; ajustar el servicio de edición. Hacer pasar 4.1–4.2 sin crear migración.
- [x] 4.4 Escribir primero en `tests/catalog/test_catalog_api.py` casos rojos del filtro `code_over_limit`: lista exactamente los excedidos, activos e inactivos, con `code_length`; lista vacía sin error; 403 para quien no edita productos. Implementar en `application/queries.py`, `api/serializers.py` y `api/views.py`.
- [x] 4.5 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/catalog/test_catalog_validation.py tests/catalog/test_catalog_services.py tests/catalog/test_catalog_api.py tests/catalog/test_manufacturer_code.py tests/catalog/test_product_label_data_api.py`, Ruff y mypy sobre `src/catalog`.

Evidencia del grupo: límite probado en 25 y 26, productos largos existentes intactos, filtro con permisos.

Resultado registrado (2026-10-05):
- Rojo inicial por la razón esperada: `TypeError` (`current_code` inexistente), códigos de 26 y 40 caracteres aceptados y filtro `code_over_limit` ignorado; verde tras implementar `PRODUCT_CODE_MAX = 25`, `MANUFACTURER_CODE_MAX = 64`, `normalize_code(..., current=)` y la consulta con `Length`.
- Sin migración: `Product.code` conserva `max_length=64` porque existen filas válidas más largas. La edición pasa el código vigente a la validación para que un producto largo guarde otros campos sin tocarlo.
- Los códigos con saltos de línea se rechazan.
- El filtro exige `productos.gestionar` (403 para Vendedor y Encargado del taller sin revelar el listado), solo acepta `true` (400 en otro caso), no es un filtro de etiquetas y añade `code_length` a cada resultado.
- Verificación 4.5: `tests/catalog` completo, 170 pruebas en 25 s; Ruff y mypy sin hallazgos sobre `src/catalog` y `tests/catalog`.

## 5. Código de servicio

Dependencias: grupo 1. Diseño 8; spec `catalogo-de-servicios`.

- [x] 5.1 Crear las migraciones de `catalog`: `Service.code` anulable y `ServiceCodeCounter` de fila única; relleno idempotente por `created_at` e `id` que fija el contador; `code` obligatorio y único. Añadir una prueba de migración con servicios previos que compruebe orden, unicidad y que nombre, precio y estado no cambian.
- [x] 5.2 Escribir primero en `tests/catalog/test_catalog_services.py` casos rojos: el alta asigna `SRV-` con el siguiente número; un alta fallida no deja servicio sin código; un servicio desactivado no libera su código; alta y edición rechazan un `code` recibido con error de campo.
- [x] 5.3 Escribir primero en `tests/catalog/test_catalog_concurrency.py` un caso rojo con dos altas simultáneas en transacciones reales que deben recibir códigos distintos.
- [x] 5.4 Implementar la asignación con `select_for_update` sobre el contador dentro de la transacción del alta; hacer pasar 5.2–5.3.
- [x] 5.5 Escribir primero en `tests/catalog/test_catalog_api.py` casos rojos: el código aparece en ficha y listado y la búsqueda « srv-000012 » localiza el servicio. Implementar en consultas y serializadores, y exponer el código en `tests/catalog/test_workshop_references.py` y su interfaz de referencia para el taller.
- [x] 5.6 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/catalog`, Ruff y mypy sobre `src/catalog`, y el chequeo de migraciones.

Evidencia del grupo: migración aplicada y revertida en desarrollo, conteo de servicios con código igual al de 1.4, concurrencia en verde.

Resultado registrado (2026-10-05):
- Rojo inicial por la razón esperada: `ImportError` (`ServiceCodeCounter` inexistente), `NodeNotFoundError` (migración inexistente) y `AttributeError` en la referencia del taller; verde tras implementar el modelo, las tres migraciones (`0003_service_code_and_counter`, `0004_backfill_service_codes`, `0005_service_code_required_unique`) y `catalog.application.service_codes.next_service_code`.
- Tres migraciones separadas para que el relleno y el cambio a `NOT NULL`/único no compartan transacción en PostgreSQL. El relleno guarda solo la columna `code`: no cambia versión ni fecha de actualización.
- Base de desarrollo: aplicada, revertida a `0002` y reaplicada. Los 6 servicios existentes quedaron con `SRV-000001` a `SRV-000006` en orden de creación (6 códigos distintos, igual al conteo de 1.4), contador en 6 y nombres, versiones y estado intactos.
- Concurrencia: dos altas simultáneas con transacciones reales reciben `SRV-000001` y `SRV-000002`; una alta con fallo de persistencia revierte el número.
- `Service.code` es obligatorio y único: las seis creaciones directas de `Service` en pruebas de otros módulos reciben un código explícito de prueba.
- La búsqueda de servicios (API y referencia del taller) también encuentra por código, y la interfaz de referencia entrega `code` para el grupo 6.
- Verificación 5.6: `tests/catalog` + `tests/workshop` + `tests/sales/test_workshop_links.py`, 485 pruebas, 484 pasan; Ruff, mypy sobre `src/catalog` y `tests/catalog` y `makemigrations --check` sin hallazgos.
- Hallazgo ajeno al cambio: `tests/workshop/test_boundaries.py::test_no_other_module_imports_workshop` falla también sin los cambios de este cambio (`fiscal/application/xml_archive.py` y `preparations.py` importan `workshop`). No se modificó.

## 6. Código de servicio en las líneas artesanales

Dependencias: grupo 5. Diseño 9; spec `preparacion-y-seguimiento-fiscal`, «Códigos y descripciones de línea…».

- [x] 6.1 Crear la migración de `workshop`, dependiente de la de `catalog`, que añade `service_code` a `ServiceLine` y `ServiceOperationLine` y lo rellena por `service_id` mediante la lectura del catálogo, sin escribir en tablas ajenas. Añadir prueba de migración con líneas previas, incluida una cuyo servicio no exista.
- [x] 6.2 Escribir primero casos rojos en las pruebas de líneas y operaciones de `backend/tests/workshop`: al agregar un servicio y al documentar la operación se copia `service_code` junto a `service_name`; la fuente fiscal entrega ese código y no `service_id`.
- [x] 6.3 Implementar en `workshop/application/service_lines.py`, `service_operations.py` y `fiscal_source.py`; exponer el código en los serializadores de la operación artesanal. Hacer pasar 6.2.
- [x] 6.4 Verificar con `cd backend && uv run --frozen pytest --no-cov` sobre los archivos de `tests/workshop` tocados más los de operaciones de servicios y límites de módulo, Ruff y mypy sobre `src/workshop`, y el chequeo de migraciones.

Evidencia del grupo: líneas existentes con código igual al del servicio, frontera entre módulos respetada.

Resultado registrado (2026-10-05):
- Rojo inicial por la razón esperada: `KeyError: 'service_code'` en las líneas, la vista previa, la operación y la fuente fiscal, y `NodeNotFoundError` en la prueba de migración; verde tras implementar.
- Migración `0005_service_codes_on_lines` (depende de `catalog.0005`): añade `service_code` a `ServiceLine` y `ServiceOperationLine` y lo rellena leyendo el catálogo, sin escribir en tablas ajenas ni tocar `updated_at`. Una línea de operación cuyo servicio ya no existe queda con código vacío (probado).
- La prueba de migración usa datos reales del taller, retrocede a `0004` (se pierde la columna) y vuelve a `0005`, de modo que verifica el relleno.
- Base de desarrollo: aplicada, revertida a `0004` y reaplicada; las 8 líneas de servicio y las 6 líneas de operación (iguales al conteo de 1.4) quedaron con el código de su servicio y ninguna difiere del catálogo.
- El código se copia al agregar el servicio y al documentar la operación; la vista previa, la operación, el detalle de la orden, el serializador y `ArtisanFiscalLine.service_code` lo exponen, y un cambio posterior del catálogo no lo altera.
- Verificación 6.4: `tests/workshop` + `tests/catalog` + `tests/sales/test_workshop_links.py`, 489 pruebas, 488 pasan; Ruff y `makemigrations --check` sin hallazgos; mypy con el mismo único error que ya existía.
- La única falla es `tests/workshop/test_boundaries.py::test_no_other_module_imports_workshop`, ya registrada en el grupo 5 y previa a este cambio.

## 7. Instantánea de formato 3, límites de línea y regla de calificación

Dependencias: grupos 3 y 6. Diseño 4, 5 y 6; spec `preparacion-y-seguimiento-fiscal`.

- [ ] 7.1 Escribir primero en `backend/tests/fiscal/test_snapshot_amounts.py` casos rojos: código de 25 aceptado y de 31 bloqueado con longitudes observada y admitida; descripción de 300 aceptada y de 320 bloqueada; saltos de línea rechazados; nada se trunca.
- [ ] 7.2 Escribir primero en `tests/fiscal/test_snapshot.py` casos rojos de `tax_profile`: taller en régimen general con calificación (contabilidad `NO`, número y vencimiento, sin leyenda ni resoluciones); RIMPE Emprendedor con la leyenda exacta; condiciones que no aplican omitidas; `legends` vacía; `snapshot_format` 3.
- [ ] 7.3 Implementar en `backend/src/fiscal/domain/snapshot_amounts.py` y `snapshot.py`, con la traducción de condiciones a `tax_profile` como función pura de dominio; hacer pasar 7.1–7.2.
- [ ] 7.4 Escribir primero en las pruebas de preparación de `tests/fiscal` casos rojos de integración: perfil en formato 1 deja la preparación en borrador con impedimento al Administrador; línea de servicio usa `SRV-…`; venta con código de 31 queda bloqueada y sigue bloqueada tras acortar el catálogo, mientras una venta nueva se prepara; calificación vigente con servicios a 0 % completa y con un servicio a 15 % bloquea por línea sin modificar importes; entidad sin calificación no evalúa la regla; calificación vencida bloquea por estado del perfil.
- [ ] 7.5 Implementar en `fiscal/application/snapshot_builder.py` e `impediment_messages.py`: uso de `service_code`, regla de tratamiento `ZERO` con calificación vigente y textos dirigidos al Administrador; hacer pasar 7.4.
- [ ] 7.6 Añadir pruebas de regresión que lean instantáneas de formato 1 y 2 sin completar campos desde el perfil vigente, y ajustar `fiscal/api/serializers.py` para exponer `tax_profile` cuando exista y `legends` cuando no.
- [ ] 7.7 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/fiscal/test_snapshot.py tests/fiscal/test_snapshot_amounts.py tests/fiscal/test_api.py tests/fiscal/test_boundaries.py tests/fiscal/test_migrations.py` más los archivos de preparación tocados, Ruff y mypy sobre `src/fiscal`.

Evidencia del grupo: impedimentos con campo y valores, preparaciones anteriores sin cambios, regla de tarifa probada en positivo y negativo.

## 8. Contrato OpenAPI

Dependencias: grupos 3, 4, 5, 6 y 7.

- [ ] 8.1 Regenerar `backend/schema.yml` y revisar el diff: cuerpo y respuesta del perfil, `code` de servicio, `service_code` de líneas, filtro `code_over_limit` y `tax_profile`.
- [ ] 8.2 Verificar con `cd backend && uv run --frozen pytest --no-cov tests/fiscal/test_openapi.py` y las pruebas de contrato de catálogo y configuración existentes.

Evidencia del grupo: diff del contrato revisado y pruebas de contrato en verde.

## 9. Frontend: perfil del emisor y calificación artesanal

Dependencias: grupo 8. Diseño 10; spec `configuracion-operativa-y-fiscal`.

- [ ] 9.1 Actualizar los tipos y el cliente de la configuración fiscal al contrato nuevo, con sus pruebas.
- [ ] 9.2 Escribir primero pruebas Vitest de `ProfileConditionsSection.tsx`: selectores de régimen y contabilidad; *No aplica / Aplica* revela resolución o datos de calificación; leyenda del régimen de solo lectura; errores de campo del backend junto a cada control; revisión de formato 1 con aviso y acción de declarar de nuevo; sin campo de texto libre para ninguna condición.
- [ ] 9.3 Implementar el formulario siguiendo los patrones vigentes: modal para formulario corto, toast de confirmación, campos que llenan el ancho y avisos como iconos con detalle desplegable.
- [ ] 9.4 Escribir primero pruebas del aviso de vencimiento (fecha y días, color de advertencia, ausente fuera del umbral) y de `readiness.ts` con las causas nuevas; implementar.
- [ ] 9.5 Verificar con Vitest sobre los archivos de `frontend/src/features/fiscal/configuration` tocados, `tsc`, ESLint y Prettier sobre esos archivos.

Evidencia del grupo: pruebas en verde y revisión visual en claro y oscuro, escritorio y móvil.

## 10. Frontend: códigos de servicio y de producto, y preparación

Dependencias: grupo 8. Diseño 10; specs de catálogos y de preparación.

- [ ] 10.1 Servicios: escribir primero pruebas y luego mostrar el código en listado y ficha como dato de solo lectura, incluirlo en la búsqueda y no enviarlo en altas ni ediciones.
- [ ] 10.2 Operación artesanal: escribir primero la prueba y mostrar el código junto al nombre del servicio en las líneas.
- [ ] 10.3 Productos: escribir primero pruebas del límite de 25 en el formulario con el mensaje del backend, de la edición de un producto con código largo sin tocarlo, y del filtro de códigos por corregir visible solo para quien edita, con su estado vacío; implementar en `ProductsPage` y el formulario de producto.
- [ ] 10.4 Preparación fiscal: escribir primero pruebas de `FiscalPreparationPage` que muestren el emisor estructurado en formato 3, las leyendas en formatos anteriores y los impedimentos nuevos con el texto del backend; implementar.
- [ ] 10.5 Verificar con Vitest sobre las páginas y componentes tocados, `tsc`, ESLint y Prettier sobre esos archivos.

Evidencia del grupo: pruebas en verde; el frontend no decide límites ni reglas, solo refleja al backend.

## 11. Recorridos E2E focalizados

Dependencias: grupos 9 y 10.

- [ ] 11.1 Ampliar `frontend/e2e/fiscal.spec.ts`: el Administrador declara el perfil del taller con las opciones cerradas y la calificación artesanal; el Encargado prepara una operación artesanal a 0 % y la línea muestra el código `SRV-…`.
- [ ] 11.2 Añadir en `fiscal.spec.ts` el caso de un producto con código largo cuya preparación queda bloqueada con el impedimento, y en `catalogs.spec.ts` el rechazo de un código de 26 caracteres y el filtro de códigos por corregir.
- [ ] 11.3 Ejecutar solo `npx playwright test e2e/fiscal.spec.ts e2e/catalogs.spec.ts` y registrar el resultado.

Evidencia del grupo: recorridos en verde con su salida; no se ejecuta el resto de Playwright.

## 12. Documentación, trazabilidad y cierre

Dependencias: grupos 2 a 11.

- [ ] 12.1 Actualizar `docs/tecnico/matriz-instantanea-fiscal.md` con el formato 3, los campos de `tax_profile` y los límites de longitud comprobados.
- [ ] 12.2 Incorporar a `docs/negocio/producto/glosario.md` los términos perfil del emisor, régimen tributario, calificación artesanal, agente de retención, código de servicio e impedimento, y actualizar sus referencias de glosario.
- [ ] 12.3 Actualizar `docs/negocio/requisitos/requisitos-funcionales.md`, `casos-de-uso.md` (CU-003), `interfaz-y-navegacion.md` y `matriz-trazabilidad.md` con sus archivos de referencia de glosario; completar las matrices de cobertura abiertas en 1.5.
- [ ] 12.4 Actualizar `docs/arquitectura/modelo-datos.md` con `conditions_format`, `Service.code`, `ServiceCodeCounter` y `service_code`, y `docs/arquitectura/modelo-dominio.md` §11.6 con el perfil estructurado y la calificación artesanal. Registrar en `decisiones-confirmadas.yaml` los datos confirmados del RUC artesanal y las decisiones D1–D5.
- [ ] 12.5 Ejecutar la verificación focalizada final: los comandos de los grupos 3, 4, 5, 6 y 7, `uv run python manage.py makemigrations --check --dry-run`, Ruff y mypy sobre los cuatro módulos tocados, Vitest de los archivos tocados, `tsc`, ESLint, Prettier y `openspec validate estructurar-perfil-del-emisor-y-codigos-fiscales --strict`.
- [ ] 12.6 Redactar el resumen de cierre con comandos y resultados reales, indicando expresamente qué no se ejecutó (`make check`, `make test`, suites completas y el resto de Playwright) para que el usuario decida si quiere la verificación completa antes de integrar.

Evidencia del grupo: documentación sincronizada, validación de OpenSpec en verde y resumen con lo ejecutado y lo no ejecutado.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
