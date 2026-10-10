#!/usr/bin/env python3
"""알림 확인함 재발송 판정.

ArtifactData 로 받은 alerts 문서(<db>/alerts/<id>.json)를 읽어
  - 만료 시각이 지난 미확인 알림 → EXPIRE <id>   (out/<id>.update.json)
  - 마지막 발송 뒤 GAP_MIN 분 이상 지난 미확인 알림 → SEND <id>
      out/<id>.ntfy.json    ntfy JSON 본문 (그대로 POST)
      out/<id>.update.json  발송 성공 뒤 update 할 필드
      out/<id>.txt          1행 제목, 2행 본문 (Pushover·PushNotification 용)
을 만든다. 네트워크·DB 쓰기는 하지 않는다.

사용: python3 -I ack_resend.py --db DIR --outdir DIR [--now ISO8601]
"""
import argparse
import datetime as dt
import glob
import json
import os
import sys

ART = "https://claude.ai/artifact/R6P14nEFrYg4mDMWPvNqMA"
TOPIC = "wsc-alerts-ng9561vu"
GAP_MIN = 50
KST = dt.timezone(dt.timedelta(hours=9))


def parse(ts):
    if not ts:
        return None
    try:
        d = dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=KST)


def kst(d):
    return d.astimezone(KST).strftime("%m/%d %H:%M").lstrip("0")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--now")
    a = ap.parse_args()

    now = parse(a.now) if a.now else dt.datetime.now(dt.timezone.utc)
    now_iso = now.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    os.makedirs(a.outdir, exist_ok=True)

    files = sorted(glob.glob(os.path.join(a.db, "alerts", "*.json")))
    send = expire = skip = 0
    for f in files:
        doc_id = os.path.splitext(os.path.basename(f))[0]
        try:
            d = json.load(open(f, encoding="utf-8"))
        except (OSError, ValueError) as e:
            print(f"BAD {doc_id} {e}")
            continue
        if d.get("status") != "pending":
            continue
        exp = parse(d.get("expires"))
        if exp and exp <= now:
            json.dump({"status": "expired", "expired_at": now_iso},
                      open(os.path.join(a.outdir, doc_id + ".update.json"), "w"), ensure_ascii=False)
            print(f"EXPIRE {doc_id}")
            expire += 1
            continue
        last = parse(d.get("last_sent")) or parse(d.get("created"))
        if last and (now - last).total_seconds() < GAP_MIN * 60:
            print(f"WAIT {doc_id} last_sent {kst(last)}")
            skip += 1
            continue

        n = int(d.get("sent_count") or 0) + 1
        title = f"🔁 다시 알림 · {d.get('title') or doc_id}"
        body = (d.get("message") or "").strip()
        tail = f"확인 안 함 · {n}번째"
        if exp:
            tail += f" · 만료 {kst(exp)}"
        msg = (body + "\n" if body else "") + tail
        ntfy = {
            "topic": TOPIC,
            "title": title,
            "message": msg,
            "priority": 5 if n >= 3 else 4,
            "tags": ["repeat"],
            "click": ART,
            "actions": [{"action": "view", "label": "확인하러 가기", "url": ART, "clear": True}],
        }
        json.dump(ntfy, open(os.path.join(a.outdir, doc_id + ".ntfy.json"), "w"), ensure_ascii=False)
        json.dump({"last_sent": now_iso, "sent_count": n},
                  open(os.path.join(a.outdir, doc_id + ".update.json"), "w"), ensure_ascii=False)
        with open(os.path.join(a.outdir, doc_id + ".txt"), "w", encoding="utf-8") as t:
            t.write(title + "\n" + msg.replace("\n", " / ") + "\n")
        print(f"SEND {doc_id} n={n}")
        send += 1

    print(f"SUMMARY send={send} expire={expire} wait={skip} docs={len(files)} now={kst(now)} KST")


if __name__ == "__main__":
    sys.exit(main())
