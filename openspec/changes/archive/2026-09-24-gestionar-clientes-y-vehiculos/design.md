## Context

**Estado:** diseño aprobado por el usuario al solicitar su commit y continuación a tareas el 2026-09-11. Las tres specs fueron aprobadas al solicitar su commit y continuación; están registradas en `master` (`64a6ef4`) y `develop` (`44f5cac`). Se autoriza crear tareas después de registrar el diseño en `master`; no se autoriza implementación.

El backend real contiene `identity` con modelos en `models.py`, servicios bajo `application`, reglas puras en `domain` y adaptadores DRF en `api`. La autorización y auditoría ya tienen servicios explícitos. El frontend dispone de cliente HTTP, TanStack Query, guards, navegación y primitivas visuales. No existe módulo funcional de clientes ni documento `modelo-datos.md`.

Se conserva DP-008 revisada: cliente exige nombre o razón social, identificación con su tipo y teléfono; email y dirección son opcionales. Vehículo exige placa, marca, modelo y propietario; color, año y VIN son opcionales. No se incorporan comprobantes, reglas tributarias ni validaciones externas. Las especificaciones aprobadas gobiernan el comportamiento; este documento define su realización técnica.

**Condición de aplicación:** verificar y cerrar `gestion-usuarios-autenticacion-roles` y `establecer-sistema-visual-frontend`, incluida aceptación visual humana y archivo desde `master`, antes de implementar esta capacidad. Los contadores de tareas y las pruebas antiguas no sustituyen ese cierre. Se volverá a inspeccionar su código integrado antes de aplicar: este diseño se basa en el estado actual de `develop`.

## Goals / Non-Goals

**Goals:** implementar las tres capacidades aprobadas con fronteras claras, propiedad coherente, unicidad concurrente, permisos efectivos, auditoría atómica, errores por campo y una interfaz que reutilice el sistema visual. Preservar los datos compartidos entre ambos RUC.

**Non-Goals:** operaciones económicas o de mantenimiento, historial complejo, fotografías, fusión de duplicados, importaciones, catálogos de productos, nuevos roles, dependencias externas, rediseño de identidad o cambios de plataforma. No se crean modelos, migraciones ni el documento de datos definitivo mientras este diseño no esté aprobado.

## Decisions

### 1. Una frontera funcional para clientes y vehículos

Crear `backend/src/customer_registry/` como módulo de personas y vehículos, con `apps.py`, `models.py`, `migrations/`, `domain/`, `application/` y `api/`. Estas rutas son propuestas nuevas; `backend/src/identity/`, `backend/src/config/` y `backend/src/shared/` ya existen. Solo se crearán archivos con responsabilidades concretas:

- `domain/validation.py` y `domain/errors.py`: normalización y validaciones independientes de Django, DRF y HTTP.
- `application/customers.py`, `vehicles.py`, `brands.py`: casos de uso y transacciones; `queries.py`: lecturas paginadas y proyecciones.
- `api/serializers.py`, `views.py` y `urls.py`: traducción HTTP y contrato; no decidir reglas de propiedad ni permisos.
- `models.py`: adaptación persistente siguiendo la estructura real de identidad, sin repositorios abstractos ni capas vacías.

`config/api/urls.py` compondrá las rutas; `config/settings/base.py` registrará la aplicación. El módulo consumirá los servicios públicos de autorización y auditoría de identidad. No modificará directamente sus modelos ni asignaciones. Futuras ventas o taller deberán usar consultas/casos de uso públicos del registro, no mutar sus filas.

Marca de vehículo pertenece a esta capacidad porque habilita su registro inmediato. No se crea un módulo genérico de catálogos ni se confunde con marca de producto. Separar clientes y vehículos en aplicaciones distintas añadiría coordinación a una operación que hoy debe ser local y atómica. Mantenerlos en `identity` mezclaría clientes con usuarios autenticados.

### 2. Diseño de persistencia afectado, aprobado

El modelo conceptual no se convierte automáticamente en tablas. Se proponen cuatro registros persistentes porque son necesarios para los escenarios aprobados:

| Registro propuesto | Datos y relaciones | Restricciones |
|---|---|---|
| `Customer` | Identificador estable; `person_type` NATURAL/JURIDICA; `name` para nombre o razón social; `identification_type` CI/RUC; `identification`; `phone`; `email` y `address` opcionales; `is_active`; `version`; fechas de creación y modificación. | Identificación única por tipo y número normalizado, también inactiva; nombre, identificación y teléfono no vacíos; tipo permitido y longitud CI 10/RUC 13. |
| `VehicleBrand` | Identificador estable, `name`, `is_active`, `version`, fechas. | Nombre no vacío. No se introduce unicidad de marcas ni fusión automática que las specs no hayan exigido. |
| `Vehicle` | Identificador estable; `plate`; `brand` protegido; `model`; `color`, `year`, `vin` opcionales; estado, versión y fechas. | Placa normalizada única; VIN informado normalizado único, también inactivos. Modelo y placa no vacíos. |
| `OwnershipPeriod` | Vehículo, cliente propietario, `started_at`, `ended_at` nullable. | Referencias protegidas; como máximo un período abierto por vehículo; fin mayor o igual al inicio. Creación y servicios garantizan al menos un período y continuidad. |

Usar claves numéricas autogeneradas como los contratos actuales. Relaciones de negocio con `PROTECT`; no ofrecer `DELETE`, edición administrativa genérica ni cascadas destructivas. El propietario actual se obtiene del único período abierto, sin duplicar una columna mutable `owner_id` en vehículo. La API sí expondrá `owner_id` como proyección y como entrada del alta/transferencia.

Los identificadores se almacenan como texto para conservar ceros. Aplicar unicidad en PostgreSQL, no solo una consulta previa; usar restricciones únicas sobre las expresiones normalizadas acordadas y una restricción parcial de período abierto. VIN vacío se representa como `NULL`, para permitir múltiples ausencias. Email, dirección y color ausentes se almacenan como cadena vacía; año ausente como `NULL`. La API acepta omisión y vacío en textos opcionales; PATCH distingue omitir de borrar un valor.

Los límites de transporte serán explícitos y compartidos por formulario y OpenAPI: nombre/razón social y modelo hasta 255 caracteres, teléfono hasta 64, email hasta 254, dirección hasta 1024, color hasta 100, placa y VIN hasta 64 y nombre de marca hasta 255. Año es un entero opcional; no inferir ni validar la antigüedad del vehículo contra el año actual. Estos límites evitan entradas ilimitadas y no introducen requisitos tributarios. La identificación mantiene exclusivamente sus longitudes aprobadas, sin dígito verificador ni restricción numérica adicional.

No hay entidad fiscal en estas filas: las fichas son compartidas. La referencia del propietario histórico de futuros mantenimientos deberá conservarla esa capacidad al implementarse; este cambio no crea tablas vacías de ventas o taller.

**Documento de datos:** tras aprobar y registrar este diseño, su sección de persistencia servirá para crear `docs/arquitectura/modelo-datos.md`, limitado a esta capacidad y las referencias reales a identidad. Se preserva la prohibición de crearlo antes de la aprobación de propuesta, specs y diseño establecida en `AGENTS.md`. En esta entrega el diseño de datos está contenido aquí para revisión, sin modificar el modelo conceptual aprobado.

### 3. Normalización y búsqueda sin inventar identidades

Normalizar identificación quitando espacios exteriores; conservar tipo, contenido y ceros. Para placa y VIN, quitar espacios exteriores y convertir letras a mayúsculas. No retirar guiones ni espacios internos, ni equiparar automáticamente formatos distintos: las specs solo exigen equivalencia por espacios exteriores y capitalización. Las mismas funciones y casos de ejemplo guiarán frontend, servidor y restricciones persistentes.

Email vacío es válido; informado usa validación de formato de email. Teléfono es texto obligatorio sin imponer prefijo nacional ni longitud telefónica de negocio. `person_type` distingue natural/jurídica y cambia la etiqueta a nombre o razón social; no se introduce una matriz nueva entre persona y documento. Año y VIN siguen siendo opcionales, sin validación externa ni regla VIN de 17 caracteres no aprobada.

Las búsquedas de clientes combinan OR entre nombre, identificación y teléfono, y AND con estado. Vehículos combinan placa/VIN/cliente y estado. Comparación textual sin distinguir mayúsculas para nombres y búsquedas, sin motor difuso ni eliminación de acentos no especificada. Advertencias por nombre completo normalizado o teléfono coincidente se consultan antes de guardar; no se convierten en restricciones únicas. Guardar una identidad diferente puede continuar tras revisar la advertencia. El conflicto duro se vuelve a comprobar al escribir.

Listados: `search`, `is_active`, `page`, `page_size`, orden permitido y desempate por identificador; páginas de 20 y máximo 100, siguiendo identidad. Al omitir estado se consultan ambos estados; los selectores de nuevas asociaciones solicitan activos. Propiedad actual desde cliente usa el período abierto e incluye vehículos inactivos con su estado; períodos anteriores se consultan desde vehículo.

Crear índices derivados de restricciones únicas y de relaciones; período abierto por cliente/vehículo y orden de listados. Medir búsquedas parciales con datos representativos antes de añadir trigramas u otra extensión. No añadir dependencias para optimizar una carga todavía desconocida.

### 4. Transacciones, bloqueos y edición concurrente

Cada mutación comprueba permisos también dentro del servicio, valida datos y ejecuta cambios y evento exitoso dentro de una única transacción. El fallo de auditoría revierte el negocio. Las violaciones de unicidad se traducen después del rollback según el nombre concreto de restricción; no convertir cualquier `IntegrityError` en duplicado.

Las operaciones que dependen de estado activo bloquean las referencias antes de validarlo. Orden común de bloqueos: clientes por identificador, marcas por identificador, vehículo y período vigente. Desactivar cliente o marca bloquea su propia fila. Crear vehículo bloquea cliente y marca antes del alta y período inicial. Editar datos de vehículo bloquea una nueva marca si cambia y luego vehículo; conservar una referencia ya inactiva no exige reemplazarla. Transferir bloquea clientes implicados y después vehículo/período. Ningún servicio adquiere después una fila de una categoría anterior.

La transferencia puede leer referencias antes de bloquear; tras adquirir los bloqueos verifica de nuevo versión y propietario. Si cambiaron, revierte con conflicto y exige recargar, en lugar de adquirir bloqueos fuera de orden. Esto coordina transferencia con desactivación de propietarios y evita asignar una referencia que quedó inactiva mientras se esperaba.

Cada ficha mutable devuelve `version`; edición y transiciones envían `expected_version`. Bajo bloqueo se compara y, si el cliente parte de una versión obsoleta, se devuelve `409 stale_record` sin sobrescribir cambios ajenos. Una mutación efectiva incrementa versión. Una repetición que ya expresa exactamente el estado actual devuelve ese estado sin incrementar versión ni auditar otro éxito; si hubo cambios intermedios distintos se exige recargar.

En transferencia, un único instante calculado después del bloqueo cierra el período anterior y abre el siguiente. Se comprueba que no preceda al inicio vigente; los períodos se interpretan como intervalos con fin exclusivo y se ordenan por inicio e identificador. Se conserva la posibilidad de períodos de duración cero para acciones inmediatamente consecutivas, sin solapamientos. La restricción de un período abierto refuerza el servicio; se comprueba que no se confirme un vehículo sin período inicial. No hay edición retroactiva ni eliminación de períodos.

No se introduce un almacén general de idempotencia. Altas duplicadas de cliente/vehículo se rechazan por identidad única y ofrecen recuperar la ficha; las mutaciones no se reintentan automáticamente. Repetir estados y propietario actuales no produce nuevos períodos ni eventos. Las marcas, sin identidad única aprobada, requieren prevención de doble envío y, ante pérdida de respuesta, consulta del catálogo antes de iniciar deliberadamente otra alta; no se promete idempotencia de creación no especificada.

### 5. Permisos y auditoría mediante interfaces existentes

Reutilizar `identity.application.authorization.require_permission` y `identity.api.permissions.HasBusinessPermission`, además del middleware de versión de sesión y bloqueo por contraseña temporal. `is_superuser` no sustituye permisos funcionales. No cambiar sesiones, CSRF, cookies ni mismo origen.

Extender el catálogo fijo de `identity/domain/authorization.py` con `marcas_vehiculo.ver` para los tres roles, `marcas_vehiculo.gestionar` para Administrador/Encargado y `marcas_vehiculo.desactivar` para Administrador. Estos códigos son nombres técnicos de concesiones aprobadas, no permisos editables. Sincronizar la matriz documental y sus pruebas. Clientes y vehículos reutilizan sus permisos existentes; activar y desactivar comparten el permiso de estado ya aprobado.

La infraestructura de auditoría ya admite `action`, `target_type`, `target_id` y metadatos. Consumir `record_audit_event` desde servicios; no escribir `AuditEvent.objects` desde el nuevo módulo. Usar acciones `registry.customer_created/updated/activated/deactivated`, equivalentes de vehículo/marca, y `registry.vehicle_owner_changed`. Objetivos: `customer`, `vehicle`, `vehicle_brand`. Los períodos históricos y estas referencias explican la transferencia sin copiar contactos.

Ampliar la lista permitida de metadatos de identidad únicamente con `previous_owner_id` y `new_owner_id`, restringidos a identificadores enteros en transferencias; conservar `changed_fields` sin valores personales. Es una extensión de su interfaz pública actual. No mover auditoría a `shared`, crear otro almacén ni reformar retrospectivamente los eventos de identidad.

Éxitos: dentro de la transacción. Validaciones y conflictos relevantes: evento FAILURE después del rollback. Denegación: un evento DENIED en la capa que la detecta, sin duplicarlo en la API y el servicio. En solicitudes directas al servicio se conserva el mismo control. No registrar cuerpos, términos de búsqueda, teléfonos, email ni dirección; sanitizar rutas de auditoría sin query string. Consultas GET ordinarias no generan eventos de negocio.

La consulta `/audit/` existente filtra ya por acción, objetivo y resultado y permite solo Administrador; reutilizarla, añadiendo etiquetas de presentación para los nuevos tipos. UTC en persistencia y `America/Guayaquil` al presentar. Si falla la auditoría de un rechazo, mantener el rechazo y registrar el fallo técnico correlacionado; nunca continuar con la mutación. Sin purgas: la política de retención pendiente no queda resuelta por este diseño.

### 6. Contratos HTTP y errores compatibles

Rutas nuevas bajo `/api/v1/`, conservando convenciones de barras finales e identificadores numéricos:

| Ruta | Operación y permiso |
|---|---|
| `customers/` | GET búsqueda (`clientes.ver`); POST alta (`clientes.gestionar`). |
| `customers/<id>/` | GET ficha; PATCH datos y versión, sin cambiar estado. |
| `customers/<id>/activate/`, `deactivate/` | POST con versión; `clientes.desactivar`. |
| `customers/<id>/vehicles/` | GET vehículos de propiedad actual, paginados; `vehiculos.ver` y consulta del cliente. |
| `customers/matches/` | POST de consulta sin mutación para advertencias por nombre/teléfono, con sesión, CSRF y `clientes.ver`; no registrar el cuerpo. |
| `vehicles/`, `vehicles/<id>/` | GET lista/ficha; POST alta y PATCH datos según `vehiculos.gestionar`; PATCH no admite propietario ni estado. |
| `vehicles/<id>/change-owner/` | POST `owner_id` y versión; `vehiculos.gestionar`. |
| `vehicles/<id>/ownership/` | GET períodos paginados; `vehiculos.ver`. |
| `vehicles/<id>/activate/`, `deactivate/` | POST de estado; `vehiculos.desactivar`. |
| `vehicle-brands/`, `vehicle-brands/<id>/` | GET consulta, POST alta y PATCH nombre, según permisos de marcas. |
| `vehicle-brands/<id>/activate/`, `deactivate/` | POST de estado; `marcas_vehiculo.desactivar`. |

Reservar la ruta `matches/` antes del detalle; no crear endpoints genéricos de modificación de roles ni DELETE de datos maestros. Los listados devuelven `count`, `page`, `page_size`, `total_pages`, `results`, como identidad. Las fichas exponen referencias mínimas y versión, no campos internos de autorización. Períodos se cargan separadamente para no descargar toda la historia con cada ficha.

Alta exitosa: 201; consultas, edición y acciones/no-op: 200; dato inválido: 400; permiso, CSRF o sesión rechazada: conservar la semántica 403 del stack de sesión existente, sin suponer que siempre será 401; inexistente: 404; duplicado o versión obsoleta: 409; método no soportado: 405. Verificar sesión ante error de acceso antes de redirigir, distinguiendo sesión anónima de una denegación con sesión vigente. No cambiar por este motivo los contratos de identidad.

`config/api/errors.py` actualmente pierde errores de serializers por campo y `ProblemError` del frontend solo conserva mensaje/código. Añadir extensiones opcionales `errors` (campo → lista de mensajes/códigos) y `conflict` (tipo e identificador de ficha existente, solo tras comprobar permiso de consulta), preservando `type`, `title`, `status`, `detail`, `code`, `request_id` y `application/problem+json`. No devolver valores personales en errores. Códigos mínimos: `validation_error`, `duplicate_identification`, `duplicate_plate`, `duplicate_vin`, `inactive_reference`, `stale_record`.

Extender `ProblemSerializer` y el cliente HTTP de forma compatible: los consumidores actuales podrán ignorar los nuevos campos. Los formularios nuevos mapearán errores a sus campos; no copiarán el patrón actual de `UserForm` que atribuye todo error remoto al identificador. OpenAPI documentará entradas, opcionales, versiones, permisos, paginación, errores y ejemplos sintéticos; no se publicará un segundo contrato manual divergente.

### 7. Composición frontend y sistema visual

Añadir capacidades propuestas `frontend/src/features/customers/`, `vehicles/`, `vehicle-brands/` con `api.ts`, `types.ts`, `hooks.ts` y formularios específicos. Páginas propuestas bajo `pages/customers/`, `pages/vehicles/`, `pages/vehicle-brands/`. `app/App.tsx` compondrá `/customers`, `/customers/:id`, `/vehicles`, `/vehicles/:id`, `/vehicle-brands`; `AuthenticatedShell.tsx` añadirá navegación filtrada por permisos de consulta.

Reutilizar `ApiClient`, TanStack Query, `SessionGuard`, `PermissionGuard` y las primitivas reales de `shared/ui`. Estado remoto en consultas; borradores en el formulario, sin almacenamiento persistente del navegador ni nuevo store. Filtros/página en la URL para recuperar contexto; datos personales sensibles no se copiarán a logs ni telemetría. Evitar reintentos automáticos de mutación.

Claves separadas por capacidad, filtros e identificador. Mutación de cliente invalida ficha/listas y proyecciones de propietario afectadas. Transferencia invalida vehículo/períodos y vehículos de ambos clientes. Cambio de marca invalida su lista y proyecciones de vehículos. Cerrar/inutilizar sesión elimina datos protegidos de caché; una denegación con sesión vigente no destruye un borrador recuperable innecesariamente.

Listas con `ElevatedDataList`, `ResponsiveDataView`, `Toolbar`, `Pagination` y estados existentes; fichas con `PageHeader` y `Surface`. Identidad/contacto, estado y acceso a vehículos son prioritarios en cliente. Placa, marca/modelo, propietario y estado lo son en vehículo. Sin saldos, trabajos, fotos ni indicadores simulados. No añadir distintivo fiscal que sugiera que una ficha pertenece solo a un RUC.

Crear/editar en `Drawer`; desactivar/reactivar y transferir mediante confirmación con objeto y consecuencia. Seleccionar propietario por consulta paginada de clientes activos. Marca faltante: permitir abrir creación a usuarios autorizados conservando en memoria el borrador del vehículo, regresar y seleccionar la nueva marca; evitar dos paneles con foco atrapado simultáneamente. Campos opcionales se etiquetan; nombre/razón social cambia según tipo de persona.

Consumir tokens y patrones de `DESIGN.md`: Nunito local, lienzo claro, violeta, sidebar de 80 px desde tableta, superficies ordinarias sin sombras generalizadas, formularios de una columna y drawer de referencia de 409 px cuando cabe. Las clases JSX existentes tienen algunas dimensiones iniciales sobreescritas por CSS; comprobar estilo computado, no copiar utilidades aisladas como autoridad visual. No modificar la dirección ni el archivo `DESIGN.md` ajeno en esta fase.

Teclado, retorno de foco, prevención de doble envío, aviso de cambios sin guardar y estados accesibles deben mantenerse en 360/768/1024/1440 px. Reutilizar controles de 44 px en contexto táctil y reducción de movimiento. No se requieren nuevas librerías ni activos externos.

### 8. Estrategia de pruebas y trazabilidad

Aplicar **TDD** durante implementación, sin crear pruebas de código en esta fase documental. Cada escenario de las tres specs deberá vincularse en una futura `docs/negocio/requisitos/cobertura-clientes-vehiculos.md` a pruebas reales y evidencia; no considerar un escenario cubierto solo porque exista un requisito parecido.

| Grupo | Evidencia prevista |
|---|---|
| Dominio | Normalización, ceros iniciales, longitud CI/RUC, campos obligatorios y opcionales, email informado, invariantes de período. |
| Aplicación y PostgreSQL | Unicidad incluidos inactivos, VIN NULL múltiple, transferencia completa, fallo de auditoría con rollback, no-op sin evento, versiones obsoletas y conservación de referencias. |
| Concurrencia | Dos altas/ediciones sobre misma identidad, transferencias simultáneas, transferencia contra desactivación de propietario y alta contra desactivación de marca, usando conexiones independientes y coordinación explícita. |
| API y permisos | Cada acción en los tres roles y combinaciones; anónimo, usuario inactivo, contraseña temporal, sesión invalidada, CSRF, no DELETE ni PATCH de estado/propietario, filtros/paginación, errores y OpenAPI. |
| Frontend | Errores por campo, opcionales, advertencias, búsqueda y retorno, permisos, caché tras transferencia, borrador al crear marca, foco y estados de carga/vacío/error. |
| E2E | Ciclo de cliente sin email/dirección; vehículo sin color/año/VIN; marcas con cada rol; transferencia entre fichas; duplicado inactivo; denegación directa; sesión invalidada; flujos táctiles y teclado. |
| Visual y regresiones | Capturas con datos sintéticos y axe en los cuatro anchos, textos largos y errores. Preservar flujos de identidad y auditoría, sin interpretar capturas como aceptación humana. |

Rutas nuevas de pruebas: `backend/tests/customer_registry/`, pruebas junto a los componentes frontend y `frontend/e2e/customers-vehicles.spec.ts`. Reutilizar la configuración E2E aislada existente; no apuntar pruebas a datos personales operativos.

Finalización posterior: `make check`, `make test`, `make audit`, `make compose-check`, `cd frontend && npm run test:e2e`, `cd backend && uv run python manage.py spectacular --validate`, validación OpenSpec estricta y revisión de trazabilidad. Ejecutar comandos enfocados mientras se aplica cada parte; conservar umbrales de cobertura del README. Migraciones comprobadas desde cero y contra base que ya contiene identidad. Estos comandos son un plan de verificación, no resultados de este diseño.

### 9. Documentación y evaluación de ADR

Sincronizar DP-008 revisada con reglas RN-CLI, RF-CLI, roles/permisos de marcas, CU-004/005/006, UI-020…025/033, matriz de trazabilidad y glosarios. Actualizar arquitectura con la frontera efectiva y README con operación comprobada durante apply. No modificar specs históricas de identidad para aparentar cobertura de clientes; sus contratos reutilizados se conservan.

ADR-0001 ya establece módulos con servicios públicos; ADR-0002 fija dependencias reproducibles y ADR-0003 sesiones/mismo origen. Este diseño no añade contenedores ni plataforma; no requiere nuevo C4 ni ADR. La extensión acotada del servicio actual de auditoría evita una extracción transversal. Si la inspección posterior al cierre obliga a extraer auditoría o sustituir autenticación, deberá revisarse el diseño y evaluar un ADR antes de implementar.

## Risks / Trade-offs

- [Dependencias todavía activas] → No iniciar apply hasta verificar su cierre; comparar nuevamente el código integrado con este diseño.
- [Propietario derivado añade una relación a consultas] → Lecturas con joins/prefetch y restricción parcial; evitar dos fuentes mutables del propietario.
- [Ausencia total de período no es impedida solo por unicidad] → Alta atómica y todos los cambios por servicios; ninguna interfaz de edición genérica de períodos.
- [Bloqueos múltiples y referencias leídas antes del bloqueo] → Orden global, revalidación de versión y rechazo de conflictos; pruebas reales de concurrencia.
- [Normalización demasiado agresiva] → Solo transformaciones aprobadas; no convertir guiones, caracteres internos ni documentos tributarios por heurística.
- [Auditoría conserva metadatos insuficientes o excesivos] → IDs de propietarios validados y nombres de campos; no copiar contactos ni solicitudes.
- [Errores uniformes rompen identidad] → Extensiones opcionales y regresión de errores y clientes existentes.
- [Respuesta perdida de un alta de marca] → Sin reintento automático; consultar catálogo antes de otra creación. No prometer deduplicación no aprobada.
- [Búsquedas parciales crecen] → Paginación y medición; optimización posterior justificada sin cambiar resultados observables.

## Migration Plan

1. Antes de apply, verificar cierre/archivo de ambas dependencias, aprobación de diseño/tareas y presencia de artefactos aprobados en `master`. No hacer ese cierre dentro de este cambio por inferencia.
2. Crear el documento de datos a partir del diseño aprobado y revisar el estado de la base objetivo sin exponer datos personales. Respaldar antes de migrar según procedimiento vigente.
3. Añadir una migración inicial del módulo para los cuatro registros y restricciones; no cambiar `AUTH_USER_MODEL`, tablas económicas ni datos históricos. No cargar marcas arbitrarias ni importar Flutter.
4. Ensayar migración en PostgreSQL vacío y sobre una copia desechable de la base de identidad; verificar constraints, ausencia de cambios inesperados y preservación de usuarios/auditoría. Cualquier dato previo imprevisto bloquea la migración hasta un plan de conservación.
5. Desplegar backend y migraciones, validar sesiones, permisos de marcas, API y auditoría; después frontend. El contrato extendido de errores debe seguir siendo consumible por el frontend anterior.
6. Ejecutar verificaciones funcionales, concurrentes, visuales y documentales. Habilitar el flujo solo con evidencia y aprobaciones aplicables.

Rollback: antes de uso operativo se puede volver al código anterior conservando las nuevas tablas sin uso; no revertir destructivamente migraciones después de registrar datos. Tras uso operativo preferir corrección hacia adelante. Una restauración exige respaldo probado y autorización correspondiente, no eliminación automática de fichas.

## Open Questions

No quedan preguntas de negocio bloqueantes para revisar este diseño. La retención de auditoría y el cierre real de dependencias siguen pendientes en sus flujos, sin resolverlos silenciosamente. Validaciones fiscales de una futura facturación quedan fuera del alcance.

El usuario aprobó este diseño y su sección de datos al solicitar el commit y la continuación a tasks. La creación del documento de datos se mantiene en el plan de trabajo aprobado; las tasks se entregarán para revisión y no autorizan implícitamente implementación.

## Fuentes consultadas

- `AGENTS.md`, `openspec/config.yaml`, decisiones confirmadas completas y modelo/diagrama de dominio consultados durante este cambio; DP-008 revisada por instrucción del usuario.
- Propuesta y las tres specs aprobadas de este cambio; spec principal `modelo-dominio-taller`.
- Producto, reglas RN-CLI/RN-SEG/RN-FIS, roles, RF-CLI/RF-AUD, RNF, CU/UI y matriz de trazabilidad revisados en las fases previas; glosarios del negocio y técnico.
- Arquitectura inicial, C4 y ADR-0001/0002/0003; artefactos de identidad y sistema visual, `DESIGN.md` y registro visual.
- Código actual: `backend/src/identity/models.py`, `domain/authorization.py`, `application/authorization.py`, `application/users.py`, `application/audit.py`, `api/permissions.py`, `api/request_context.py`, `api/audit.py`, `backend/src/config/api/errors.py` y `urls.py`.
- Frontend actual: `shared/api/client.ts`, `features/users/api.ts`, `hooks.ts`, `UserForm.tsx`, `shared/ui/Drawer.tsx`, `app/App.tsx`, `app/AuthenticatedShell.tsx`; inventario de primitivas, páginas y capacidades.
- `Makefile` y `README.md` para comandos, entorno y cobertura. No se consultó el sistema Flutter ni se asumió como arquitectura objetivo.
