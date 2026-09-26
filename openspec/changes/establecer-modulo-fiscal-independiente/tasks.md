## 1. Preparación, trazabilidad y política de verificación

Dependencias: propuesta, siete specs y diseño D1–D14 aprobados; diseño disponible en `master` (`5ef6ccd`). Este artefacto planifica implementación, no la inicia. Las rutas de fiscal y sus pruebas son nuevas propuestas; las rutas comerciales, artesanales y de configuración son existentes.

Por instrucción del usuario, ejecutar únicamente pruebas necesarias y regresiones directamente afectadas. No ejecutar por defecto `make check`, `make test` ni suites completas. Cada tarea de comportamiento seguirá prueba roja por la razón esperada → implementación mínima → refactorización → prueba verde. Ampliar pruebas solo con motivo concreto. Mantener la cobertura de escenarios, no confundir menor ejecución con omitir requisitos.

- [x] 1.1 Verificar que propuesta, specs, diseño y tareas aprobadas estén disponibles en `master` antes de aplicar; comprobar estado Git y preservar cambios ajenos. Registrar cualquier nueva contradicción o bloqueo sin modificar reglas de negocio.
- [x] 1.2 Crear `docs/negocio/requisitos/cobertura-modulo-fiscal.md` con las 34 reglas y 89 escenarios, enlazando spec, tarea, prueba/evidencia y estado pendiente; distinguir pruebas automatizadas de verificaciones administrativas.
- [x] 1.3 Definir selección de pruebas por grupo y registro de comandos/resultados. Durante TDD usar, desde `backend/`, `uv run --frozen pytest --no-cov <archivo_o_nodeid>`; ejecutar solo casos modificados hasta que pasen y después las regresiones justificadas del grupo.
- [x] 1.4 Registrar cobertura focalizada al cerrar cada grupo relevante con `uv run --frozen pytest -o addopts='' <seleccion> --cov=<paquete_afectado> --cov-branch --cov-report=term-missing --cov-fail-under=85`; justificar y cubrir las ramas nuevas que falten. No aplicar cobertura global a una selección parcial ni modificar el umbral global del proyecto.

Evidencia: matriz inicial completa y plan de selección coherente con diseño D14. Documentar lo no ejecutado; ninguna casilla implica implementación antes de aprobación de este artefacto.

## 2. Configuración fiscal adicional y permisos

Dependencias: grupo 1. Diseño D1/D2/D11; spec `configuracion-operativa-y-fiscal`.

- [x] 2.1 Escribir pruebas focalizadas en `backend/tests/workshop_configuration/` para perfil desconocido frente a no aplicable, fuente/vigencia, revisión utilizada y certificado solo declarado; incluir rechazo de P12, claves privadas y contraseñas sin filtración en errores.
- [x] 2.2 Extender modelos y migraciones de `backend/src/workshop_configuration/` para perfiles/revisiones, establecimientos/puntos y metadatos de certificado. Probar sobre datos previos que no se inventan regímenes, puntos, tarifas ni certificados y no se altera configuración interna.
- [ ] 2.3 Implementar servicios de configuración y validación de códigos, unicidad y desactivación prospectiva; impedir cambiar RUC o códigos utilizados, también desde los comandos existentes. Probar carreras entre preparación y modificación del perfil según orden de D6.
- [x] 2.4 Añadir versiones del catálogo oficial y correspondencias con `TaxDefinition`, diferenciando cero, no objeto y exento. Probar vigencias, solapamientos, porcentajes incompatibles y conservación de versiones usadas; no deducir tratamiento legal por porcentaje.
- [x] 2.5 Añadir resolución fiscal pública separada de `application/configuration_resolver.py` actual, devolviendo valores inmutables. Mantener las confirmaciones comerciales/artesanales sin nuevos requisitos fiscales.
- [x] 2.6 Definir permisos fiscales derivados de roles en `backend/src/identity/domain/authorization.py` y aplicarlos mediante la autorización existente. Probar todos los roles, su unión y la consulta comercial limitada del Encargado; no crear roles ni permisos personales.

Evidencia: pruebas nuevas de configuración/permisos y casos pertinentes de `backend/tests/workshop_configuration/test_api.py`, `backend/tests/sales/test_confirm.py` y `backend/tests/workshop/test_service_operations.py`, seleccionados por caso para demostrar continuidad sin perfil electrónico. Verificar migración y restricciones, sin ejecutar esos directorios completos por defecto.

## 3. Núcleo fiscal, persistencia y contratos de origen

Dependencias: grupo 2. Diseño D1/D3/D6/D7; specs de preparación y acceso comercial/artesanal.

- [x] 3.1 Crear pruebas de frontera y valores puros en `backend/tests/fiscal/`, luego `backend/src/fiscal/domain/` y registro mínimo de aplicación. Probar que dominio no importa Django, HTTP o proveedores y no permite estado oficial ficticio.
- [x] 3.2 Crear pruebas y servicios públicos `sales/application/fiscal_source.py` y `workshop/application/fiscal_source.py`: snapshot histórico, versión, estado, correcciones y lectura bajo bloqueo; no mutar persistencia ajena ni incluir repuestos en el origen artesanal.
- [x] 3.3 Añadir persistencia/migraciones de preparación, snapshot, recibos e historia en fiscal: UUID estable, origen protegido exactamente uno, versión optimista y unicidad condicional de preparación activa por origen. Probar restricciones y cancelación sin pérdida de historia.
- [x] 3.4 Implementar comandos propios con **idempotencia**, autorización anterior al replay, huella canónica y auditoría mínima. Reutilizar utilidades puras existentes sin importar los modelos de comandos de ventas.
- [x] 3.5 Probar respuesta perdida, intento incompatible, permiso revocado, dos ventas legítimas iguales y creación simultánea de preparación. Implementar recuperación y traducción de conflictos usando `shared/transactions.py` con rollback completo.
- [x] 3.6 Añadir consultas de discrepancia entre origen actual e instantánea; probar anulación/devolución/reapertura posteriores y cobro independiente, sin bloquear operaciones internas ni producir efectos fiscales automáticos.

Evidencia: archivos focalizados nuevos de origen, comandos y concurrencia; PostgreSQL real con conexiones independientes y barreras. Comprobar que ningún error fiscal modifica deuda, inventario o numeración interna.

## 4. Preparación, receptor y suficiencia de la instantánea

Dependencias: grupo 3. Diseño D3/D4/D7; spec `preparacion-y-seguimiento-fiscal`.

- [x] 4.1 Escribir pruebas e implementar validadores puros del receptor: formatos por tipo, sin algoritmo universal de RUC, consumidor final explícito y restringido, sin cambiar la ficha ni snapshot comercial del cliente.
- [ ] 4.2 Crear `docs/tecnico/matriz-instantanea-fiscal.md` contra el esquema oficial de factura soportado, cubriendo cada campo obligatorio/condicional con valor conservado, derivación o no aplicabilidad. Distinguir firma/autorización e identidad posterior; registrar procedencia y versión de fuentes.
- [ ] 4.3 Añadir casos de suficiencia para emisor, receptor, domicilios, condiciones, leyendas, líneas, códigos, totales e información adicional. Implementar snapshot versionado con cadenas decimales, sin datos operativos o personales innecesarios.
- [ ] 4.4 Probar representación de precio unitario sin impuestos y coherencia de bases/impuestos/totales, conservando cálculos históricos de `shared/money.py`. Cubrir varias líneas por tarifa, tratamientos distintos, diferencia de centavo y precisión insuficiente; no introducir ajustes automáticos.
- [ ] 4.5 Probar y representar medios fiscales declarados, importes que cubren el total y datos adicionales exigibles al crédito; mantener cobros reales separados y condiciones incompletas como impedimentos, sin inventar vencimientos.
- [ ] 4.6 Implementar revisión con token firmado, caducidad de 15 minutos, usuario, versión, huellas y revisiones; probar modificación concurrente del origen/receptor/perfil y revalidación bajo bloqueo antes de preparar.
- [ ] 4.7 Implementar preparar/cancelar/reemplazar e historia inmutable. Probar cambios maestros posteriores, consulta sin proveedores, conservación del reemplazado y distinción entre preparación, pago y evidencia externa.

Evidencia: pruebas focalizadas de validación, importes, revisión y transiciones; matriz completa. Las cantidades fraccionarias solo se prueban donde el origen o XML externo las admita, sin habilitarlas para presentaciones comerciales. No construir un generador XML de emisión.

## 5. Identidad y numeración fiscal de ensayo

Dependencias: grupo 4. Diseño D5/D6; spec `identidad-y-numeracion-fiscal`.

- [ ] 5.1 Añadir pruebas puras de componentes, 49 dígitos, módulo 11, códigos numéricos y fecha `America/Guayaquil`, incluido instante UTC que pertenece al día anterior local y reintento al día siguiente.
- [ ] 5.2 Crear migraciones de ámbitos, contadores e identidades propias por RUC/tipo/establecimiento/punto/ambiente; restricciones de unicidad y límites 1…999999999. No reutilizar `DocumentSeries` ni `NumberAllocation` internos.
- [ ] 5.3 Implementar asignación de ensayo en **transacción atómica** exterior: bloqueo, identidad completa, contador y auditoría. Probar rollback en cada punto de fallo, concurrencia, agotamiento y recuperación del mismo resultado.
- [ ] 5.4 Implementar antecedentes administrativos sin avanzar contadores y prohibición productiva en dominio/aplicación. Probar que importar, cancelar o repetir no libera/reutiliza números y que solicitud de anulación no consume identidad documental.

Evidencia: pruebas focalizadas de clave, ámbito y asignación sobre PostgreSQL. Confirmar que ningún comando puede habilitar emisión productiva, incluso con rol Administrador y perfil completo.

## 6. Archivo XML seguro y transaccional

Dependencias: grupos 3–5. Diseño D8/D9; spec `archivo-de-comprobantes-fiscales`.

- [ ] 6.1 Añadir esquemas oficiales locales y manifiesto URL/versión/hash en `backend/src/fiscal/infrastructure/`, con fixtures sintéticos por versión admitida. Incorporar `lxml` mediante uv y actualizar `backend/uv.lock` únicamente cuando se use para XSD; auditar entonces la nueva dependencia.
- [ ] 6.2 Escribir pruebas adversas y luego parser/validador: DTD, XXE, entidades, recursos de red/archivos locales, esquemas externos, XML inválido y versión desconocida. Comprobar que no se realiza acceso externo ni se filtra contenido en errores.
- [ ] 6.3 Aplicar límites durante lectura: 2 MiB por archivo y comprobante extraído, profundidad 64, 50000 elementos y 100 atributos por elemento. Probar fronteras y rechazo controlado; sin ZIP, importación por URL, XInclude ni XSLT.
- [ ] 6.4 Implementar extracción de factura/nota de crédito y envoltorio con esquema local explícito; validar coherencia de emisor, ambiente, clave, identidad y totales. No validar criptográficamente ni elevar declaración de autorización a verificación oficial.
- [ ] 6.5 Crear persistencia/migraciones de expediente y contenido binario en PostgreSQL, tamaño, SHA-256, procedencia y evidencia inmutable. Probar bytes originales exactos y rollback conjunto de contenido/referencias/auditoría.
- [ ] 6.6 Implementar carga idempotente, unicidad por identidad y conservación separada de evidencia compatible. Probar cargas concurrentes, misma identidad con contenido distinto y envoltorio adicional sin sobrescritura ni doble expediente.
- [ ] 6.7 Implementar vinculación administrativa y corrección motivada del vínculo, comparando operación y factura del mismo emisor; permitir archivo sin origen interno. Probar carrera de vinculación frente a nueva preparación y bloqueo de preparación ordinaria cuando existe evidencia vinculada.
- [ ] 6.8 Implementar consultas sin bytes, descarga del original y exportación de seleccionados con manifiesto. Probar ámbito, enlaces directos, integridad y cabeceras privadas; exportación acotada/por lotes sin cargar el archivo completo en memoria.

Evidencia: pruebas focalizadas de XML, almacenamiento, duplicados, vínculos y acceso. Auditar dependencias con `uv run --frozen pip-audit` después del cambio de lockfile. El documento sintético válido no se presenta como autorizado real.

## 7. Solicitudes de corrección fiscal

Dependencias: grupos 4–6. Diseño D10; spec `solicitudes-de-correccion-fiscal`.

- [ ] 7.1 Escribir pruebas e implementar persistencia/servicios de solicitud administrativa con original externo o de ensayo, acción, motivo, fuente normativa, hechos conocidos y estado local; sin efectos comerciales ni oficiales.
- [ ] 7.2 Implementar evaluación versionada de restricciones: plazo de anulación y desplazamiento, calendario insuficiente, consumidor final transmitido, devolución de impuestos y factura negociada; hechos desconocidos quedan pendientes. No reintroducir límite general de doce meses.
- [ ] 7.3 Implementar líneas/importes históricos de nota de crédito, límites y remanente afectable bajo bloqueo del original. Probar dos solicitudes simultáneas, residuos de afectación parcial y datos externos insuficientes.
- [ ] 7.4 Implementar relación de evidencia con solicitud mediante identidad común de afectación; probar que se cuenta una sola vez y que cancelar una solicitud no elimina la afectación atribuida a evidencia externa conservada.
- [ ] 7.5 Probar e implementar cancelación/reemplazo trazable, reintento compatible y conflicto; mantener XML incoherente sin vínculo y bloquear remanente pendiente de conciliación, sin afirmar ejecución oficial.

Evidencia: pruebas nuevas de elegibilidad, remanente, relación y concurrencia, sin consultar SRI. La cobertura de calendario y hechos externos debe ser explícita y verificable.

## 8. API propia y contratos OpenAPI

Dependencias: grupos 2–7. Diseño D11; todas las specs.

- [ ] 8.1 Crear pruebas API antes de exponer comandos/consultas en `backend/src/fiscal/api/` y `backend/src/config/api/urls.py`; mantener serializers/views delgados, sesión y CSRF, cadenas decimales y errores estables por campo.
- [ ] 8.2 Exponer configuración adicional por servicios propietarios y endpoints de preparación/revisión/cancelación/identidad de prueba; probar versión obsoleta, intento incompatible y rechazo de campos de estado oficial o secretos.
- [ ] 8.3 Exponer archivo, descarga/exportación, vínculos y correcciones; probar todos los roles y combinaciones, acceso directo y recuperación tras revocar permisos, incluyendo la consulta limitada del Encargado sobre ventas.
- [ ] 8.4 Publicar contrato OpenAPI de entradas, límites, estados locales, procedencia no verificada y errores 400/403/404/409/413; añadir `backend/tests/fiscal/test_openapi.py` y comprobar que contratos de ventas/taller afectados conservan compatibilidad.

Evidencia: `uv run --frozen pytest --no-cov tests/fiscal/test_api.py tests/fiscal/test_openapi.py` una vez creados, y solo nodeids pertinentes de OpenAPI comercial/artesanal si cambian sus proyecciones. No duplicar aquí todas las pruebas de dominio de grupos anteriores.

## 9. Interfaz fiscal e integración visual

Dependencias: grupo 8. Diseño D11; specs de acceso desde ventas y operación artesanal.

- [ ] 9.1 Crear pruebas y contratos de `frontend/src/features/fiscal/`: API, tipos, consultas, claves por emisor/origen, invalidación y recuperación de comandos; nunca calcular permisos, impuestos o numeración en frontend.
- [ ] 9.2 Extender `frontend/src/pages/workshop-configuration/WorkshopConfigurationPage.tsx` con perfil, puntos, metadatos y correspondencias. Probar desconocidos, faltantes, vigencia y prohibición de carga de firma privada.
- [ ] 9.3 Crear `frontend/src/pages/fiscal/` para preparación/revisión con valores históricos, datos faltantes y diferencias; separar pago y estado fiscal, conservar entrada ante error y mostrar explícitamente ambiente de ensayo.
- [ ] 9.4 Añadir enlaces desde `frontend/src/pages/sales/SaleDetailPage.tsx` y `frontend/src/pages/maintenance/ServiceOperationDetailPage.tsx`, rutas y navegación autorizadas; probar unión de roles y que el resumen de repuestos no habilita expediente fiscal comercial al Encargado.
- [ ] 9.5 Crear pantallas de archivo, carga limitada, consulta/exportación y vínculos, con condición externa no verificada y originales descargables; probar falta de permisos y fallos de integridad sin mostrar éxito ficticio.
- [ ] 9.6 Crear pantallas administrativas de solicitudes locales y preparación operativa; probar impedimentos, revisión, cancelación y discrepancias. Reutilizar Tallkit con foco/teclado y errores persistentes, sin añadir biblioteca visual.
- [ ] 9.7 Añadir E2E focalizados en `frontend/e2e/fiscal.spec.ts` para una preparación comercial, una artesanal, archivo con permisos y un bloqueo crítico; reutilizar configuración Playwright existente. Seleccionar regresiones de `maintenance-billing.spec.ts` o `sales-payments.spec.ts` solo si la integración cambia esos flujos.

Evidencia: desde `frontend/`, `npm test -- <archivos_de_prueba_afectados>`; E2E con `npm run test:e2e -- e2e/fiscal.spec.ts` y filtro adicional cuando baste. Ejecutar cobertura de componentes afectados al cerrar el grupo, sin correr la suite completa. No repetir E2E tras cambios puramente documentales.

## 10. Recuperación, datos personales y habilitación de archivo real

Dependencias: grupos 6/8/9. Diseño D12 y Migration Plan; spec de archivo.

- [ ] 10.1 Crear `docs/tecnico/operacion-archivo-fiscal.md` con política por responsable/**entidad fiscal**, categorías, retención, canal y procedimiento de derechos; separar contacto operativo, XML, auditoría, exportaciones y copias. No atribuir cumplimiento legal a un formulario completado.
- [ ] 10.2 Implementar registro versionado y consulta administrativa de política/evidencia de restauración. Probar bloqueo de incorporación real sin política y de producción sin restauración, permitiendo ensayos sintéticos; invalidar habilitación al cambiar almacenamiento/procedimiento.
- [ ] 10.3 Documentar respaldo consistente de PostgreSQL en destino protegido independiente, restauración aislada y comprobación de contenido, hashes, identidades, permisos y vínculos. Incluir revisión de decisiones posteriores de eliminación legítima antes de reabrir datos restaurados.
- [ ] 10.4 Ejecutar un ensayo de restauración con datos sintéticos, registrar responsable, copia, procedimiento y resultado; comprobar original idéntico y permisos, no solo conteo de filas. Mantener cargas productivas bloqueadas si falta infraestructura/evidencia real aplicable.
- [ ] 10.5 Verificar migraciones con datos anteriores y rollback operativo no destructivo: sin preparaciones retrospectivas, sin cambiar COM-VEN/ART-SER, sin borrar XML nuevos y sin activar emisión productiva. Registrar límites del ensayo y que DA-003 general continúa pendiente.

Evidencia: informe de restauración sintética, pruebas focalizadas de readiness y migración, procedimiento revisable. No marcar configuración operativa de producción como completada por una prueba sintética ni solicitar RUC/certificados reales para pasar las pruebas.

## 11. Documentación y cierre focalizado de implementación

Dependencias: grupos anteriores. No iniciar este grupo como sustituto de pruebas fallidas.

- [ ] 11.1 Publicar el ADR dedicado de independencia fiscal y archivo transaccional a partir de diseño D13, con identificador disponible y estado conforme a aprobación; enlazar ADR-0001/0004/0006/0008 y distinguirlo de fotografías (ADR-0007).
- [ ] 11.2 Actualizar `docs/arquitectura/modelo-dominio.md`, producto, requisitos, casos de uso, trazabilidad, glosarios y referencias asociadas para describir la capacidad implementada; corregir notas desactualizadas sin reescribir decisiones históricas ni anunciar emisión real.
- [ ] 11.3 Completar la matriz de cobertura con resultados por escenario, pruebas ejecutadas, evidencia administrativa y pendientes operativos. Enlazar matriz de instantánea, OpenAPI y procedimiento del archivo; no convertir pendientes externos en cumplimiento.
- [ ] 11.4 Ejecutar formato/lint sobre archivos modificados con `uv run --frozen ruff format --check <rutas>` y `uv run --frozen ruff check <rutas>`; frontend con `npm exec -- prettier --check <rutas>` y `npm exec -- eslint <rutas> --max-warnings 0`. Solo archivos aplicables a cada herramienta.
- [ ] 11.5 Ejecutar una vez tipos de áreas afectadas, `uv run --frozen python manage.py check`, `uv run --frozen python manage.py makemigrations --check --dry-run` y validación del esquema API. En frontend ejecutar `npm run build` una vez para tipos y compilación. Ampliar análisis estático a consumidores si las firmas compartidas cambian.
- [ ] 11.6 Consolidar resultados focalizados ya vigentes y ejecutar únicamente casos faltantes o invalidados por cambios posteriores. Incluir concurrencia PostgreSQL, dinero, permisos y seguridad XML; registrar selección y cobertura, sin llamar a `make check`/`make test` ni atribuir éxito a suites no ejecutadas.
- [ ] 11.7 Ejecutar `openspec validate establecer-modulo-fiscal-independiente --strict`, revisar diff y comunicar alcance, limitaciones y comandos reales; entregar para verificación. No archivar ni integrar implementación sin el flujo/autorización correspondientes.

Evidencia de cierre: checks estáticos aplicables, build, cobertura focalizada, matriz y validación OpenSpec. Una indisponibilidad de infraestructura se registra como bloqueo real, no como prueba aprobada. Las pruebas completas solo se reconsideran ante una necesidad concreta explicada al usuario.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
