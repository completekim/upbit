# pc-routines — 클라우드 루틴의 PC 대체 스크립트 (2026-10-17)

PC `C:\Users\wsc62\tools\pc-routines\` 에 복사해 작업 스케줄러로 돌린다. Claude 를 부르지 않으므로 토큰 0.
기존 `parking-watch.py`·`umbrella.py`·`marriott-watch.py`·`samsung-transit-watch.py` 와 같은 폴더·같은 키 파일을 쓴다.

| 파일 | 대체하는 클라우드 루틴 | 작업(스케줄러) |
|---|---|---|
| `pcr_notify.py` | (공용) Pushover → ntfy 발송, 긴급 알림 receipt 조회 | — |
| `cultureclub-alert.py` | 위례 컬처클럽 접수 알림 `trig_019H8qxFAtxwtgkqVX5Hq9XU` | `CultureClubEve` 수 19:28 · `CultureClubDay` 목 09:28 |
| `pushover-canary.py` | Pushover 수신 점검 `trig_01XL3FCpNRt1r1fUfuADfUWa` + 미확인 알림 재발송 `trig_01GBJjr5izE6DzNmZsE5Murr`(알림 확인함) | `PushoverCanarySend` 일 09:13 · `PushoverCanaryCheck` 일 12:20 |
| `event-watch.py` + `event-watch.json` | 화담숲 예약 오픈 `trig_01Vpg1Ag6KVQgXgo586pTCzy` · 불꽃축제 탐색·예매 직전 `trig_0145Q1c2dBBqhyqZeDCcSirA` · 불꽃축제 리마인더 `trig_01Hp4KQoAkiVBBckj9JdAtyc` | `EventWatch` 매일 09:05 (`watch`) · `EventWatchAlarm1340`·`EventWatchAlarm1940` 매일 (`alarm`) |
| `install-tasks.ps1` | — | 위 7개 등록(`-DryRun` 시험, `-Uninstall` 해제) |

event-watch 설계 — **PC가 0토큰으로 공식 페이지를 지켜보다가, 새 공지가 뜰 때만 PC의 `claude -p`로 날짜를 뽑는다.** 페이지 본문을 줄 단위로 스냅샷과 비교해 키워드가 든 새 줄이 생기면 Pushover(p1)로 바로 알리고, 추출된 행사일·예매 오픈 시각은 `%LOCALAPPDATA%\pc-routines\event-watch-state.json` 의 events 에 쌓인다. 그 뒤로는 날짜 계산만: D-7·D-1 알림, 예매 3일 전 알림, 예매 45분 전 긴급 알림(priority 2, 확인할 때까지 울림). 날짜를 손으로 넣으려면 `python event-watch.py set busan-2026 fest_date=2026-11-07 fest_time=19:00 sale_open=2026-09-04T14:00`. 한계: JS로만 채워지는 페이지는 변화를 못 본다 — 설치 때 각 URL 본문에 공지 목록이 보이는지 확인한다.

설치 순서
1. 세 `.py` 를 `tools\pc-routines\` 에 복사
2. `python pcr_notify.py --selftest` — keys.json 의 Pushover 키를 찾았는지와 시험 발송(우선순위 −1) 확인. 「없음」이면 `KEY_ALIASES` 에 keys.json 의 실제 키 이름 추가
3. `python cultureclub-alert.py --date 2026-10-21T19:28 --dryrun` → 「전날 알림」 문구, `--date 2026-10-22T09:28 --dryrun` → 「당일 알림」 문구, `--date 2026-10-28T09:28 --dryrun` → 「해당 없음」
4. `powershell -ExecutionPolicy Bypass -File install-tasks.ps1 -DryRun` 으로 명령 확인 후 `-DryRun` 없이 실행
5. 클라우드 루틴 끄기(설치 확인 후): 위례 컬처클럽 `trig_019H8qxFAtxwtgkqVX5Hq9XU` (재발송·수신 점검은 2026-10-17 클라우드에서 이미 껐다)

설계 메모
- 알림 확인함(아티팩트 DB)과 하루 4회 재발송 대신 **Pushover 긴급 알림(priority 2)** 을 쓴다: 확인(Acknowledge)할 때까지 1분마다 다시 울리고, `receipts/<id>.json` 으로 확인 여부를 조회한다. 재알림 상한은 3시간.
- 수신 이상 경보는 Pushover 와 별개 경로(ntfy)로도 나간다. keys.json 에 ntfy 토픽이 없으면 Pushover 로만 나간다 — 토픽을 넣어 두는 것이 안전하다.
