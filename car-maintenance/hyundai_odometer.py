#!/usr/bin/env python3
"""그붕이 누적 주행거리를 현대 디벨로퍼스(블루링크) 데이터 API로 읽는다.

표준 라이브러리만 쓴다. 비밀값은 환경 변수로만 받는다.

  HYUNDAI_CLIENT_ID       디벨로퍼스 콘솔 프로젝트의 Client ID
  HYUNDAI_CLIENT_SECRET   같은 프로젝트의 Client Secret
  HYUNDAI_REFRESH_TOKEN   최초 동의 후 받은 Refresh Token
  HYUNDAI_REDIRECT_URI    콘솔에 등록한 Redirect URI (토큰 요청에 같이 보낸다)
  HYUNDAI_CAR_ID          (선택) 차량 ID. 없으면 차량 목록의 첫 차를 쓴다
  HYUNDAI_AUTH_HOST       (선택) 기본 https://prd.kr-ccapi.hyundai.com
  HYUNDAI_API_HOST        (선택) 기본 https://dev.kr-ccapi.hyundai.com

사용
  python3 hyundai_odometer.py authorize-url      동의 화면 주소 출력
  python3 hyundai_odometer.py odometer           {"km":..,"date":..} 한 줄 JSON 출력
  python3 hyundai_odometer.py cars               연결된 차량 목록 출력

실패하면 종료 코드 1과 함께 {"error": ...} 한 줄을 출력한다. 토큰 값은 출력하지 않는다.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
AUTH_HOST = os.environ.get("HYUNDAI_AUTH_HOST", "https://prd.kr-ccapi.hyundai.com").rstrip("/")
API_HOST = os.environ.get("HYUNDAI_API_HOST", "https://dev.kr-ccapi.hyundai.com").rstrip("/")
UNIT_TO_KM = {0: 0.0003048, 1: 1.0, 2: 0.001, 3: 1.609344}  # 0 feet · 1 km · 2 meter · 3 mile


class ApiError(Exception):
    pass


def env(name, required=True):
    v = os.environ.get(name, "").strip()
    if required and not v:
        raise ApiError(f"환경 변수 {name}가 비어 있다")
    return v


def http(method, url, headers=None, data=None):
    body = urllib.parse.urlencode(data).encode() if isinstance(data, dict) else data
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        raise ApiError(f"{method} {urllib.parse.urlsplit(url).path} → HTTP {e.code}: {detail}")
    except urllib.error.URLError as e:
        raise ApiError(f"{method} {urllib.parse.urlsplit(url).netloc} 연결 실패: {e.reason}")
    try:
        return json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        raise ApiError(f"JSON이 아닌 응답: {raw[:200]}")


def access_token():
    cid, secret = env("HYUNDAI_CLIENT_ID"), env("HYUNDAI_CLIENT_SECRET")
    form = {"grant_type": "refresh_token", "refresh_token": env("HYUNDAI_REFRESH_TOKEN")}
    redirect = env("HYUNDAI_REDIRECT_URI", required=False)
    if redirect:
        form["redirect_uri"] = redirect
    basic = base64.b64encode(f"{cid}:{secret}".encode()).decode()
    res = http("POST", f"{AUTH_HOST}/api/v1/user/oauth2/token",
               {"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"}, form)
    tok = res.get("access_token")
    if not tok:
        raise ApiError(f"토큰 응답에 access_token이 없다: {sorted(res)}")
    rotated = bool(res.get("refresh_token")) and res["refresh_token"] != form["refresh_token"]
    return tok, rotated


def get(path, tok):
    return http("GET", f"{API_HOST}{path}", {"Authorization": f"Bearer {tok}"})


def car_list(tok):
    res = get("/api/v1/car/profile/carlist", tok)
    cars = res.get("cars") if isinstance(res, dict) else res
    if not isinstance(cars, list):
        raise ApiError(f"차량 목록 형식이 예상과 다르다: {str(res)[:200]}")
    return cars


def parse_odometer(res):
    """응답에서 가장 최근 값을 km로 꺼낸다. 단일 객체·목록 두 형태를 모두 받는다."""
    rows = res.get("odometers") if isinstance(res, dict) else None
    if not rows:
        rows = [res] if isinstance(res, dict) and "value" in res else []
    if not rows:
        raise ApiError(f"주행거리 값이 응답에 없다: {str(res)[:200]}")

    def stamp(r):
        return str(r.get("timestamp") or r.get("date") or "")

    r = sorted(rows, key=stamp)[-1]
    unit = int(r.get("unit", 1))
    km = float(r["value"]) * UNIT_TO_KM.get(unit, 1.0)
    s = "".join(ch for ch in stamp(r) if ch.isdigit())
    date = f"{s[0:4]}-{s[4:6]}-{s[6:8]}" if len(s) >= 8 else datetime.now(KST).strftime("%Y-%m-%d")
    return {"km": round(km), "date": date, "unit": unit, "timestamp": stamp(r)}


def cmd_odometer():
    tok, rotated = access_token()
    car_id = env("HYUNDAI_CAR_ID", required=False)
    if not car_id:
        cars = car_list(tok)
        if not cars:
            raise ApiError("동의된 차량이 없다. 디벨로퍼스 동의 화면에서 차량을 선택했는지 확인한다")
        car_id = cars[0].get("carId")
    out = parse_odometer(get(f"/api/v1/car/status/{urllib.parse.quote(str(car_id))}/odometer", tok))
    out.update({"source": "bluelink", "refreshTokenRotated": rotated})
    return out


def cmd_cars():
    tok, _ = access_token()
    return {"cars": [{k: c.get(k) for k in ("carId", "carNickname", "carSellname", "carName", "carType")} for c in car_list(tok)]}


def cmd_authorize_url():
    q = {"client_id": env("HYUNDAI_CLIENT_ID"), "redirect_uri": env("HYUNDAI_REDIRECT_URI"),
         "response_type": "code", "state": "gbung"}
    return {"url": f"{AUTH_HOST}/api/v1/user/oauth2/authorize?{urllib.parse.urlencode(q)}"}


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "odometer"
    fn = {"odometer": cmd_odometer, "cars": cmd_cars, "authorize-url": cmd_authorize_url}.get(cmd)
    if not fn:
        print(__doc__)
        return 2
    try:
        print(json.dumps(fn(), ensure_ascii=False))
        return 0
    except ApiError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
