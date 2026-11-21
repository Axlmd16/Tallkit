# ADR-0013: Despliegue local nativo en Windows 11 Pro, actualizaciones vía GitHub y respaldos cifrados

- Estado: Aceptada
- Fecha: 2026-11-20

## Contexto

La decisión `DA-003` (empaquetado, instalación, actualización, respaldo y restauración local) permanecía abierta. El taller opera con una mini PC compartida con **Windows 11 Pro** (donde coexisten la cuenta de operación diaria y una cuenta de entretenimiento con software anti-cheat a nivel de kernel) y una tablet Lenovo Android en la red local del taller.

En la prueba piloto (Fase 0 del 20/11/2026) se verificó que Python 3.13 con `uv`, PostgreSQL (19 en el equipo piloto), `waitress` y `caddy` (`tls internal`) funcionan nativamente en Windows y que la tablet Lenovo Android confía en el certificado de CA local (`root.crt`) sin advertencias.

## Decisión

1. **Pila nativa sin contenedores en Windows 11 Pro:**
   - **Base de datos:** PostgreSQL nativo escuchando exclusivamente en `localhost` (`127.0.0.1:5432`, `pg_hba.conf` local).
   - **Backend:** Django + DRF servido mediante `waitress` en `127.0.0.1:8000` (`--trusted-proxy=127.0.0.1 --trusted-proxy-headers="x-forwarded-proto x-forwarded-for"`).
   - **Proxy y estáticos:** Caddy v2 en `:443` con `tls internal`, sirviendo `frontend/dist` y enrutando `/api/*`, `/admin/*` y `/static/*` al backend bajo el mismo origen (`ADR-0003`).
   - **Servicios:** Ambos procesos se registran mediante WinSW (`tallkit-backend`, `tallkit-caddy`) bajo la cuenta local sin privilegios `tallkit-svc` con arranque automático sin requerir inicio de sesión.
   - **Aislamiento y seguridad:** Permisos NTFS restrictivos en `C:\Tallkit\*`, firewall limitado al perfil `Private` en puerto `443`, BitLocker en el equipo y expiración de sesión por inactividad configurable (`DJANGO_SESSION_INACTIVITY_SECONDS`).
2. **Actualizaciones conectadas con GitHub:**
   - GitHub Actions compila `frontend/dist` y empaqueta `backend/` + `web/` en `tallkit-vX.Y.Z.zip` dentro de GitHub Releases.
   - `infra/windows/actualizar.ps1` descarga el release (o acepta un `.zip` local), ejecuta respaldo preventivo obligatorio, detiene servicios, reemplaza código preservando `.env` y `C:\Tallkit\datos\fotos`, ejecuta `uv sync --frozen --no-dev`, `migrate`, `collectstatic`, levanta servicios y verifica `/api/v1/health/`.
3. **Respaldos y restauración:**
   - `infra/windows/respaldar.ps1` empaqueta `pg_dump -Fc`, `PRIVATE_MEDIA_ROOT`, `.env` y los datos/PKI de Caddy en un archivo cifrado AES-256 (`7z`), lo copia a disco USB externo y a Google Drive vía `rclone`, aplica retención (`7d / 4w / 3m`) y registra fecha, resultado y tamaño (`RNF-DIS-006`).
   - `infra/windows/restaurar.ps1` automatiza el descifrado y la restauración (`pg_restore` con versión igual o superior a la de origen).

## Alternativas consideradas

- **Docker Desktop / WSL2 / Hyper-V:** Descartado por consumo adicional de recursos, complejidad de mantenimiento en Windows compartido y posibles conflictos con software anti-cheat (Riot Vanguard).
- **Actualización mediante `git pull` + `npm run build` en la mini PC:** Descartado para evitar instalar Node.js, Git y credenciales de repositorio en el equipo compartido.
- **Certificado público con dominio propio:** Reservado como alternativa únicamente si en el futuro cambia la política de dispositivos Android; la Fase 0 demostró viabilidad completa con `tls internal` de Caddy.

## Consecuencias

- Se cierra `DA-003`.
- La mini PC no requiere Docker, Node.js ni Git para operar o actualizarse.
- Las pruebas del backend incluyen verificación continua en Windows (`backend-windows` en `.github/workflows/ci.yml`).
- Los scripts en `infra/windows/` detectan dinámicamente la ruta `bin` de PostgreSQL instalada (soportando PostgreSQL 17+).

## Referencias

- `DA-003`, `RNF-DIS-001` a `RNF-DIS-008`, `RNF-SEG-004` a `RNF-SEG-012`, `CU-021`
- `docs/adr/0003-sesiones-y-mismo-origen.md`, `docs/adr/0007-almacenamiento-privado-fotografias.md`
- `infra/windows/` y `docs/tecnico/plan-instalacion-taller.md`
