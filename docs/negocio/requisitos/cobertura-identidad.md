# Cobertura de identidad, autenticación y roles

| Campo | Valor |
|---|---|
| Cambio OpenSpec | `gestion-usuarios-autenticacion-roles` |
| Fecha de evidencia | 2026-09-09 |
| Alcance | Identidad, autenticación, autorización, administración de usuarios y auditoría de identidad |

## Trazabilidad

| Capacidad y escenarios | Reglas y requisitos | Evidencia backend | Evidencia frontend / E2E |
|---|---|---|---|
| Login activo, rechazo genérico, límite de intentos, sesión y logout | RN-SEG-001, 005, 006; RF-ACC-001…003; CU-001; UI-001…002 | `backend/tests/api/test_authentication.py`, `backend/tests/identity/test_authorization_version_middleware.py` | `frontend/src/features/auth/AuthForms.test.tsx`, `frontend/src/features/auth/SessionGuard.test.tsx`, `frontend/e2e/auth.spec.ts` |
| Cambio propio y credencial temporal obligatoria | RF-ACC-003…004; CU-002; UI-010 | `backend/tests/identity/test_password_services.py`, `backend/tests/identity/test_temporary_credential_restriction.py`, `backend/tests/identity/test_users_api.py` | `frontend/src/pages/change-password/ChangePasswordPage.test.tsx`, `frontend/e2e/users.spec.ts` |
| Tres roles fijos, multirrol y unión de permisos | CT-001; RN-SEG-002…004; RF-ACC-006…008; UI-011 | `backend/tests/identity/test_authorization.py`, `backend/tests/identity/test_api_permissions.py`, `backend/tests/identity/test_roles_api.py` | `frontend/src/app/AuthenticatedShell.test.tsx`, `frontend/e2e/auth.spec.ts` |
| Crear, consultar, editar, activar y desactivar usuarios; último Administrador | RN-SEG-003, 006; RF-ACC-005, 007; CU-002; UI-010…011 | `backend/tests/identity/test_user_services.py`, `backend/tests/identity/test_users_api.py`, `backend/tests/identity/test_user_queries.py`, `backend/tests/identity/test_last_administrator_concurrency.py` | `frontend/src/features/users/UserForm.test.tsx`, `frontend/src/pages/users/UsersPage.test.tsx`, `frontend/e2e/users.spec.ts` |
| Invalidación por estado, restablecimiento o reducción de roles | RN-SEG-006…007; RF-ACC-004…005, 008 | `backend/tests/identity/test_authorization_version_middleware.py`, `backend/tests/identity/test_user_services.py`, `backend/tests/identity/test_password_services.py` | `frontend/src/features/auth/SessionGuard.test.tsx`, reducción de roles en `frontend/e2e/users.spec.ts` |
| Auditoría inmutable, sanitizada, correlacionada y consultable | RN-SEG-005; RF-ACC-009; RF-AUD-001, 003, 005; UI-018; RNF-AUD-001…005 | `backend/tests/identity/test_audit_model.py`, `backend/tests/identity/test_audit_service.py`, `backend/tests/identity/test_audit_immutability.py`, `backend/tests/identity/test_audit_api.py`, `backend/tests/api/test_authentication.py` | `frontend/src/pages/audit/AuditPage.test.tsx`; acceso de ruta en `frontend/src/app/App.test.tsx` |

Los 23 requisitos y 53 escenarios completos permanecen en las cuatro specs del cambio. Se revisaron contra el código y las pruebas backend, frontend y E2E; las rutas anteriores son evidencia navegable agrupada y no una duplicación de las especificaciones.

## Límites

- La conservación y purga de auditoría (`RNF-DAT-004`, `RNF-AUD-006`) sigue pendiente antes de producción; no se ejecutan purgas silenciosas.
- La base local existente tiene migraciones estándar previas al usuario personalizado. No se modificó: debe seguirse el [procedimiento de transición de identidad](../../tecnico/transicion-base-identidad.md).
- Ninguna evidencia implica que clientes, productos, inventario, ventas o mantenimiento estén implementados.
