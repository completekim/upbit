# 그붕이 정비 계기판

그랜저 IG 3.3(2017-10 출고)의 소모품 11개 품목을 **시간 주기와 주행거리 주기 중 먼저 오는 쪽**으로 판정하는 claude.ai 아티팩트의 소스와 운영 구조다.

- 아티팩트: https://claude.ai/artifact/Tk6srnKHJefj3i9qXZvRq3 (비공개)
- 화면 소스: `gbung-dashboard.html`
- 주행거리 수집: `hyundai_odometer.py` (현대 디벨로퍼스 데이터 API, 표준 라이브러리만 사용)
- 데이터 정본: Vault Family `28. 자동차/10. 그붕이/10. 소모품/01. 소모품 교체 기록표`. 아티팩트는 운영용 사본이다. 교체를 기록한 뒤 화면의 「기록표 마크다운 복사」로 정본에 반영한다.

## 구조

```
블루링크 모뎀 ─▶ 현대 커넥티드 서버 ─▶ 현대 디벨로퍼스 데이터 API
                                            │  GET /api/v1/car/status/{carId}/odometer
                                            ▼
                     주간 점검 루틴 (월 08:52 KST, 클라우드 세션)
                     hyundai_odometer.py → 아티팩트 DB odo (source: bluelink)
                                            │
                                            ├─ 판정 → 🔴·🟡·갱신 없음이면 푸시·메일
                                            ▼
                     아티팩트 화면 (items · odo · history)
                     └─ 품목 카드 「캘린더 알림」 → Google Calendar 09:00 일정
```

## 판정 규칙

| 항목 | 계산 |
|---|---|
| 하루 주행량 | 최근 400일 주행거리 기록의 최소제곱 기울기. 기록이 부족하면 18.3 km/일 |
| 오늘 추정 주행거리 | 마지막 기록 + 하루 주행량 × 경과일 |
| 시간 예정일 | 마지막 교체일 + 주기(개월) |
| 거리 예정일 | (마지막 교체 km + 주기 km − 추정 주행거리) ÷ 하루 주행량 → 날짜 환산 |
| 다음 교체일 | 두 예정일 중 이른 쪽 (카드에 「시간 기준」/「거리 기준」 표시) |
| 🔴 지금 | 예정일 경과, 잔여 km ≤ 0, 또는 수동 판정 「지금」 |
| 🟡 확인 | 남은 일수 ≤ 선행일(기본 30), 잔여 km ≤ 선행 km(기본 1,000), 또는 수동 판정 「확인」 |
| 상태 기준 | 주기 값이 없는 품목(브레이크패드 잔량, 스마트키 건전지) |

## 블루링크 API 연결 — 1회 설정

### 1. 디벨로퍼스 프로젝트

1. developers.hyundai.com 에 현대자동차 통합계정(블루링크 계정)으로 가입한다. 개인은 서류 심사 없이 본인인증만으로 된다.
2. 서비스 콘솔 → 프로젝트 생성 → 데이터 API에서 **주행거리**를 선택한다.
3. Redirect URI를 등록한다. 받는 서버가 필요 없으므로 `https://www.google.com` 처럼 열리기만 하는 https 주소면 된다. 동의 후 주소창의 `code=` 값만 쓴다.
4. 발급된 Client ID와 Client Secret을 확인한다.

### 2. Refresh Token 발급 (PC PowerShell — 토큰이 채팅에 나오지 않게 직접 실행)

```powershell
$cid = "<Client ID>"; $sec = "<Client Secret>"; $redirect = "https://www.google.com"
$auth = "https://prd.kr-ccapi.hyundai.com/api/v1/user/oauth2"
Start-Process "$auth/authorize?client_id=$cid&redirect_uri=$([uri]::EscapeDataString($redirect))&response_type=code&state=gbung"
# 블루링크 계정으로 로그인 → 그붕이 선택·동의 → 이동한 주소창의 code= 값을 붙여 넣는다
$code  = Read-Host "code"
$basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${cid}:${sec}"))
$r = Invoke-RestMethod -Method Post -Uri "$auth/token" -Headers @{ Authorization = "Basic $basic" } `
     -ContentType "application/x-www-form-urlencoded" `
     -Body @{ grant_type = "authorization_code"; code = $code; redirect_uri = $redirect }
$r.refresh_token | Set-Clipboard   # 클립보드에만 복사한다
"access 만료(초): $($r.expires_in)"
```

### 3. 클라우드 환경 설정 (세션 제목 표시줄의 환경 메뉴 → Edit)

| 구분 | 값 |
|---|---|
| 환경 변수 | `HYUNDAI_CLIENT_ID`, `HYUNDAI_CLIENT_SECRET`, `HYUNDAI_REFRESH_TOKEN`, `HYUNDAI_REDIRECT_URI` (선택 `HYUNDAI_CAR_ID`) |
| Network access → Custom → Allowed domains | `prd.kr-ccapi.hyundai.com`, `dev.kr-ccapi.hyundai.com`, `developers.hyundai.com` (기본 패키지 관리자 목록 유지) |

### 4. 확인

```bash
python3 -I hyundai_odometer.py cars       # 동의한 차량이 보이는지
python3 -I hyundai_odometer.py odometer   # {"km": ..., "date": ..., "source": "bluelink"}
```

`cars`가 빈 목록이면 동의 화면에서 차량을 고르지 않았거나, 이 차량(블루링크 2.0 세대)이 데이터 API 지원 대상이 아닌 것이다.

## 미검증 사항

- 엔드포인트 경로(`/api/v1/user/oauth2/token`, `/api/v1/car/profile/carlist`, `/api/v1/car/status/{carId}/odometer`)와 호스트(인증 `prd.` · 데이터 `dev.`)는 공식 규격서를 직접 열지 못한 채 검색 결과와 공개 자료로 잡았다. 다르면 `HYUNDAI_AUTH_HOST` · `HYUNDAI_API_HOST`로 바꾸거나 경로를 고친다.
- 응답 필드는 `odometers[].value/unit/timestamp`와 단일 `value` 두 형태를 모두 받도록 했고, 로컬 모의 서버로만 시험했다.
- Refresh Token 유효기간과 재발급(rotation) 여부를 확인하지 못했다. 재발급되면 스크립트가 `refreshTokenRotated: true`를 내고 루틴이 재인증 경고를 보낸다. 그때 2단계를 다시 실행해 환경 변수를 바꾼다.

## 알림

- **캘린더**: 품목 카드 「캘린더 알림」 → 다음 교체일 − 선행일, 09:00–09:30 KST 일정(팝업 당일·하루 전). 다시 누르면 기존 일정을 지우고 새로 만든다.
- **주간 루틴** `trig_01PuXXiZ59TJiLySfjhM3d2K`: 매주 월 08:52 KST 새 세션. 블루링크 주행거리 수신 → 판정 → 🔴·🟡·갱신 없음(21일 이상)·API 오류가 있으면 푸시·메일.
