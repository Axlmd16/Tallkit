# Diseño técnico: instalar-en-windows-local

## Context

Actualmente Tallkit cuenta con configuración de desarrollo local y un ejemplo de producción basado en Docker + Nginx (`infra/compose.production.example.yaml`, `infra/nginx/default.conf`), pero la decisión `DA-003` (empaquetado, instalación, actualización, respaldo y restauración local) permanece abierta.

En la prueba piloto (Fase 0, 20/11/2026) sobre una mini PC con Windows 11 Pro (24 GB RAM) se validó que:
- Python 3.13 con `uv`, PostgreSQL 19 en Windows y la suite del backend corren nativamente en Windows (3,337 pruebas aprobadas; único fallo de plataforma por separadores `\` en `backend/tests/customer_registry/test_module_boundary.py`).
- Waitress (`--trusted-proxy=127.0.0.1 --trusted-proxy-headers="x-forwarded-proto x-forwarded-for"`) coordina correctamente con `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` en `backend/src/config/settings/production.py`.
- Caddy con `tls internal` entrega el frontend estático (`frontend/dist`) y enruta `/api/*`, `/admin/*` y `/static/*` bajo el mismo origen (`ADR-0003`), y tanto Windows como Chrome en la tablet Lenovo Android confían en `root.crt`.

El equipo del taller es compartido (cuentas `Administrador`, `Secretaria` y `Guardia` para entretenimiento), por lo que se requiere aislamiento por permisos NTFS, arranque autónomo sin inicio de sesión y cierre de sesión por inactividad configurable.

## Goals / Non-Goals

**Goals:**
- Cerrar `DA-003` y registrar `ADR-0013` con la arquitectura de despliegue local en Windows 11 Pro.
- Empaquetar y automatizar la instalación, verificación, respaldo cifrado, restauración y actualización conectada con GitHub en `infra/windows/`.
- Ejecutar backend (Waitress) y proxy HTTPS (Caddy) como servicios de Windows mediante WinSW bajo una cuenta de servicio sin privilegios administrativos.
- Implementar expiración de sesión por inactividad configurable en el backend respetando `ADR-0003`.
- Garantizar compatibilidad de pruebas en Windows y añadir verificación continua en `.github/workflows/ci.yml`.
- Mantener sincronizada la documentación técnica (`README.md`, C4, decisiones, matriz de trazabilidad y plan de instalación).

**Non-Goals:**
- Exponer Tallkit a Internet o habilitar acceso remoto público al sistema de gestión.
- Introducir Docker, WSL2, Hyper-V, Node.js o herramientas de compilación frontend en la mini PC del taller.
- Modificar reglas de negocio, esquema de base de datos de negocio, permisos (`CT-001`) ni habilitar facturación electrónica en producción (`DP-034`).

## Decisions

### 1. Pila nativa en Windows 11 Pro (PostgreSQL + Waitress + Caddy + WinSW)
- **Decisión:** Ejecutar PostgreSQL nativo (17+ ; la mini PC del piloto utiliza PostgreSQL 19) como servicio en `127.0.0.1:5432`, el backend Django mediante `waitress` escuchando en `127.0.0.1:8000`, y `Caddy` en `:443` sirviendo `frontend/dist` y haciendo proxy inverso hacia Waitress. Los scripts de `infra/windows/` detectan automáticamente la ruta `bin` de la versión instalada de PostgreSQL (o aceptan `-PgBinPath`) sin fijar una única versión mayor en código. Ambos procesos de aplicación se registran como servicios de Windows con WinSW usando una cuenta local dedicada sin privilegios administrativos (`tallkit-svc`), con arranque automático y recuperación ante fallos.
- **Por qué:** Elimina la sobrecarga de virtualización/Hyper-V/WSL2 en un equipo compartido donde también corre software con anti-cheat a nivel de kernel (League of Legends / Riot Vanguard), ya fue validado en la Fase 0, y mantiene el esquema de mismo origen exigido por `ADR-0003`.
- **Alternativas consideradas:**
  - *Docker Desktop / WSL2 / Hyper-V:* Mayor consumo de RAM/disco, posibles conflictos con Riot Vanguard y mayor complejidad de soporte en el taller.
  - *Nginx en Windows + NSSM:* Caddy resuelve automáticamente HTTPS local (`tls internal`) y renovación del certificado de servidor sin scripts adicionales de OpenSSL.
- **Dependencias nuevas:** Añadir `waitress` en `backend/pyproject.toml` y `backend/uv.lock` (manteniendo `gunicorn` para el despliegue de ejemplo en Docker).

### 2. Flujo de actualización conectado con GitHub (`GitHub Releases` + `actualizar.ps1`)
- **Decisión:** Agregar un workflow de GitHub Actions (`.github/workflows/release-windows.yml`) que, al publicar un tag `v*` o ejecutarse manualmente, compile `frontend/dist`, empaquete `backend/` (código, `pyproject.toml`, `uv.lock`) + `web/` (compilado) en un `.zip` versionado (`tallkit-vX.Y.Z.zip`) y lo adjunte a un GitHub Release. El script `infra/windows/actualizar.ps1` acepta `-Version` (descarga el release desde GitHub) o `-Paquete` (ruta local a un `.zip` como respaldo).
- **Orden estricto de `actualizar.ps1`:**
  1. Validar parámetros y disponibilidad del paquete.
  2. Ejecutar `respaldar.ps1` (respaldo preventivo obligatorio; si falla, abortar).
  3. Detener servicios de Tallkit (`tallkit-caddy`, `tallkit-backend`).
  4. Reemplazar `C:\Tallkit\app\backend` y `C:\Tallkit\app\web` preservando intactos `C:\Tallkit\app\.env` y `C:\Tallkit\datos\fotos`.
  5. Ejecutar `uv sync --frozen --no-dev`, `manage.py migrate --noinput` y `manage.py collectstatic --noinput` con `DJANGO_SETTINGS_MODULE=config.settings.production`.
  6. Iniciar servicios y consultar `/api/v1/health/` (si falla, reportar error conservando el respaldo previo para recuperación).
- **Alternativas consideradas:**
  - *`git pull` + `npm run build` en la mini PC:* Exigiría instalar Git, Node.js/npm y mantener credenciales de GitHub en un equipo compartido.
  - *Solo copia manual por USB:* Obliga a trasladar archivos manualmente en cada actualización.

### 3. Respaldo conjunto cifrado y restauración verificable (`respaldar.ps1` / `restaurar.ps1`)
- **Decisión:** `respaldar.ps1` agrupa en una carpeta temporal:
  1. Volcado lógico de PostgreSQL (`pg_dump -Fc`).
  2. Copia de `PRIVATE_MEDIA_ROOT` (`C:\Tallkit\datos\fotos`, según `ADR-0007`).
  3. Copia de `C:\Tallkit\app\.env`.
  4. Copia de los datos de Caddy (`C:\Tallkit\caddy\data`, que contiene `root.crt` y `root.key`).
  Luego empaqueta y cifra el conjunto con AES-256 (mediante `7z` o módulo criptográfico estándar configurado), lo guarda en `C:\Tallkit\respaldos`, lo copia al disco USB externo configurado y lo sincroniza con Google Drive mediante `rclone`. Si alguno de los destinos externos falla, conserva la copia local cifrada y registra el error explícitamente en el log (`RNF-DIS-006`). Aplica retención configurable (7 diarios, 4 semanales, 3 mensuales).
- `restaurar.ps1` descifra un archivo de respaldo, restaura PostgreSQL (`pg_restore`) sobre una base limpia y restituye fotos, `.env` y datos de Caddy. Para pruebas de restauración en otra computadora (p. ej. Linux), el motor/cliente `pg_restore` de destino debe ser igual o superior a la versión mayor de PostgreSQL de origen (PostgreSQL 19 en la mini PC).

### 4. Expiración de sesión por inactividad configurable
- **Decisión:** Incorporar la variable de entorno `DJANGO_SESSION_INACTIVITY_SECONDS` en `backend/src/config/settings/base.py` (valor por defecto `3600` segundos = 60 minutos; `0` para deshabilitar en pruebas o entornos que lo requieran) y un middleware `SessionInactivityMiddleware` en `backend/src/identity/middleware.py` ubicado después de `AuthenticationMiddleware` y `AuthorizationVersionMiddleware`.
- **Comportamiento:**
  - Si el usuario está autenticado, compara la marca de tiempo UTC actual contra `request.session.get("last_activity_ts")`.
  - Si la diferencia supera `SESSION_INACTIVITY_TIMEOUT_SECONDS`, ejecuta `logout(request)` e invalida la sesión antes de procesar la vista (la petición protegida retorna `401`/`403` según DRF).
  - Si está dentro del plazo, actualiza `last_activity_ts` en la sesión únicamente cuando hayan transcurrido al menos 60 segundos desde la última marca (evita escrituras innecesarias en la tabla de sesiones en cada lectura consecutiva).
  - Al iniciar sesión (`LoginView`), inicializa `request.session["last_activity_ts"]`.
- **Por qué:** Cumple con `autenticacion-y-credenciales` sin depender de `SESSION_SAVE_EVERY_REQUEST = True` (que escribiría en base de datos en cada request incluyendo archivos estáticos) y permite ajustar el umbral en taller sin desplegar código nuevo.

### 5. Compatibilidad y CI en Windows
- **Decisión:** Corregir `backend/tests/customer_registry/test_module_boundary.py` usando `relative.as_posix()` al comparar contra `existing = {("catalog/models.py", "customer_registry.models")}`. Añadir un job `backend-windows` en `.github/workflows/ci.yml` (`runs-on: windows-latest`) con servicio/instalación PostgreSQL 17 para ejecutar `ruff`, `mypy`, `manage.py check` y `pytest`.

## Impactos

- **Backend:** `pyproject.toml`, `uv.lock`, `src/config/settings/base.py`, `src/identity/middleware.py`, `src/identity/api/authentication.py`, `tests/customer_registry/test_module_boundary.py` y nuevas pruebas en `tests/identity/`. Sin migraciones de base de datos ni cambios en modelos de negocio.
- **Frontend:** Sin cambios en componentes ni contratos API; el manejo existente de sesiones expiradas (`401`/`403`) redirige al login.
- **Operación e infraestructura:** Nuevos archivos en `infra/windows/` (`instalar.ps1`, `actualizar.ps1`, `respaldar.ps1`, `restaurar.ps1`, `verificar.ps1`, `Caddyfile.template`, descriptores WinSW XML, `.env.windows.example`, `README.md`), nuevo workflow `.github/workflows/release-windows.yml` y actualización de `.github/workflows/ci.yml`.
- **Seguridad y permisos:** Aislamiento NTFS en `C:\Tallkit\*` (`Administradores` y `tallkit-svc`; `C:\Tallkit\respaldos` solo `Administradores`), PostgreSQL restringido a `127.0.0.1` en `listen_addresses` y `pg_hba.conf`, firewall limitado al perfil `Private` en puerto `443`, y expiración automática por inactividad en sesiones.
- **Documentación:** Nuevo `docs/adr/0013-despliegue-local-windows-y-respaldos.md`, cierre de `DA-003` en `docs/negocio/decisiones/decisiones-confirmadas.yaml` y `docs/arquitectura/modelo-dominio.md`, actualización de `docs/architecture/c4-containers.md`, `docs/negocio/requisitos/matriz-trazabilidad.md` y `README.md`.

## Risks / Trade-offs

- **Riesgo:** `rclone` o 7-Zip no están preinstalados en Windows 11. → **Mitigación:** `instalar.ps1` valida prerrequisitos (PostgreSQL 17, `uv`, `caddy`, `winsw`, `7z`, `rclone`) con instrucciones claras o descarga/verificación explícita antes de continuar.
- **Riesgo:** Antivirus o Riot Vanguard interfieren con procesos Python/Caddy. → **Mitigación:** Verificación explícita en Fase 2 tras instalar ambos y exclusión operativa documentada si aplica.
- **Riesgo:** Umbral de inactividad interrumpe captura larga en la tablet. → **Mitigación:** Umbral por defecto conservador (60 min) y configurable vía variable de entorno en `.env`.
- **Riesgo:** Pérdida de claves de cifrado de respaldos o BitLocker. → **Mitigación:** Almacenamiento obligatorio fuera de la mini PC y entrega de copia al dueño antes de Fase 6.

## Estrategia de pruebas

- **Nivel Estricto (TDD — `AGENTS.md`):**
  - `SessionInactivityMiddleware` e invalidación de sesión en `LoginView` / vistas protegidas (pruebas unitarias y de integración en `backend/tests/identity/` escribiendo primero la prueba que falla).
- **Nivel Prueba al final / Verificación técnica:**
  - Normalización POSIX en `test_module_boundary.py` verificada con `pytest`.
  - Validación de sintaxis de scripts PowerShell (cuando estén en repositorio) y workflows YAML de GitHub Actions.
  - Ejecución de la suite relacionada en backend (`pytest tests/identity tests/customer_registry/test_module_boundary.py`) y verificación de `ruff`, `mypy`, `manage.py check` y `makemigrations --check --dry-run`.
