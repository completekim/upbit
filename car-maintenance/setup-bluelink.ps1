# 그붕이 블루링크 최초 연결 (PC PowerShell에서 1회 실행)
# Secret과 토큰은 이 PC 안에서만 다루고, Refresh Token은 클립보드로만 꺼낸다.
$cid      = "cfcf12d2-11ce-405f-bd4c-3d7d061756fd"
$redirect = "https://www.google.com"
$auth     = "https://prd.kr-ccapi.hyundai.com/api/v1/user/oauth2"
$api      = "https://dev.kr-ccapi.hyundai.com/api/v1"

$sec = Read-Host "1) 디벨로퍼스 「프로젝트 개요」의 Client Secret 붙여넣기"
Start-Process "$auth/authorize?client_id=$cid&redirect_uri=$([uri]::EscapeDataString($redirect))&response_type=code&state=gbung"
$back = Read-Host "2) 브라우저에서 로그인 → 구글로 넘어간 주소창 전체 붙여넣기"
$code = [uri]::UnescapeDataString([regex]::Match($back, 'code=([^&]+)').Groups[1].Value)
if (-not $code) { throw "주소에 code= 가 없습니다. 2)를 다시 하세요." }

$basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${cid}:${sec}"))
$t = Invoke-RestMethod -Method Post -Uri "$auth/token" -Headers @{ Authorization = "Basic $basic" } `
     -ContentType "application/x-www-form-urlencoded" `
     -Body @{ grant_type = "authorization_code"; code = $code; redirect_uri = $redirect }
$h = @{ Authorization = "Bearer $($t.access_token)" }

try {
    $cars = Invoke-RestMethod -Uri "$api/car/profile/carlist" -Headers $h
    $car  = $cars.cars[0].carId
    $o    = Invoke-RestMethod -Uri "$api/car/status/$car/odometer" -Headers $h
    $last = $o.odometers | Sort-Object date | Select-Object -Last 1
    "연결 성공 — 차량 $($cars.cars.Count)대, 누적 주행거리 $($last.value) km ($($last.date))"
} catch {
    "차량 데이터 조회 실패: $($_.Exception.Message)"
    "차량 데이터 제공 동의 화면을 엽니다. 동의를 마친 뒤 이 스크립트를 다시 실행하세요."
    $f = Join-Path $env:TEMP "gbung_consent.html"
    "<meta charset='utf-8'><form id='f' method='post' action='$api/car-service/terms/agreement'><input type='hidden' name='token' value='Bearer $($t.access_token)'><input type='hidden' name='state' value='gbung'></form><script>document.getElementById('f').submit()</script>" |
        Out-File $f -Encoding utf8
    Start-Process $f
}

Set-Clipboard $t.refresh_token
"3) Refresh Token을 클립보드에 복사했습니다(1년 유효)."
"   claude.ai/code → ☁ 대화 → 환경 편집 → 환경 변수 맨 아래 줄에 붙여넣기:"
"   HYUNDAI_REFRESH_TOKEN=(Ctrl+V)"
