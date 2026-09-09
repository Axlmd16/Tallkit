## Context

El repositorio contiene un bootstrap técnico funcional, pero todavía no implementa módulos de negocio ni migraciones propias. El backend dispone de endpoints básicos para emitir CSRF, iniciar sesión, cerrar sesión y consultar la sesión; usa `SessionAuthentication`, denegación autenticada por defecto y limitación de cinco intentos de login por minuto. El frontend solo muestra una página de estado técnico y no tiene experiencia autenticada, rutas funcionales ni cliente de sesión.

Esta capacidad debe convertirse en la base transversal para los módulos posteriores. Los **Usuarios** son compartidos por los dos RUC, mientras sus permisos se derivan de uno o varios **Roles** fijos. El backend es la única autoridad de autorización; el frontend adapta la experiencia, pero no decide acceso.

Restricciones vigentes:

- ADR-0001 exige monolito modular y fronteras explícitas.
- ADR-0003 exige sesiones Django, CSRF, mismo origen y ausencia de JWT.
- `CT-001` fija exactamente los roles **Administrador**, **Vendedor** y **Encargado del taller**, permite acumularlos y prohíbe roles o permisos personalizados.
- Las specs aprobadas exigen invalidación de sesiones ante desactivación, restablecimiento o reducción de roles, protección del último Administrador activo y credencial temporal mostrada una sola vez.
- No existe información productiva que deba migrarse desde Flutter. Una base local ya inicializada podría contener tablas estándar de Django o superusuarios técnicos y debe inspeccionarse antes de cambiar el modelo de usuario.

## Goals / Non-Goals

**Goals:**

- Crear un módulo de identidad con responsabilidades claras para usuarios, roles, permisos, credenciales y auditoría.
- Reutilizar las sesiones y protecciones existentes sin mantener dos mecanismos de autenticación.
- Aplicar permisos vigentes en cada solicitud y evitar privilegios obsoletos tras cambios sensibles.
- Exponer contratos HTTP consistentes bajo `/api/v1/` y una experiencia React que derive su navegación de la sesión autorizada.
- Conservar auditoría trazable sin registrar contraseñas, credenciales temporales ni secretos de sesión.
- Proteger de forma transaccional la existencia de al menos un Administrador activo.
- Preparar una migración segura para instalaciones nuevas y bases locales de desarrollo ya inicializadas.
- Definir una estrategia de pruebas backend, frontend y E2E trazable a los escenarios aprobados.

**Non-Goals:**

- JWT, OAuth, proveedores externos, autenticación multifactor o API pública para terceros.
- Recuperación por correo, mensajería, invitaciones o autoservicio de cuentas.
- Roles configurables, permisos por usuario o un motor genérico de políticas.
- Funcionalidades de clientes, inventario, ventas, pagos o taller.
- Convertir el panel administrativo de Django en la interfaz operativa del negocio.
- Definir todavía retención general de auditoría, respaldo o publicación en Internet.

## Decisions

### 1. Módulo de identidad propio dentro del monolito

Se creará una aplicación Django `identity` como frontera de capacidad. Contendrá reglas y casos de uso para usuarios, roles, permisos, credenciales, sesiones y auditoría de identidad. `config` conservará composición y configuración técnica; los endpoints actuales de autenticación migrarán hacia la API pública del módulo. `shared` solo mantendrá mecanismos verdaderamente transversales, como correlación de solicitudes.

Estructura objetivo orientativa, sin crear capas vacías:

- `backend/src/identity/domain/`: enumeración de roles, catálogo de permisos e invariantes puras.
- `backend/src/identity/application/`: servicios de creación, edición, cambio de roles, desactivación, credenciales y consulta de auditoría.
- `backend/src/identity/infrastructure/`: modelos Django y adaptadores de sesión/auditoría.
- `backend/src/identity/api/`: serializers, permisos y vistas delgadas.
- `frontend/src/features/auth/`, `users/` y `audit/`: acceso remoto y comportamiento por capacidad.
- `frontend/src/app/`: bootstrap de sesión, router y marco autenticado.

Alternativas descartadas:

- Mantener identidad en `config`: mezclaría composición técnica con una capacidad de negocio transversal.
- Crear microservicio de identidad: añadiría red, despliegue y consistencia distribuida sin una necesidad de V1.
- Crear capas completas sin comportamiento: contradice la arquitectura incremental del repositorio.

### 2. Usuario personalizado desde la primera migración funcional

Se definirá `identity.User` extendiendo la abstracción de usuario de Django y se configurará como `AUTH_USER_MODEL` antes de generar la primera migración funcional. Reutilizará identificador de acceso, nombre, email opcional, contraseña protegida y estado activo del framework; añadirá únicamente el estado necesario para exigir cambio de contraseña y una versión de autorización.

Los roles no serán filas editables de un catálogo. Se representarán mediante una enumeración cerrada y asignaciones `UserRole` con unicidad por usuario y rol. El catálogo de permisos será código versionado y revisable que mapea cada rol a los identificadores documentados en `actores-y-roles.md`. Los permisos efectivos se calculan como unión y no se almacenan duplicados.

Alternativas descartadas:

- `auth.User` más perfil: evita el cambio inicial, pero divide la identidad y hace más costosa una sustitución futura cuando aún no existe información productiva.
- Grupos y permisos administrables de Django como fuente de verdad: permiten mutaciones que V1 prohíbe y crean dos vocabularios de autorización.
- Un registro por permiso efectivo: duplica datos derivados y exige sincronización al cambiar el catálogo fijo.

Consecuencias:

- `AUTH_USER_MODEL` será una decisión temprana y costosa de revertir; toda relación futura deberá usar la referencia configurada por Django.
- La regla “al menos un rol” se garantizará en servicios de aplicación, porque una restricción de fila no puede asegurar por sí sola la existencia de una asignación relacionada.
- `is_staff` e `is_superuser` podrán conservarse para tareas técnicas de Django, pero nunca concederán automáticamente permisos de la aplicación. La autorización funcional consultará exclusivamente los roles documentados.

### 3. Autorización central, denegación por defecto y sesión descriptiva

El módulo expondrá una función única `has_permission(user, permission_code)` y permisos DRF reutilizables que la invoquen. Cada caso de uso sensible volverá a comprobar la autorización antes de mutar estado; no dependerá de que la vista o el frontend hayan filtrado la acción.

El contrato de sesión devolverá, como mínimo, estado autenticado, identidad visible, estado de cambio obligatorio, roles y permisos efectivos. No devolverá hashes, banderas internas ni datos sensibles. El frontend usará ese contrato para construir rutas, menús y acciones, pero una llamada directa seguirá sometida a la misma autorización backend.

El permiso global de DRF continuará exigiendo autenticación. Los endpoints públicos quedarán enumerados explícitamente: health, esquema OpenAPI, emisión CSRF, login y consulta mínima de sesión. Las excepciones necesarias durante cambio obligatorio se limitarán a consultar sesión, cerrar sesión y cambiar contraseña.

Alternativas descartadas:

- Autorizar solo por nombre de rol dentro de cada vista: dispersa reglas y falla con usuarios multirrol.
- Confiar en rutas protegidas del frontend: no evita llamadas directas.
- Incluir permisos dentro de un token firmado: contradice ADR-0003 y complica la revocación.

### 4. Invalidación mediante versión de autorización

Cada usuario tendrá `authorization_version`, un entero monotónico. Al iniciar sesión se copiará su valor a la sesión. Un middleware situado después de la autenticación comparará ambos valores en cada solicitud autenticada; si difieren o la cuenta está inactiva, cerrará la sesión y la solicitud protegida quedará sin autenticar.

Los servicios incrementarán la versión al desactivar la cuenta, restablecer la contraseña o reducir roles. Agregar roles no invalidará la sesión: la autorización backend calculará los permisos desde las asignaciones actuales y el frontend los obtendrá al refrescar su consulta de sesión. Un cambio de contraseña propio conservará la sesión actual usando los mecanismos seguros del framework, sin conservar otras sesiones con una credencial anterior cuando Django las invalide mediante su hash de autenticación.

Esta estrategia evita recorrer y decodificar todas las sesiones de la base de datos. La invalidación es efectiva en la siguiente solicitud de cada sesión afectada, que es el primer momento en que podría ejecutar una acción.

```mermaid
sequenceDiagram
    actor A as Administrador
    participant API as API de identidad
    participant S as Servicio de usuarios
    participant DB as PostgreSQL
    actor U as Usuario afectado

    A->>API: Retira un rol
    API->>S: actualizarRoles(usuario, roles)
    S->>DB: Bloquea usuario y administradores activos
    S->>DB: Guarda roles e incrementa authorization_version
    S->>DB: Registra auditoría en la misma transacción
    DB-->>S: Cambio confirmado
    S-->>API: Usuario actualizado
    U->>API: Siguiente solicitud con sesión anterior
    API->>DB: Compara versión de sesión y usuario
    DB-->>API: Versiones diferentes
    API-->>U: Sesión invalidada; nueva autenticación requerida
```

Alternativas descartadas:

- Eliminar sesiones buscando el usuario dentro de cada contenido serializado: acopla el dominio al formato de sesión y escala linealmente.
- Esperar al siguiente login: mantendría privilegios retirados durante una sesión vigente.
- Cachear permisos en la sesión sin versión: produce permisos obsoletos.

### 5. Servicios transaccionales para usuarios y último Administrador

Crear, editar, cambiar roles, activar, desactivar y restablecer credenciales serán casos de uso explícitos, no un CRUD genérico. Cada escritura validará identidad única, roles permitidos y resultado final antes de confirmar.

Las operaciones que puedan retirar el último Administrador activo ejecutarán una transacción y bloquearán, en orden estable, al usuario objetivo y las asignaciones administrativas activas relevantes. La validación se hará contra el estado que resultaría de la operación. Dos cambios concurrentes no podrán confirmar un resultado sin Administrador; uno esperará o será rechazado.

El cambio principal y su evento de auditoría exitoso se confirmarán en la misma transacción. Una validación fallida no dejará cambios parciales. Las solicitudes declarativas de edición serán naturalmente idempotentes al establecer un estado final. Restablecer credenciales exigirá un identificador único de operación: repetirlo no generará otra contraseña ni otro evento. Como la credencial temporal no se almacena de forma reversible, un reintento solo podrá informar que la operación ya fue procesada; si la respuesta original se perdió, el Administrador deberá iniciar deliberadamente otra operación, que invalidará la credencial anterior y quedará auditada.

Alternativas descartadas:

- Comprobar el último Administrador sin bloqueo: dos solicitudes concurrentes podrían aprobarse con información obsoleta.
- Señales Django como coordinador principal: ocultan límites transaccionales y dificultan distinguir actor, intención y resultado.
- Eliminación física de usuarios: rompe la atribución histórica.

### 6. Credenciales temporales sin almacenamiento reversible

El restablecimiento administrativo generará una contraseña aleatoria mediante un generador criptográficamente seguro, validada contra la política configurada de Django. Solo se almacenará su hash mediante el mecanismo del framework. El valor temporal aparecerá únicamente en la respuesta exitosa original y no se incluirá en logs, auditoría ni consultas posteriores.

El usuario quedará con `must_change_password=true`; tras autenticarse, un permiso global limitará la sesión a consulta, logout y cambio de contraseña. Al establecer una nueva contraseña válida se limpiará la marca. No se incorporarán correo, mensajería ni recuperación pública.

Se configurarán los validadores estándar de contraseña de Django. La API responderá errores comprensibles sin revelar la contraseña recibida ni detalles del validador innecesarios.

Alternativas descartadas:

- Guardar o cifrar la contraseña temporal para volver a mostrarla: amplía innecesariamente la exposición de secretos.
- Enviar la credencial por correo: requiere infraestructura y datos no incluidos en V1.
- Permitir uso normal con credencial temporal: aumenta el período de exposición.

### 7. Auditoría explícita, append-only y sanitizada

`AuditEvent` conservará actor opcional, acción estable, tipo e identificador del objeto, resultado, fecha UTC, motivo opcional, `request_id`, identificador de operación cuando aplique y metadatos mínimos sanitizados. El actor será opcional porque un login fallido puede no corresponder a una identidad confirmada. La presentación convertirá las fechas a `America/Guayaquil`. Una restricción única sobre acción e identificador de operación impedirá repetir un restablecimiento lógico.

Los servicios registrarán explícitamente eventos administrativos. Los endpoints de login, logout y cambio de contraseña registrarán sus propios resultados. El manejador de autorización registrará solo denegaciones clasificadas como críticas para evitar ruido y crecimiento descontrolado. Ningún endpoint permitirá actualizar o borrar eventos.

Un éxito que acompaña una mutación se guardará en la misma transacción. Un intento fallido se registrará después de resolver el error, en una escritura independiente que no pueda convertir el fallo en éxito ni rescatar cambios revertidos. La auditoría funcional vivirá en PostgreSQL; los logs técnicos estructurados seguirán siendo diagnósticos y no sustituirán el historial consultable.

Alternativas descartadas:

- Auditar únicamente en logs: dificulta consulta estable, relaciones e inmutabilidad operativa.
- Registrar automáticamente todos los cambios de modelos: captura modificaciones sin intención de negocio y puede filtrar campos sensibles.
- Event sourcing: añade complejidad desproporcionada; la auditoría no será la fuente para reconstruir usuarios.

### 8. Contratos HTTP orientados a acciones

La API mantendrá `/api/v1/` y `application/problem+json`. El contrato se organizará así:

- autenticación: CSRF, login, logout, sesión y cambio de la propia contraseña;
- usuarios: listado, creación, detalle y edición declarativa;
- acciones de usuario: activar, desactivar y restablecer contraseña;
- roles: consulta de los tres roles y permisos fijos;
- auditoría: listado y detalle de solo lectura con filtros y paginación.

Las transiciones sensibles usarán acciones explícitas para evitar que un `PATCH` genérico oculte la intención. La respuesta de restablecimiento será la única que contenga la credencial temporal. Listados usarán paginación del servidor. El contrato OpenAPI documentará permisos, errores y respuestas sin exponer internamente el modelo de persistencia.

### 9. Estado remoto y navegación en el frontend

TanStack Query mantendrá la sesión como estado remoto y será invalidada después de login, logout, cambio de contraseña o administración que afecte al usuario actual. Un cliente HTTP común obtendrá CSRF antes de la primera escritura, enviará cookies bajo mismo origen y normalizará errores de problema.

El router separará ruta de acceso, marco autenticado y páginas administrativas. Un guard de ruta resolverá los estados cargando, anónimo, cambio obligatorio y autenticado. Los componentes de permiso ocultarán enlaces y acciones, pero no contendrán la matriz de autorización: consumirán los permisos devueltos por la sesión.

Las capacidades se ubicarán en `features/auth`, `features/users` y `features/audit`; las páginas compondrán esas capacidades. No se añadirá un almacén global ni una biblioteca de autorización mientras TanStack Query y funciones puras sean suficientes.

### 10. Estrategia de pruebas y trazabilidad

La implementación seguirá TDD y cubrirá:

- dominio/aplicación: unión de permisos, mínimo un rol, último Administrador, versión de autorización, cambio obligatorio y sanitización de auditoría;
- integración backend: sesiones y CSRF, login limitado, contratos de usuario, transacciones concurrentes sobre Administradores, invalidación y auditoría de éxitos y fallos;
- API/OpenAPI: autenticación y autorización positiva y negativa para cada acción, incluidos usuarios con varios roles;
- frontend: bootstrap de sesión, guards, menús, acciones, cambio obligatorio, formularios y errores accesibles;
- E2E Playwright: login/logout, administración de usuarios, combinación y reducción de roles, restablecimiento temporal y denegación de acceso directo.

Se conservarán y ampliarán las pruebas existentes de autenticación en vez de reemplazarlas sin cobertura equivalente. La verificación final ejecutará `make check`, las pruebas E2E y `openspec validate --all --strict` con PostgreSQL disponible.

### 11. Evaluación de ADR y diagramas

No se crea un ADR adicional en este cambio: ADR-0001 ya gobierna la frontera modular y ADR-0003 ya gobierna la arquitectura de autenticación y sesión. La versión de autorización, las asignaciones cerradas y la auditoría son decisiones internas de esta capacidad que no introducen una plataforma, dependencia o patrón de despliegue nuevo. Si durante la implementación fuera necesario sustituir sesiones, introducir un proveedor externo o generalizar autorización fuera del monolito, deberá proponerse un ADR nuevo antes del cambio.

No se modifica el C4 de contenedores porque no aparece ningún contenedor ni relación externa nueva. El diagrama de secuencia anterior documenta el único flujo cuya coordinación temporal no resulta evidente en prosa.

## Risks / Trade-offs

- [Cambiar `AUTH_USER_MODEL` después de haber inicializado una base local] → Detectar tablas y usuarios existentes antes de migrar; respaldar y elegir de forma explícita entre recreación local o traslado controlado.
- [Bloqueo accidental del último Administrador] → Validación transaccional bajo bloqueo, comando de bootstrap probado y procedimiento de recuperación documentado.
- [Sesiones con permisos obsoletos] → Comparar `authorization_version` en cada solicitud y calcular permisos desde asignaciones vigentes.
- [Consulta adicional del usuario por solicitud] → Aceptar una lectura indexada proporcional a la escala V1; medir antes de introducir caché que complique revocación.
- [Exposición de la credencial temporal en pantalla] → Mostrar una sola vez, impedir logs y copias automáticas, advertir entrega privada y forzar cambio inmediato.
- [Auditoría que crece sin límite] → Paginar e indexar consultas desde V1; definir retención antes de producción conforme a `RNF-DAT-004` y `RNF-AUD-006`.
- [Diferencia entre superusuario Django y Administrador del negocio] → No usar `is_superuser` como autorización funcional y hacer que el comando operativo asigne explícitamente el rol Administrador.
- [Doble envío de restablecimiento] → Exigir un identificador de operación y rechazar su repetición; una nueva acción consciente usa otro identificador, invalida la credencial temporal anterior y queda auditada.
- [Ocultación frontend interpretada como seguridad] → Mantener pruebas de llamadas directas denegadas por backend para cada permiso relevante.

## Migration Plan

1. Inspeccionar si la base objetivo contiene usuarios o migraciones estándar aplicadas y producir un respaldo antes de cualquier acción destructiva.
2. Incorporar `identity` y `AUTH_USER_MODEL` antes de generar la primera migración funcional del proyecto.
3. En instalaciones limpias, ejecutar migraciones y crear el primer Administrador mediante un comando operativo que asigne también el rol de negocio.
4. En una base local descartable sin datos necesarios, recrearla solo con autorización explícita. Si contiene usuarios que deban conservarse, preparar y probar un traslado de identidad antes de cambiar la configuración; no improvisar el cambio sobre la base activa.
5. Desplegar primero backend y migraciones, verificar creación de sesión, permisos y comando de Administrador, y después publicar el frontend funcional.
6. Verificar OpenAPI, permisos positivos y negativos, concurrencia del último Administrador, auditoría, frontend y E2E antes de habilitar usuarios operativos.

Rollback antes de uso operativo: volver al commit anterior y restaurar el respaldo o recrear la base local autorizada. Después de crear usuarios operativos no se revertirá destructivamente el modelo de identidad; se desplegará una corrección hacia adelante preservando usuarios y auditoría.

## Open Questions

- La duración y política de conservación de auditoría y logs técnicos sigue pendiente según `RNF-DAT-004` y `RNF-AUD-006`. No bloquea esta capacidad, pero debe resolverse antes de producción; V1 no ejecutará purgas silenciosas.
- No quedan decisiones funcionales abiertas para implementar las cuatro specs. Los detalles de nombres de campos visibles y composición visual se concretarán respetando `UI-001`, `UI-002`, `UI-010`, `UI-011` y `UI-018`, sin cambiar el comportamiento aprobado.

## Sources Consulted

- Propuesta y cuatro specs del cambio `gestion-usuarios-autenticacion-roles`.
- `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`.
- Documentos aplicables de producto, roles, requisitos, casos de uso, interfaz y trazabilidad bajo `docs/negocio/`.
- `docs/tecnico/arquitectura-inicial.md`, diagramas C4 y ADR-0001 y ADR-0003.
- Código y pruebas actuales de `backend/src/config/`, `backend/src/shared/`, `backend/tests/`, `frontend/src/`, además de `backend/pyproject.toml`, `frontend/package.json`, `Makefile` y `README.md`.
