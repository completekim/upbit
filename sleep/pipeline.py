"""수면 일지 갱신 파이프라인. 사용:
  python3 -I pipeline.py extract <events.txt> <outdir>       # 루틴 세션 기록에서 sleep_calc.py·sleep_log.csv 복원
  python3 -I pipeline.py run <outdir> <truth.json|-> <today YYYY-MM-DD>   # 직접 기록 합쳐 실행 → db_writes.json·summary 출력
"""
import base64, csv, io, json, re, subprocess, sys, os
from datetime import date, timedelta, datetime, timezone

def extract(events, outdir):
    s = open(events, encoding="utf-8").read()
    pat = r'\\*"content\\*"\s*:\s*\\*"([A-Za-z0-9+/=]{200,})\\*"\s*,\s*\\*"id\\*"\s*:\s*\\*"([^"\\]+)\\*"\s*,\s*\\*"mimeType\\*"\s*:\s*\\*"([^"\\]+)\\*"\s*,\s*\\*"title\\*"\s*:\s*\\*"([^"\\]+)'
    got = {}
    for b, fid, mt, title in re.findall(pat, s):
        if title in ("sleep_calc.py", "sleep_log.csv"):
            got[title] = (base64.b64decode(b), fid)   # 마지막(가장 최근) 것이 남는다
    os.makedirs(outdir, exist_ok=True)
    for t, (data, fid) in got.items():
        open(os.path.join(outdir, t), "wb").write(data)
        print(f"복원 {t} fileId={fid} {len(data)}바이트")
    missing = {"sleep_calc.py", "sleep_log.csv"} - set(got)
    if missing: print("못 찾음:", ", ".join(sorted(missing))); sys.exit(2)

def run(outdir, truth_path, today):
    log = open(os.path.join(outdir, "sleep_log.csv"), encoding="utf-8-sig").read()
    if not log.endswith("\n"): log += "\n"
    truth = json.load(open(truth_path)) if truth_path != "-" else []
    added = 0
    for d in truth:
        v = d.get("data", d)
        if v.get("skipped") or not (v.get("sleep") or v.get("wake")): continue
        log += f'{d["id"]},09:00,TRUTH,{v.get("sleep") or ""},{v.get("wake") or ""}\n'; added += 1
    merged = os.path.join(outdir, "merged.csv"); open(merged, "w", encoding="utf-8").write(log)
    out = subprocess.run([sys.executable, "-I", os.path.join(outdir, "sleep_calc.py"), merged, "--auto"],
                         capture_output=True, text=True).stdout
    open(os.path.join(outdir, "out.txt"), "w").write(out)
    lines = out.splitlines()
    title = next((l[12:] for l in lines if l.startswith("NTFY_TITLE: ")), "")
    body = next((l[11:] for l in lines if l.startswith("NTFY_BODY: ")), "")
    cutoff = (date.fromisoformat(today) - timedelta(days=30)).isoformat()
    nights = []
    for row in csv.reader(l for l in lines if re.match(r"\d{4}-\d{2}-\d{2},", l)):
        n, ss, wk, mins, rs, ck, st, ts, tw, es, ew = (row + [""] * 11)[:11]
        if n < cutoff: continue
        iv = lambda x: int(x) if x not in ("", None) else None
        nights.append({"night": n, "sleep_start": ss or None, "wake": wk or None, "minutes": iv(mins), "resets": iv(rs) or 0,
                       "checks": iv(ck) or 0, "status": st, "truth_start": ts or None, "truth_wake": tw or None,
                       "err_start": iv(es), "err_wake": iv(ew)})
    m = re.search(r"평균 절대 오차 (\d+)분 \(비교 (\d+)개", out)
    tuned = next((l.split(": ", 1)[1] for l in lines if l.startswith("# 자동 튜닝 적용")), None)
    nt = re.search(r"정답 (\d+)/10", body)
    lr = [r for r in log.splitlines() if re.match(r"\d{4}-\d{2}-\d{2},\d", r) and ",TRUTH," not in r]
    lastev = lr[-1].split(",")[:2] if lr else None
    summary = {"updated_at": (datetime.now(timezone.utc) + timedelta(hours=9)).strftime("%m/%d %H:%M"),
               "last_log": f"{lastev[0][5:7]}/{lastev[0][8:10]} {lastev[1]}" if lastev else None,
               "ntruth": int(nt.group(1)) if nt else 10, "min_truth": 10,
               "mae": int(m.group(1)) if m else None, "mae_n": int(m.group(2)) if m else 0, "tuned": tuned,
               "alert": f"{title} — {body}" if any(k in title for k in ("끊김", "없음", "오류")) else None}
    # 기록 알림 판정: 보정 기간 + 오늘 밤 오차 없음 + 오늘 일지 기록(건너뛰기 포함) 없음
    tn = next((n for n in nights if n["night"] == today), None)
    has_doc = any(d["id"] == today for d in truth)
    remind = bool(nt) and not has_doc and not (tn and (tn["err_start"] is not None or tn["err_wake"] is not None))
    json.dump({"nights": nights, "summary": summary, "ntfy_title": title, "ntfy_body": body, "truth_rows_added": added,
               "remind": remind},
              open(os.path.join(outdir, "result.json"), "w"), ensure_ascii=False, indent=1)
    print(out.strip().splitlines()[-6:] and "\n".join(out.strip().splitlines()[-6:]))
    print(f"직접 기록 합침 {added}건 · 밤 {len(nights)}개 · 기록 알림 {'보냄' if remind else '안 보냄'} · 요약 {json.dumps(summary, ensure_ascii=False)}")

if __name__ == "__main__":
    {"extract": lambda: extract(sys.argv[2], sys.argv[3]), "run": lambda: run(sys.argv[2], sys.argv[3], sys.argv[4])}[sys.argv[1]]()
