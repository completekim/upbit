"""Pushover 수신 점검 — 클라우드 루틴 「Pushover 수신 점검」(trig_01XL3FCpNRt1r1fUfuADfUWa)과
「미확인 알림 재발송」의 수신 점검 부분(알림 확인함 DB)을 Pushover 자체 기능으로 대체.

send  (일요일 09:13 `PushoverCanarySend`) : priority 2 점검 알림 — 폰에서 「확인」을 누를 때까지 1분마다 최대 3시간 울린다.
                                            응답의 receipt 를 상태 파일에 저장.
check (일요일 12:20 `PushoverCanaryCheck`): receipt 조회. acknowledged 가 아니면 ntfy(별개 경로)로 「📶 Pushover 수신 이상」 경보.
상태: %LOCALAPPDATA%\\pc-routines\\pushover-canary.json
"""
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pcr_notify  # noqa: E402

STATE = os.path.join(pcr_notify.STATE_DIR, "pushover-canary.json")
TITLE = "📶 Pushover 수신 점검"
MSG = "이 알림이 보이면 「확인」(Acknowledge)을 눌러 주세요. 3시간 안에 확인이 없으면 수신 이상으로 경보합니다."


def _save(d):
    os.makedirs(pcr_notify.STATE_DIR, exist_ok=True)
    json.dump(d, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def send():
    try:
        r = pcr_notify.pushover(TITLE, MSG, 2, retry=60, expire=10800)
    except Exception as e:  # noqa: BLE001
        pcr_notify.log(f"canary send fail {e}")
        pcr_notify.ntfy("📶 Pushover 발송 실패", f"수신 점검 알림을 보내지 못했습니다: {e}", 5)
        _save({"sent": dt.datetime.now().isoformat(timespec="minutes"), "receipt": None, "error": str(e)})
        return 1
    _save({"sent": dt.datetime.now().isoformat(timespec="minutes"), "receipt": r.get("receipt"), "checked": None})
    pcr_notify.log(f"canary sent receipt={r.get('receipt')}")
    print("보냄", r.get("receipt"))
    return 0


def check():
    try:
        st = json.load(open(STATE, encoding="utf-8"))
    except (OSError, ValueError):
        print("상태 파일 없음 — 건너뜀")
        return 0
    sent = dt.datetime.fromisoformat(st["sent"])
    if dt.datetime.now() - sent > dt.timedelta(hours=20):
        print("오래된 상태 — 건너뜀")
        return 0
    if not st.get("receipt"):
        print("receipt 없음(발송 실패) — send 단계에서 이미 경보")
        return 0
    rec = pcr_notify.receipt(st["receipt"])
    acked = rec.get("acknowledged") == 1
    st["checked"] = dt.datetime.now().isoformat(timespec="minutes")
    st["acknowledged"] = acked
    _save(st)
    if acked:
        pcr_notify.log("canary acked")
        print("확인됨")
        return 0
    pcr_notify.log("canary NOT acked → ntfy alarm")
    body = f"{sent:%m/%d %H:%M} 보낸 수신 점검 알림이 확인되지 않았습니다. Pushover 앱 알림 권한·배터리 최적화·방해 금지를 확인하세요."
    try:
        pcr_notify.ntfy("📶 Pushover 수신 이상", body, 5)
    except Exception as e:  # noqa: BLE001
        pcr_notify.log(f"canary ntfy fail {e}")
    try:  # Pushover 도 함께 — 앱이 살아 있는데 긴급 알림만 못 받은 경우를 위해
        pcr_notify.pushover("📶 Pushover 수신 이상", body, 1)
    except Exception as e:  # noqa: BLE001
        pcr_notify.log(f"canary pushover alarm fail {e}")
    print("미확인 — 경보 보냄")
    return 0


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    sys.exit({"send": send, "check": check}.get(mode, lambda: print(__doc__) or 2)())
