[CmdletBinding()]
param(
  [string]$GeoServerHome = 'C:\GeoServer',
  [string]$GeoServerSeedData = 'C:\GeoServer_data',
  [int]$Port = 8081
)

$ErrorActionPreference = 'Stop'

# This script starts an isolated GeoServer instance for this project only.
# It never edits the existing server data directory or the shared port 8080.
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectData = Join-Path $projectRoot 'geoserver-data'
$restBase = "http://127.0.0.1:$Port/geoserver/rest"
$webUrl = "http://127.0.0.1:$Port/geoserver/web/"
$workspace = 'maechaem'
$styleName = 'brr_recovery'

if (-not (Test-Path -LiteralPath $GeoServerHome)) {
  throw "GeoServer was not found at $GeoServerHome"
}

if (-not (Test-Path -LiteralPath $projectData)) {
  if (-not (Test-Path -LiteralPath $GeoServerSeedData)) {
    throw "GeoServer seed data was not found at $GeoServerSeedData"
  }

  Write-Host 'Creating the project-only GeoServer data directory...'
  Copy-Item -LiteralPath $GeoServerSeedData -Destination $projectData -Recurse
}

if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) {
  $java = (Get-Command java -ErrorAction Stop).Source
  # Override this environment variable only for the child process. The existing
  # GeoServer on port 8080 keeps its own data directory unchanged.
  $env:GEOSERVER_DATA_DIR = $projectData
  $arguments = @(
    "-DGEOSERVER_DATA_DIR=$projectData",
    '-Djava.awt.headless=true',
    # This project only serves six small classified TIFFs. Keep the local
    # GeoServer heap deliberately small so it can run beside VS Code and Vite.
    '-Xms128m',
    '-Xmx512m',
    '-XX:MaxMetaspaceSize=256m',
    '-XX:MaxDirectMemorySize=128m',
    '-DSTOP.PORT=8078',
    '-DSTOP.KEY=maechaem-local',
    '-jar',
    (Join-Path $GeoServerHome 'start.jar'),
    "jetty.http.port=$Port"
  )

  Write-Host "Starting project-only GeoServer on port $Port..."
  Start-Process -FilePath $java -ArgumentList $arguments -WorkingDirectory $GeoServerHome -WindowStyle Hidden
}

$deadline = (Get-Date).AddSeconds(80)
do {
  try {
    $health = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 4
    if ($health.StatusCode -eq 200) { break }
  } catch {
    Start-Sleep -Seconds 2
  }
} while ((Get-Date) -lt $deadline)

if (-not $health -or $health.StatusCode -ne 200) {
  throw "GeoServer on port $Port did not become ready. Please run this command again in a moment."
}

# Credentials apply only to the copied, project-local data directory.
$token = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes('admin:geoserver'))
$headers = @{ Authorization = "Basic $token" }

function Get-StatusCode([object]$ErrorRecord) {
  try { return [int]$ErrorRecord.Exception.Response.StatusCode } catch { return -1 }
}

function Invoke-GeoServerRequest {
  param(
    [Parameter(Mandatory)] [string]$Method,
    [Parameter(Mandatory)] [string]$Path,
    [string]$Body,
    [string]$ContentType,
    [string]$InFile
  )

  $request = @{
    Uri = "$restBase/$Path"
    Method = $Method
    Headers = $headers
    UseBasicParsing = $true
    ErrorAction = 'Stop'
  }
  if ($Body) { $request.Body = $Body }
  if ($ContentType) { $request.ContentType = $ContentType }
  if ($InFile) { $request.InFile = $InFile }

  Invoke-WebRequest @request
}

try {
  Invoke-GeoServerRequest -Method GET -Path "workspaces/$workspace.xml" | Out-Null
} catch {
  if ((Get-StatusCode $_) -ne 404) { throw }
  Invoke-GeoServerRequest -Method POST -Path 'workspaces' `
    -ContentType 'text/xml' `
    -Body "<workspace><name>$workspace</name></workspace>" | Out-Null
}

$styleFile = Join-Path $PSScriptRoot 'brr-recovery.sld'
try {
  Invoke-GeoServerRequest -Method GET -Path "workspaces/$workspace/styles/$styleName.sld" | Out-Null
} catch {
  if ((Get-StatusCode $_) -ne 404) { throw }
  Invoke-GeoServerRequest -Method POST -Path "workspaces/$workspace/styles?name=$styleName" `
    -ContentType 'application/vnd.ogc.sld+xml' `
    -InFile $styleFile | Out-Null
}

foreach ($year in 2563..2568) {
  $store = "brr_recovery_$year"
  $tiff = Join-Path $projectRoot "public\data\MaeCham_BRR_RecoveryClass_$year.tif"

  if (-not (Test-Path -LiteralPath $tiff)) {
    throw "BRR GeoTIFF for year $year was not found at $tiff"
  }

  try {
    Invoke-GeoServerRequest -Method GET -Path "workspaces/$workspace/coveragestores/$store.xml" | Out-Null
  } catch {
    if ((Get-StatusCode $_) -ne 404) { throw }
    Write-Host "Registering BRR layer for year $year..."
    Invoke-GeoServerRequest -Method PUT `
      -Path "workspaces/$workspace/coveragestores/$store/file.geotiff?configure=first&coverageName=$store" `
      -ContentType 'image/tiff' `
      -InFile $tiff | Out-Null
  }

  $layerBody = "<layer><defaultStyle><workspace>$workspace</workspace><name>$styleName</name></defaultStyle></layer>"
  Invoke-GeoServerRequest -Method PUT -Path "layers/$workspace`:$store" `
    -ContentType 'text/xml' `
    -Body $layerBody | Out-Null
}

Write-Host ''
Write-Host 'Ready: project-only GeoServer is available at' $webUrl -ForegroundColor Green
Write-Host 'The React app can now use localhost:' $Port 'for BRR swipe comparison.' -ForegroundColor Green
