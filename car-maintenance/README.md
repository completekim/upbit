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
| 월평균 주행거리 | 최근 400일 주행거리 기록의 최소제곱 기울기 × 30.44일. 기록이 부족하면 약 557 km/월 |
| 오늘 추정 주행거리 | 마지막 기록 + 월평균을 경과일만큼 일할 |
| 시간 예정일 | 마지막 교체일 + 주기(개월) |
| 거리 예정일 | 잔여 km를 월평균으로 나눠 날짜 환산 |
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

### 2. 클라우드 환경 설정 (세션 제목 표시줄의 환경 메뉴 → Edit)

| 구분 | 값 |
|---|---|
| 환경 변수 | `HYUNDAI_CLIENT_ID`, `HYUNDAI_CLIENT_SECRET`, `HYUNDAI_REDIRECT_URI=https://www.google.com` (선택 `HYUNDAI_CAR_ID`) |
| Network access → Custom → Allowed domains | `prd.kr-ccapi.hyundai.com`, `dev.kr-ccapi.hyundai.com`, `developers.hyundai.com` (기본 패키지 관리자 목록 유지) |

### 3. 최초 동의 (1회)

1. 동의 주소(`authorize-url` 출력)를 휴대폰 브라우저로 연다 → 블루링크 계정 로그인 → 그붕이 선택·동의.
2. google.com으로 넘어간 주소창 전체(`...?code=...`)를 복사해 Claude 세션에 붙인다. code는 1회용이고 Client Secret 없이는 쓸 수 없다.
3. Claude가 주간 루틴을 `INIT` 블록과 함께 1회 실행한다 → 루틴이 `exchange`로 Refresh Token을 받아 **아티팩트 DB의 소유자 전용 경로 `data/users/<소유자>/hyundai`** 에 저장한다. 토큰은 채팅·저장소·환경 변수 어디에도 나오지 않는다.
4. 이후 매주 루틴이 그 토큰으로 주행거리를 읽고, 토큰이 재발급되면 같은 자리에 덮어쓴다.

### 4. 확인

```bash
python3 -I hyundai_odometer.py cars --token-file T       # 동의한 차량이 보이는지
python3 -I hyundai_odometer.py odometer --token-file T   # {"km": ..., "date": ..., "source": "bluelink"}
```

`cars`가 빈 목록이면 동의 화면에서 차량을 고르지 않았거나, 이 차량(블루링크 2.0 세대)이 데이터 API 지원 대상이 아닌 것이다.

## 미검증 사항

- 엔드포인트 경로(`/api/v1/user/oauth2/token`, `/api/v1/car/profile/carlist`, `/api/v1/car/status/{carId}/odometer`)와 호스트(인증 `prd.` · 데이터 `dev.`)는 공식 규격서를 직접 열지 못한 채 검색 결과와 공개 자료로 잡았다. 다르면 `HYUNDAI_AUTH_HOST` · `HYUNDAI_API_HOST`로 바꾸거나 경로를 고친다.
- 응답 필드는 `odometers[].value/unit/timestamp`와 단일 `value` 두 형태를 모두 받도록 했고, 로컬 모의 서버로만 시험했다.
- Refresh Token 유효기간을 확인하지 못했다. 재발급되면 루틴이 새 값을 저장하고, 만료(401·invalid_grant)되면 「재인증 필요」를 보낸다. 그때 3단계를 다시 한다.

## 알림

- **캘린더**: 품목 카드 「캘린더 알림」 → 다음 교체일 − 선행일, 09:00–09:30 KST 일정(팝업 당일·하루 전). 다시 누르면 기존 일정을 지우고 새로 만든다.
- **주간 루틴** `trig_01PuXXiZ59TJiLySfjhM3d2K`: 매주 월 08:52 KST 새 세션. 블루링크 주행거리 수신 → 판정 → 🔴·🟡·갱신 없음(21일 이상)·API 오류가 있으면 푸시·메일.

## 현재 운영 상태 (2026-10-06 확정)

| 구성 | 상태 |
|---|---|
| 블루링크 연결 | ✅ 누적 주행거리·주행가능거리 수신 (첫 값 67,250 km · 375 km) |
| 경고등 7종 | ❌ 서버가 `status` 없이 `msgId`만 반환 — 현대 디벨로퍼스 문의 대상 |
| 토큰 | 환경 변수 `HYUNDAI_REFRESH_TOKEN` (1년 유효, 회전 없음 확인) |
| 수집기 설치 | 환경 「대화」 설정 스크립트에 `env-setup-block.sh` 블록 — `/root/gbung/hyundai_odometer.py` 설치 + 그 명령만 실행 허용 |
| 매일 루틴 | `trig_01PuXXiZ59TJiLySfjhM3d2K` 매주 토요일 07:52 KST — 무인 수집 검증 완료(권한 거부 0건) |
| 최초 연결 절차 | 「묻기」 모드 세션에서 `authorize-url` → `exchange` (자동 모드에서는 토큰 처리가 차단된다) |
