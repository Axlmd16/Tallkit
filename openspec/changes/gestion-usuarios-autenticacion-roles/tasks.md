## 1. Preflight de datos y frontera de identidad

- [ ] 1.1 Inspeccionar la base PostgreSQL objetivo para determinar si existen migraciones `auth`, usuarios o datos que deban conservarse; registrar la evidencia y detener cualquier recreación o traslado hasta obtener autorización explícita si la base no es descartable. Verificar: consulta de `django_migrations` y conteo de usuarios ejecutada mediante `uv run python manage.py shell` o el contenedor configurado.
- [ ] 1.2 Crear la estructura mínima de `backend/src/identity/`, registrarla en `INSTALLED_APPS` y configurar `AUTH_USER_MODEL` sin añadir dependencias ni capas vacías. Verificar: `cd backend && uv run python manage.py check`.
- [ ] 1.3 Aplicar **TDD** para `identity.User` y `UserRole`: escribir pruebas que fallen por ausencia del usuario personalizado, cambio obligatorio, versión de autorización, roles cerrados y unicidad de asignación; implementar lo mínimo y refactorizar en verde. Verificar: `cd backend && uv run pytest tests/identity/test_models.py` y evidencia RED/GREEN registrada.
- [ ] 1.4 Generar y revisar la migración inicial de identidad, comprobar que una base limpia migra desde cero y que no aparece una migración inesperada. Verificar: `cd backend && uv run python manage.py makemigrations --check --dry-run` después de ejecutar la migración en una base de prueba limpia.
- [ ] 1.5 Aplicar **TDD** al comando operativo de creación del primer Administrador, garantizando usuario activo, rol de negocio y ausencia de autorización funcional implícita por `is_superuser`. Verificar: prueba enfocada del comando y `make admin` documentado para el nuevo comportamiento.

## 2. Roles y permisos efectivos

- [ ] 2.1 Aplicar **TDD** a la enumeración de los tres roles y al catálogo fijo de permisos de `backend/src/identity/domain/`, cubriendo que no existan roles adicionales y que el catálogo coincida con `docs/negocio/requisitos/actores-y-roles.md`. Verificar: pruebas unitarias enfocadas del dominio.
- [ ] 2.2 Aplicar **TDD** al cálculo de unión de permisos para uno y varios roles, incluidos permisos compartidos, retirada de un rol y denegación por defecto. Verificar: pruebas unitarias enfocadas del servicio de autorización.
- [ ] 2.3 Aplicar **TDD** al adaptador DRF de permisos para demostrar autorización positiva, llamada directa denegada y ausencia de efectos cuando falta permiso. Verificar: pruebas API parametrizadas por Administrador, Vendedor, Encargado del taller y combinaciones de roles.

## 3. Auditoría de identidad

- [ ] 3.1 Aplicar **TDD** al modelo append-only `AuditEvent`, incluyendo actor opcional, acción, objetivo, resultado, fecha, motivo, `request_id`, identificador de operación y restricción contra restablecimientos duplicados. Verificar: pruebas de modelo y migración enfocadas.
- [ ] 3.2 Aplicar **TDD** al servicio explícito de auditoría para éxitos, fallos y sanitización; demostrar que nunca persiste contraseñas, credenciales temporales ni secretos de sesión. Verificar: pruebas unitarias con valores señuelo ausentes del evento serializado.
- [ ] 3.3 Aplicar **TDD** a la inmutabilidad operativa, impidiendo actualización o eliminación mediante interfaces ordinarias y conservando correcciones como eventos adicionales. Verificar: pruebas de aplicación y API que rechacen mutaciones.
- [ ] 3.4 Integrar el `request_id` del middleware existente en los eventos y presentar fechas en `America/Guayaquil` sin cambiar el almacenamiento UTC. Verificar: prueba de integración que correlacione respuesta, log técnico y evento funcional.

## 4. Servicios de administración de usuarios

- [ ] 4.1 Aplicar **TDD** al servicio de creación de usuarios para identificación única, datos básicos, estado y uno o varios roles; cubrir rechazo sin roles y rol no permitido. Verificar: pruebas de aplicación e integración con PostgreSQL.
- [ ] 4.2 Aplicar **TDD** a la edición declarativa de datos y roles, comprobando unión vigente, idempotencia de repetir el mismo estado e incremento de `authorization_version` únicamente cuando corresponda. Verificar: pruebas enfocadas del servicio.
- [ ] 4.3 Aplicar **TDD** a activación y desactivación para impedir accesos nuevos, incrementar la versión, conservar roles e identidad histórica y registrar auditoría atómica. Verificar: pruebas de servicio y autenticación posterior.
- [ ] 4.4 Aplicar **TDD** a la protección del último Administrador activo bajo transacción y bloqueo estable, incluidos dos retiros o desactivaciones concurrentes. Verificar: prueba transaccional PostgreSQL que confirme que al menos una cuenta Administrador permanece activa.
- [ ] 4.5 Implementar consultas paginadas y filtros de usuarios por identificación, datos básicos, estado y rol mediante una interfaz de lectura separada de las mutaciones. Verificar: pruebas de consulta, paginación y ausencia de datos sensibles.

## 5. Sesiones y credenciales

- [ ] 5.1 Migrar los endpoints existentes de CSRF, login, logout y sesión desde `config` hacia `identity/api/` conservando primero sus pruebas actuales y observando el fallo esperado antes de cambiar las rutas. Verificar: `cd backend && uv run pytest tests/api/test_authentication.py tests/api/test_errors.py`.
- [ ] 5.2 Aplicar **TDD** al contrato ampliado de sesión para estado, identidad visible, roles, permisos efectivos y cambio obligatorio, sin hashes ni banderas internas. Verificar: pruebas API para sesión anónima, activa, multirrol y pendiente de cambio.
- [ ] 5.3 Aplicar **TDD** al middleware de versión de autorización, cubriendo sesión vigente, versión diferente, cuenta inactiva y orden correcto después de `AuthenticationMiddleware`. Verificar: pruebas de integración que reutilicen una cookie anterior al cambio sensible.
- [ ] 5.4 Aplicar **TDD** al cambio de la propia contraseña con validadores estándar, comprobación de contraseña actual, preservación segura de la sesión actual y rechazo de la credencial anterior. Verificar: pruebas de aplicación y API sin valores de contraseña en logs ni auditoría.
- [ ] 5.5 Aplicar **TDD** al restablecimiento administrativo con identificador de operación, generación criptográfica, visualización única, hash exclusivo, cambio obligatorio, incremento de versión y auditoría atómica. Verificar: pruebas de éxito, permiso denegado, reintento con el mismo identificador y nueva operación intencional.
- [ ] 5.6 Aplicar **TDD** a la restricción de una sesión con credencial temporal, permitiendo únicamente consultar sesión, cerrar sesión y cambiar contraseña hasta completar el cambio. Verificar: pruebas API positivas y negativas sobre las rutas permitidas y bloqueadas.
- [ ] 5.7 Conservar y ampliar la limitación de cinco intentos por minuto y la auditoría de fallos repetidos sin atribuir una identidad no confirmada. Verificar: pruebas de throttling, mensaje genérico y ausencia de contraseñas registradas.

## 6. API de usuarios, roles y auditoría

- [ ] 6.1 Aplicar **TDD** a los serializers y vistas del listado, creación, detalle y edición de usuarios, manteniendo las reglas en servicios y respuestas de error `application/problem+json`. Verificar: pruebas API de flujo válido, validaciones y permisos por rol.
- [ ] 6.2 Aplicar **TDD** a las acciones explícitas de activar, desactivar y restablecer contraseña; impedir que un `PATCH` genérico ejecute transiciones sensibles. Verificar: pruebas de rutas, atomicidad, permisos y auditoría.
- [ ] 6.3 Implementar el endpoint de solo lectura de roles y permisos fijos, accesible únicamente al Administrador y sin operaciones de creación, edición o eliminación. Verificar: pruebas de contrato y denegación para los otros roles.
- [ ] 6.4 Implementar el endpoint de auditoría de solo lectura con paginación y filtros por usuario, período, acción, objetivo y resultado; impedir revelar eventos a roles no autorizados. Verificar: pruebas de filtros, zona horaria y permisos.
- [ ] 6.5 Actualizar y validar el **Contrato OpenAPI** de todos los endpoints de identidad, incluyendo sesión, errores, acciones sensibles, paginación y credencial temporal solo en la respuesta original. Verificar: prueba de esquema y revisión de `GET /api/v1/schema/`.

## 7. Cliente de sesión y navegación frontend

- [ ] 7.1 Aplicar **TDD** al cliente HTTP común de `frontend/src/shared/api/` para obtener CSRF, enviar cookies y encabezado, renovar el token tras login y normalizar errores de problema. Verificar: `cd frontend && npm test -- src/shared/api` con evidencia RED/GREEN.
- [ ] 7.2 Aplicar **TDD** a `frontend/src/features/auth/` para consultar sesión, iniciar, cerrar y cambiar contraseña mediante TanStack Query, invalidando las consultas pertinentes. Verificar: pruebas de hooks o servicios con respuestas reales simuladas en el límite HTTP.
- [ ] 7.3 Aplicar **TDD** a los guards del router para estados cargando, anónimo, autenticado y cambio obligatorio, asegurando que una sesión invalidada vuelva al acceso. Verificar: pruebas de navegación en memoria.
- [ ] 7.4 Construir la página de inicio de sesión y el cambio obligatorio con validación accesible, mensaje genérico, prevención de doble envío y manejo de sesión expirada. Verificar: pruebas con Testing Library de teclado, errores y flujo exitoso.
- [ ] 7.5 Construir el marco autenticado con usuario actual, logout y navegación derivada exclusivamente de los permisos devueltos por sesión. Verificar: pruebas parametrizadas para los tres roles y usuarios multirrol.
- [ ] 7.6 Sustituir la página técnica como inicio funcional sin eliminar la consulta técnica necesaria para diagnóstico y mantener rutas no autorizadas fuera de la navegación. Verificar: pruebas de router y `cd frontend && npm run build`.

## 8. Administración y auditoría frontend

- [ ] 8.1 Aplicar **TDD** a la lista de usuarios con búsqueda, filtros, paginación, estado, roles y acciones según permiso. Verificar: pruebas de carga, vacío, error, filtros y acción oculta.
- [ ] 8.2 Aplicar **TDD** al formulario de creación y edición con uno o varios roles, mensajes junto al campo, conservación de datos ante errores y advertencia de cambios sin guardar. Verificar: pruebas de validación y envío.
- [ ] 8.3 Implementar activación y desactivación con confirmación clara y tratamiento específico del rechazo al dejar el sistema sin Administrador. Verificar: pruebas de diálogo, éxito, error y actualización de la lista.
- [ ] 8.4 Implementar el restablecimiento mostrando la credencial temporal una sola vez, sin persistirla en cachés duraderas, y explicar cómo iniciar una nueva operación si se perdió la respuesta. Verificar: pruebas de visualización única, cierre y reintento seguro.
- [ ] 8.5 Implementar la consulta de roles fijos y la página de auditoría con filtros, paginación, detalle sanitizado y zona horaria del negocio. Verificar: pruebas de visibilidad para Administrador y denegación para otros roles.

## 9. Pruebas E2E y concurrencia

- [ ] 9.1 Incorporar la configuración mínima de Playwright, arranque reproducible y utilidades para crear usuarios de prueba sin reutilizar datos personales reales. Verificar: `cd frontend && npm run test:e2e -- --list`.
- [ ] 9.2 Crear un E2E de login, consulta de sesión, navegación autorizada y logout para cada rol, incluidos menús distintos y usuario multirrol. Verificar: ejecución enfocada del archivo Playwright.
- [ ] 9.3 Crear un E2E de administración de usuarios: crear, editar, combinar roles, desactivar, reactivar y comprobar el rechazo del último Administrador. Verificar: ejecución enfocada del archivo Playwright.
- [ ] 9.4 Crear un E2E de restablecimiento temporal, cambio obligatorio y rechazo de una ruta protegida tras reducir roles. Verificar: ejecución enfocada del archivo Playwright.
- [ ] 9.5 Ejecutar conjuntamente las pruebas transaccionales de último Administrador, invalidación de sesiones y operación idempotente de restablecimiento contra PostgreSQL. Verificar: comando pytest enfocado repetido sin resultados intermitentes.

## 10. Documentación, trazabilidad y cierre

- [ ] 10.1 Actualizar `docs/negocio/requisitos/matriz-trazabilidad.md` y crear la matriz de cobertura que vincule specs, escenarios, pruebas backend, frontend y E2E. Verificar: revisión de enlaces e identificadores `CT-001`, `RN-SEG-*`, `RF-ACC-*`, `RF-AUD-*`, `CU-001`, `CU-002` y `UI-*` aplicables.
- [ ] 10.2 Actualizar `docs/tecnico/arquitectura-inicial.md`, C4 únicamente si cambian contenedores, README y glosarios con la frontera `identity`, bootstrap del Administrador, migración y operación; mantener ADR-0001 y ADR-0003 coherentes. Verificar: revisión documental y ausencia de afirmaciones sobre JWT o roles configurables.
- [ ] 10.3 Documentar la inspección y procedimiento seguro para bases locales ya inicializadas, sin ejecutar recreación, restauración o traslado destructivo sin autorización. Verificar: procedimiento probado en una base desechable y pasos de recuperación revisados.
- [ ] 10.4 Ejecutar `make check` con PostgreSQL disponible y corregir formato, lint, tipos, migraciones pendientes, cobertura, pruebas y build sin reducir umbrales. Verificar: salida completa con código cero.
- [ ] 10.5 Ejecutar `cd frontend && npm run test:e2e`, `make audit`, `make compose-check` y `openspec validate --all --strict`; registrar resultados reales y cualquier limitación del entorno. Verificar: salidas completas y códigos de retorno documentados.
- [ ] 10.6 Revisar cada requisito y escenario de las cuatro specs contra código y pruebas, marcar únicamente las tareas realmente verificadas y preparar `/opsx:verify gestion-usuarios-autenticacion-roles`. Verificar: matriz de cobertura sin requisitos críticos huérfanos y `git diff --check` limpio.
