# Dat lich sao luu tu dong moi dem tren may Windows bang Task Scheduler (giong cron tren VPS), dung scripts/backup.ps1.
#   powershell -ExecutionPolicy Bypass -File scripts/backup-schedule.ps1                dat lich 21:00 moi dem
#   powershell -ExecutionPolicy Bypass -File scripts/backup-schedule.ps1 -Time 02:30    doi gio (dinh dang HH:mm)
#   powershell -ExecutionPolicy Bypass -File scripts/backup-schedule.ps1 -Status        xem lich, lan chay gan nhat va ket qua
#   powershell -ExecutionPolicy Bypass -File scripts/backup-schedule.ps1 -Remove        go lich
# Cung ten tac vu "iOrder sao luu" voi nut "Bat tu dong sao luu" cua CMS (chay truc tiep tren may), nen CMS nhan ra lich nay.
# Luu y: may phai bat (lich chay luc may mo; neu lo gio, chay bu ngay khi co the) va Docker Desktop phai dang chay (container db, storage).
# Ket qua moi lan chay ghi vao CMS (Lich su va Tinh trang); loi cung hien o thong bao.
# Chu khong dau: Windows PowerShell 5.1 doc sai file .ps1 UTF-8 khong BOM.
param(
  [string]$Time = "21:00",
  [switch]$Remove,
  [switch]$Status
)

$ErrorActionPreference = "Stop"
$taskName = "iOrder sao luu"
$root = Split-Path -Parent $PSScriptRoot
$backupScript = Join-Path $PSScriptRoot "backup.ps1"

function Show-Status {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if (-not $task) { Write-Host "Chua co lich sao luu tu dong. Dat bang: pnpm backup:schedule" -ForegroundColor Yellow; return }
  $info = Get-ScheduledTaskInfo -TaskName $taskName
  $at = ($task.Triggers | Select-Object -First 1).StartBoundary
  Write-Host "Lich '$taskName': $($task.State), moi dem luc $(([datetime]$at).ToString('HH:mm'))"
  Write-Host "  Lan chay tiep theo : $($info.NextRunTime)"
  if ($info.LastRunTime.Year -lt 2000) { Write-Host "  Lan chay gan nhat  : chua chay lan nao" }
  else { Write-Host "  Lan chay gan nhat  : $($info.LastRunTime) (ma ket qua $($info.LastTaskResult); 0 la thanh cong)" }
}

if ($Status) { Show-Status; exit 0 }

if ($Remove) {
  if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "Da go lich sao luu tu dong." -ForegroundColor Green
  } else {
    Write-Host "Khong co lich sao luu tu dong de go." -ForegroundColor Yellow
  }
  exit 0
}

$at = [datetime]::MinValue
if (-not [datetime]::TryParseExact($Time, "HH:mm", [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$at)) {
  Write-Host "Gio khong hop le: '$Time'. Dung dinh dang HH:mm, vi du 21:00 hoac 02:30." -ForegroundColor Red
  exit 1
}
if (-not (Test-Path $backupScript)) { Write-Host "Khong thay $backupScript." -ForegroundColor Red; exit 1 }

# -StartWhenAvailable: may tat luc 21:00 thi chay bu khi bat lai; IgnoreNew: khong chay chong hai luot; gioi han 2 gio de khong treo mai.
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$backupScript`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Sao luu database va media iOrder (scripts/backup.ps1)" -Force | Out-Null
Write-Host "Da dat lich sao luu tu dong moi dem luc $($at.ToString('HH:mm'))." -ForegroundColor Green
Show-Status
Write-Host "Chay thu ngay: Start-ScheduledTask -TaskName '$taskName'   |   Xem lich: pnpm backup:schedule:status   |   Go lich: pnpm backup:unschedule"
