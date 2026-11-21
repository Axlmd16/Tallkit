# Tareas: instalar-en-windows-local

## 1. Backend: Expiración de sesión por inactividad y compatibilidad Windows
**Nivel de riesgo:** Estricto (**TDD**) para expiración/invalidación de sesión; **Prueba al final** para compatibilidad de rutas y dependencia WSGI.

- [x] 1.1 (**TDD - Rojo**) Escribir pruebas en `backend/tests/identity/test_session_inactivity.py` que verifiquen: sesión vigente dentro del umbral, expiración e invalidación tras superar `SESSION_INACTIVITY_TIMEOUT_SECONDS`, renovación de marca de actividad y desactivación con valor `0`.
- [x] 1.2 (**TDD - Verde**) Configurar `DJANGO_SESSION_INACTIVITY_SECONDS` (`SESSION_INACTIVITY_TIMEOUT_SECONDS`, default `3600`) en `backend/src/config/settings/base.py`, implementar `SessionInactivityMiddleware` en `backend/src/identity/middleware.py`, registrarlo en `MIDDLEWARE` e inicializar `last_activity_ts` en `LoginView` (`backend/src/identity/api/authentication.py`).
- [x] 1.3 (**TDD - Refactorización**) Revisar legibilidad, tipado estricto (`mypy`) y evitar escrituras innecesarias en sesión cuando el intervalo desde el último registro sea menor a 60 s.
- [x] 1.4 Añadir `waitress` a `dependencies` en `backend/pyproject.toml` y actualizar `backend/uv.lock` manteniendo `gunicorn` para Docker.
- [x] 1.5 Normalizar el separador con `.as_posix()` en `backend/tests/customer_registry/test_module_boundary.py` para compatibilidad en Windows.

**Evidencia de finalización:**
`cd backend && uv run --frozen ruff format --check . && uv run --frozen ruff check . && uv run --frozen mypy src tests && uv run --frozen python manage.py check && uv run --frozen python manage.py makemigrations --check --dry-run && uv run --frozen pytest tests/identity tests/customer_registry/test_module_boundary.py`

## 2. Infraestructura Windows (`infra/windows/`)
**Nivel de riesgo:** Prueba al final / Verificación de configuración y sintaxis (sin prueba nueva unitaria para archivos declarativos).

- [x] 2.1 Crear `infra/windows/.env.windows.example` con las variables requeridas (`DATABASE_URL`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `APP_TIME_ZONE`, `PRIVATE_MEDIA_ROOT`, `DJANGO_SESSION_INACTIVITY_SECONDS`, `LOG_LEVEL`) sin secretos reales.
- [x] 2.2 Crear plantilla `infra/windows/Caddyfile.template` con `tls internal`, `encode gzip`, límites de subida (`/api/*` 12 MB), proxy hacia `127.0.0.1:8000` y archivos estáticos en `C:\Tallkit\app\web`.
- [x] 2.3 Crear descriptores de servicio WinSW `infra/windows/tallkit-backend.xml` (ejecutando `waitress-serve --listen=127.0.0.1:8000 --trusted-proxy=127.0.0.1 --trusted-proxy-headers="x-forwarded-proto x-forwarded-for" config.wsgi:application` con `DJANGO_SETTINGS_MODULE=config.settings.production`) y `infra/windows/tallkit-caddy.xml`, configurados para cuenta `tallkit-svc` y arranque automático.
- [x] 2.4 Crear `infra/windows/instalar.ps1` (parametrizado con `-Ip`, detección automática de PostgreSQL `bin` o `-PgBinPath`, `uv sync --frozen --no-dev`, `migrate`, `collectstatic`, registro de servicios WinSW, regla de firewall puerto 443 solo en perfil `Private` y permisos NTFS restrictivos en `C:\Tallkit`).
- [x] 2.5 Crear `infra/windows/respaldar.ps1` (empaquetado de `pg_dump -Fc`, `PRIVATE_MEDIA_ROOT`, `.env` y datos de Caddy, cifrado AES-256, copia a disco USB externo y Google Drive vía `rclone`, retención 7d/4w/3m, log de fecha/resultado/tamaño y manejo explícito de fallos parciales) y `infra/windows/restaurar.ps1` (descifrado, `pg_restore` y restitución de archivos).
- [x] 2.6 Crear `infra/windows/actualizar.ps1` (descarga desde GitHub Release por `-Version` o paquete local `-Paquete`, respaldo preventivo obligatorio con `respaldar.ps1`, detención de servicios, reemplazo sin sobrescribir `.env` ni fotos, `uv sync --frozen --no-dev`, `migrate`, `collectstatic`, arranque y verificación de `/api/v1/health/`) y `infra/windows/verificar.ps1` (estado de servicios, puerto 443, salud HTTP y verificación de que PostgreSQL no escucha hacia la red).
- [x] 2.7 Crear `infra/windows/README.md` con la guía operativa paso a paso para instalación, programación de tareas (18:30 y comandos de limpieza `purge_workshop_files` / `purge_entity_logos`), certificado `root.crt` en Windows/Android y restauración.

**Evidencia de finalización:**
Revisión de estructura, parámetros y coherencia entre scripts, plantillas XML/Caddyfile y `.env.windows.example` bajo `infra/windows/`.

## 3. CI en Windows y empaquetado de versiones en GitHub
**Nivel de riesgo:** Sin prueba nueva (configuración de CI/CD); validación mediante sintaxis YAML y ejecución en GitHub Actions.

- [x] 3.1 Añadir job `backend-windows` en `.github/workflows/ci.yml` (`runs-on: windows-latest`) ejecutando `ruff`, `mypy`, `manage.py check` y `pytest`.
- [x] 3.2 Crear `.github/workflows/release-windows.yml` para compilar `frontend/dist`, empaquetar `backend/` y `web/` en `tallkit-vX.Y.Z.zip` y publicarlo en GitHub Releases ante tags `v*` o disparo manual.

**Evidencia de finalización:**
Validación de sintaxis YAML de `.github/workflows/ci.yml` y `.github/workflows/release-windows.yml`.

## 4. Documentación, ADR y Trazabilidad
**Nivel de riesgo:** Sin prueba nueva (documentación).

- [x] 4.1 Crear `docs/adr/0013-despliegue-local-windows-y-respaldos.md` documentando el cierre de `DA-003` (pila nativa Windows 11 Pro, actualización vía GitHub y respaldos cifrados).
- [x] 4.2 Cerrar `DA-003` en `docs/negocio/decisiones/decisiones-confirmadas.yaml` y actualizar `docs/arquitectura/modelo-dominio.md` (sección 11.4).
- [x] 4.3 Actualizar `docs/architecture/c4-containers.md`, `docs/negocio/requisitos/matriz-trazabilidad.md` y `README.md` referenciando `infra/windows/` y `ADR-0013` (y `docs/tecnico/glosario-tecnico.md` solo si se introducen términos técnicos nuevos).

**Evidencia de finalización:**
Verificación de enlaces internos y consistencia documental entre ADR-0013, decisiones confirmadas, C4 y trazabilidad.

## 5. Cobertura de requisitos (1 fila por requisito)

| Requisito | Verificación / Prueba asociada |
| --- | --- |
| Instalación local repetible y aislamiento (`DA-003`, `RNF-DIS-001`, `RNF-SEG-008`, `RNF-SEG-012`) | Revisión y ejecución de `infra/windows/instalar.ps1` + `verificar.ps1` en equipo Windows |
| Operación automática sin sesión y transporte seguro (`ADR-0003`, `RNF-SEG-004`, `RNF-SEG-010`) | Descriptores WinSW + `Caddyfile.template` + prueba piloto/verificación en red local |
| Respaldo conjunto, cifrado y replicado (`CU-021`, `RNF-DIS-002`, `RNF-DIS-003`, `RNF-DIS-006`, `ADR-0007`) | Ejecución y log de `infra/windows/respaldar.ps1` hacia disco USB y Google Drive |
| Restauración verificable en entorno independiente (`CU-021`, `RNF-DIS-004`, `RNF-DIS-005`) | Prueba de `infra/windows/restaurar.ps1` / `pg_restore` en equipo distinto |
| Actualización controlada conectada con GitHub (`RNF-DIS-007`, `RNF-DIS-008`) | Workflow `.github/workflows/release-windows.yml` + `infra/windows/actualizar.ps1` |
| Consulta y expiración de sesión por inactividad (`autenticacion-y-credenciales`, `RF-ACC-001`, `RNF-SEG-002`) | `backend/tests/identity/test_session_inactivity.py` (TDD) |
