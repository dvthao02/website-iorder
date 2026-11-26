# Sao luu tren may Windows (moi truong dev local), cung cach lam voi scripts/backup.sh tren VPS:
# pg_dump database iOrder (+ umami neu co), thu khoi phuc vao database tam, sao luu media theo object,
# giu N ban moi nhat, roi ghi ket qua vao site_settings (scripts/backup-status.sql) de CMS hien o Tong quan.
#   powershell -ExecutionPolicy Bypass -File scripts/backup.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/backup.ps1 -BackupDir E:\iorder-backups -Keep 30
#   -NoVerify  bo buoc thu khoi phuc      -NoMedia  chi sao luu database      -EnvFile  file .env khac
#   -VerifyMedia  bam lai moi tep media tren dia de bat tep hong (cham hon, nen chay thi thoang)
#   -Keep N  so ban database giu lai; khong dat thi lay so Super Admin chinh trong CMS (man Sao luu), mac dinh 14
# Can container db (va storage neu sao luu media) dang chay: scripts/dev.ps1 bat chung.
# Chu khong dau: Windows PowerShell 5.1 doc sai file .ps1 UTF-8 khong BOM.
param(
  [string]$BackupDir = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "iorder-backups"),
  [string]$EnvFile = (Join-Path (Split-Path -Parent $PSScriptRoot) ".env"),
  [int]$Keep = 0,
  [switch]$NoVerify,
  [switch]$NoMedia,
  [switch]$VerifyMedia
)

# Khong dung "Stop": PowerShell 5.1 bien stderr cua lenh native (docker) thanh loi dung script.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
# Chuoi dua vao stdin cua lenh native phai la UTF-8 (mac dinh PowerShell 5.1 la ASCII).
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
$checkDb = "iorder_restore_check_$([Guid]::NewGuid().ToString('N'))"
$tempDumpPrefix = "/tmp/iorder-backup-$([Guid]::NewGuid().ToString('N'))"
$compose = @("compose", "--env-file", $EnvFile)

function Write-Step($message) { Write-Host "==> $message" -ForegroundColor Cyan }
# Lenh sh trong container db. Khong dung dau nhay kep ben trong: PowerShell 5.1 lam mat dau nhay kep khi truyen cho exe.
function Invoke-Db([string]$command, [string]$failure) {
  $output = & docker @compose exec -T db sh -c $command
  if ($LASTEXITCODE -ne 0) { throw $failure }
  return $output
}
function Write-Status([string[]]$environment) {
  $arguments = $compose + @("exec", "-T", "-e", "BACKUP_SOURCE=windows", "-e", "BACKUP_LOCATION=$BackupDir", "-e", "BACKUP_REPO=$root")
  foreach ($item in $environment) { $arguments += @("-e", $item.Replace('"', "'")) }
  $arguments += @("db", "sh", "-c", 'psql -q -U $POSTGRES_USER -d $POSTGRES_DB -f -')
  Get-Content -Raw -Encoding UTF8 (Join-Path $root "scripts/backup-status.sql") | & docker @arguments
  return $LASTEXITCODE -eq 0
}

if (-not (Test-Path $EnvFile)) { Write-Host "Thieu file $EnvFile." -ForegroundColor Red; exit 1 }
& docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Docker chua chay. Bat bang: powershell -ExecutionPolicy Bypass -File scripts/dev.ps1" -ForegroundColor Red; exit 1 }
if ((& docker @compose ps db --format "{{.Health}}") -ne "healthy") { Write-Host "Container db chua chay. Bat bang: powershell -ExecutionPolicy Bypass -File scripts/dev.ps1" -ForegroundColor Red; exit 1 }

# So ban giu lai: -Keep neu dat; khong thi doc site_settings "system.backup.keep" (backup-retention.ts, khoang 3-60); thieu hoac sai thi 14.
if ($Keep -le 0) {
  $Keep = 14
  try {
    $stored = "$(Invoke-Db "psql -U `$POSTGRES_USER -d `$POSTGRES_DB -tA -c 'select value from site_settings where key = `$`$system.backup.keep`$`$'" "Khong doc duoc so ban giu lai.")".Trim()
    if ($stored -match '^\d+$' -and [int]$stored -ge 3 -and [int]$stored -le 60) { $Keep = [int]$stored }
  } catch { }
}

New-Item -ItemType Directory -Force (Join-Path $BackupDir "db"), (Join-Path $BackupDir "media") | Out-Null
# Duong dan day du: CMS hien no trong huong dan phuc hoi.
$BackupDir = (Resolve-Path $BackupDir).Path
try {
  $lock = [System.IO.File]::Open((Join-Path $BackupDir ".lock"), "OpenOrCreate", "ReadWrite", "None")
} catch {
  Write-Host "Mot lan sao luu khac dang chay, dung." -ForegroundColor Red
  exit 1
}

$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'")
$partial = Join-Path $BackupDir "db\$stamp.partial"
$step = "chuan bi"
try {
  Get-ChildItem (Join-Path $BackupDir "db") -Directory -Filter "*.partial" | Remove-Item -Recurse -Force
  New-Item -ItemType Directory $partial | Out-Null

  $databases = @(Invoke-Db 'printf %s $POSTGRES_DB' "Khong doc duoc ten database.")
  if ((Invoke-Db "psql -U `$POSTGRES_USER -d `$POSTGRES_DB -tAc 'select 1 from pg_database where datname = `$`$umami`$`$'" "Khong kiem tra duoc database umami.") -eq "1") { $databases += "umami" }

  foreach ($name in $databases) {
    $step = "dump database $name"
    Write-Step "Dump database $name"
    # Dump ra tep trong container roi docker cp: pipeline PowerShell 5.1 lam hong du lieu nhi phan.
    Invoke-Db "pg_dump -U `$POSTGRES_USER -Fc --no-owner -f $tempDumpPrefix-$name.dump $name && pg_restore --list $tempDumpPrefix-$name.dump > /dev/null" "pg_dump $name loi." | Out-Null
    & docker @compose cp "db:$tempDumpPrefix-$name.dump" (Join-Path $partial "$name.dump")
    if ($LASTEXITCODE -ne 0) { throw "Khong chep duoc ban dump $name ra may." }
  }

  $users = ""; $media = ""
  if (-not $NoVerify) {
    $step = "khoi phuc thu"
    $main = $databases[0]
    Write-Step "Thu khoi phuc $main vao database tam $checkDb"
    # Neu trung ten, createdb that bai va khong duoc xoa database da co.
    Invoke-Db "createdb -U `$POSTGRES_USER $checkDb" "Khong tao duoc database thu phuc hoi." | Out-Null
    try {
      Invoke-Db "pg_restore -U `$POSTGRES_USER --no-owner --exit-on-error -d $checkDb $tempDumpPrefix-$main.dump" "Khoi phuc thu that bai." | Out-Null
      $counts = (Invoke-Db "psql -U `$POSTGRES_USER -d $checkDb -tA -F ' ' -c 'select (select count(*) from drizzle.__drizzle_migrations), (select count(*) from users u where to_jsonb(u)->>`$`$deleted_at`$`$ is null), (select count(*) from media_assets)'" "Khong dem duoc du lieu ban khoi phuc.") -split " "
      Write-Host "Khoi phuc thu: $($counts[0]) migration, $($counts[1]) tai khoan, $($counts[2]) media"
      if ([int]$counts[0] -eq 0 -or [int]$counts[1] -eq 0) { throw "Ban khoi phuc thu khong co du lieu." }
      $users = $counts[1]; $media = $counts[2]
    } finally {
      & docker @compose exec -T db sh -c "dropdb -U `$POSTGRES_USER --if-exists $checkDb" | Out-Null
    }
  }
  foreach ($name in $databases) { & docker @compose exec -T db sh -c "rm -f $tempDumpPrefix-$name.dump" | Out-Null }

  $step = "tinh checksum"
  $dumps = Get-ChildItem $partial -Filter "*.dump"
  $sums = $dumps | ForEach-Object { "$((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())  ./$($_.Name)" }
  # Xuong dong LF de "sha256sum -c SHA256SUMS" (Git Bash, Linux) kiem tra duoc.
  [System.IO.File]::WriteAllText((Join-Path $partial "SHA256SUMS"), (($sums -join "`n") + "`n"), (New-Object System.Text.UTF8Encoding $false))
  $bytes = ($dumps | Measure-Object -Property Length -Sum).Sum
  Rename-Item $partial $stamp

  if (-not $NoMedia) {
    $step = "sao luu media"
    Write-Step "Sao luu media vao $(Join-Path $BackupDir 'media')"
    $mediaArguments = @("--env-file=$EnvFile", "scripts/backup-media.mjs", "backup", (Join-Path $BackupDir "media"))
    if ($VerifyMedia) { $mediaArguments += "--verify" }
    & node @mediaArguments
    if ($LASTEXITCODE -ne 0) { throw "Sao luu media loi (storage co dang chay?)." }
  }

  # Giu $Keep ban database moi nhat; media chi them, khong xoa. Tep khac trong $BackupDir khong bi dung toi.
  $step = "xoa ban cu"
  # Chi thu muc dung dang ma thoi gian (20261122T100000Z): ban chep tay ten la va ban dang do khong bi tinh hay bi xoa.
  $old = @(Get-ChildItem (Join-Path $BackupDir "db") -Directory | Where-Object { $_.Name -match '^\d{8}T\d{6}Z$' } | Sort-Object Name | Select-Object -SkipLast $Keep)
  $old | Remove-Item -Recurse -Force

  $step = "ghi trang thai"
  if (-not (Write-Status @("BACKUP_SUCCESS=true", "BACKUP_STAMP=$stamp", "BACKUP_DATABASE=$($databases[0])", "BACKUP_BYTES=$bytes", "BACKUP_VERIFIED=$(([bool](-not $NoVerify)).ToString().ToLower())", "BACKUP_USERS=$users", "BACKUP_MEDIA=$media"))) {
    throw "Khong ghi duoc trang thai sao luu vao database."
  }
  Write-Host ""
  Write-Host "Hoan tat $stamp ($([math]::Round($bytes / 1KB)) KB database, xoa $($old.Count) ban cu): $(Join-Path $BackupDir "db\$stamp")" -ForegroundColor Green
} catch {
  $message = "Sao luu loi o buoc $step`: $($_.Exception.Message)"
  Write-Host $message -ForegroundColor Red
  if (-not (Write-Status @("BACKUP_SUCCESS=false", "BACKUP_MESSAGE=$message"))) { Write-Host "Khong ghi duoc trang thai loi vao database." -ForegroundColor Yellow }
  exit 1
} finally {
  $lock.Dispose()
}
