<#
.SYNOPSIS
    Descifra un respaldo de Tallkit y restaura PostgreSQL, fotos privadas, .env y datos de Caddy.
.PARAMETER Archivo
    Ruta al archivo .7z cifrado a restaurar.
.PARAMETER Passphrase
    Clave de cifrado del respaldo (o TALLKIT_BACKUP_KEY).
.PARAMETER DatabaseUrl
    Cadena de conexión PostgreSQL de destino (por defecto se toma del .env restaurado).
.PARAMETER PgBinPath
    Ruta opcional a bin de PostgreSQL (igual o superior a la versión de origen).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Archivo,

    [string]$Passphrase = $env:TALLKIT_BACKUP_KEY,

    [string]$DatabaseUrl = "",

    [string]$PgBinPath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-PgRestore {
    param([string]$ExplicitPath)
    if ($ExplicitPath -and (Test-Path (Join-Path $ExplicitPath "pg_restore.exe"))) {
        return (Join-Path $ExplicitPath "pg_restore.exe")
    }
    $candidates = Get-ChildItem -Path "C:\Program Files\PostgreSQL\*\bin" -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Parent.Name -replace '[^\d]', '') } -Descending
    foreach ($dir in $candidates) {
        $exe = Join-Path $dir.FullName "pg_restore.exe"
        if (Test-Path $exe) { return $exe }
    }
    throw "No se encontró pg_restore.exe."
}

if (-not (Test-Path $Archivo)) { throw "No existe el archivo de respaldo: $Archivo" }
if (-not $Passphrase) { throw "Debe indicar -Passphrase o TALLKIT_BACKUP_KEY." }

$sevenZip = (Get-Command 7z -ErrorAction SilentlyContinue)?.Source
if (-not $sevenZip -and (Test-Path "C:\Program Files\7-Zip\7z.exe")) {
    $sevenZip = "C:\Program Files\7-Zip\7z.exe"
}
if (-not $sevenZip) { throw "No se encontró 7z.exe." }

$stageDir = Join-Path $env:TEMP "tallkit-restore-$(Get-Date -Format 'yyyyMMddHHmmss')"
try {
    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null
    & $sevenZip x $Archivo "-o$stageDir" "-p$Passphrase" -y | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No se pudo descifrar el respaldo (clave incorrecta o archivo dañado)." }

    $BaseDir = "C:\Tallkit"
    $envRestored = Join-Path $stageDir ".env"
    if (Test-Path $envRestored) {
        New-Item -ItemType Directory -Path (Join-Path $BaseDir "app") -Force | Out-Null
        Copy-Item -Path $envRestored -Destination (Join-Path $BaseDir "app\.env") -Force
    }

    if (-not $DatabaseUrl -and (Test-Path $envRestored)) {
        foreach ($line in Get-Content -Path $envRestored) {
            if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)$') {
                $DatabaseUrl = $Matches[1].Trim().Trim('"').Trim("'")
                break
            }
        }
    }
    if (-not $DatabaseUrl) { throw "No se pudo determinar DATABASE_URL para restaurar." }

    $pgRestore = Resolve-PgRestore -ExplicitPath $PgBinPath
    $dumpFile = Join-Path $stageDir "tallkit.dump"
    & $pgRestore "--clean" "--if-exists" "--no-owner" "--no-privileges" "--dbname=$DatabaseUrl" $dumpFile
    if ($LASTEXITCODE -ne 0) { throw "pg_restore falló con código $LASTEXITCODE." }

    $fotosSrc = Join-Path $stageDir "fotos"
    if (Test-Path $fotosSrc) {
        $fotosDst = Join-Path $BaseDir "datos\fotos"
        New-Item -ItemType Directory -Path $fotosDst -Force | Out-Null
        Copy-Item -Path "$fotosSrc\*" -Destination $fotosDst -Recurse -Force
    }

    $caddySrc = Join-Path $stageDir "caddy-data"
    if (Test-Path $caddySrc) {
        $caddyDst = Join-Path $BaseDir "caddy\data"
        New-Item -ItemType Directory -Path $caddyDst -Force | Out-Null
        Copy-Item -Path "$caddySrc\*" -Destination $caddyDst -Recurse -Force
    }

    Write-Host "Restauración completada con éxito desde $Archivo."
}
finally {
    if (Test-Path $stageDir) {
        Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
