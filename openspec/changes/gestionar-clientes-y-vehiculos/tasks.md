## 1. Aprobación, dependencias y preparación documental

**Estado:** tareas aprobadas por el usuario mediante `/opsx:apply` y confirmación posterior para registrarlas en `master`. La implementación sigue condicionada al cierre verificado de las dos dependencias de 1.2. El usuario aprobó el diseño al solicitar su commit y continuación; su contenido está en `master` y `develop`. Las comprobaciones documentales 1.1 y 1.2 están realizadas; la implementación continúa desde 1.3.

**Fuentes:** propuesta, tres specs (22 requisitos y 69 escenarios), diseño aprobado, DP-008 revisada, modelo/diagrama de dominio, configuración OpenSpec, ADR-0001/0002/0003 y documentos de producto/requisitos consultados durante el cambio. Las rutas nuevas citadas abajo son las propuestas por el diseño; las rutas de identidad, configuración, UI y comandos oficiales fueron inspeccionadas en el repositorio.

- [x] 1.1 Antes de cualquier implementación, comprobar aprobación explícita de estas tareas y presencia de propuesta, specs, diseño y tareas aprobados en `master`. Registrar rama, commits y estado del árbol, preservando cambios ajenos; no crear commits, ramas ni merges adicionales sin autorización.
**Evidencia 1.1 (2026-09-12):** rama `develop`, commit `8d98e62`; tareas aprobadas registradas en `master` mediante `78ba5bf`. `git diff master develop -- openspec/changes/gestionar-clientes-y-vehiculos` no presenta diferencias. Se conserva la modificación ajena de `DESIGN.md`.

- [x] 1.2 Verificar que `gestion-usuarios-autenticacion-roles` y `establecer-sistema-visual-frontend` estén verificados, integrados y cerrados/archivados mediante sus respectivos flujos, incluida aceptación visual explícita. Si falta alguno, detener apply sin marcar la condición cumplida; no ejecutar su cierre como parte implícita de estas tareas.
- [ ] 1.3 Reinspeccionar las interfaces de identidad, auditoría, errores, cliente HTTP y primitivas visuales después del cierre; comparar con `design.md` y registrar cualquier divergencia que requiera revisar el diseño antes de código.
- [ ] 1.4 Crear `docs/arquitectura/modelo-datos.md` y su referencia terminológica a partir del diseño aprobado: Customer, VehicleBrand, Vehicle, OwnershipPeriod, restricciones, versiones, nulos, índices, relaciones protegidas y migración. No añadir tablas económicas ni alterar el modelo conceptual para ajustarlo a persistencia.
- [ ] 1.5 Crear `docs/negocio/requisitos/cobertura-clientes-vehiculos.md` y su referencia terminológica, inventariando individualmente los 69 escenarios por título y capacidad; distinguir cobertura pendiente de evidencia ejecutada y asociar cada escenario con el grupo vertical correspondiente.

**Cierre 1.2:** identidad y sistema visual integrados en `master` (`617ec59`), verificados y archivados por OpenSpec en `archive/2026-09-13-*` (fecha UTC de la CLI). Identidad 55/55 y sistema visual 60/60; aceptación visual explícita del usuario y 26 E2E aprobados.

**Evidencia de salida:** estado Git, referencias aprobadas presentes en `master`, registros de cierre de dependencias, inventario de diferencias y revisión de los dos documentos. La creación de tareas por la CLI no satisface este grupo.

## 2. Base compartida mínima para el registro

**Depende de:** grupo 1. **Trazabilidad:** diseño §1, §5–6; permisos, errores y auditoría de las tres specs.

Cada tarea de comportamiento de los grupos 2–9 seguirá **TDD**: ejecutar primero una prueba que falle por la razón esperada, implementar lo mínimo, refactorizar en verde y conservar evidencia. Los comandos indicados son comprobaciones futuras, no resultados ya obtenidos.

- [ ] 2.1 Crear pruebas de frontera en `backend/tests/customer_registry/` y la estructura mínima de `backend/src/customer_registry/`, registrándola en `config/settings/base.py`. No crear capas vacías ni permitir mutaciones directas de persistencia de identidad desde el nuevo módulo.
- [ ] 2.2 Probar y extender `backend/src/identity/domain/authorization.py` con los tres permisos fijos de marcas definidos en el diseño; comprobar concesiones para cada rol, combinaciones, denegación por defecto y ausencia de privilegios por `is_superuser`. Sincronizar `docs/negocio/requisitos/actores-y-roles.md` y sus pruebas de correspondencia.
- [ ] 2.3 Probar y extender `backend/src/config/api/errors.py` con `errors` y `conflict` opcionales, sanitizados y descritos en `ProblemSerializer`; preservar consumidores actuales, tipo de contenido y correlación. Probar que conflictos solo revelan identificadores consultables y que un fallo interno no se transforma arbitrariamente en duplicado.
- [ ] 2.4 Probar y extender `frontend/src/shared/api/client.ts` para conservar errores por campo y referencia de conflicto sin perder mensaje, estado, código ni request ID. Mantener sesiones/CSRF y los contratos de usuarios existentes.
- [ ] 2.5 Probar y ampliar `identity/application/audit.py` para admitir únicamente IDs enteros de propietario anterior/nuevo en transferencias; conservar la lista permitida y sanitización. Probar exclusión de contactos, cuerpos y query strings; no generalizar auditoría ni introducir otro almacén.

**Evidencia de salida:** `cd backend && uv run pytest tests/identity tests/customer_registry` y `cd frontend && npm test -- src/shared/api/client.test.ts`, con resultados RED/GREEN relevantes y regresiones de identidad. No añadir dependencias ni modificar lockfiles sin uso necesario aprobado.

## 3. Registrar, buscar y editar clientes de extremo a extremo

**Depende de:** grupo 2. **Trazabilidad:** spec `gestion-de-clientes`, registro mínimo, identificación, unicidad, consulta, edición, permisos, errores y experiencia.

- [ ] 3.1 Probar normalización y datos mínimos en `customer_registry/domain/validation.py`: nombre o razón social, tipo/identificación y teléfono obligatorios; CI 10/RUC 13, ceros iniciales, email/dirección opcionales y email informado válido. No introducir dígito verificador, obligatoriedad numérica ni matriz fiscal por tipo de persona.
- [ ] 3.2 Probar e incorporar Customer en `customer_registry/models.py` y generar su migración: unicidad por tipo/número normalizado también inactivo, datos no vacíos, tipo/longitud, versión y fechas. Probar restricciones en PostgreSQL y ausencia de identidad duplicada por RUC comercial/artesanal.
- [ ] 3.3 Implementar con pruebas servicios de alta/edición y consultas en `application/customers.py` y `queries.py`: permisos dentro del servicio, auditoría atómica, PATCH parcial, versión obsoleta, búsqueda OR por nombre/identificación/teléfono, filtros AND, paginación y orden estable. Cubrir dos creaciones/ediciones concurrentes de la misma identidad y rollback ante fallo de auditoría.
- [ ] 3.4 Probar e implementar `customers/`, detalle y `customers/matches/` en `api/serializers.py`, `views.py`, `urls.py` y composición de `config/api/urls.py`; documentar OpenAPI. Las coincidencias de nombre/teléfono advierten sin bloquear identidades distintas; rechazar duplicados reales y conservar permisos, sesión y CSRF en llamadas directas.
- [ ] 3.5 Crear con pruebas `frontend/src/features/customers/{api,types,hooks}.ts` y formulario: errores asociados, opcionales, advertencias revisables, versión, valores conservados y prevención de doble envío. Usar componentes existentes; sin store nuevo ni persistir borradores en almacenamiento del navegador.
- [ ] 3.6 Crear lista/ficha y edición en `frontend/src/pages/customers/`; conectar `/customers` y `/customers/:id` en `app/App.tsx` y navegación en `AuthenticatedShell.tsx`. Probar filtros/página en URL, carga/vacío/error, acceso por los tres roles y regreso al contexto. La sección de vehículos se conectará en el grupo 5, sin datos ficticios.
- [ ] 3.7 Añadir el primer recorrido a `frontend/e2e/customers-vehicles.spec.ts`: registrar persona natural y jurídica sin email/dirección, localizar por los tres campos, corregir teléfono, rechazar identificación duplicada y revisar una coincidencia no bloqueante. Actualizar cobertura con los escenarios realmente ejecutados.

**Evidencia de salida:** pruebas enfocadas `cd backend && uv run pytest tests/customer_registry -k customer`, `cd frontend && npm test -- src/features/customers src/pages/customers` y `cd frontend && npm run test:e2e -- customers-vehicles.spec.ts`; validación del esquema mediante `cd backend && uv run python manage.py spectacular --validate`.

## 4. Administrar marcas de vehículo de extremo a extremo

**Depende de:** grupo 2; ejecutar después del grupo 3 para reutilizar los contratos comprobados. **Trazabilidad:** cinco requisitos de `catalogo-de-marcas-de-vehiculo` y DP-008 Marcas.

- [ ] 4.1 Probar e incorporar VehicleBrand y su migración, con nombre no vacío, estado, versión y fechas. No imponer unicidad o fusión de marcas que no fue aprobada; actualizar el documento de datos con la migración real.
- [ ] 4.2 Probar e implementar `application/brands.py` y consultas: alta/edición para Administrador/Encargado, consulta para los tres, estado solo Administrador; bloqueos, versiones, no-op de estado y auditoría atómica. Cubrir denegaciones por servicio y ausencia de efectos parciales.
- [ ] 4.3 Probar e implementar API de lista/detalle/alta/edición/activar/desactivar y OpenAPI bajo `vehicle-brands/`; rechazar PATCH de estado y DELETE, validar nombre y versión y preservar errores uniformes.
- [ ] 4.4 Crear con pruebas `frontend/src/features/vehicle-brands/` y `pages/vehicle-brands/`, ruta y navegación: lista, formulario contextual y confirmaciones de estado; acciones por permiso, teclado, carga/vacío/error y doble envío. Ante respuesta perdida de alta, consultar catálogo antes de iniciar otra; sin reintento automático.
- [ ] 4.5 Ampliar E2E para consulta por los tres roles, creación/edición por Encargado, denegación directa de escritura por Vendedor y de baja por Encargado, y desactivación/reactivación por Administrador. Registrar cobertura real.

**Evidencia de salida:** `cd backend && uv run pytest tests/customer_registry -k brand`, `cd frontend && npm test -- src/features/vehicle-brands src/pages/vehicle-brands`, E2E del archivo común y esquema OpenAPI válido.

## 5. Registrar y consultar vehículos con su propietario

**Depende de:** grupos 3 y 4. **Trazabilidad:** registro mínimo, normalización/unicidad, consulta, permisos, auditoría y experiencia de `gestion-de-vehiculos-y-propiedad`; vehículos desde cliente.

- [ ] 5.1 Probar e incorporar Vehicle y OwnershipPeriod y su migración: placa única, VIN informado único normalizados incluso inactivos, VIN NULL múltiple, relaciones protegidas, un período abierto como máximo y fin no anterior al inicio. Color, año y VIN opcionales; propietario derivado del período abierto, sin copia mutable redundante.
- [ ] 5.2 Probar e implementar alta y edición en `application/vehicles.py`: bloquear cliente/marca antes de validar actividad y crear vehículo/período inicial/evento juntos; revalidar versión al editar. Permitir correcciones que conserven una marca ya inactiva; impedir nueva selección de referencia inactiva. Probar rollback de alta sin período o auditoría.
- [ ] 5.3 Probar e implementar consultas y API de `vehicles/`, detalle y `customers/<id>/vehicles/`: búsqueda parcial por placa/VIN/cliente, estado, paginación, propietario actual y navegación entre fichas. Probar unicidad concurrente, permisos directos, no DELETE y rechazo de PATCH de propietario/estado; actualizar OpenAPI.
- [ ] 5.4 Crear con pruebas `frontend/src/features/vehicles/` y `pages/vehicles/`, rutas y navegación: lista/ficha/formulario, validación de mínimos, selectores paginados de cliente/marca activos, color/año/VIN opcionales y errores por campo. No ocultar datos consultables al Vendedor ni ofrecerle edición.
- [ ] 5.5 Conectar los vehículos actuales en la ficha de cliente, estados y accesos bidireccionales; probar cliente sin vehículos y exclusión de propiedad anterior. Implementar creación de marca faltante conservando el borrador del vehículo y retornando al selector, sin dos paneles con foco atrapado.
- [ ] 5.6 Ampliar E2E: alta sin color/año/VIN, consulta desde cliente y vehículo, rechazo sin placa, duplicados normalizados, selección inactiva rechazada y alta de marca durante el formulario. Actualizar cobertura y documento de datos.

**Evidencia de salida:** `cd backend && uv run pytest tests/customer_registry -k 'vehicle or ownership'`, `cd frontend && npm test -- src/features/vehicles src/pages/vehicles src/pages/customers`, E2E común y esquema OpenAPI válido. Restricciones comprobadas en PostgreSQL, no SQLite.

## 6. Cambiar propietario conservando los períodos

**Depende de:** grupo 5. **Trazabilidad:** cambio de propietario y auditoría de vehículos; consulta actual desde cliente; DM-003 V1.

- [ ] 6.1 Probar e implementar transferencia en `application/vehicles.py`: clientes bloqueados en orden estable antes de vehículo/período, relectura de propietario/versión, nuevo cliente activo, cierre y apertura con un instante coherente y auditoría conjunta. Mantener exactamente un período vigente y no ofrecer edición retroactiva.
- [ ] 6.2 Probar conflictos concurrentes de transferencias, cambio contra desactivación de propietario y fallo al guardar nuevo período/evento usando conexiones independientes y sincronización explícita; verificar rollback íntegro, ausencia de solapamientos y de adquisición de bloqueos fuera de orden.
- [ ] 6.3 Probar reintento al propietario actual sin nuevo período/evento y versión obsoleta con recarga; exponer `change-owner/` y `ownership/` paginado y su contrato OpenAPI. Cubrir Administrador/Encargado permitidos y Vendedor denegado.
- [ ] 6.4 Crear con pruebas confirmación de transferencia y consulta de períodos en la ficha de vehículo; invalidar consultas de vehículo/períodos y vehículos de ambos clientes, conservando contexto. Mostrar conflicto recuperable sin sobrescribir la ficha ni perder el borrador.
- [ ] 6.5 Ampliar E2E con transferencia A→B, desaparición de propiedad actual de A, aparición en B, período anterior consultable y repetición sin historia duplicada; revisar datos del propietario desde vehículo. Registrar evidencia de concurrencia backend por separado del recorrido E2E.

**Evidencia de salida:** `cd backend && uv run pytest tests/customer_registry -k 'transfer or concurrent'`, pruebas frontend de vehículo/cliente y E2E común; consultas de integridad confirman un único período abierto y cambios atómicos.

## 7. Desactivar y reactivar clientes y vehículos

**Depende de:** grupos 5 y 6. **Trazabilidad:** ciclos activos de clientes/vehículos, duplicados inactivos y preservación de referencias.

- [ ] 7.1 Probar e implementar acciones de estado de clientes en `application/customers.py` y su API: solo Administrador, confirmación explícita, versión y no-op; conservación de vehículos/relaciones, sin cascada ni selección futura como propietario mientras esté inactivo.
- [ ] 7.2 Probar e implementar acciones de estado de vehículos en servicio/API: conservar propietario/períodos, impedir eliminación, reactivar la misma ficha sin reactivar cliente o marca. Rechazar duplicados de placa/VIN que pertenecen a fichas inactivas.
- [ ] 7.3 Completar pruebas de desactivación de marca contra alta/cambio de marca del vehículo, y corrección de otros datos conservando marca inactiva; comprobar el orden de bloqueos aprobado y que el estado de vehículos no cambie en cascada.
- [ ] 7.4 Conectar con pruebas confirmaciones de estado en páginas de clientes/vehículos, botones solo para Administrador, estado textual y filtros de activos/inactivos; conservar contexto e invalidar consultas afectadas. Mantener ficha consultable y mensajes de conflicto por versión.
- [ ] 7.5 Ampliar E2E con baja/reactivación de cliente y vehículo, consultas de fichas inactivas, intento de duplicarlas y permisos negativos directos de Vendedor/Encargado. Actualizar cobertura del ciclo completo.

**Evidencia de salida:** `cd backend && uv run pytest tests/customer_registry -k 'active or inactive or state'`, pruebas de páginas clientes/vehículos, E2E común y OpenAPI de acciones validado. Rechazos sin efectos y reactivación sin duplicación de identidad.

## 8. Auditoría consultable, sesión y experiencia adaptable completas

**Depende de:** grupos 3–7. No aplaza la auditoría de las mutaciones: cada grupo anterior ya debe guardarla atómicamente.

- [ ] 8.1 Probar consulta de eventos del registro mediante `identity/api/audit.py` y completar etiquetas en `frontend/src/pages/audit/`/`features/audit/`: filtros por actor, acción, objetivo, resultado y fechas, consulta solo Administrador, metadatos mínimos de transferencia y `America/Guayaquil`. Mantener eventos existentes y rechazar mutación de auditoría.
- [ ] 8.2 Completar matriz de permisos y seguridad para cada acción de las tres capacidades: tres roles, combinaciones, anónimo, cuenta inactiva, contraseña temporal, sesión invalidada y CSRF; probar denegación tanto API como servicio y un único evento de rechazo por intento relevante.
- [ ] 8.3 Probar limpieza de caché protegida al cerrar/invalidar sesión, actualización de propietario tras editar cliente y actualización de marcas en vehículos; distinguir denegación con sesión vigente de sesión expirada y preservar borradores recuperables.
- [ ] 8.4 Ampliar `frontend/e2e/responsive.spec.ts` y evidencia visual para clientes, marcas, vehículos y transferencia a 360/768/1024/1440 px: teclado, foco/retorno, controles táctiles, reducción de movimiento, textos largos, carga/vacío/error y ausencia de desbordamiento de página. Usar `shared/ui` y tokens vigentes, sin otro sistema visual.
- [ ] 8.5 Ejecutar axe y revisar capturas comparativas de las nuevas superficies con el sistema aprobado; corregir regresiones y presentar la evidencia de adaptaciones. Conservar capturas y trazas generadas fuera del repositorio. No equiparar las pruebas técnicas a aceptación visual del usuario.

**Evidencia de salida:** `cd backend && uv run pytest tests/identity tests/customer_registry`, `cd frontend && npm test`, `cd frontend && npm run test:e2e`; resultados de seguridad, revisión visual y accesibilidad identificados por superficie. Sin errores serios/críticos de axe ni regresiones de identidad.

## 9. Migración, documentación, verificación y preparación de cierre

**Depende de:** todos los grupos anteriores. No ejecutar despliegue productivo o recuperación destructiva por haber completado una casilla.

- [ ] 9.1 Ensayar el conjunto de migraciones en PostgreSQL limpio y en una base desechable ya inicializada con identidad; comprobar conservación de usuarios/eventos y restricciones nuevas. Documentar respaldo, despliegue backend→frontend y recuperación hacia adelante en `docs/arquitectura/modelo-datos.md` y documentación operativa, sin revertir destructivamente datos de negocio. Detenerse si aparecen datos previos no previstos.
- [ ] 9.2 Sincronizar `docs/negocio/producto/reglas-negocio.md`, `docs/negocio/requisitos/requisitos-funcionales.md`, `actores-y-roles.md`, `casos-de-uso.md`, `interfaz-y-navegacion.md` y `matriz-trazabilidad.md` con DP-008 revisada, permisos de marcas y alcance entregado; revisar `alcance-v1.md`, glosarios y referencias terminológicas. No introducir facturación ni historia compleja.
- [ ] 9.3 Actualizar `docs/tecnico/arquitectura-inicial.md` y `README.md` con frontera, contratos y operación realmente comprobados. Revisar coherencia con ADR-0001/0002/0003; crear ADR solo si aparece una decisión duradera nueva aprobada. No cambiar C4 de contenedores si no cambió la arquitectura desplegable.
- [ ] 9.4 Completar `cobertura-clientes-vehiculos.md` con los 69 escenarios, pruebas exactas backend/frontend/E2E y resultados recientes; explicar escenarios cuya comprobación requiere concurrencia o revisión manual. Comprobar que ningún requisito quede sin cobertura y que los contratos OpenAPI reflejen opcionales, errores, versiones y permisos.
- [ ] 9.5 Ejecutar `make check`, `make test`, `make audit`, `make compose-check`, `cd frontend && npm run test:e2e`, `cd backend && uv run python manage.py spectacular --validate`, `openspec validate --all --strict` y `git diff --check`; corregir fallos del alcance sin bajar umbrales. Registrar comandos, resultados y bloqueos reales.
- [ ] 9.6 Revisar migraciones, dependencias/lockfiles, privacidad y ausencia de archivos generados/secretos; confirmar que solo se implementaron specs aprobadas. Preparar la verificación OpenSpec con evidencia, sin declarar completado el cambio solo por tener todas las tareas descritas.
- [ ] 9.7 Tras verificación y autorización de integración, comprobar aplicación integrada en `master` y preparar archivo/sincronización de specs principales mediante el flujo correspondiente. No archivar desde `develop`, antes de integrar o antes de verificar; no confundir aprobación de estas tareas con autorización de commit/merge/despliegue posterior.

**Evidencia de salida:** comandos oficiales satisfactorios, contrato validado, migraciones ensayadas, cobertura sin escenarios críticos huérfanos y documentación coherente. Las aprobaciones humanas y operaciones Git se registran por separado de resultados técnicos. Ninguna tarea está marcada como realizada en esta entrega.
