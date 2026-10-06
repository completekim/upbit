# ── 그붕이 블루링크 수집기 (클라우드 환경 「대화」 설정 스크립트 맨 아래에 붙인다) ──
mkdir -p /root/gbung /root/.claude
git clone -q --depth 1 -b claude/car-maintenance-tracker-bgis7g https://github.com/completekim/upbit /root/gbung/src 2>/dev/null \
  && cp /root/gbung/src/car-maintenance/hyundai_odometer.py /root/gbung/hyundai_odometer.py
python3 - <<'PY'
import json, os
p = "/root/.claude/settings.json"
d = json.load(open(p)) if os.path.exists(p) else {}
allow = d.setdefault("permissions", {}).setdefault("allow", [])
for r in ["Bash(python3 -I /root/gbung/hyundai_odometer.py status)",
          "Bash(python3 -I /root/gbung/hyundai_odometer.py odometer)"]:
    if r not in allow:
        allow.append(r)
json.dump(d, open(p, "w"), ensure_ascii=False, indent=2)
PY
