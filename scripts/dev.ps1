# Chay moi truong dev local: PostgreSQL + S3Mock (Docker) va 3 app Next.js (api 3002, admin 3001, website 3000),
# moi app mot cua so/tab rieng de xem log.
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1              chay tat ca
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -Analytics   them Umami (cong 3005, ton them RAM)
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -NoDocker    bo qua Docker (DB/S3 da chay san)
#   powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -Stop        dung 3 app va container db/storage (khong xoa du lieu)
# Chu khong dau: Windows PowerShell 5.1 doc sai file .ps1 UTF-8 khong BOM.
param(
  [switch]$Analytics,
  [switch]$NoDocker,
  [switch]$Stop
)

# Khong dung "Stop": PowerShell 5.1 bien stderr cua lenh native (docker, taskkill) thanh loi dung script.
# Moi buoc tu kiem $LASTEXITCODE.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$services = @(
  @{ Name = "api"; Port = 3002; Script = "dev:api"; Url = "http://localhost:3002/api/health" },
  @{ Name = "admin"; Port = 3001; Script = "dev:admin"; Url = "http://localhost:3001/admin" },
  @{ Name = "website"; Port = 3000; Script = "dev"; Url = "http://localhost:3000" }
)

function Write-Step($message) { Write-Host "==> $message" -ForegroundColor Cyan }
function Get-ListeningPid($port) {
  $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($connection) { return $connection.OwningProcess }
  return $null
}
function Test-DockerEngine {
  & docker info *> $null
  return $LASTEXITCODE -eq 0
}

if ($Stop) {
  foreach ($service in $services) {
    $processId = Get-ListeningPid $service.Port
    if ($processId) {
      # Dung ca cay tien trinh (pnpm -> next) dang giu cong.
      & taskkill /PID $processId /T /F *> $null
      Write-Host "Da dung $($service.Name) (cong $($service.Port))."
    } else {
      Write-Host "$($service.Name) khong chay."
    }
  }
  if (-not $NoDocker -and (Get-Command docker -ErrorAction SilentlyContinue) -and (Test-DockerEngine)) {
    Write-Step "Dung container (giu nguyen volume du lieu)"
    & docker compose --profile analytics stop
  }
  return
}

if (-not (Test-Path (Join-Path $root ".env"))) {
  # Khong co .env thi Compose tao lai container db voi bien rong va app khong co DATABASE_URL.
  Write-Host "Thieu file .env o $root. Sao chep tu .env.example roi dien gia tri truoc khi chay." -ForegroundColor Red
  exit 1
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host "Khong tim thay pnpm. Cai bang: corepack enable" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path (Join-Path $root "node_modules"))) {
  Write-Step "Cai dependency (pnpm install)"
  & pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $NoDocker) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Khong tim thay Docker. Cai Docker Desktop hoac chay lai voi -NoDocker." -ForegroundColor Red
    exit 1
  }
  if (-not (Test-DockerEngine)) {
    $desktop = @("$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe", "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $desktop) { Write-Host "Docker chua chay va khong tim thay Docker Desktop." -ForegroundColor Red; exit 1 }
    Write-Step "Khoi dong Docker Desktop"
    Start-Process $desktop
    $deadline = (Get-Date).AddMinutes(3)
    while (-not (Test-DockerEngine)) {
      if ((Get-Date) -gt $deadline) { Write-Host "Docker khong san sang sau 3 phut." -ForegroundColor Red; exit 1 }
      Start-Sleep -Seconds 3
    }
  }
  Write-Step "Bat PostgreSQL + S3Mock$(if ($Analytics) { ' + Umami' })"
  if ($Analytics) { & docker compose --profile analytics up -d } else { & docker compose up -d db storage }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $deadline = (Get-Date).AddMinutes(1)
  while ((& docker compose ps db --format "{{.Health}}") -ne "healthy") {
    if ((Get-Date) -gt $deadline) { Write-Host "PostgreSQL chua healthy sau 1 phut: docker compose logs db" -ForegroundColor Red; exit 1 }
    Start-Sleep -Seconds 2
  }
  Write-Host "PostgreSQL 127.0.0.1:5433, S3Mock 127.0.0.1:9090 da san sang."
}

$toStart = @()
foreach ($service in $services) {
  $processId = Get-ListeningPid $service.Port
  if ($processId) { Write-Host "$($service.Name) da chay o cong $($service.Port) (PID $processId), bo qua." -ForegroundColor Yellow }
  else { $toStart += $service }
}

if ($toStart.Count) {
  Write-Step "Mo $($toStart.Count) app: $(($toStart | ForEach-Object { $_.Name }) -join ', ')"
  $commandOf = { param($service) "`$Host.UI.RawUI.WindowTitle = 'iOrder $($service.Name) :$($service.Port)'; pnpm $($service.Script)" }
  if (Get-Command wt.exe -ErrorAction SilentlyContinue) {
    # Windows Terminal: mot cua so, moi app mot tab.
    $tabs = $toStart | ForEach-Object {
      $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes((& $commandOf $_)))
      "new-tab --title `"iOrder $($_.Name)`" -d `"$root`" powershell -NoExit -EncodedCommand $encoded"
    }
    Start-Process wt.exe -ArgumentList ($tabs -join " ; ")
  } else {
    foreach ($service in $toStart) {
      Start-Process powershell -WorkingDirectory $root -ArgumentList @("-NoExit", "-Command", (& $commandOf $service))
    }
  }

  # Lan dau sau khi bat may, 3 app cung bien dich nen co the mat vai phut.
  $deadline = (Get-Date).AddMinutes(4)
  foreach ($service in $toStart) {
    while (-not (Get-ListeningPid $service.Port)) {
      if ((Get-Date) -gt $deadline) { Write-Host "$($service.Name) chua mo cong $($service.Port) sau 4 phut, co the van dang khoi dong; xem log trong tab cua no." -ForegroundColor Yellow; break }
      Start-Sleep -Seconds 1
    }
  }
}

Write-Host ""
foreach ($service in $services) {
  $state = if (Get-ListeningPid $service.Port) { "dang chay" } else { "CHUA CHAY" }
  Write-Host ("{0,-12} {1,-10} {2}" -f $service.Name, $state, $service.Url)
}
if ($Analytics) { Write-Host ("{0,-12} {1,-10} {2}" -f "umami", "docker", "http://localhost:3005") }
Write-Host ""
Write-Host "Lan dau mo moi trang Next se bien dich vai giay. Sau khi sua packages/shared phai khoi dong lai api/admin."
Write-Host "Dung tat ca: powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -Stop"
