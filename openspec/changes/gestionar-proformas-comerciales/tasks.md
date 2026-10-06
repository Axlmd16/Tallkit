## 1. Preparación y trazabilidad

Base: propuesta, specs y diseño aprobados en `master`; ADR-0012 aceptado. Estas tareas requieren aprobación explícita y registro en `master` antes de apply. Ninguna casilla está completada. Las rutas de proformas, sus pruebas, su cobertura documental y `sales/application/proforma_links.py` son archivos nuevos previstos por el diseño; las demás rutas citadas corresponden al repositorio inspeccionado.

Cada tarea de comportamiento sigue **TDD**: prueba que falla por la razón esperada → implementación mínima → refactorización → repetición de la prueba. No marcar tareas por intención ni sustituir la evidencia con el nombre de una prueba. Los comandos backend se ejecutan desde `backend`, los npm desde `frontend` y `make` desde la raíz. No añadir dependencias ni modificar lockfiles sin necesidad actual aprobada.

- [x] 1.1 Comprobar Git y que propuesta, specs, diseño y ADR aprobados están registrados en `master`; preservar los cambios ajenos, incluidos los del archivo de retenciones. Evidencia: `git status --short`, revisión del historial y de los artefactos exactos; no comenzar apply si falta el checkpoint.
- [x] 1.2 Crear `docs/negocio/requisitos/cobertura-proformas.md` con los 76 escenarios de ambas specs, identificados por capacidad, requisito y nombre, y columnas de tarea, prueba y resultado pendiente. Cierre: ningún escenario omitido o declarado cumplido sin evidencia; conservar la referencia a los escenarios existentes de ventas.
- [x] 1.3 Preparar fixtures sintéticas de cliente, productos, tarifa, disponibilidad y serie comercial en el nuevo `backend/tests/proformas/`; confirmar PostgreSQL de pruebas y comandos oficiales sin tocar datos operativos. Evidencia: ejecución de una prueba de fixture y lectura de `README.md`, `Makefile` y configuración vigente de cobertura.

Dependencias: grupo inicial. Criterio de grupo: checkpoint comprobado y cobertura pendiente trazable; `openspec validate gestionar-proformas-comerciales --strict` pasa. Estas tareas no autorizan nuevos commits, ramas o merges fuera de los solicitados.

## 2. Dominio puro y fronteras

Cubre diseño D1…D3, vigencia, precios y validaciones; RF-PRO-001…005/011.

- [x] 2.1 Escribir pruebas de entrada para cliente, productos, cantidades enteras positivas y rechazo de servicios, descuentos, precio e impuesto manuales; crear las validaciones mínimas en `backend/src/proformas/domain/`. Cierre: casos positivos y negativos, kits intactos y ausencia de dependencias de framework.
- [x] 2.2 Probar e implementar fechas y transiciones con reloj recibido como dato: emisión +7 días, fecha explícita, final inclusivo del día local, cambio de día, precedencia de convertida/anulada y prohibición de reactivación. Cierre: casos de límite sin esperas temporizadas ni cron.
- [x] 2.3 Probar el desglose inclusivo y suma por línea mediante `backend/src/shared/money.py`; implementar la composición de importes de oferta sin duplicar fórmulas ni usar coma flotante. Cierre: ejemplos 23.00 y 0.06 de las specs y ausencia de tarifa como impedimento, no exención.
- [x] 2.4 Añadir pruebas de frontera para `proformas` y ampliar `backend/tests/sales/test_boundaries.py`: solo contratos públicos, ningún import de proformas desde ventas, ninguna escritura de modelos ajenos ni dependencia de framework en dominio. Crear únicamente el módulo y las capas con uso real. Cierre: pruebas de imports y propiedad pasan.

Dependencias: grupo 1. Evidencia: `uv run --frozen pytest tests/proformas/ tests/sales/test_boundaries.py`, inicialmente con alcance a los archivos ya creados; registrar rojo/verde por tarea en la cobertura.

## 3. Persistencia, integridad y migraciones

Cubre diseño D2 y Migration Plan, historia inmutable y origen único.

- [x] 3.1 Probar e implementar `Proforma`, `ProformaLine`, `ProformaCommand` y `ProformaBrandAsset` en el nuevo `backend/src/proformas/models.py`, con migración inicial y registro de app. Cierre: restricciones de cantidad, posición, número, versión de instantáneas, referencias protegidas y deduplicación de activo demostradas.
- [x] 3.2 Probar y ampliar `backend/src/sales/models.py` con PROFORMA, referencia única nullable e instantánea; crear migración dependiente de la inicial de proformas sin dependencia inversa. Cierre: los tres orígenes son coherentes y se conservan restricciones de mantenimiento, números e historia previos.
- [x] 3.3 Probar escrituras ordinarias, directas y bulk contra contenido emitido, marca, origen y eliminación; implementar protecciones siguiendo las migraciones de historia de ventas. Cierre: no se altera oferta emitida ni se libera conversión borrando una venta vacía; transiciones legítimas funcionan.
- [x] 3.4 Probar migración sobre ventas directas y de mantenimiento, y reversión sin datos nuevos; documentar recuperación hacia adelante después de emitir o convertir. Cierre: ninguna oferta retroactiva, pérdida de datos ni ciclo de migraciones; no ejecutar restauración sobre datos del usuario.

Dependencias: grupo 2. Evidencia: pruebas de modelos/migraciones en `tests/proformas/` y ventas, `uv run --frozen python manage.py makemigrations --check --dry-run`; revisión de plan de migración en base de pruebas. Aplicar a entorno autorizado con el comando oficial `make migrate`, nunca como efecto de redactar tareas.

## 4. Contratos públicos y marca histórica

Cubre diseño D1/D4/D5 y ADR-0012.

- [x] 4.1 Probar y añadir en `backend/src/workshop_configuration/application/` la interfaz pública de marca con DTO de identidad, hash/versión y bytes normalizados o ausencia. Cierre: archivo ilegible no se omite, límite de 2 MiB y formatos vigentes respetados, sin exigir permiso administrativo al consumidor autorizado ni exponer rutas privadas.
- [x] 4.2 Probar la lectura previa de bytes y comprobación bajo bloqueo de la identidad de marca; ajustar los escritores de marca de configuración solo si es necesario para compartir esa disciplina. Cierre: sustitución/eliminación concurrente invalida la revisión; no hay lectura pesada o decodificación bajo bloqueo ni dependencia de la purga del archivo actual.
- [x] 4.3 Probar e implementar `backend/src/sales/application/proforma_links.py`: transacción exterior obligatoria, DTO inmutable, permisos de creación, nueva venta con condición editable CONTADO, origen y copia histórica, y consulta del vínculo. Cierre: no reclama otro recibo, no numera ni reserva, y solo ventas escribe su persistencia.
- [x] 4.4 Verificar uso de contratos de clientes, catálogo, disponibilidad, configuración y numeración; exponer DTO adicionales únicamente donde lo exija el diseño, conservando consumidores previos. Cierre: pruebas de frontera y regresión impiden imports privados y mutaciones ajenas.

Dependencias: grupo 3. Evidencia: pruebas nuevas del contrato de marca y de `proforma_links`, más `uv run --frozen pytest tests/sales/test_boundaries.py`; incluir regresión de los endpoints actuales de logos y reservas. No se considera terminado por compilar solamente.

## 5. Servicios de oferta, revisión y emisión

Cubre RF-PRO-001…006/010/011, diseño D2…D5 y las nueve primeras reglas de proformas salvo conversión.

- [x] 5.1 Probar e implementar comandos autorizados de creación, guardado y copia en `backend/src/proformas/application/`, con recibos, huella canónica, versión esperada y auditoría. Cierre: respuesta perdida recupera el mismo borrador, entrada incompatible da conflicto, guardado obsoleto no sobrescribe y copia conserva origen sin reactivarlo.
- [x] 5.2 Probar e implementar preview y revisión firmada propia de 15 minutos, ligados a actor, acción, identidad, versión y contenido relevante. Cierre: no producen escrituras; precios/tarifa/día/vigencia/datos históricos cambiados exigen revisión y disponibilidad insuficiente sigue siendo aviso.
- [x] 5.3 Probar e implementar emisión en una **transacción atómica** con orden de bloqueos aprobado, uso histórico de configuración, `allocate_number`, cabecera/líneas/marca y auditoría. Cierre: serie resuelta por ámbito, borrador sin número, historial reproducible y stock/saldos intactos.
- [x] 5.4 Probar e implementar reemisión compatible incluso con otra clave y revisión originalmente aplicada; probar fallos después de numeración, marca e historia. Cierre: mismo número sin duplicados; rollback de contador, usos, instantáneas y auditoría de éxito; rechazo auditado fuera del rollback.
- [x] 5.5 Probar e implementar anulación explícita, estado efectivo, consultas paginadas y filtros, referencias entre ofertas y documento histórico. Cierre: mismo reloj local en lista/detalle, estados terminales conservados y consultas sin mutación ni pérdida de número.

Dependencias: grupos 2…4. Evidencia: `uv run --frozen pytest tests/proformas/`, con pruebas de borradores, revisiones, emisión, historia, anulación, idempotencia y consultas; conciliar número y ausencia de efectos de inventario/cobranza en cada operación.

## 6. Conversión y adaptación de ventas

Cubre RF-PRO-007…009, RF-VEN-002 y las cinco reglas del delta de ventas; diseño D5/D6.

- [x] 6.1 Probar e implementar preview y conversión que coordinan proforma y `proforma_links`, con vigencia revalidada después de bloqueos. Cierre: venta, vínculo, estado y auditoría se completan juntos; oferta no convertible o referencia inactiva no dejan una venta parcial.
- [x] 6.2 Probar replay de la misma conversión y nuevo intento sobre oferta ya convertida, incluso después del vencimiento; inyectar fallo tras creación de venta. Cierre: un replay recupera el resultado, un intento nuevo informa la existente y nunca se crea una segunda venta.
- [x] 6.3 Probar e implementar comparación en servidor de productos, cantidades agregadas, precios, tarifas y totales entre copia cotizada y venta actual, incluidos duplicados, líneas nuevas y retiradas. Cierre: casos de precio 10→12, cambio tributario y revisión posterior a 13 sin cambiar la oferta.
- [x] 6.4 Adaptar `backend/src/sales/application/queries.py`, `reads.py`, `reviews.py`, entrada y serializers para nuevo origen y comparación, preservando claves de orden existentes. Cierre: filtros y enlaces correctos; rechazo de origen manual; borrador vacío conserva vínculo; confirmación sigue precio vigente, disponibilidad y cobro independiente.
- [x] 6.5 Probar confirmación después de vencer la oferta, anulación comercial posterior y edición de productos/cantidades; ejecutar regresión de ventas directas, mantenimiento, reservas, pagos y retenciones. Cierre: ninguna acción reactiva oferta ni obtiene acceso de taller a ventas de proforma.
- [x] 6.6 Crear consulta operativa de conciliación de solo lectura sobre ofertas convertidas y vínculos devueltos por el contrato público de ventas. Cierre: detecta discrepancia sintética y no modifica datos ni importa modelos ajenos.

Dependencias: grupo 5 y contrato 4.3. Evidencia: `uv run --frozen pytest tests/proformas/ tests/sales/`; mapa de cobertura distingue nuevos escenarios de regresiones preservadas.

## 7. Concurrencia y seguridad de la API

Cubre RNF-INT/SEG y diseño D5/D7; se completa antes de construir pantallas sobre el contrato.

- [x] 7.1 Escribir y ejecutar pruebas PostgreSQL con conexiones independientes y barreras para doble emisión, emisiones distintas, doble conversión, conversión/anulación y edición/emisión. Cierre: números únicos, una venta, ningún efecto parcial ni reserva; respetar bloqueos existentes de ventas/configuración.
- [x] 7.2 Probar cambios de catálogo/tarifa/logo y paso de día mientras se esperan bloqueos, además de errores transitorios y reintento de la unidad completa. Cierre: revisión/vigencia revalidadas y ausencia de reintentos parciales; no usar sleeps para ordenar concurrencia.
- [x] 7.3 Probar e implementar `backend/src/proformas/api/` y composición en `backend/src/config/api/urls.py` con las rutas de diseño D7, DTO tipados y errores del proyecto. Cierre: decimales como cadenas, campos desconocidos rechazados, estado efectivo y conflicto distinguibles, sin precios calculados por el cliente.
- [x] 7.4 Cubrir cada acción y lectura de logo/documento con Administrador, Vendedor, Encargado, roles acumulados, sesión inválida y CSRF; comprobar replay tras pérdida de permiso y rechazo de pagos/retenciones sobre ofertas. Cierre: autorización siempre en backend y ausencia de costos/datos privados en respuestas y errores.
- [x] 7.5 Actualizar OpenAPI mediante serializers/anotaciones existentes y pruebas nuevas, con operaciones, ejemplos y conflictos de proformas y el origen de ventas. Cierre: esquema generado válido, rutas reales coincidentes y ninguna ruptura de los contratos previos de ventas.

Dependencias: grupo 6; las pruebas transaccionales también retroalimentan grupos 4…6. Evidencia: pruebas de concurrencia/API/autorización/OpenAPI en `tests/proformas/`, más `tests/api/test_openapi.py` y `tests/sales/test_openapi.py`; registrar los comandos concretos y resultados en cobertura.

## 8. Frontend y flujo comercial

Cubre UI-050…052, RF-PRO-001…011 y diseño D8. Usar sistema visual y componentes existentes; no rediseñar ventas.

- [x] 8.1 Probar y crear tipos, cliente API y hooks en `frontend/src/features/proformas/` sobre el contrato del grupo 7. Cierre: sin cálculo monetario local, claves estables de intento, invalidación tras conversión y limpieza de caché al cerrar sesión.
- [x] 8.2 Probar y crear lista, detalle y guards en `frontend/src/pages/proformas/`, `frontend/src/app/App.tsx` y `navigation.ts`. Cierre: búsqueda/filtros, estados textuales, enlaces a origen/nueva oferta/venta y acceso directo protegido; permisos reflejan el backend.
- [x] 8.3 Probar y crear editor con cliente, vigencia, líneas y cantidades, precios no editables y disponibilidad informativa. Cierre: captura persiste tras error, cambios sin guardar se advierten, cotizar sin stock es posible y revisión obsoleta exige actualizar sin emitir.
- [x] 8.4 Probar e implementar acciones de emitir, copiar, anular y convertir con confirmaciones y recuperación de respuesta incierta. Cierre: doble clic o retry no genera otra clave ni otro documento; el resultado enlaza la misma venta.
- [x] 8.5 Probar y adaptar componentes y páginas existentes de ventas para origen proforma, comparación con cotización, ajuste de líneas y confirmación/cobro normal. Cierre: retiro y adición de productos mantienen intacta la oferta; filtros de mantenimiento y flujo directo conservados.

Dependencias: grupo 7 cerrado. Evidencia: pruebas Vitest de los archivos creados/editados mediante `npm test -- <rutas>`, más rutas y limpieza de sesión existentes; registrar paths concretos al implementarlos.

## 9. Impresión, accesibilidad y recorrido completo

Cubre D5 de propuesta, diseño D4/D8 y RNF-USA aplicables.

- [x] 9.1 Probar e implementar documento de proforma reutilizando `frontend/src/shared/ui/business/DocumentSheet`, con identidad y logo históricos, vigencia, líneas, impuestos, totales, avisos y estado. Cierre: nunca consulta logo vigente para oferta emitida ni incluye condición de cobro, costos o identidad artesanal.
- [x] 9.2 Probar logo reemplazado/eliminado después de emitir, ausencia original de logo, imagen ilegible antes de emitir y espera de recursos antes de imprimir. Cierre: historia reproducible, sin huecos artificiales ni omisiones silenciosas; guardar PDF usa el navegador.
- [x] 9.3 Añadir E2E en `frontend/e2e/` para crear → revisar → emitir → imprimir → convertir → ajustar líneas → confirmar, incluyendo respuesta perdida, oferta vencida y stock insuficiente. Cierre: vínculos/números/estados coherentes y una sola venta, sin efectos de stock hasta confirmar.
- [x] 9.4 Verificar y corregir impresión A4 multipágina, ancho 360 px, teclado, foco, etiquetas, contraste y estados independientes del color. Cierre: evidencia visual y de accesibilidad identificada, guardada fuera del repositorio; sin filas o totales recortados.

Dependencias: grupo 8. Evidencia: `npm run test:e2e -- <archivo-de-proformas>` y pruebas enfocadas de documento; capturas e inspección de impresión con y sin logo. No afirmar fidelidad visual solo por aprobar tests DOM.

## 10. Documentación, operación y cierre de implementación

Cubre diseño Migration Plan y Verification Strategy. Estas tareas se ejecutan en apply/verify, no durante la redacción del presente artefacto.

- [x] 10.1 Actualizar `docs/arquitectura/modelo-datos.md` con persistencia aprobada e implementada, `docs/tecnico/arquitectura-inicial.md`, ADR-0012 y referencias de fronteras; sincronizar términos y compañeros de glosario. Cierre: coinciden con modelos, migraciones y contratos reales; no presentar previsiones como implementación.
- [x] 10.2 Actualizar reglas, alcance, requisitos, casos de uso, interfaz y matriz de trazabilidad de proformas en `docs/negocio/`; corregir edición de vigentes, captura libre de precios y referencia RN-PRO-009 inexistente. Registrar las decisiones aprobadas donde corresponda sin modificar obligaciones externas ni brechas ajenas.
- [x] 10.3 Completar `cobertura-proformas.md` con evidencia de los 76 escenarios, riesgos, comandos y resultados; actualizar cobertura de ventas afectada y sus referencias terminológicas. Cierre: cada escenario tiene prueba real y resultado, o bloqueo explícito que impide declarar terminado.
- [x] 10.4 Documentar despliegue y deshabilitación segura de escrituras, probar respaldo/restauración sintética de ofertas, logos y vínculos, y validar conciliación de solo lectura. Cierre: datos previos preservados; no se revierte destructivamente tras nuevas ventas ni se versionan respaldos o imágenes generadas.
- [x] 10.5 Ejecutar `make check`, `make test` y `make audit`; verificar cobertura backend según `backend/pyproject.toml`, cobertura frontend, build, migraciones, OpenAPI y E2E aplicable. Cierre: todas las comprobaciones necesarias pasan con evidencia reciente; cualquier fallo real se resuelve o queda como bloqueo, no se marca esta casilla.
- [x] 10.6 Ejecutar verificación OpenSpec de implementación frente a propuesta/specs/diseño y `openspec validate gestionar-proformas-comerciales --strict`; revisar diff y cambios ajenos. Cierre: sin criterios pendientes ni desviaciones sin aprobar; registrar informe verificable. Integración, sincronización final de specs y archivo requieren su fase y autorizaciones, y el archivo ocurre en `master` después de integrar y verificar; no archivar por completar los cuatro artefactos.

Dependencias: grupos 1…9. Evidencia de grupo: comandos oficiales y reporte de verificación, enlaces a pruebas y evidencia visual/operativa. La documentación histórica no redefine requisitos. La creación de tasks deja la planificación completa, no la funcionalidad implementada.

Referencia terminológica: [tasks-glossary-reference.md](tasks-glossary-reference.md).
