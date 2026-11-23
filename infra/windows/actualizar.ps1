<#
.SYNOPSIS
    Actualiza Tallkit a una nueva versión desde GitHub Releases o paquete .zip local.
.PARAMETER Version
    Etiqueta de versión en GitHub Releases (ej. v1.2.0 o "latest").
.PARAMETER Repo
    Repositorio GitHub en formato propietario/nombre (por defecto Axlmd16/Tallkit).
.PARAMETER Paquete
    Ruta local opcional a un archivo .zip ya descargado (omite descarga de GitHub).
.PARAMETER Ip
    IP local del servidor para verificar /api/v1/health/ al finalizar.
.PARAMETER Passphrase
    Clave de cifrado para el respaldo preventivo obligatorio (o TALLKIT_BACKUP_KEY).
#>
[CmdletBinding()]
param(
    [string]$Version = "latest",
    [string]$Repo = "Axlmd16/Tallkit",
    [string]$Paquete = "",
    [string]$Ip = "127.0.0.1",
    [string]$Passphrase = $env:TALLKIT_BACKUP_KEY
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir = "C:\Tallkit"
$AppDir = Join-Path $BaseDir "app"
$tempDownload = ""
$tempExtract = ""

try {
    # 1. Resolver paquete (desde GitHub Releases o archivo local)
    if (-not $Paquete) {
        $apiUrl = if ($Version -eq "latest") {
            "https://api.github.com/repos/$Repo/releases/latest"
        } else {
            "https://api.github.com/repos/$Repo/releases/tags/$Version"
        }
        Write-Host "Consultando versión en GitHub: $apiUrl"
        $release = Invoke-RestMethod -Uri $apiUrl -Headers @{ "User-Agent" = "Tallkit-Updater" }
        $asset = $release.assets | Where-Object { $_.name -like "tallkit-*.zip" } | Select-Object -First 1
        if (-not $asset) {
            throw "No se encontró un archivo tallkit-*.zip en el release $($release.tag_name)."
        }
        $tempDownload = Join-Path $env:TEMP $asset.name
        Write-Host "Descargando $($asset.name)..."
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tempDownload
        $Paquete = $tempDownload
    }

    if (-not (Test-Path $Paquete)) {
        throw "No existe el paquete: $Paquete"
    }

    # 2. Respaldo preventivo obligatorio
    Write-Host "Ejecutando respaldo preventivo obligatorio..."
    & (Join-Path $scriptDir "respaldar.ps1") -Passphrase $Passphrase

    # 3. Detener servicios
    Write-Host "Deteniendo servicios de Tallkit..."
    Stop-Service -Name "tallkit-caddy" -Force -ErrorAction SilentlyContinue
    Stop-Service -Name "tallkit-backend" -Force -ErrorAction SilentlyContinue

    # 4. Extraer y reemplazar backend y web preservando .env y datos
    $tempExtract = Join-Path $env:TEMP "tallkit-update-$(Get-Date -Format 'yyyyMMddHHmmss')"
    Expand-Archive -Path $Paquete -DestinationPath $tempExtract -Force

    foreach ($sub in @("backend", "web", "infra")) {
        $srcSub = Join-Path $tempExtract $sub
        if (-not (Test-Path $srcSub)) {
            if ($sub -eq "infra") { continue }
            throw "El paquete no contiene la carpeta esperada '$sub'."
        }
        $dstSub = Join-Path $AppDir $sub
        if (Test-Path $dstSub) { Remove-Item -Path $dstSub -Recurse -Force }
        Copy-Item -Path $srcSub -Destination $dstSub -Recurse -Force
    }

    # 5. Dependencias, migraciones y estáticos
    $backendDir = Join-Path $AppDir "backend"
    Push-Location $backendDir
    try {
        $env:UV_PYTHON_INSTALL_DIR = Join-Path $BaseDir "python"
        $env:UV_CACHE_DIR = Join-Path $BaseDir "uv-cache"
        $env:DJANGO_SETTINGS_MODULE = "config.settings.production"
        $env:PYTHONPATH = "src"
        uv sync --frozen --no-dev
        uv run --frozen --no-dev python manage.py migrate --noinput
        uv run --frozen --no-dev python manage.py collectstatic --noinput
    }
    finally {
        Pop-Location
    }

    # 6. Iniciar servicios y verificar salud
    Start-Service -Name "tallkit-backend"
    Start-Service -Name "tallkit-caddy"
    Start-Sleep -Seconds 3

    & (Join-Path $scriptDir "verificar.ps1") -Ip $Ip
    Write-Host "Actualización completada con éxito."
}
finally {
    if ($tempDownload -and (Test-Path $tempDownload)) { Remove-Item -Path $tempDownload -Force -ErrorAction SilentlyContinue }
    if ($tempExtract -and (Test-Path $tempExtract)) { Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue }
}
