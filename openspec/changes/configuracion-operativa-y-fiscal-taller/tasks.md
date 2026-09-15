## 1. Reconciliación documental previa a implementación

Fuentes: `proposal.md`, `specs/configuracion-operativa-y-fiscal/spec.md`, `design.md` y sus referencias de glosario; decisiones confirmadas, modelo de dominio, requisitos y ADR consultados durante este cambio. Las rutas de configuración indicadas abajo son nuevas rutas propuestas por el diseño. Crear este listado no significa haber ejecutado sus tareas.

- [x] 1.1 Sincronizar DP-006 en `docs/negocio/decisiones/decisiones-confirmadas.yaml`, proposal y documentos afectados con las cuatro series y política aprobadas en la entrevista. Finalización: ninguna fuente presenta como pendiente el formato ya acordado; revisión de referencias con `rg 'DP-006' docs/negocio openspec/changes/configuracion-operativa-y-fiscal-taller`.
- [x] 1.2 Reconciliar en la spec y el diseño el cierre prospectivo auditado de una vigencia utilizada: distinguirlo de edición genérica, preservar usos históricos y añadir escenarios de sustitución válida, fecha incompatible y concurrencia. Finalización: ambos artefactos expresan una misma regla y existe evidencia de aprobación de la reconciliación antes de implementar vigencias.
- [x] 1.3 Concretar en el diseño la precisión decimal admitida, límites de códigos y datos opcionales, semántica de claves de idempotencia y respuesta ante entradas excedidas, sin redondeo silencioso ni atribuir validez tributaria. Finalización: contrato suficientemente preciso para pruebas de límites; cualquier cambio observable queda reflejado en la spec.
- [x] 1.4 Redactar en `docs/adr/` un ADR del contrato transaccional de configuración y numeración, con alternativas, orden de bloqueos, límites de la transacción exterior y responsabilidad de los consumidores. Finalización: ADR y referencia de glosario revisados y coherentes con ADR-0001 y ADR-0003.
- [x] 1.5 Verificar aprobación de los artefactos reconciliados y su disponibilidad en `master` antes de apply. Finalización: evidencia de revisión, `git status --short` y comparación de artefactos con `master`; no crear commits, ramas ni merges sin autorización. La implementación de los grupos siguientes depende del cierre de este grupo.

## 2. Dominio y persistencia

Aplicar **TDD** en cada tarea de comportamiento: observar fallo por la causa esperada, implementar y refactorizar. Comando enfocado, desde `backend/`: `uv run --frozen pytest tests/workshop_configuration/`. Registrar resultados reales por tarea y mantener trazabilidad a Requirement/Scenario.

- [x] 2.1 Crear pruebas puras de tipos fiscales, RUC textual de 13 caracteres, razón social, tarifas decimales, intervalos y formato de **secuencial**; implementar validaciones en `backend/src/workshop_configuration/domain/`. Finalización: casos válidos, límites y rechazos pasan sin depender de HTTP ni persistencia.
- [x] 2.2 Añadir pruebas de unicidad y restricciones para instalación, **entidad fiscal** y **bodega**; implementar sus registros y migraciones aditivas en `backend/src/workshop_configuration/`, registrando la aplicación en `backend/src/config/settings/base.py`. Finalización: singleton de instalación creado sin RUC ficticios; duplicados y tipos inválidos rechazados.
- [x] 2.3 Añadir pruebas y persistencia de TaxDefinition, TaxPeriod y ConfigurationUse según el diseño reconciliado. Finalización: restricciones de tarifa e intervalos, referencias protegidas y conservación de copias históricas verificadas.
- [x] 2.4 Añadir pruebas y persistencia de NumberingScope, DocumentSeries, NumberAllocation y ConfigurationCommand. Finalización: unicidades de ámbito, serie activa, código, número y documento consumidor verificadas; migraciones reproducibles con `uv run --frozen python manage.py makemigrations --check --dry-run`.

## 3. Servicios administrativos

Dependencia: grupo 2. Evidencia: pruebas enfocadas PostgreSQL y auditoría persistida, ejecutadas con el comando del grupo 2.

- [x] 3.1 Probar e implementar `initialize_workshop` en `application/`: permisos, ambos RUC, bodega principal y cuatro series dentro de una transacción. Finalización: repetición devuelve resultado previo, entradas incompatibles generan conflicto y falla intermedia no deja configuración parcial.
- [x] 3.2 Probar e implementar consulta y actualización de entidades y bodega con `expected_version`. Finalización: versiones obsoletas rechazadas, tipo fiscal inmutable y ausencia de borrado/desactivación ordinarios; identidad y copias anteriores conservadas.
- [x] 3.3 Probar e implementar impuestos, calendarios y acción de sucesión aprobada, bloqueando TaxDefinition. Finalización: no hay solapamientos, los límites de fechas son reproducibles y se rechaza cualquier cambio que invalide usos históricos.
- [x] 3.4 Probar e implementar edición previa al uso y sustitución atómica de series. Finalización: código utilizado protegido, contador no editable, prefijo retirado no reutilizable y una sola serie activa por ámbito.
- [x] 3.5 Integrar auditoría mediante `identity.application.audit` y autorización mediante su servicio público. Finalización: éxitos atómicos con cambios, rechazos conservados tras rollback, metadatos limitados y pruebas de roles acumulados y denegaciones.

## 4. Contratos internos, idempotencia y concurrencia

Dependencia: grupo 3. Usar conexiones PostgreSQL independientes y barreras en `backend/tests/workshop_configuration/`; los consumidores de prueba no implementan ventas ni inventario reales.

- [x] 4.1 Probar e implementar resolución explícita de entidad, códigos de impuesto y configuración aplicable en la transacción del consumidor. Finalización: falta o ambigüedad rechaza antes de efectos, uso y copia se guardan juntos y edición concurrente no altera la selección.
- [x] 4.2 Probar e implementar `allocate_number` como servicio interno con bloqueo del ámbito y deduplicación por documento y solicitud. Finalización: llamadas fuera del contexto transaccional requerido se rechazan, reintentos conservan número y entradas incompatibles no se aceptan bajo una clave repetida.
- [x] 4.3 Probar dos confirmaciones concurrentes, reintentos simultáneos y sustitución de serie contra asignación. Finalización: números distintos consecutivos para operaciones distintas, una asignación por documento y ámbito fiscal correcto.
- [x] 4.4 Probar rollback del consumidor después de numerar, anulación posterior, paso de seis a siete dígitos y agotamiento del entero. Finalización: no hay efectos parciales, números confirmados no se reutilizan y agotamiento genera rechazo atómico.
- [x] 4.5 Probar carreras de inicialización, creación de períodos y edición frente a primer uso. Finalización: resultados deterministas sin duplicados ni solapamientos, mediante el comando de pruebas enfocadas; documentar orden de bloqueos demostrado.

## 5. API y contrato OpenAPI

Dependencias: grupos 3 y 4. Evidencia: pruebas HTTP y esquema dentro de `backend/tests/workshop_configuration/`.

- [x] 5.1 Probar e implementar los recursos administrativos de la decisión 6 del diseño bajo `/api/v1/workshop-configuration/`, en `workshop_configuration/api/` e integrados desde `backend/src/config/api/urls.py`. Finalización: consultas y comandos delegan reglas a servicios y no existe endpoint para consumir números libremente.
- [x] 5.2 Añadir pruebas de sesión, CSRF, roles, `expected_version`, idempotencia y errores `application/problem+json`. Finalización: 400/403/404/409 y correlación coherentes con el contrato, sin datos fiscales en rutas públicas ni modificación por usuarios sin permiso.
- [x] 5.3 Documentar entradas, respuestas, decimal textual, errores y acciones de sucesión mediante drf-spectacular. Finalización: pruebas de OpenAPI validan todos los recursos y no exponen edición de contador o borrados prohibidos.

## 6. Frontend administrativo

Dependencia: contrato del grupo 5. Evidencia desde `frontend/`: `npm test`, `npm run typecheck` y `npm run test:e2e` para el recorrido agregado; usar la configuración de entorno de pruebas existente.

- [x] 6.1 Probar e implementar contratos, consultas y mutaciones en `frontend/src/features/workshop-configuration/` reutilizando el cliente HTTP. Finalización: tarifas permanecen como cadenas, errores se traducen y se invalidan solo consultas afectadas.
- [x] 6.2 Probar e implementar alta inicial y secciones de entidades y bodega en `frontend/src/pages/workshop-configuration/`. Finalización: ambos RUC claramente identificados, doble envío controlado y datos del formulario preservados al fallar.
- [x] 6.3 Probar e implementar calendarios tributarios y formularios de series con componentes de `shared/ui`. Finalización: conflictos de fechas/versiones legibles, primer uso bloquea edición y sustituciones requieren la acción explícita prevista.
- [x] 6.4 Integrar `/configuration` en `frontend/src/app/App.tsx` y navegación de `AuthenticatedShell.tsx`, además de etiquetas de auditoría en `features/audit/labels.ts`. Finalización: acceso y enlaces solo para permisos administrativos; rutas directas y roles acumulados probados.
- [x] 6.5 Añadir recorrido administrativo de extremo a extremo y comprobaciones de teclado, foco, etiquetas y adaptación móvil. Finalización: inicialización, modificación, rechazo y consulta funcionan con backend real; conservar evidencia sin datos personales reales.

## 7. Migraciones, documentación y verificación final

- [x] 7.1 Ensayar migraciones en base vacía y con identidad/clientes existentes en un entorno de prueba. Finalización: registros previos preservados, restricciones activas y `makemigrations --check --dry-run` sin cambios pendientes; registrar versiones y resultado.
- [x] 7.2 Documentar en `docs/tecnico/` el alta operativa, configuración incompleta, respaldo y reversión conservando numeración utilizada; enlazar desde README. Finalización: ensayo de recuperación en entorno desechable y procedimiento que no elimina datos usados ni exige tasas ficticias.
- [x] 7.3 Actualizar matriz de trazabilidad, requisitos/interfaz afectados y glosarios con sus referencias complementarias. Finalización: cada escenario de la spec apunta a prueba o evidencia; separar cobertura de servicios internos de recorridos documentales futuros aún no implementados.
- [x] 7.4 Ejecutar `make check`, `make test`, `make audit` y `openspec validate configuracion-operativa-y-fiscal-taller --type change --strict`. Finalización: resultados reales registrados para formato, lint, tipos, pruebas, cobertura, build, migraciones y documentación; resolver fallos pertinentes antes de declarar terminado.
- [x] 7.5 Revisar implementación frente a todos los escenarios y producir evidencia de verificación con limitaciones reales y dependencias futuras. Finalización: ninguna tarea obligatoria pendiente; integración y archivo solo tras sus controles de Git y verificación, sin confundir artefactos redactados con funcionalidad terminada.
