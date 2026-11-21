# Despliegue y operación local en Windows 11 Pro

Guía operativa para instalar, respaldar, verificar y actualizar Tallkit en la mini PC del taller sin Docker ni WSL2.

## Prerrequisitos en la mini PC

1. **PostgreSQL** (17+; en la mini PC del taller se utiliza PostgreSQL 19) escuchando solo en `localhost` (`127.0.0.1:5432` y `pg_hba.conf` restringido a `127.0.0.1/32` y `::1/128`).
2. **`uv`** instalado y Python 3.13 disponible (`uv python install 3.13.14`).
3. **`caddy.exe`** en `C:\Tallkit\caddy\caddy.exe`.
4. **WinSW** copiado como `C:\Tallkit\winsw-backend.exe` y `C:\Tallkit\winsw-caddy.exe`.
5. **7-Zip** (`7z.exe`) para cifrado AES-256 de respaldos y **`rclone`** configurado con el remoto `gdrive` para copia en Google Drive.

## Instalación inicial

1. Copiar `infra/windows/.env.windows.example` a `C:\Tallkit\app\.env` y completar `DATABASE_URL`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS` y `DJANGO_CSRF_TRUSTED_ORIGINS`.
2. Ejecutar en PowerShell como Administrador:
   ```powershell
   .\instalar.ps1 -Ip 192.168.110.250 -Paquete C:\ruta\tallkit-v1.0.0.zip
   ```
3. Verificar estado:
   ```powershell
   .\verificar.ps1 -Ip 192.168.110.250
   ```

## Certificados (`root.crt`)

Caddy genera su CA local en `C:\Tallkit\caddy\data\caddy\pki\authorities\local\root.crt`.
- **En Windows:** `certutil -addstore -f Root C:\Tallkit\caddy\data\caddy\pki\authorities\local\root.crt`
- **En tablet Android:** copiar únicamente `root.crt` (nunca `root.key`) e instalarlo en *Ajustes → Seguridad → Cifrado y credenciales → Instalar certificado → Certificado de CA*.

## Respaldos y limpieza programada

1. Definir la variable de entorno del sistema o de la tarea `TALLKIT_BACKUP_KEY` con la clave de cifrado (guardada fuera de la mini PC).
2. Programar en el **Programador de tareas** de Windows (ejecutar *tanto si el usuario inició sesión como si no* y *ejecutar lo antes posible si se perdió un inicio programado*):
   - **Respaldo diario (18:30):**
     `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Tallkit\app\infra\windows\respaldar.ps1`
   - **Limpieza diaria de archivos huérfanos:**
     `uv run --frozen --no-dev python manage.py purge_workshop_files` y `purge_entity_logos` (con `DJANGO_SETTINGS_MODULE=config.settings.production`).
3. Probar la restauración en otra computadora (con `pg_restore` de versión igual o superior a la mini PC) usando `.\restaurar.ps1 -Archivo <copia.7z>`.

## Actualización desde GitHub

```powershell
.\actualizar.ps1 -Version latest -Ip 192.168.110.250
```
*(O pasando `-Paquete C:\ruta\tallkit-vX.Y.Z.zip` si se descarga manualmente).*
El script respalda antes de tocar nada, detiene servicios, reemplaza aplicación y pantallas sin sobrescribir `.env` ni `C:\Tallkit\datos\fotos`, aplica migraciones, levanta servicios y verifica `/api/v1/health/`.
