## Why

El sistema necesita una base de identidad y autorización antes de incorporar clientes, inventario, ventas o mantenimientos, porque toda operación interna debe atribuirse a un **Usuario** activo y someterse a permisos comprobados por el backend. La infraestructura actual resuelve parcialmente las sesiones, pero todavía no ofrece la gestión operativa de usuarios y **Roles**, la navegación autorizada ni la auditoría administrativa requeridas para V1.

## What Changes

### Objetivo y alcance

- Completar el inicio, consulta y cierre de sesión con una experiencia web utilizable y segura.
- Permitir que el **Administrador** cree, consulte, edite, active y desactive usuarios sin eliminar su historial.
- Permitir asignar a cada usuario uno o varios de los tres roles fijos de V1: **Administrador**, **Vendedor** y **Encargado del taller**; no se podrán crear roles ni permisos personalizados.
- Derivar los permisos efectivos como unión de los roles y exigirlos en el backend para cada acción protegida.
- Mostrar navegación y acciones únicamente cuando el usuario tenga el permiso correspondiente, sin considerar esta ocultación como una medida suficiente de seguridad.
- Permitir el cambio de contraseña por el propio usuario y el restablecimiento administrativo mediante una credencial temporal que obligue a establecer una nueva contraseña.
- Registrar y consultar acciones administrativas relevantes y eventos de acceso, incluidos cambios de usuarios y roles, restablecimientos, desactivaciones y denegaciones críticas.
- Cubrir los comportamientos con pruebas de backend, frontend y flujos E2E, incluidos casos permitidos, denegados y combinaciones de roles.

### Reutilización, modificación y sustitución

- Se reutilizarán la autenticación por sesión de Django, la protección CSRF, el mismo origen, los endpoints técnicos existentes de sesión y la limitación inicial de cinco intentos de acceso por minuto, conforme al ADR-0003.
- Se ampliará el comportamiento existente para representar usuarios activos, roles acumulables, permisos efectivos, cambio y restablecimiento de contraseña, invalidación de acceso y auditoría.
- La página técnica actual no define la experiencia funcional objetivo; la navegación autenticada y las pantallas de usuarios la sustituirán progresivamente dentro de esta capacidad.

### Fuera de alcance

- Clientes, vehículos, productos, servicios, proveedores, inventario, Kardex, proformas, ventas, pagos y mantenimientos.
- Creación o edición de roles, permisos personalizados por usuario y cualquier rol adicional, incluido Contador.
- Registro de clientes como usuarios, autoservicio público, invitaciones, recuperación por correo y autenticación de terceros.
- JWT, aplicaciones móviles, API pública para terceros, autenticación multifactor o proveedores externos de identidad.
- Configuración de entidades fiscales y parámetros económicos, aunque los usuarios sean compartidos por ambos RUC.

### Usuarios afectados

- El **Administrador** gestionará usuarios, roles, restablecimientos y consulta de auditoría.
- El **Vendedor** y el **Encargado del taller** podrán autenticarse, cerrar sesión, cambiar su propia contraseña y usar únicamente la navegación y acciones derivadas de sus roles.

### Decisiones y trazabilidad

- Decisión confirmada: `CT-001` establece exactamente tres roles fijos, al menos uno por usuario y acumulación de roles.
- Reglas aplicables: `RN-SEG-001` a `RN-SEG-007` y `RN-FIS-004`.
- Requisitos aplicables: `RF-ACC-001` a `RF-ACC-009`, `RF-AUD-001`, `RF-AUD-005`, `RNF-SEG-001` a `RNF-SEG-007`, `RNF-MAN-006` a `RNF-MAN-009` y `RNF-AUD-001` a `RNF-AUD-005`.
- Casos y pantallas aplicables: `CU-001`, `CU-002`, `UI-001`, `UI-002`, `UI-010`, `UI-011` y `UI-018`.
- Arquitectura confirmada: ADR-0003 exige sesiones Django, CSRF y mismo origen; no se introduce JWT.
- No se encontraron contradicciones entre las fuentes vigentes y el alcance solicitado.

### Decisiones de alcance aprobadas para las specs

- Impedir que una acción deje al sistema sin al menos un Administrador activo; esto incluye desactivar al último Administrador o retirarle ese rol.
- Invalidar las sesiones activas afectadas cuando se desactive un usuario, se restablezca su contraseña o se reduzcan sus roles, para que el cambio de seguridad no espere a un nuevo inicio de sesión.
- Para V1 local, mostrar una credencial temporal una sola vez al Administrador para que la entregue fuera del sistema; no incorporar todavía correo ni mensajería. El usuario deberá cambiarla en su siguiente acceso.

El usuario aprobó estas tres recomendaciones para concretarlas en las specs del cambio. Su diseño técnico se definirá posteriormente sin alterar este comportamiento esperado.

## Capabilities

### New Capabilities

- `autenticacion-y-credenciales`: Inicio y cierre de sesión, consulta de sesión, cambio de contraseña y restablecimiento administrativo seguro.
- `administracion-de-usuarios-y-roles`: Ciclo de vida de usuarios, tres roles fijos acumulables y conservación del historial al desactivar.
- `autorizacion-y-navegacion`: Cálculo de permisos efectivos, autorización obligatoria en backend y adaptación de navegación y acciones en frontend.
- `auditoria-de-identidad`: Registro y consulta autorizada de eventos críticos de acceso y administración de usuarios, roles y credenciales.

### Modified Capabilities

Ninguna. La única spec principal existente corresponde al modelo de dominio y no cambia sus requisitos.

## Impact

- **Backend y API:** se ampliará la infraestructura actual de autenticación y se incorporarán contratos para sesión, credenciales, usuarios, roles, permisos y auditoría; todas las operaciones protegidas deberán denegar accesos no autorizados sin efectos parciales.
- **Frontend:** se incorporarán acceso, marco autenticado, navegación según permisos, gestión de usuarios y estados de sesión; la visibilidad nunca sustituirá la autorización del backend.
- **Datos:** será necesario conservar identidad, estado, roles y autoría histórica de cada usuario, además de eventos administrativos trazables. La estructura concreta y su migración se decidirán en `design.md`.
- **Seguridad:** se preservarán sesiones Django, CSRF, cookies seguras, mismo origen, hash de contraseñas y limitación de intentos; los cambios sensibles deberán evitar sesiones con privilegios obsoletos.
- **Pruebas y documentación:** se requerirán pruebas backend, frontend y E2E, contrato OpenAPI y actualización de trazabilidad y documentación afectada.
- **Dependencias:** esta capacidad será una base para las posteriores funcionalidades del negocio, que necesitarán usuarios autenticados y permisos comprobables.
- **Riesgos:** bloqueo accidental del acceso administrativo, permisos acumulados incorrectos, sesiones que conserven privilegios retirados, exposición de credenciales temporales y registros de auditoría con información sensible.

## Fuentes consultadas

- `docs/negocio/decisiones/decisiones-confirmadas.yaml`.
- `docs/arquitectura/modelo-dominio.md`.
- `docs/negocio/producto/alcance-v1.md`, `reglas-negocio.md` y `glosario.md`.
- `docs/negocio/requisitos/actores-y-roles.md`, `requisitos-funcionales.md`, `requisitos-no-funcionales.md`, `casos-de-uso.md`, `interfaz-y-navegacion.md` y `matriz-trazabilidad.md`.
- `docs/adr/0003-sesiones-y-mismo-origen.md`.
- `openspec/specs/modelo-dominio-taller/spec.md`.
- Infraestructura actual de autenticación y pruebas bajo `backend/src/config/api/`, `backend/src/config/settings/` y `backend/tests/api/`, y estado actual del frontend bajo `frontend/src/`.
