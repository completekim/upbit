# pc-routines 작업 스케줄러 등록 — 현재 사용자로 등록(관리자 권한 불필요).
# 사용: powershell -ExecutionPolicy Bypass -File install-tasks.ps1 [-DryRun] [-Uninstall]
# 기존 ParkingWatch·Umbrella 와 같이 `pythonw -I <스크립트>` 로 돈다(창 없음).
param([switch]$DryRun, [switch]$Uninstall)

$dir = "C:\Users\wsc62\tools\pc-routines"
$py = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if (-not $py) { throw "pythonw.exe 를 PATH 에서 찾지 못함" }
foreach ($f in @("pcr_notify.py", "cultureclub-alert.py", "pushover-canary.py")) {
  if (-not (Test-Path "$dir\$f")) { throw "$dir\$f 없음 — 먼저 복사" }
}

$tasks = @(
  @{ Name = "CultureClubEve";      Day = "WED"; Time = "19:28"; Arg = "`"$dir\cultureclub-alert.py`"" },
  @{ Name = "CultureClubDay";      Day = "THU"; Time = "09:28"; Arg = "`"$dir\cultureclub-alert.py`"" },
  @{ Name = "PushoverCanarySend";  Day = "SUN"; Time = "09:13"; Arg = "`"$dir\pushover-canary.py`" send" },
  @{ Name = "PushoverCanaryCheck"; Day = "SUN"; Time = "12:20"; Arg = "`"$dir\pushover-canary.py`" check" }
)

foreach ($t in $tasks) {
  if ($Uninstall) {
    $cmd = "schtasks /Delete /F /TN `"$($t.Name)`""
  } else {
    $tr = "`"$py`" -I $($t.Arg)"
    $cmd = "schtasks /Create /F /TN `"$($t.Name)`" /SC WEEKLY /D $($t.Day) /ST $($t.Time) /TR '$tr'"
  }
  Write-Host $cmd
  if (-not $DryRun) { Invoke-Expression $cmd }
}
if (-not $DryRun -and -not $Uninstall) {
  schtasks /Query /FO LIST /TN CultureClubEve | Select-String "TaskName|Next Run Time|다음 실행"
  schtasks /Query /FO LIST /TN PushoverCanarySend | Select-String "TaskName|Next Run Time|다음 실행"
}
