## Context

Diseño para `configuracion-operativa-y-fiscal`, basado en `proposal.md`, su referencia terminológica y `specs/configuracion-operativa-y-fiscal/spec.md`. Estado: borrador técnico revisable; la discrepancia de vigencias indicada abajo requiere reconciliación antes de implementar esa parte.

El código inspeccionado contiene `identity` y `customer_registry` en `backend/src/`. `identity.application.authorization` valida permisos y `identity.application.audit.record_audit_event` registra eventos con metadatos filtrados. `customer_registry.application.brands` ya combina transacciones, bloqueo de filas y `expected_version`. La composición HTTP está en `backend/src/config/api/urls.py`; React compone rutas en `frontend/src/app/App.tsx`, con `PermissionGuard`, TanStack Query y componentes de `shared/ui`.

Fuentes consultadas: decisiones confirmadas, modelo de dominio, spec principal `modelo-dominio-taller`, alcance V1, reglas de negocio, requisitos funcionales y no funcionales, CU-003, actores y permisos, interfaz y trazabilidad; arquitectura inicial, C4 de contenedores y ADR-0001, ADR-0002 y ADR-0003. Se reutilizan los glosarios de producto y técnico. Estas fuentes se consultaron durante este cambio; el código aporta evidencia de integración, no requisitos fiscales.

La entrevista aprobó `COM-ING`, `COM-PRO`, `COM-VEN` y `ART-SER`, contador inicial 1, representación con al menos seis dígitos y protección después del primer uso. El proposal y la fuente de decisiones todavía describen DP-006 como pendiente: es una brecha documental que debe sincronizarse con esos acuerdos antes de aplicar. No se interpreta la aprobación como validación de tarifas tributarias reales.

## Goals / Non-Goals

**Goals:** configuración administrativa verificable de las dos **entidades fiscales**, tarifas con vigencia, **bodega** única y numeración; contratos internos transaccionales para futuros consumidores; API, interfaz y auditoría consistentes con la aplicación existente.

**Non-Goals:** implementar ventas, ingresos, proformas o servicios completos, calcular impuestos de sus líneas, decidir clasificación tributaria o redondeo, integrar SRI, crear multibodega o reemplazar identidad. Este artefacto propone persistencia; no crea modelos, migraciones ni modifica `modelo-datos.md`.

## Decisions

### 1. Frontera funcional y dependencias

Crear `backend/src/workshop_configuration/` con `domain`, `application`, `api`, `models.py` y migraciones cuando comience apply. El dominio contendrá validaciones, tipos de documento, formato de números y selección de intervalos sin dependencia de DRF o HTTP. La aplicación coordinará persistencia, permisos y transacciones. Registrar la aplicación en `config/settings/base.py` y sus rutas en `config/api/urls.py`.

Los consumidores accederán mediante funciones públicas de aplicación y recibirán valores inmutables; no actualizarán tablas de configuración directamente. Se reutilizan las interfaces públicas de identidad. No se mueve la auditoría a `shared` en este cambio.

Alternativas: introducir configuración en `config` mezclaría parámetros del despliegue con negocio; ubicarla en identidad ampliaría una frontera ajena; un módulo por cada tabla fragmentaría una capacidad cohesiva. La decisión aplica el **monolito modular** del ADR-0001 sin cambiar los contenedores.

### 2. Persistencia propuesta

Los nombres siguientes son nuevos elementos de diseño, no archivos ni modelos existentes.

| Registro | Responsabilidad y restricciones |
|---|---|
| WorkshopConfiguration | Fila única de instalación, versión y estado de inicialización; punto de bloqueo para el alta inicial. |
| FiscalEntity | Tipo COMERCIAL/ARTESANAL único, RUC textual único de 13 caracteres, razón social y versión. Tipo inmutable; sin borrado ordinario. |
| Warehouse | Identidad única de V1, nombre y versión; siempre activa después de inicializar. |
| TaxDefinition | Código y nombre del impuesto por entidad; unicidad de entidad y código; punto de bloqueo de sus vigencias. |
| TaxPeriod | Tarifa Decimal entre 0 y 100, inicio, fin opcional, versión y marca de uso. Intervalos ordenados por inicio. |
| NumberingScope | Entidad y tipo de documento únicos; bloquea tanto sustitución de serie como asignación. |
| DocumentSeries | Ámbito, código único, estado, último número y versión. Unicidad condicional de serie activa por ámbito. |
| NumberAllocation | Serie, número, identidad del documento consumidor y clave lógica; únicos serie/número y ámbito/documento. Conserva el número visible asignado. |
| ConfigurationUse | Referencia opaca al consumidor y copia de entidad, período y tarifa seleccionados; prueba de uso sin claves foráneas a futuros módulos. |
| ConfigurationCommand | Clave de idempotencia, actor, acción, huella de entrada y resultado de escrituras administrativas. |

Aplicar CHECK para tipos admitidos, longitud de RUC, tarifas, contadores no negativos y singleton; claves foráneas protegidas en referencias históricas. La ausencia de API de borrado y los servicios preservan las invariantes que necesitan comparar estados previos. No se afirma que la validación de longitud certifique un RUC ante el SRI.

La tarifa viaja como cadena decimal en JSON y se procesa con Decimal; el diseño no redondea silenciosamente una entrada. La precisión admitida deberá quedar explícita en el contrato y sus errores. Los identificadores fiscales nunca son números JavaScript.

### 3. Inicialización atómica

Una migración crea únicamente el registro singleton de instalación. `initialize_workshop` exige permisos administrativos, bloquea ese registro y valida ambos contribuyentes antes de crear juntos las dos entidades, bodega principal, cuatro ámbitos y cuatro series. Los RUC y razones sociales provienen del formulario; no se incluyen contribuyentes ni tarifas ficticios en migraciones.

Antes de inicializar existen cero entidades operativas; después existen exactamente dos. La interfaz informa configuración pendiente y las funciones dependientes rechazan su uso. Repetir el mismo comando devuelve el resultado previo; intentar reinicializar con datos diferentes produce conflicto. Una inicialización fallida revierte todo.

### 4. Vigencias y discrepancia normativa

Usar fechas de negocio, interpretadas en `America/Guayaquil`, con inicio y fin inclusivos. El siguiente período puede comenzar al día siguiente del fin anterior. Cada escritura bloquea TaxDefinition, comprueba el intervalo y luego persiste; dos altas simultáneas sobre un calendario vacío también bloquean el mismo padre. La resolución para confirmación utiliza ese mismo bloqueo para evitar una carrera entre selección y modificación.

Registrar uso y copia histórica en la transacción del consumidor. El bloqueo de TaxDefinition serializa también la comprobación de uso frente a una edición. No seleccionar automáticamente cualquier impuesto configurado: el consumidor solicita explícitamente sus códigos aplicables; si falta uno, falla antes de numerar.

**Contradicción encontrada:** el escenario «Cambio futuro de tarifa» permite cerrar el período anterior, mientras «Intento de editar una tarifa utilizada» prohíbe modificar sus fechas. Una vigencia abierta utilizada no puede sustituirse bajo ambas reglas literales sin solaparse.

**Recomendación para reconciliar la spec:** distinguir la edición genérica de una acción explícita `schedule_successor`. Esta acción, atómica y auditada, solo cierra prospectivamente la vigencia abierta y crea la sucesora, sin tocar tarifa, inicio ni copias históricas. Debe rechazar una fecha que invalide usos ya registrados. Esta excepción necesita reflejarse en la spec; no se considera resuelta solo por escribir este diseño. Mientras no se reconcilie, no implementar esa acción ni presentar la gestión de vigencias como completa.

Alternativa: exigir fin obligatorio antes del primer uso evita la contradicción pero cambia el requisito de fin opcional y complica la operación. Revisiones completas de calendarios añadirían mayor complejidad sin necesidad actual.

### 5. Numeración y transacción del consumidor

`allocate_number` será una función interna, sin endpoint para consumir números. El servicio de la capacidad consumidora verifica sus permisos y estado, abre la transacción exterior, resuelve configuración, solicita número, guarda su documento y efectos, y confirma conjuntamente. Configuración no exige `parametros.gestionar` al Vendedor que confirma una venta: ese permiso protege administración, no colaboración interna entre módulos.

Bloquear NumberingScope, buscar una asignación existente para la identidad estable del documento y, si existe, devolverla. En otro caso validar la serie activa, incrementar su contador y crear NumberAllocation dentro de la misma transacción. La identidad del documento y la huella de la solicitud impiden que un reintento con otra clave numere dos veces o que una clave repetida oculte entradas diferentes. Las discrepancias devuelven conflicto.

El cierre y sustitución bloquean el mismo ámbito. La nueva serie empieza en 1; la unicidad global del código impide reutilizar un prefijo retirado. El contador se incrementa únicamente desde el servicio y crece más allá de seis dígitos cuando sea necesario. El cambio de año no lo reinicia. Una anulación posterior conserva NumberAllocation.

Se elige contador transaccional sobre fila frente a `MAX()+1`, inseguro ante carreras, o secuencia independiente, que no revierte con la operación. Una falla de la transacción exterior revierte incremento y asignación; un número de una transacción confirmada nunca vuelve a estar disponible.

Orden de bloqueos del contrato: configuración aplicable (entidad, impuestos en orden de identificador), ámbito y serie. Los consumidores deberán establecer además un orden consistente para sus propios recursos. No se reintenta un fragmento de una confirmación: el reintento abarca la unidad completa con su identidad estable.

### 6. API administrativa, errores y auditoría

Prefijo propuesto `/api/v1/workshop-configuration/`:

| Recurso/acción | Métodos | Permiso |
|---|---|---|
| status/ | GET | parametros.gestionar |
| initialize/ | POST | entidades_fiscales.editar y parametros.gestionar |
| entities/ y entities/{id}/ | GET, PATCH en detalle | entidades_fiscales.ver / entidades_fiscales.editar |
| warehouse/ | GET, PATCH | parametros.gestionar |
| taxes/ y taxes/{id}/periods/ | GET, POST | parametros.gestionar |
| periods/{id}/ | PATCH para registros no utilizados | parametros.gestionar |
| series/ y series/{id}/ | GET, PATCH previo al uso | parametros.gestionar |
| series/{id}/replace/ | POST | parametros.gestionar |

La sustitución de vigencias se añade al contrato solo tras reconciliar el punto anterior. No se exponen DELETE ni edición de contador. PATCH incluye `expected_version`; si otro usuario guardó primero, responder 409 conservando su cambio. POST administrativo usa clave lógica persistida junto al resultado; misma clave y entrada devuelve resultado previo, misma clave y otra entrada devuelve 409. La inicialización bloqueada garantiza unicidad incluso con claves distintas.

Mantener sesiones, CSRF y mismo origen según ADR-0003. Errores siguen `application/problem+json` y X-Request-ID: 400 validación, 403 permisos, 404 recurso inexistente, 409 versión o estado conflictivo. Publicar entradas, salidas y errores con drf-spectacular. No exponer datos fiscales mediante status público.

Auditoría exitosa se guarda en la misma transacción. Rechazos se registran después del rollback o antes de escribir, para no perderlos al abortar. Usar `changed_fields`, admitido por la lista de metadatos existente, y códigos de motivo; evitar copiar RUC o cuerpos completos en logs. Ampliar etiquetas de acciones en frontend. Un fallo real de base de datos no permite garantizar que el rechazo quede persistido; conservar correlación en el registro técnico sin anunciar éxito.

### 7. Frontend y alcance de integración

Crear `frontend/src/features/workshop-configuration/` para contratos, consultas y mutaciones, y `pages/workshop-configuration/` para la pantalla protegida `/configuration`. Integrar en App y AuthenticatedShell. Reutilizar campos, tablas, diálogos y estados existentes de `shared/ui`; el diseño no cambia el sistema visual.

Mostrar alta inicial de ambos RUC y luego secciones Entidades, Impuestos y vigencias, Bodega y Series. Cada formulario identifica su entidad; series muestran último número, siguiente representación y bloqueo de edición. Tarifas se mantienen como texto decimal hasta validación del servidor. Errores junto al campo, conflicto de versión con recarga explícita y datos introducidos preservados, foco y etiquetas accesibles, bloqueo temporal de doble envío. Invalidar únicamente consultas afectadas tras éxito.

La interfaz administrativa y servicios internos son verificables ahora. Emisión, impresión y confirmación de documentos reales se integrarán en sus cambios futuros; aquí se prueban mediante consumidores de prueba dentro de una transacción. No declarar cubiertos recorridos reales que aún no existen.

### 8. Estrategia de verificación

En apply usar TDD y añadir `backend/tests/workshop_configuration/`: pruebas puras de formato y validación; integración de inicialización, restricciones y permisos de todos los roles; copias históricas y auditoría; contratos OpenAPI; transacciones PostgreSQL con conexiones distintas y barreras, no SQLite ni esperas arbitrarias.

Casos críticos: dos altas iniciales; períodos solapados concurrentes; carrera edición/primer uso; dos asignaciones distintas consecutivas; reintento del mismo documento; sustitución concurrente con asignación; excepción del consumidor después de numerar y rollback total. Vincular cada prueba al Requirement y Scenario correspondiente. Probar agotamiento del entero almacenado con rechazo atómico y crecimiento de seis a siete dígitos sin reinicio.

Frontend: guards, errores de campos, versiones obsoletas, vigencias por RUC, series bloqueadas y accesibilidad; recorrido administrativo con sesión y CSRF. Ejecutar `make check`, `make test`, `make audit` y validación OpenSpec antes de finalizar implementación. Las pruebas de documentos completos quedan identificadas como dependencias de sus capacidades.

## Risks / Trade-offs

- Contradicción de vigencias → reconciliar los dos escenarios antes de implementar la sustitución; no esconder la excepción en persistencia.
- RUC de 13 caracteres no garantiza validez tributaria → respetar el alcance de validación documentado y cargar datos oficiales; sin consulta SRI.
- Serialización de numeración → bloqueo corto por ámbito; mantener cálculos y llamadas externas fuera de la sección crítica.
- Historial usado por capacidades futuras → contratos públicos, copias persistidas y pruebas de rollback; evitar mutación directa desde consumidores.
- Auditoría alojada en identidad → reutilizar su interfaz existente; evaluar extracción mediante otro cambio si se vuelve necesaria.
- El validador OpenSpec comprueba estructura, no consistencia de negocio → mantener visible el hallazgo de vigencias aunque valide sin errores.

## Migration Plan

Después de aprobar este diseño, generar migraciones aditivas para el módulo y singleton, con restricciones e índices. No tocar tablas de clientes ni poblar tasas o datos personales. Registrar la aplicación, ejecutar migraciones en entorno de prueba vacío y con los datos existentes de identidad/clientes; después ejecutar el alta administrativa.

Respaldar antes de desplegar y comprobar conservación de registros existentes. Mientras no haya uso, una reversión ensayada puede retirar las tablas nuevas si están vacías. Después de crear configuración o numerar documentos, revertir código conservando tablas y datos; corregir hacia adelante. Nunca eliminar asignaciones para resolver un despliegue fallido. Verificar respaldo y restauración según el procedimiento vigente antes de producción.

Sincronizar DP-006, proposal y trazabilidad con la entrevista; registrar en master los artefactos aprobados conforme al flujo del repositorio antes de apply. Esta invocación redacta el diseño en develop y no crea commits ni merges.

## Open Questions

La única discrepancia de comportamiento detectada es el cierre prospectivo de vigencias utilizadas, con recomendación concreta en la decisión 4. Las tarifas reales y reglas de redondeo siguen como validación externa fuera del alcance. La precisión decimal aceptada por el formulario debe concretarse y probarse en el contrato sin atribuirle carácter tributario.

El contrato transaccional entre consumidores y numeración es una decisión duradera: deberá extraerse a un ADR propuesto junto con la reconciliación documental, antes de apply. No requiere sustituir ADR-0001 ni ADR-0003.
