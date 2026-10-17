# pc-routines — 클라우드 루틴의 PC 대체 스크립트 (2026-10-17)

PC `C:\Users\wsc62\tools\pc-routines\` 에 복사해 작업 스케줄러로 돌린다. Claude 를 부르지 않으므로 토큰 0.
기존 `parking-watch.py`·`umbrella.py`·`marriott-watch.py`·`samsung-transit-watch.py` 와 같은 폴더·같은 키 파일을 쓴다.

| 파일 | 대체하는 클라우드 루틴 | 작업(스케줄러) |
|---|---|---|
| `pcr_notify.py` | (공용) Pushover → ntfy 발송, 긴급 알림 receipt 조회 | — |
| `cultureclub-alert.py` | 위례 컬처클럽 접수 알림 `trig_019H8qxFAtxwtgkqVX5Hq9XU` | `CultureClubEve` 수 19:28 · `CultureClubDay` 목 09:28 |
| `pushover-canary.py` | Pushover 수신 점검 `trig_01XL3FCpNRt1r1fUfuADfUWa` + 미확인 알림 재발송 `trig_01GBJjr5izE6DzNmZsE5Murr`(알림 확인함) | `PushoverCanarySend` 일 09:13 · `PushoverCanaryCheck` 일 12:20 |
| `install-tasks.ps1` | — | 위 4개 등록(`-DryRun` 시험, `-Uninstall` 해제) |

설치 순서
1. 세 `.py` 를 `tools\pc-routines\` 에 복사
2. `python pcr_notify.py --selftest` — keys.json 의 Pushover 키를 찾았는지와 시험 발송(우선순위 −1) 확인. 「없음」이면 `KEY_ALIASES` 에 keys.json 의 실제 키 이름 추가
3. `python cultureclub-alert.py --date 2026-10-21T19:28 --dryrun` → 「전날 알림」 문구, `--date 2026-10-22T09:28 --dryrun` → 「당일 알림」 문구, `--date 2026-10-28T09:28 --dryrun` → 「해당 없음」
4. `powershell -ExecutionPolicy Bypass -File install-tasks.ps1 -DryRun` 으로 명령 확인 후 `-DryRun` 없이 실행
5. 클라우드 루틴 끄기(설치 확인 후): 위례 컬처클럽 `trig_019H8qxFAtxwtgkqVX5Hq9XU` (재발송·수신 점검은 2026-10-17 클라우드에서 이미 껐다)

설계 메모
- 알림 확인함(아티팩트 DB)과 하루 4회 재발송 대신 **Pushover 긴급 알림(priority 2)** 을 쓴다: 확인(Acknowledge)할 때까지 1분마다 다시 울리고, `receipts/<id>.json` 으로 확인 여부를 조회한다. 재알림 상한은 3시간.
- 수신 이상 경보는 Pushover 와 별개 경로(ntfy)로도 나간다. keys.json 에 ntfy 토픽이 없으면 Pushover 로만 나간다 — 토픽을 넣어 두는 것이 안전하다.
