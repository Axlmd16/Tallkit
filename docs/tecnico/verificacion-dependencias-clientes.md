# Verificación previa a clientes y vehículos

Fecha: 2026-09-12. Rama revisada: `develop`, commit `8d98e62`. Se preserva la modificación previa de `DESIGN.md`. Flujo: **OpenSpec** `spec-driven`.

## Resultado inicial de la revisión

La aplicación de `gestionar-clientes-y-vehiculos` permanece detenida en su condición 1.2. Los artefactos aprobados están registrados en `master` (`78ba5bf`) y coinciden con los de `develop`; la tarea documental 1.1 está completada. No se implementó código de clientes, vehículos ni marcas.

| Dimensión | Identidad | Sistema visual |
|---|---|---|
| Completitud | 54/54 casillas existentes; la verificación detecta una brecha de comportamiento que impide dar el cambio por cerrado. | 58/60 tareas; revisión conjunta 9.5 y aceptación explícita 11.10 pendientes. |
| Corrección | Pruebas existentes correctas; falla el escenario «Permiso retirado durante el uso» sin recargar la página. | 25 E2E existentes correctos, incluyendo geometría, adaptación y accesibilidad; esto no sustituye la aceptación visual. |
| Coherencia | Backend conserva la autoridad de autorización; falta propagar la invalidación a la sesión del frontend. | Las capturas mantienen las adaptaciones documentadas del kit Figma a los flujos del taller. |

## Hallazgo bloqueante de identidad

En `openspec/changes/archive/2026-09-13-gestion-usuarios-autenticacion-roles/specs/autorizacion-y-navegacion/spec.md`, el escenario «Permiso retirado durante el uso» exige abandonar la experiencia autenticada cuando se invalida la sesión.

Reproducción con dos contextos Chromium y datos aislados de prueba:

1. Un Administrador concede temporalmente el rol Administrador a `multirrol_e2e`.
2. Ese usuario inicia una sesión independiente y abre Usuarios.
3. El primer Administrador retira el rol concedido.
4. El usuario afectado escribe en la búsqueda de la pantalla ya abierta, sin recargarla.
5. El backend rechaza la consulta con `403`, pero la interfaz no muestra «Iniciar sesión» dentro del plazo de seis segundos. La aserción falla por ausencia del encabezado, después de observar la respuesta rechazada.

La protección backend funciona en esta reproducción; no se demostró acceso indebido a datos. La divergencia está en la reacción del frontend. `frontend/src/shared/api/client.ts` transforma la respuesta en `ProblemError`, `frontend/src/features/users/hooks.ts` no actualiza la sesión ante ese rechazo y `frontend/src/features/auth/SessionGuard.tsx` sigue leyendo la sesión almacenada en TanStack Query. La prueba existente de `frontend/e2e/users.spec.ts` recarga la página antes de comprobar la invalidación y no cubre este recorrido.

Acción requerida antes de cerrar identidad: incorporar una regresión sin recarga y sincronizar la sesión al detectar pérdida de autenticación, distinguiéndola de una denegación de permiso que no invalida la sesión. Aplicar **TDD** y repetir las verificaciones afectadas. No se modificó producción durante esta revisión; la prueba diagnóstica y su salida se conservaron fuera del repositorio.

## Verificaciones ejecutadas

| Comando | Resultado reciente |
|---|---|
| `make check` | Código 0: formato, lint, tipos, Django, migraciones, 98 pruebas backend, 89 frontend, cobertura, build y Compose. Frontend: 89,02 % sentencias y 90,60 % líneas. |
| `make test` | Código 0; 98 pruebas backend y 89 frontend. |
| `make audit` | Código 0; sin vulnerabilidades conocidas en backend y frontend. |
| `cd backend && uv run --frozen python manage.py spectacular --validate` | Código 0. |
| `cd frontend && npm run test:e2e -- --retries=0 --reporter=line` | Código 0; 25/25 recorridos, sin reintentos. |
| Diagnóstico E2E de revocación sin recarga | Código 1; fallo funcional descrito arriba. |
| `openspec validate --all --strict` | Cuatro elementos aprobados, cero fallos. |

Entorno frontend de esta revisión: Node `v26.8.1`; la versión objetivo documentada es Node 24. Esta ejecución no sustituye la validación de CI sobre la versión objetivo.

## Revisión visual preparada

La galería local `verificacion-dependencias/comparacion.html` reúne siete pares a las dimensiones originales de Figma y capturas actuales a 360, 768, 1024 y 1440 px. Los 39 archivos requeridos están presentes. Las referencias Figma proceden de las exportaciones de la ronda anterior; las capturas de aplicación se regeneraron en esta revisión.

Se inspeccionaron directamente Usuarios frente a su referencia, acceso a 360 px, Usuarios a 360 px y formulario a 768 px. No se observaron solapamientos en esas muestras. Las comprobaciones automatizadas cubren las otras superficies; no se atribuye a esta ronda una inspección humana exhaustiva de cada captura.

Continúan explícitas las adaptaciones: navegación de 80 px en listas, regiones sin métricas ficticias, ilustración propia del taller, acciones y filtros funcionales de usuarios, y restablecimiento administrativo en las composiciones Recover/Confirm. La aceptación visual del usuario sigue pendiente y no se infiere del resultado de las pruebas.

## Fuentes y trazabilidad

Fuentes consultadas durante este trabajo: `AGENTS.md`, configuración OpenSpec, decisiones confirmadas y DP-008 revisada, modelo de dominio, artefactos completos de los tres cambios activos, arquitectura y ADR aplicables, `docs/negocio/requisitos/cobertura-identidad.md`, `docs/tecnico/revision-visual-frontend.md`, `DESIGN.md`, código y pruebas asociados.

La cobertura de identidad anterior debe leerse junto con el hallazgo de esta revisión: la invalidación backend está cubierta, pero el recorrido de frontend sin recarga no estaba demostrado. No se reabren decisiones de negocio ni se amplía el alcance de clientes y vehículos. Ninguna dependencia fue archivada en esta ronda.

## Resolución y aceptación posteriores

El usuario aprobó explícitamente la comparación visual con «si, continua ya con las tareas». Las tareas visuales 9.5 y 11.10 quedan cumplidas; el sistema visual alcanza 60/60 tareas.

La regresión se incorporó a `frontend/e2e/session-revocation.spec.ts`: falló nuevamente antes de corregir producción y pasó después. `frontend/src/app/query-client.ts` consulta de nuevo la sesión ante errores 401/403 de consultas y mutaciones, sin reintentar solicitudes ya rechazadas por autorización. El guard existente decide la navegación desde la respuesta del backend, conservando una sesión vigente ante una mera denegación de permiso. Los errores de validación no invalidan la sesión. No se cambiaron contratos backend ni estilos.

Verificación posterior: `make check` aprobó 98 pruebas backend y 92 frontend, con formato, lint, tipos, migraciones, cobertura y build correctos; cobertura frontend 89,19 % sentencias y 90,74 % líneas. Playwright completo aprobó 26/26 recorridos sin reintentos. `make audit` no encontró vulnerabilidades conocidas. La tarea correctiva 11.4 deja identidad en 55/55. Esta evidencia sustituye el bloqueo funcional descrito en la revisión inicial y habilita la integración y archivo de ambas dependencias desde `master`.

## Cierre de dependencias

Ambas aplicaciones se integraron en `master` mediante `617ec59`. OpenSpec sincronizó sus seis capacidades principales y archivó los cambios bajo `openspec/changes/archive/2026-09-13-*` (fecha UTC generada por la CLI). Todas sus tareas estaban completas: identidad 55/55 y visual 60/60. `make test` posterior aprobó 98 pruebas backend y 92 frontend. La tarea 1.2 de clientes y vehículos queda cumplida.
