<#
.SYNOPSIS
    Verifica servicios, puertos, salud HTTPS y aislamiento de PostgreSQL en Windows.
#>
[CmdletBinding()]
param(
    [string]$Ip = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

foreach ($svcName in @("tallkit-backend", "tallkit-caddy")) {
    $svc = Get-Service -Name $svcName -ErrorAction Stop
    if ($svc.Status -ne "Running") {
        throw "El servicio $svcName no está en ejecución (estado: $($svc.Status))."
    }
    Write-Host "[OK] Servicio $svcName activo."
}

$pgListeners = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
foreach ($conn in $pgListeners) {
    if ($conn.LocalAddress -notin @("127.0.0.1", "::1")) {
        throw "ALERTA: PostgreSQL escucha en dirección externa ($($conn.LocalAddress):5432)."
    }
}
Write-Host "[OK] PostgreSQL restringido a localhost (5432)."

$healthUrl = "https://$Ip/api/v1/health/"
$response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
if ($response.StatusCode -ne 200) {
    throw "Health check devolvió código $($response.StatusCode) en $healthUrl."
}
Write-Host "[OK] Health check respondió HTTP 200 en $healthUrl."
