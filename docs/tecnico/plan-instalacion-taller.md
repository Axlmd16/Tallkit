# Plan de instalación y operación de Tallkit en el taller

Fecha base: 31 de octubre de 2026  
Actualizado con resultados de Fase 0: 20 de noviembre de 2026

## Resumen

Tallkit se instala directo en la mini PC del taller sobre **Windows 11 Pro**, sin Docker, Hyper-V ni Linux y sin costo mensual. La aplicación corre de forma nativa mediante servicios de Windows para arrancar automáticamente tras cortes de energía, incluso sin que nadie inicie sesión.

| Tema | Decisión |
| --- | --- |
| Equipo | Mini PC compartida con Windows 11 Pro y 24 GB de RAM |
| Instalación | PostgreSQL 17, backend con Waitress y Caddy como servicios de Windows (WinSW) |
| Acceso | Navegador en la mini PC y en la tablet Lenovo Android |
| HTTPS | Certificado interno generado por Caddy (`tls internal`, validado en Fase 0) |
| IP fija | Configurada manualmente en Windows; no requiere clave del router |
| Respaldos | Diarios y cifrados (AES-256), en disco USB externo y Google Drive (`rclone`) |
| Actualizaciones | Conectadas con GitHub (vía Releases/Actions o `actualizar.ps1`), sin depender de USB |
| Alcance | Solo dentro de la red local del taller; acceso externo requiere decisión aparte |

| Fase | Dónde | Criterio de paso | Estado |
| --- | --- | --- | --- |
| 0. Piloto | Mini PC y tablet | Backend corre en Windows y la tablet confía en el certificado HTTPS | **Completada (20/11/2026)** |
| 1. Preparación | Repositorio | Cambio OpenSpec aprobado e integrado en `master` (cierra `DA-003` + `ADR-0013`) | **Completada (20/11/2026)** *(en rama `develop`, pendiente merge a `master`)* |
| 2. Windows | Mini PC | Energía, cuentas, BitLocker, acceso remoto e IP fija configurados | **Completada (20/11/2026)** *(IP fija provisional por Wi-Fi hasta conectar cable UTP)* |
| 3. Servicios | Mini PC | Servicios registrados con WinSW; health check responde tras reinicio sin sesión | Pendiente |
| 4. Certificado | Mini PC y tablet | Ambos equipos muestran conexión segura sin advertencias y tienen acceso directo | Pendiente |
| 5. Respaldos | Mini PC y laptop | Copia cifrada en USB/Drive y restauración de prueba verificada en otro equipo | Pendiente |
| 6. Puesta en marcha | Taller | Base limpia, datos fiscales reales cargados y respaldo inicial verificado | Pendiente |

> La copia en Google Drive es la única que sobrevive a un robo o un incendio en el taller.

---

## Requisitos previos (antes de la instalación definitiva)

Guardar todas las claves fuera de la mini PC (en gestor de contraseñas y copia física para el dueño).

**Materiales**
- [ ] Cable Ethernet para conectar la mini PC al router
- [ ] Memoria USB para transferencia inicial / certificados
- [ ] Disco USB externo para respaldos locales
- [ ] Cuenta de Google Drive del cliente para copia fuera del taller
- [ ] UPS pequeño (opcional, recomendado)

**Datos del cliente**
- [ ] RUC comercial definitivo (el de desarrollo es provisional)
- [ ] Datos tributarios y logo de cada entidad fiscal (RUC comercial y RUC artesanal)
- [ ] Lista de personas que usarán el sistema con su rol (`ADMINISTRADOR`, `VENDEDOR`, `ENCARGADO_TALLER`)
- [ ] Catálogo inicial de productos, servicios y existencias

**Confirmaciones con el dueño**
- [ ] La tablet se usará solo dentro del taller
- [ ] El guardia no tendrá usuario en Tallkit (no existe rol de solo lectura)
- [ ] Intentar conseguir la clave del router con el proveedor (no bloquea la instalación)

---

## Fase 0: Piloto en la mini PC *(Completada el 20/11/2026)*

El piloto validó la viabilidad técnica en Windows 11 Pro y la aceptación del certificado de Caddy en la tablet Lenovo Android.

### Resultados observados
- **Backend en Windows (`uv` + Python 3.13 + PostgreSQL 19):** Se ejecutó `pytest` sobre `C:\Tallkit-piloto\backend` con **3,337 pruebas aprobadas** (92.91 % de cobertura) y 4 fallos menores no bloqueantes:
  - `test_only_published_customer_interfaces_are_imported_by_other_modules`: diferencia de separador de rutas Windows (`\`) frente a POSIX (`/`).
  - `test_summary_stays_within_the_response_budget`: presupuesto de milisegundos en entorno piloto.
  - 2 fallos menores en `tests/workshop/` asociados al estado en desarrollo de la rama.
- **Waitress + Caddy:**
  - En Waitress, `--trusted-proxy-headers` en Windows espera valores separados por espacio entre comillas (`--trusted-proxy-headers="x-forwarded-proto x-forwarded-for"`), no por coma.
  - `config/settings/production.py` ya cuenta con `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")`.
  - Caddy v2 sirvió el frontend compilado (`frontend/dist`) y enrutó `/api/*`, `/admin/*` y `/static/*` hacia `127.0.0.1:8000`.
- **Certificado HTTPS (`root.crt`):**
  - Instalado en Windows y como Certificado de CA en la tablet Lenovo Android.
  - Tanto la mini PC como Google Chrome en la tablet mostraron **conexión segura** sobre `https://192.168.110.116` sin advertencias de privacidad.

---

## Fase 1: Preparación en el repositorio

Esta fase convierte el piloto en una instalación repetible mediante OpenSpec (cambio sugerido: `instalar-en-windows-local`), cerrando `DA-003` en `docs/negocio/decisiones/decisiones-confirmadas.yaml` y creando `ADR-0013`.

| Entregable | Qué incluye |
| --- | --- |
| Decisión y ADR | Cerrar `DA-003` y crear `ADR-0013` |
| Backend | Añadir `waitress` a `pyproject.toml` y actualizar `uv.lock` (manteniendo `gunicorn` para Docker) |
| Sesiones | Cierre de sesión por inactividad configurable |
| Instalador | `infra/windows/instalar.ps1` con la IP como parámetro |
| Servicios | Configuración de [WinSW](https://github.com/winsw/winsw) para backend (Waitress) y Caddy bajo cuenta sin privilegios |
| Caddy | Plantilla de `Caddyfile` |
| Operación | `respaldar.ps1`, `restaurar.ps1`, `actualizar.ps1` y `verificar.ps1` |
| Actualización vía GitHub | Flujo conectado con GitHub (GitHub Actions/Releases o descarga directa) para que `actualizar.ps1` actualice sin usar USB |
| Configuración | `.env.windows.example` sin secretos |
| CI | Trabajo de CI en Windows para el backend (detectando incompatibilidades como separadores de ruta) |
| Documentación | `README.md`, arquitectura, diagramas C4, trazabilidad y glosarios |

Detalles obligatorios del instalador y scripts:
- Fijar explícitamente `DJANGO_SETTINGS_MODULE=config.settings.production`.
- Preservar `.env` y `C:\Tallkit\datos\fotos` intactos durante cualquier actualización.
- Corregir en `tests/customer_registry/test_module_boundary.py` el uso de `.as_posix()` para compatibilidad con Windows.

---

## Fase 2: Preparar Windows en la mini PC *(Completada el 20/11/2026)*

1. **Energía y arranque**
   - [ ] En la BIOS, activar encendido automático al volver la luz (*Restore on AC Power Loss*).
   - [ ] Desactivar suspensión e hibernación:
     ```powershell
     powercfg /change standby-timeout-ac 0
     powercfg /change hibernate-timeout-ac 0
     ```
   - [ ] Probar un corte real de corriente y verificar encendido automático.

2. **Cuentas de Windows**
   | Cuenta | Tipo | Propósito |
   | --- | --- | --- |
   | `Administrador` | Administrador (con contraseña) | Instalación, actualizaciones y soporte |
   | `Secretaria` | Estándar | Uso diario de Tallkit |
   | `Guardia` | Estándar | Juegos (League of Legends), videos y música |
   - [ ] Crear las tres cuentas sin inicio de sesión automático.
   - [ ] Instalar League of Legends en `Guardia` y verificar que Riot Vanguard no afecte el arranque ni los servicios de fondo.
   - [ ] Verificar que `Guardia` no pueda abrir `C:\Tallkit`.

3. **Disco cifrado**
   - [ ] Activar BitLocker (Windows 11 Pro) y guardar la clave de recuperación fuera de la mini PC.
   - [ ] Comprobar que reinicia sin pedir clave de BitLocker antes de cargar Windows (TPM automático).

4. **Red e IP fija**
   - [ ] Conectar cable Ethernet, etiquetarlo («No desconectar») y apagar el Wi-Fi de la mini PC.
   - [ ] Elegir una IP alta dentro del rango de la red (ej. `192.168.110.250`), confirmar con `ping` que está libre y configurarla como IP manual en Windows (DNS `1.1.1.1`).
   - [ ] Marcar la red Ethernet como **Privada**.

5. **Windows Update y soporte remoto**
   - [ ] Configurar horas activas de `07:00` a `23:00` y verificar que la conexión no sea de uso medido.
   - [ ] Instalar herramienta de soporte remoto (ej. RustDesk o Tailscale) en la cuenta `Administrador`.

---

## Fase 3: Instalar los servicios definitivos

Estructura de directorios en `C:\Tallkit`:

| Carpeta | Contenido | Permisos NTFS |
| --- | --- | --- |
| `C:\Tallkit\app` | Versión actual: backend, frontend compilado y `.env` | Administradores y cuenta del servicio |
| `C:\Tallkit\datos\fotos` | Fotografías privadas de mantenimientos y logos | Administradores y cuenta del servicio |
| `C:\Tallkit\caddy` | `caddy.exe`, `Caddyfile` y certificados | Administradores y cuenta del servicio |
| `C:\Tallkit\respaldos` | Respaldos cifrados locales | Solo administradores |

Pasos:
1. Instalar PostgreSQL 17 dejando `listen_addresses = 'localhost'` y verificar `pg_hba.conf` restringido a `127.0.0.1/32` y `::1/128`.
2. Crear usuario y base de datos `tallkit` con contraseña generada.
3. Crear `C:\Tallkit\app\.env`:
   - `DATABASE_URL=postgresql://tallkit:CLAVE@127.0.0.1:5432/tallkit`
   - `DJANGO_SECRET_KEY=<clave-larga-aleatoria>`
   - `DJANGO_ALLOWED_HOSTS=<IP_FIJA>,localhost,127.0.0.1`
   - `DJANGO_CSRF_TRUSTED_ORIGINS=https://<IP_FIJA>`
   - `APP_TIME_ZONE=America/Guayaquil`
   - `PRIVATE_MEDIA_ROOT=C:\Tallkit\datos\fotos`
   - `LOG_LEVEL=INFO`
4. Ejecutar `.\instalar.ps1 -Ip <IP_FIJA>` como Administrador (instala `uv sync --frozen --no-dev`, aplica `migrate` y `collectstatic`, registra servicios WinSW, abre puerto 443 solo en perfil Privado y restringe permisos NTFS).
5. Verificar que `https://<IP_FIJA>/api/v1/health/` responde tras reiniciar **sin iniciar sesión**, y que el puerto `5432` no es accesible desde la red.

---

## Fase 4: Certificado definitivo y accesos directos

1. Instalar `root.crt` (nunca `root.key`) en Windows con `certutil -addstore -f Root C:\ruta\root.crt`.
2. Instalar `root.crt` en la tablet Lenovo Android (*Ajustes → Seguridad → Cifrado y credenciales → Instalar certificado → Certificado de CA*).
3. En Chrome de la tablet: **Añadir a la pantalla de inicio**.
4. En la cuenta `Secretaria` de la mini PC: crear acceso directo en el escritorio hacia `https://<IP_FIJA>`.

---

## Fase 5: Respaldos y restauración

Qué respalda `respaldar.ps1` en un solo conjunto cifrado (AES-256):
- Base de datos (`pg_dump` formato custom)
- `C:\Tallkit\datos\fotos`
- `.env`
- Carpeta de datos de Caddy (para conservar la CA raíz `root.crt` / `root.key`)

Programación y retención:
- Tarea diaria a las `18:30` («tanto si el usuario inició sesión como si no» + «ejecutar lo antes posible si se perdió un inicio programado»).
- Copia al disco USB externo (letra fija) y a Google Drive con `rclone`.
- Retención inicial: 7 diarios, 4 semanales, 3 mensuales.
- Registro de fecha, resultado y tamaño (`RNF-DIS-006`).
- Tarea diaria de limpieza con `purge_workshop_files` y `purge_entity_logos`.

**Prueba obligatoria antes de producción:**
1. Crear datos de prueba con foto en la mini PC y ejecutar respaldo.
2. Descargar la copia desde Google Drive en otra computadora (laptop Linux).
3. Descifrar, restaurar con `pg_restore` (versión igual o superior a la de la mini PC, PostgreSQL 19), levantar con el `.env` restaurado y verificar datos, fotos y conciliaciones (`reconcile_inventory`, `reconcile_sales`, `reconcile_proformas`).

---

## Fase 6: Puesta en marcha

1. Limpiar los datos de prueba de la Fase 5.
2. Crear el primer Administrador con `createsuperuser`.
3. Configurar las dos entidades fiscales (RUC comercial definitivo y RUC artesanal), logos e impuestos.
4. Crear usuarios reales y cargar catálogo, servicios y existencias iniciales.
5. Ensayo completo de punta a punta: cliente/vehículo, proforma A4, venta confirmada/cobrada y mantenimiento con foto desde la tablet.
6. Ejecutar respaldo manual a USB y Google Drive.
7. Capacitar a la secretaria (inicio, cierre de turno, no apagar sin necesidad) y entregar copias de las claves (BitLocker y cifrado de respaldos) al dueño.

---

## Operación continua y actualizaciones

### Flujo de actualización (vía GitHub)
1. Publicar cambios en `master` / tag de versión en GitHub.
2. En un horario sin uso (noche), conectarse por soporte remoto y ejecutar `actualizar.ps1`.
3. El script ejecuta en orden: respaldo preventivo → detener servicios → descargar/actualizar código y frontend compilado sin tocar `.env` ni fotos → `uv sync --frozen --no-dev` → `migrate` → `collectstatic` → iniciar servicios → chequeo de salud (`/api/v1/health/`).

### Revisiones periódicas

| Frecuencia | Qué revisar |
| --- | --- |
| Mensual | Registro de respaldos, espacio en disco USB y Google Drive |
| Mensual | Conciliaciones `reconcile_inventory`, `reconcile_sales` y `reconcile_proformas` |
| Trimestral | Prueba de restauración en otra computadora (`RNF-DIS-005`) |
| Trimestral | Actualizaciones menores de PostgreSQL, Caddy y Windows |
| Anual | Estado físico del disco USB y vigencia de claves de recuperación |
