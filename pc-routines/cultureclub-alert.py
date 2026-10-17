"""위례 컬처클럽 접수 알림 — 클라우드 루틴 「위례 컬처클럽 접수 알림」(trig_019H8qxFAtxwtgkqVX5Hq9XU) 대체.

작업 스케줄러(install-tasks.ps1): 매주 수요일 19:28 `CultureClubEve`, 매주 목요일 09:28 `CultureClubDay`.
판정(검색 없이 날짜 계산만): 이마트 컬처클럽 학기 접수는 1·4·7·10월 넷째 목요일 10:00 (2026-10-10 조사, 예외 2020-01-30 설 연휴).
  - 수요일 저녁 실행: 내일이 1·4·7·10월의 22~28일이면 「전날 알림」(priority 1)
  - 목요일 아침 실행: 오늘이 그 날이면 「당일 알림」(priority 2 — 확인할 때까지 1분마다 30분간 울림)
  - 그 밖은 아무것도 하지 않는다. 설 연휴로 한 주 밀리는 해(2028-01-27, 2031-01-23 전후)는 앱 공지를 직접 본다.
시험: `python cultureclub-alert.py --date 2026-10-21T19:28 --dryrun`
"""
import datetime as dt
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pcr_notify  # noqa: E402

TERM = {1: "봄학기", 4: "여름학기", 7: "가을학기", 10: "겨울학기"}


def decide(now):
    wd, hour = now.weekday(), now.hour  # Mon=0 … Wed=2, Thu=3
    if wd == 2 and hour >= 12:
        d, kind = (now + dt.timedelta(days=1)).date(), "eve"
    elif wd == 3 and hour < 12:
        d, kind = now.date(), "day"
    else:
        return None
    if d.month not in TERM or not (22 <= d.day <= 28):
        return None
    term = TERM[d.month]
    if kind == "eve":
        return "컬처클럽 접수", f"내일 {d.month}/{d.day}(목) 10시 위례점 {term} 접수 시작", 1
    return "컬처클럽 접수 — 30분 뒤", f"오늘 10시 위례점 {term} 접수 시작", 2


def main(argv):
    now = dt.datetime.now()
    if "--date" in argv:
        now = dt.datetime.fromisoformat(argv[argv.index("--date") + 1])
    r = decide(now)
    if not r:
        print(f"{now:%Y-%m-%d %H:%M} 해당 없음")
        return 0
    title, msg, pr = r
    if "--dryrun" in argv:
        print(f"[dryrun] p{pr} {title} — {msg}")
        return 0
    path, _ = pcr_notify.send(title, msg, pr, retry=60, expire=1800)
    print(f"{now:%Y-%m-%d %H:%M} 보냄({path}) p{pr} {title} — {msg}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:  # noqa: BLE001
        pcr_notify.log(f"cultureclub-alert 오류 {e}")
        raise
