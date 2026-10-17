"""event-watch — 공식 페이지 변화 감시 + 행사 D-day·예매 오픈 알림. 클라우드 루틴 3개 대체:
  화담숲 예약 오픈 알림 trig_01Vpg1Ag6KVQgXgo586pTCzy · 불꽃축제 탐색·예매 직전 알림 trig_0145Q1c2dBBqhyqZeDCcSirA
  · 불꽃축제 리마인더 trig_01Hp4KQoAkiVBBckj9JdAtyc

설계 — PC가 0토큰으로 지켜보다가 변화가 있을 때만 Claude를 부른다.
  watch (매일 09:05) : event-watch.json 의 대상 페이지를 받아 본문 줄 단위로 지난 스냅샷과 비교. 새로 생긴 줄 중
                        키워드(예약·예매·오픈…)가 든 것이 있으면 ① 로그 ② Pushover(p1) ③ PC 의 `claude -p` 로 날짜·시각 추출
                        (claude 가 없거나 실패하면 알림만). 추출된 fest_date·sale_open 은 events 에 저장된다.
                        이어서 reminders 를 돈다.
  alarm (13:40·19:40) : 페이지는 안 받고 reminders 만 — 예매 오픈 45분 전 긴급 알림(priority 2, 확인할 때까지 울림)·
                        D-7·D-1·예매 3일 전.
  set   : 날짜를 손으로 넣는다 — `event-watch.py set busan-2026 fest_date=2026-11-07 fest_time=19:00 sale_open=2026-09-04T14:00`
  list  : 상태 출력. `--dryrun` 은 알림·저장 없이 판정만.
대상·창(window)은 event-watch.json, 스냅샷·행사·알림 플래그는 %LOCALAPPDATA%\\pc-routines\\event-watch-state.json.
"""
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import pcr_notify  # noqa: E402

CFG = os.environ.get('EW_CFG', os.path.join(HERE, 'event-watch.json'))
STATE = os.path.join(pcr_notify.STATE_DIR, "event-watch-state.json")
LOG = os.path.join(pcr_notify.STATE_DIR, "event-watch.log")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) event-watch/1.0"
WD = "월화수목금토일"


def log(msg):
    os.makedirs(pcr_notify.STATE_DIR, exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"{dt.datetime.now():%Y-%m-%d %H:%M:%S} {msg}\n")


class _Text(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg"}

    def __init__(self):
        super().__init__()
        self.lines, self._skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if not self._skip:
            t = re.sub(r"\s+", " ", data).strip()
            if len(t) >= 6:
                self.lines.append(t)


def fetch_lines(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko,en;q=0.5"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
    for enc in ("utf-8", "euc-kr", "cp949"):
        try:
            html = raw.decode(enc)
            break
        except UnicodeDecodeError:
            html = None
    if html is None:
        html = raw.decode("utf-8", "replace")
    p = _Text()
    p.feed(html)
    seen, out = set(), []
    for l in p.lines:
        if l not in seen:
            seen.add(l)
            out.append(l)
    return out


def h(s):
    return hashlib.sha1(s.encode("utf-8")).hexdigest()[:16]


def load_json(path, default):
    try:
        return json.load(open(path, encoding="utf-8"))
    except (OSError, ValueError):
        return default


def save_state(st):
    os.makedirs(pcr_notify.STATE_DIR, exist_ok=True)
    json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def in_window(windows, today):
    md = today.strftime("%m-%d")
    return not windows or any(a <= md <= b for a, b in windows)


def ask_claude(target, lines, year):
    """PC 의 Claude Code CLI 로 새 줄에서 날짜를 뽑는다. 토큰은 이때만 쓴다. 실패하면 None."""
    exe = shutil.which("claude")
    if not exe:
        log("claude CLI 없음 — 추출 생략")
        return None
    prompt = (
        f"아래는 「{target['name']}」 공식 페이지에 새로 나타난 문장들이다. {year}년 행사 날짜·시각(fest_date, fest_time)과 "
        "입장권·좌석 예매(사전예약) 오픈 일시(sale_open)를 찾아 JSON 한 개만 출력하라. 모르면 null. 추측 금지, 문장에 있는 것만. "
        '형식: {"fest_date":"YYYY-MM-DD"|null,"fest_time":"HH:MM"|null,"sale_open":"YYYY-MM-DDTHH:MM"|null,"summary":"30자 요약"}\n\n'
        + "\n".join(lines[:40])
    )
    try:
        r = subprocess.run([exe, "-p", prompt], capture_output=True, text=True, timeout=240, encoding="utf-8", errors="replace")
        m = re.search(r"\{.*\}", r.stdout, re.S)
        return json.loads(m.group(0)) if m else None
    except Exception as e:  # noqa: BLE001
        log(f"claude 추출 실패 {e}")
        return None


def send(title, msg, pr, dry, **kw):
    if dry:
        print(f"[dryrun] p{pr} {title} — {msg}")
        return True
    try:
        path, _ = pcr_notify.send(title, msg[:1000], pr, **kw)
        log(f"알림 {path} p{pr} {title}")
        return True
    except Exception as e:  # noqa: BLE001
        log(f"알림 실패 {title} {e}")
        return False


def watch(cfg, st, today, dry):
    snap = st.setdefault("snap", {})
    for t in cfg["targets"]:
        if not in_window(t.get("window"), today):
            continue
        year = today.year
        for url in t.get("urls", []):
            key = f"{t['id']}|{url}"
            try:
                lines = fetch_lines(url)
            except Exception as e:  # noqa: BLE001
                log(f"{t['id']} 받기 실패 {url} {e}")
                fails = st.setdefault("fails", {})
                fails[key] = fails.get(key, 0) + 1
                if fails[key] in (2, 7):  # 이틀째·일주일째에만 경고
                    send(f"⚠️ {t['name']} 페이지 못 읽음", f"{fails[key]}일째 · {url}", 0, dry)
                continue
            st.get("fails", {}).pop(key, None)
            hashes = [h(l) for l in lines]
            if key not in snap:
                snap[key] = hashes
                log(f"{t['id']} 기준 스냅샷 저장 {len(lines)}줄 {url}")
                continue
            old = set(snap[key])
            new = [l for l in lines if h(l) not in old]
            snap[key] = hashes
            hits = [l for l in new if any(k in l for k in t.get("keywords", []))]
            log(f"{t['id']} 새 줄 {len(new)} · 키워드 {len(hits)} {url}")
            if not hits:
                continue
            body = " / ".join(hits[:5])[:400] + f"\n{url}"
            send(f"👀 {t['name']} 페이지 변화", body, 1, dry, url=url, url_title="페이지 열기")
            if t.get("claude", True) and not dry:
                got = ask_claude(t, hits + [l for l in new if l not in hits], year)
                if got:
                    ev = st.setdefault("events", {}).setdefault(f"{t['id']}-{year}", {"name": t["name"], "notified": {}})
                    changed = []
                    for k in ("fest_date", "fest_time", "sale_open"):
                        if got.get(k) and got[k] != ev.get(k):
                            ev[k] = got[k]
                            changed.append(f"{k}={got[k]}")
                            if k == "sale_open":
                                ev["notified"].pop("sale_soon", None)
                                ev["notified"].pop("sale_alarm", None)
                    if changed:
                        ev["source"] = url
                        send(f"📅 {t['name']} 일정 추출", " · ".join(changed) + " · " + str(got.get("summary", "")), 1, dry)
                    log(f"{t['id']} claude 추출 {got}")


def reminders(st, now, dry):
    today = now.date()
    for eid, ev in st.get("events", {}).items():
        n = ev.setdefault("notified", {})
        name = ev.get("name", eid)
        fd = ev.get("fest_date")
        if fd:
            f = dt.date.fromisoformat(fd)
            d = (f - today).days
            tm = ev.get("fest_time") or "저녁"
            if d < 0:
                ev["status"] = "종료"
            elif d == 1 and not n.get("d1"):
                n["d1"] = send(f"🎆 내일 {name} {tm}", f"{f.month}/{f.day}({WD[f.weekday()]}) · 교통·날씨 확인", 0, dry)
            elif 2 <= d <= 7 and not n.get("d7"):
                n["d7"] = send(f"🎆 {d}일 뒤 {name}", f"{f.month}/{f.day}({WD[f.weekday()]}) {tm} · 숙소·교통 확인", 0, dry)
        so = ev.get("sale_open")
        if so:
            s = dt.datetime.fromisoformat(so)
            delta = (s - now).total_seconds() / 60
            if 0 < delta <= 45 and not n.get("sale_alarm"):
                n["sale_alarm"] = send(f"🚨 {s:%H:%M} {name} 예매 오픈 — 지금 접속", ev.get("source", "") or "로그인·결제수단 준비",
                                       2, dry, retry=60, expire=1800)
            elif 0 < (s.date() - today).days <= 3 and not n.get("sale_soon"):
                n["sale_soon"] = send(f"🎟 {s.month}/{s.day}({WD[s.weekday()]}) {s:%H:%M} {name} 예매 오픈",
                                      "로그인·결제수단·본인인증 미리 준비 · 오픈 45분 전에 다시 울립니다", 1, dry)


def main(argv):
    mode = argv[0] if argv else "list"
    dry = "--dryrun" in argv
    cfg = load_json(CFG, {"targets": []})
    st = load_json(STATE, {})
    for eid, ev in cfg.get("events_seed", {}).items():  # 설정 파일의 시드 행사는 없을 때만 넣는다
        st.setdefault("events", {}).setdefault(eid, dict(ev, notified={}))
    now = dt.datetime.now()
    if "--now" in argv:
        now = dt.datetime.fromisoformat(argv[argv.index("--now") + 1])
    if mode == "watch":
        watch(cfg, st, now.date(), dry)
        reminders(st, now, dry)
    elif mode == "alarm":
        reminders(st, now, dry)
    elif mode == "set":
        eid = argv[1]
        ev = st.setdefault("events", {}).setdefault(eid, {"name": eid, "notified": {}})
        for kv in argv[2:]:
            if "=" in kv:
                k, v = kv.split("=", 1)
                ev[k] = v or None
        print(json.dumps(ev, ensure_ascii=False))
    elif mode == "list":
        print(json.dumps({"events": st.get("events", {}), "snapshots": list(st.get("snap", {}).keys()),
                          "fails": st.get("fails", {})}, ensure_ascii=False, indent=1))
        return 0
    else:
        print(__doc__)
        return 2
    if not dry:
        save_state(st)
    return 0


if __name__ == "__main__":
    for _s in (sys.stdout, sys.stderr):
        try:
            _s.reconfigure(errors="replace")
        except (AttributeError, ValueError):
            pass
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:  # noqa: BLE001
        log(f"event-watch 오류 {e}")
        raise
