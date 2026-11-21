<#
.SYNOPSIS
    Respalda base de datos, fotos privadas, .env y datos de Caddy en un archivo cifrado AES-256.
.PARAMETER Passphrase
    Clave de cifrado AES-256 (idealmente desde variable de entorno TALLKIT_BACKUP_KEY).
.PARAMETER UsbDrive
    Letra o ruta de destino en el disco USB externo (ej. E:\Tallkit-Respaldos).
.PARAMETER RcloneRemote
    Nombre del remoto configurado en rclone para Google Drive (ej. gdrive:Tallkit-Respaldos).
.PARAMETER PgBinPath
    Ruta opcional a bin de PostgreSQL; si se omite se detecta automáticamente.
#>
[CmdletBinding()]
param(
    [string]$Passphrase = $env:TALLKIT_BACKUP_KEY,
    [string]$UsbDrive = "E:\Tallkit-Respaldos",
    [string]$RcloneRemote = "gdrive:Tallkit-Respaldos",
    [string]$PgBinPath = ""
)

$ErrorActionPreference = "Stop"

function Resolve-PgDump {
    param([string]$ExplicitPath)
    if ($ExplicitPath -and (Test-Path (Join-Path $ExplicitPath "pg_dump.exe"))) {
        return (Join-Path $ExplicitPath "pg_dump.exe")
    }
    $candidates = Get-ChildItem -Path "C:\Program Files\PostgreSQL\*\bin" -Directory -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Parent.Name -replace '[^\d]', '') } -Descending
    foreach ($dir in $candidates) {
        $exe = Join-Path $dir.FullName "pg_dump.exe"
        if (Test-Path $exe) { return $exe }
    }
    throw "No se encontró pg_dump.exe."
}

function Get-DatabaseUrlFromEnvFile {
    param([string]$EnvPath)
    foreach ($line in Get-Content -Path $EnvPath) {
        if ($line -match '^\s*DATABASE_URL\s*=\s*(.+)$') {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    throw "DATABASE_URL no encontrada en $EnvPath"
}

if (-not $Passphrase) {
    throw "Debe proporcionar -Passphrase o definir la variable de entorno TALLKIT_BACKUP_KEY."
}

$sevenZip = (Get-Command 7z -ErrorAction SilentlyContinue)?.Source
if (-not $sevenZip -and (Test-Path "C:\Program Files\7-Zip\7z.exe")) {
    $sevenZip = "C:\Program Files\7-Zip\7z.exe"
}
if (-not $sevenZip) {
    throw "No se encontró 7-Zip (7z.exe) para generar el paquete cifrado AES-256."
}

$BaseDir = "C:\Tallkit"
$EnvPath = Join-Path $BaseDir "app\.env"
$PhotosDir = Join-Path $BaseDir "datos\fotos"
$CaddyDataDir = Join-Path $BaseDir "caddy\data"
$BackupRoot = Join-Path $BaseDir "respaldos"
$LogFile = Join-Path $BackupRoot "respaldos.log"

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$stageDir = Join-Path $env:TEMP "tallkit-backup-$timestamp"
$archivePath = Join-Path $BackupRoot "tallkit-$timestamp.7z"
$partialErrors = @()

try {
    New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

    $pgDump = Resolve-PgDump -ExplicitPath $PgBinPath
    $dbUrl = Get-DatabaseUrlFromEnvFile -EnvPath $EnvPath
    $dumpFile = Join-Path $stageDir "tallkit.dump"
    & $pgDump "--dbname=$dbUrl" "--format=custom" "--file=$dumpFile"
    if ($LASTEXITCODE -ne 0) { throw "pg_dump falló con código $LASTEXITCODE." }

    Copy-Item -Path $EnvPath -Destination (Join-Path $stageDir ".env") -Force
    if (Test-Path $PhotosDir) {
        Copy-Item -Path $PhotosDir -Destination (Join-Path $stageDir "fotos") -Recurse -Force
    }
    if (Test-Path $CaddyDataDir) {
        Copy-Item -Path $CaddyDataDir -Destination (Join-Path $stageDir "caddy-data") -Recurse -Force
    }

    # Empaquetar y cifrar con AES-256 y cabeceras cifradas (-mhe=on)
    & $sevenZip a -t7z -mhe=on -mx=5 "-p$Passphrase" $archivePath "$stageDir\*" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "7z falló al cifrar el respaldo." }

    $sizeBytes = (Get-Item $archivePath).Length
    $sizeMB = [Math]::Round($sizeBytes / 1MB, 2)

    # Copia a disco USB externo
    if ($UsbDrive) {
        try {
            $usbRoot = [System.IO.Path]::GetPathRoot($UsbDrive)
            if (-not (Test-Path $usbRoot)) { throw "Unidad USB no disponible ($usbRoot)." }
            New-Item -ItemType Directory -Path $UsbDrive -Force | Out-Null
            Copy-Item -Path $archivePath -Destination (Join-Path $UsbDrive (Split-Path -Leaf $archivePath)) -Force
        }
        catch {
            $partialErrors += "USB: $($_.Exception.Message)"
        }
    }

    # Copia a Google Drive vía rclone
    if ($RcloneRemote) {
        try {
            $rclone = (Get-Command rclone -ErrorAction Stop).Source
            & $rclone copy $archivePath $RcloneRemote --quiet
            if ($LASTEXITCODE -ne 0) { throw "rclone retornó código $LASTEXITCODE." }
        }
        catch {
            $partialErrors += "Nube: $($_.Exception.Message)"
        }
    }

    # Retención local: conservar 7 diarios, 4 semanales (domingos) y 3 mensuales (día 1)
    $allBackups = Get-ChildItem -Path $BackupRoot -Filter "tallkit-*.7z" | Sort-Object CreationTime -Descending
    $keep = [System.Collections.Generic.HashSet[string]]::new()
    $allBackups | Select-Object -First 7 | ForEach-Object { [void]$keep.Add($_.FullName) }
    $allBackups | Where-Object { $_.CreationTime.DayOfWeek -eq [DayOfWeek]::Sunday } | Select-Object -First 4 | ForEach-Object { [void]$keep.Add($_.FullName) }
    $allBackups | Where-Object { $_.CreationTime.Day -eq 1 } | Select-Object -First 3 | ForEach-Object { [void]$keep.Add($_.FullName) }
    foreach ($old in $allBackups) {
        if (-not $keep.Contains($old.FullName)) {
            Remove-Item -Path $old.FullName -Force
        }
    }

    $status = if ($partialErrors.Count -eq 0) { "EXITO" } else { "PARCIAL ($($partialErrors -join '; '))" }
    $logLine = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | $status | $sizeMB MB | $archivePath"
    Add-Content -Path $LogFile -Value $logLine -Encoding UTF8

    if ($partialErrors.Count -gt 0) {
        Write-Warning $logLine
        exit 2
    }
    Write-Host $logLine
}
catch {
    $errLine = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | ERROR | 0 MB | $($_.Exception.Message)"
    Add-Content -Path $LogFile -Value $errLine -Encoding UTF8
    throw
}
finally {
    if (Test-Path $stageDir) {
        Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
