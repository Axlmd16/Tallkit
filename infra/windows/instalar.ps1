<#
.SYNOPSIS
    Instala o reconfigura Tallkit en Windows 11 Pro como servicios nativos con WinSW y Caddy.
.PARAMETER Ip
    Dirección IP fija asignada a la mini PC en la red local (obligatoria).
.PARAMETER Paquete
    Ruta opcional a un archivo .zip de versión (tallkit-vX.Y.Z.zip) para extraer en C:\Tallkit\app.
.PARAMETER ServiceAccount
    Cuenta local de Windows sin privilegios administrativos para ejecutar los servicios (por defecto .\tallkit-svc).
.PARAMETER ServicePassword
    Contraseña de la cuenta de servicio (SecureString). Si la cuenta no existe, se crea automáticamente.
.PARAMETER PgBinPath
    Ruta opcional al directorio bin de PostgreSQL. Si se omite, se detecta la versión instalada más reciente.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Ip,

    [string]$Paquete = "",

    [string]$Version = "latest",

    [string]$Repo = "Axlmd16/Tallkit",

    [string]$ServiceAccount = ".\tallkit-svc",

    [SecureString]$ServicePassword,

    [string]$PgBinPath = ""
)

$ErrorActionPreference = "Stop"

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Este script debe ejecutarse en PowerShell como Administrador."
    }
}

function Resolve-PgBinPath {
    param([string]$ExplicitPath)
    if ($ExplicitPath -and (Test-Path (Join-Path $ExplicitPath "pg_dump.exe"))) {
        return $ExplicitPath
    }
    $candidates = Get-ChildItem -Path "C:\Program Files\PostgreSQL\*\bin" -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Parent.Name -replace '[^\d]', '') } -Descending
    foreach ($dir in $candidates) {
        if (Test-Path (Join-Path $dir.FullName "pg_dump.exe")) {
            return $dir.FullName
        }
    }
    throw "No se encontró PostgreSQL en C:\Program Files\PostgreSQL\*\bin. Especifique -PgBinPath."
}

function Set-RestrictedAcl {
    param(
        [string]$Path,
        [System.Security.Principal.SecurityIdentifier[]]$AllowedSids
    )
    $acl = Get-Acl -Path $Path
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) {
        $acl.RemoveAccessRule($rule) | Out-Null
    }
    foreach ($sid in $AllowedSids) {
        $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
            $sid,
            [System.Security.AccessControl.FileSystemRights]::FullControl,
            [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit,
            [System.Security.AccessControl.PropagationFlags]::None,
            [System.Security.AccessControl.AccessControlType]::Allow
        )
        $acl.AddAccessRule($rule)
    }
    Set-Acl -Path $Path -AclObject $acl
}

Assert-Administrator

$BaseDir = "C:\Tallkit"
$AppDir = Join-Path $BaseDir "app"
$DataDir = Join-Path $BaseDir "datos\fotos"
$CaddyDir = Join-Path $BaseDir "caddy"
$BackupDir = Join-Path $BaseDir "respaldos"
$LogsDir = Join-Path $BaseDir "logs"

foreach ($dir in @($BaseDir, $AppDir, $DataDir, $CaddyDir, "$CaddyDir\data", "$CaddyDir\config", $BackupDir, "$LogsDir\backend", "$LogsDir\caddy")) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$pgBin = Resolve-PgBinPath -ExplicitPath $PgBinPath
Write-Host "PostgreSQL detectado en: $pgBin"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "No se encontró 'uv' en el PATH. Instálelo antes de continuar."
}
if (-not (Test-Path (Join-Path $CaddyDir "caddy.exe"))) {
    throw "No se encontró caddy.exe en $CaddyDir."
}

$winswBackend = Join-Path $BaseDir "winsw-backend.exe"
$winswCaddy = Join-Path $BaseDir "winsw-caddy.exe"
if (-not (Test-Path $winswBackend) -or -not (Test-Path $winswCaddy)) {
    throw "Coloque WinSW (winsw-backend.exe y winsw-caddy.exe) en $BaseDir antes de ejecutar instalar.ps1."
}

$tempDownload = ""
try {
    if (-not $Paquete -and -not (Test-Path (Join-Path $AppDir "backend"))) {
        $apiUrl = if ($Version -eq "latest") {
            "https://api.github.com/repos/$Repo/releases/latest"
        } else {
            "https://api.github.com/repos/$Repo/releases/tags/$Version"
        }
        Write-Host "Descargando release desde GitHub ($apiUrl)..."
        $release = Invoke-RestMethod -Uri $apiUrl -Headers @{ "User-Agent" = "Tallkit-Installer" }
        $asset = $release.assets | Where-Object { $_.name -like "tallkit-*.zip" } | Select-Object -First 1
        if (-not $asset) {
            throw "No se encontró un archivo tallkit-*.zip en el release $($release.tag_name)."
        }
        $tempDownload = Join-Path $env:TEMP $asset.name
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tempDownload
        $Paquete = $tempDownload
    }

    if ($Paquete) {
        if (-not (Test-Path $Paquete)) {
            throw "No existe el paquete indicado: $Paquete"
        }
        $tempExtract = Join-Path $env:TEMP "tallkit-install-$(Get-Date -Format 'yyyyMMddHHmmss')"
        Expand-Archive -Path $Paquete -DestinationPath $tempExtract -Force
        foreach ($sub in @("backend", "web", "infra")) {
            $srcSub = Join-Path $tempExtract $sub
            $dstSub = Join-Path $AppDir $sub
            if (Test-Path $srcSub) {
                if (Test-Path $dstSub) { Remove-Item -Path $dstSub -Recurse -Force }
                Copy-Item -Path $srcSub -Destination $dstSub -Recurse -Force
            }
        }
        Remove-Item -Path $tempExtract -Recurse -Force
    }
}
finally {
    if ($tempDownload -and (Test-Path $tempDownload)) {
        Remove-Item -Path $tempDownload -Force -ErrorAction SilentlyContinue
    }
}

$envFile = Join-Path $AppDir ".env"
if (-not (Test-Path $envFile)) {
    throw "Falta $envFile. Copie infra/windows/.env.windows.example a $envFile y complete las claves."
}

$backendDir = Join-Path $AppDir "backend"
if (-not (Test-Path $backendDir)) {
    throw "No se encontró $backendDir."
}

# Crear cuenta de servicio sin privilegios si no existe
$localAccountName = ($ServiceAccount -replace '^\.\\', '')
if (-not (Get-LocalUser -Name $localAccountName -ErrorAction SilentlyContinue)) {
    if (-not $ServicePassword) {
        $ServicePassword = Read-Host "Ingrese contraseña para la nueva cuenta de servicio $localAccountName" -AsSecureString
    }
    New-LocalUser -Name $localAccountName -Password $ServicePassword -PasswordNeverExpires -UserMayNotChangePassword -Description "Cuenta de servicio sin privilegios para Tallkit" | Out-Null
}

# Permisos NTFS restrictivos usando SIDs universales (compatibles con Windows en español e inglés)
$adminsSid = [System.Security.Principal.SecurityIdentifier]::new("S-1-5-32-544")
$systemSid = [System.Security.Principal.SecurityIdentifier]::new("S-1-5-18")
$svcSid = (Get-LocalUser -Name $localAccountName).SID

Set-RestrictedAcl -Path $AppDir -AllowedSids @($adminsSid, $systemSid, $svcSid)
Set-RestrictedAcl -Path $DataDir -AllowedSids @($adminsSid, $systemSid, $svcSid)
Set-RestrictedAcl -Path $CaddyDir -AllowedSids @($adminsSid, $systemSid, $svcSid)
Set-RestrictedAcl -Path $LogsDir -AllowedSids @($adminsSid, $systemSid, $svcSid)
Set-RestrictedAcl -Path $BackupDir -AllowedSids @($adminsSid, $systemSid)

# Generar Caddyfile desde plantilla
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path (Join-Path $scriptDir "Caddyfile.template"))) {
    $scriptDir = Join-Path $AppDir "infra\windows"
}
$caddyTemplate = Get-Content -Path (Join-Path $scriptDir "Caddyfile.template") -Raw
$caddyContent = $caddyTemplate.Replace("{{IP}}", $Ip)
Set-Content -Path (Join-Path $CaddyDir "Caddyfile") -Value $caddyContent -Encoding UTF8

# Instalar Python y dependencias dentro de C:\Tallkit para que el servicio de Windows tenga acceso directo
$pythonInstallDir = Join-Path $BaseDir "python"
$uvCacheDir = Join-Path $BaseDir "uv-cache"
New-Item -ItemType Directory -Path $pythonInstallDir -Force | Out-Null
New-Item -ItemType Directory -Path $uvCacheDir -Force | Out-Null
Set-RestrictedAcl -Path $pythonInstallDir -AllowedSids @($adminsSid, $systemSid, $svcSid)
Set-RestrictedAcl -Path $uvCacheDir -AllowedSids @($adminsSid, $systemSid, $svcSid)

Push-Location $backendDir
try {
    $env:UV_PYTHON_INSTALL_DIR = $pythonInstallDir
    $env:UV_CACHE_DIR = $uvCacheDir
    $env:DJANGO_SETTINGS_MODULE = "config.settings.production"
    $env:PYTHONPATH = "src"
    uv python install 3.13
    uv sync --frozen --no-dev
    uv run --frozen --no-dev python manage.py migrate --noinput
    uv run --frozen --no-dev python manage.py collectstatic --noinput
}
finally {
    Pop-Location
}

# Copiar descriptores WinSW y registrar servicios
$backendXmlContent = Get-Content -Path (Join-Path $scriptDir "tallkit-backend.xml") -Raw
$backendXmlContent = $backendXmlContent -replace '<executable>uv</executable>', '<executable>C:\Tallkit\app\backend\.venv\Scripts\waitress-serve.exe</executable>'
$backendXmlContent = $backendXmlContent -replace 'run --frozen --no-dev waitress-serve ', ''
Set-Content -Path (Join-Path $BaseDir "winsw-backend.xml") -Value $backendXmlContent -Encoding UTF8
Copy-Item -Path (Join-Path $scriptDir "tallkit-caddy.xml") -Destination (Join-Path $BaseDir "winsw-caddy.xml") -Force

& $winswBackend uninstall 2>$null | Out-Null
& $winswCaddy uninstall 2>$null | Out-Null
& $winswBackend install
& $winswCaddy install

# Configurar regla de firewall solo para redes privadas
Get-NetFirewallRule -DisplayName "Tallkit HTTPS" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName "Tallkit HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -Profile Private | Out-Null

Start-Service -Name "tallkit-backend"
Start-Service -Name "tallkit-caddy"

Write-Host "Instalación completada. Verifique el estado ejecutando .\verificar.ps1 -Ip $Ip"
