"""pc-routines 공용 발송 모듈 — Pushover 우선, 실패하면 ntfy.

키 파일: %LOCALAPPDATA%\\pc-routines\\keys.json (기존 notify.py 와 같은 파일을 읽는다).
키 이름은 중첩·대소문자와 무관하게 아래 별칭 중 하나면 된다.
  Pushover 앱 토큰  : pushover_token / pushover_app_token / token / app_token
  Pushover 사용자 키: pushover_user / pushover_user_key / user / user_key
  ntfy 토픽(선택)   : ntfy_topic / ntfy / topic
keys.json 의 실제 이름이 이 목록에 없으면 KEY_ALIASES 에 한 줄 보탠다(설치 때 `--selftest` 로 확인).
키 값은 어디에도 출력하지 않는다.
"""
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request

STATE_DIR = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "pc-routines")
KEYS_PATH = os.path.join(STATE_DIR, "keys.json")
LOG_PATH = os.path.join(STATE_DIR, "pcr-notify.log")
KEY_ALIASES = {
    "token": ["pushover_token", "pushover_app_token", "token", "app_token"],
    "user": ["pushover_user", "pushover_user_key", "user", "user_key"],
    "ntfy": ["ntfy_topic", "ntfy", "topic"],
}


def _keys():
    try:
        raw = json.load(open(KEYS_PATH, encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    flat = {}

    def walk(o, prefix=""):
        if isinstance(o, dict):
            for k, v in o.items():
                walk(v, f"{prefix}_{k}" if prefix else str(k))
        else:
            flat[prefix.lower()] = o

    walk(raw)
    out = {}
    for key, names in KEY_ALIASES.items():
        for n in names:
            if flat.get(n.lower()):
                out[key] = str(flat[n.lower()])
                break
    return out


def log(msg):
    os.makedirs(STATE_DIR, exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(f"{dt.datetime.now():%Y-%m-%d %H:%M:%S} {msg}\n")


def _post(url, data, timeout=20):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode(), method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def pushover(title, message, priority=0, url=None, url_title=None, retry=60, expire=1800, sound=None):
    """priority 2(긴급)는 확인(Acknowledge)할 때까지 retry 초마다 expire 초 동안 다시 울린다(expire 최대 10800)."""
    k = _keys()
    if not (k.get("token") and k.get("user")):
        raise RuntimeError("keys.json 에 Pushover token/user 없음")
    d = {"token": k["token"], "user": k["user"], "title": title, "message": message[:1024], "priority": priority}
    if url:
        d["url"] = url
    if url_title:
        d["url_title"] = url_title
    if priority == 2:
        d.update(retry=max(30, retry), expire=min(10800, expire), sound=sound or "persistent")
    last = None
    for _ in range(2):
        try:
            r = _post("https://api.pushover.net/1/messages.json", d)
            if r.get("status") == 1:
                return r
            last = r
        except Exception as e:  # noqa: BLE001
            last = e
    raise RuntimeError(f"Pushover 실패: {last}")


def receipt(receipt_id):
    """긴급 알림의 확인 여부 — acknowledged / expired 필드(1이면 참)."""
    k = _keys()
    q = urllib.parse.quote(k["token"])
    with urllib.request.urlopen(f"https://api.pushover.net/1/receipts/{receipt_id}.json?token={q}", timeout=20) as r:
        return json.loads(r.read().decode())


def ntfy(title, message, priority=3):
    k = _keys()
    topic = k.get("ntfy")
    if not topic:
        raise RuntimeError("keys.json 에 ntfy 토픽 없음")
    body = f"{title}\n{message}".encode()
    req = urllib.request.Request(f"https://ntfy.sh/{topic}", data=body, method="POST",
                                 headers={"Priority": str(priority), "Content-Type": "text/plain; charset=utf-8"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status


def send(title, message, priority=0, **kw):
    """Pushover → ntfy 두 단계. ('pushover', 응답) 또는 ('ntfy', None). 둘 다 실패하면 예외."""
    try:
        r = pushover(title, message, priority, **kw)
        log(f"pushover ok p{priority} {title}")
        return "pushover", r
    except Exception as e:  # noqa: BLE001
        log(f"pushover fail {e}")
        try:
            ntfy(title, message, 5 if priority >= 1 else 3)
            log(f"ntfy ok {title}")
            return "ntfy", None
        except Exception as e2:  # noqa: BLE001
            log(f"ntfy fail {e2}")
            raise


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        k = _keys()
        print("keys.json:", KEYS_PATH, {x: ("있음" if k.get(x) else "없음") for x in ("token", "user", "ntfy")})
        path, _ = send("pc-routines 시험", f"pcr_notify 자가 시험 {dt.datetime.now():%m/%d %H:%M}", -1)
        print("발송 경로:", path)
    else:
        print(__doc__)
