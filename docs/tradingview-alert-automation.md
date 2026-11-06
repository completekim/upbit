---
type: 정리
title: Claude × TradingView 알람 활용 설계
created: 2026-11-07
status: 진행중
tags: [트레이딩, 트레이딩뷰, 업비트, 자동화, MacroDroid, Claude]
---
> 병목은 「알람을 사람이 챙겨야 하는 구조」. MacroDroid로 앱 푸시를 가로채 규칙형은 서버가 재검증 후 자동 주문, 판단형은 Claude 루틴이 병합·요약해 Pushover로 보낸다.

## 목차
- [[#1. 문제 정의]]
- [[#2. Claude × TradingView 활용 경로 평가]]
- [[#3. 알람 채널 진단]]
- [[#4. 목표 구조]]
- [[#5. MacroDroid 중계 매크로]]
- [[#6. 규칙형 — 서버 자동 실행]]
- [[#7. 판단형 — Claude 루틴 요약]]
- [[#8. Pine Script — 현 전략 이식본]]
- [[#9. 제약·리스크]]
- [[#10. 저장소 관련 확인 사항]]
- [[#11. 레퍼런스]]

## 1. 문제 정의

- TradingView에 걸어 둔 알람이 계속 오지만 놓친다.
- 원인은 두 가지가 겹친 것: ① 모든 알람이 「사람이 보고 판단」해야 하는 형태 ② 알람이 앱 푸시(휘발성 채널)로만 온다.
- 알람을 다른 채널로 옮기는 것만으로는 해결되지 않는다. 받는 쪽이 **규칙형은 자동 실행**, **판단형은 병합·요약**을 대신해야 효과가 난다.

## 2. Claude × TradingView 활용 경로 평가

| 경로 | 효과 | 약관·안정성 | 판정 |
|---|---|---|---|
| Pine Script v6 작성·디버깅 | 높음. 컴파일 에러 붙여 넣기 → 수정 반복이 빠름 | 문제없음 | 핵심 |
| 알람 → 서버 → 업비트 주문 | 높음. 시점 판단을 TradingView가 맡음 | 공식 기능(웹훅) 또는 앱 푸시 중계 | 핵심 |
| 차트 스크린샷 해석 | 낮음. 픽셀 판독이라 수치가 부정확하고 예측력 없음 | 문제없음 | 보조 |
| 비공식 MCP 연동 | 중간. 데스크톱 앱 조작·OHLCV 조회 | 약관 회색지대(비표시 용도 금지), 업데이트 시 깨짐 | 비권장 |

- TradingView는 차트 데이터용 공식 API와 공식 MCP가 없다. 공개된 MCP 서버는 전부 개인 제작물이다.
- Claude가 매매 우위(edge)를 만들지는 않는다. 가치는 개발·검증 속도에 있다.
- Claude를 실시간 매매 판단 루프에 넣지 않는다. 지연이 생기고 같은 입력에도 결과가 달라질 수 있으며 비용이 든다. Claude는 요약·분류·사후 분석에 둔다.

## 3. 알람 채널 진단

- 2026-10-06 Gmail 확인: tradingview.com 발신 메일은 로그인 알림·마케팅뿐이고 **알람 메일은 0건**. 알람은 앱 푸시로만 오고 있었다.
- 앱 푸시는 폰 OS 안에서 끝나므로 Claude·서버가 그대로는 읽을 수 없다.
- TradingView 웹훅은 Essential 이상 유료 플랜 + 2FA가 필요하다. 그밖의 조건: 포트 80/443만 허용, 3초 안에 응답하지 않으면 취소, IPv6 미지원, 발신 IP 4개 고정.
- MacroDroid로 앱 푸시를 가로채면 유료 플랜이 없어도 된다(웹훅 우회).

## 4. 목표 구조

```
TradingView 앱 푸시
   └─ MacroDroid [알림 수신: TradingView]
        ├─ 매크로 A: 이메일 보내기 → Gmail "[TV]" 원장 → Claude 루틴(매시) 병합·분류 → Pushover   (판단형)
        └─ 매크로 B: 등급 "실행"만 HTTP POST → 자체 서버 → 업비트 시세로 재검증 → 주문           (규칙형)
```

- 알람 메시지 형식 고정(TradingView 알람 메시지 칸):
  `[TV] KRW-BTC | {{interval}} | {{close}} | 조건명 | 실행`
  - 티커는 업비트 형식으로 직접 적는다. `{{ticker}}`는 `BTCKRW`로 나와 업비트 형식(`KRW-BTC`)과 다르다.
  - 마지막 칸은 등급(`실행` 또는 `관찰`). 서버와 루틴이 이 칸으로 경로를 가른다.
- 폰 알림은 Pushover 단일 경로(실패 시 PushNotification). 텔레그램 등 다른 발송 단계는 두지 않는다.

## 5. MacroDroid 중계 매크로

| 항목 | 매크로 A — 원장·요약용 | 매크로 B — 실행용 |
|---|---|---|
| 트리거 | 알림 수신 · 앱: TradingView | 알림 수신 · 앱: TradingView · 텍스트에 `실행` 포함 |
| 액션 | 이메일 보내기 → 개인 Gmail. 제목 `[TV] {not_title}`, 본문 `{notification}` | HTTP 요청 POST → 서버 `/relay`. 헤더 `X-Relay-Token`, 본문 form `text={notification}` |
| 비고 | Gmail 검색·라벨로 중복 없이 처리 | JSON 대신 form을 쓴다. 본문에 따옴표·줄바꿈이 섞여도 깨지지 않는다 |

- `{not_title}`·`{notification}`은 MacroDroid가 알림 제목·본문을 넣어 주는 변수(매직 텍스트).
- 폰 필수 설정: MacroDroid 알림 접근 권한 허용, 배터리 최적화 제외(삼성: 「제한 없음」), 백그라운드 데이터 허용. 하나라도 빠지면 알람이 조용히 누락된다.
- 릴레이 토큰·서버 URL은 비밀값. 저장소·노트에 적지 않는다.
- 무료판은 매크로 개수 제한(5개로 알려짐). A·B 두 개면 충분하다.

## 6. 규칙형 — 서버 자동 실행

원칙: 폰을 거쳐 온 알림은 **깨우기 신호일 뿐 주문 근거가 아니다.**

1. **재검증** — 알림의 가격을 믿지 않는다. 업비트 시세로 조건을 다시 계산하고, 성립할 때만 주문한다.
2. **중복 방지** — 티커 + 일봉 시작(KST 09:00) 단위로 1회만 주문한다. 같은 알림이 두 번 와도 주문은 한 번.
3. **누락 보완** — 중계가 실패해도 서버가 주기적으로 조건을 직접 점검하는 백업 루프를 둔다.
4. **매도** — 알림에 의존하지 않고 서버의 시각 작업으로 처리한다(현 봇과 같은 KST 08:59:50 청산).
5. **고정 IP** — 업비트 주문 API 키는 허용 IP 등록이 필수다. 서버는 고정 IP가 있어야 한다.

```python
import os, json, hmac, threading, datetime as dt
from zoneinfo import ZoneInfo
from flask import Flask, request, abort
import pyupbit

KST = ZoneInfo("Asia/Seoul")
TOKEN = os.environ["RELAY_TOKEN"]
STATE = os.environ.get("STATE_FILE", "orders.json")
K = 0.5
upbit = pyupbit.Upbit(os.environ["UPBIT_ACCESS"], os.environ["UPBIT_SECRET"])
app = Flask(__name__)
lock = threading.Lock()

def session_key(ticker):
    """업비트 일봉 경계(KST 09:00) 기준 중복 방지 키"""
    now = dt.datetime.now(KST)
    start = now.replace(hour=9, minute=0, second=0, microsecond=0)
    if now < start:
        start -= dt.timedelta(days=1)
    return f"{ticker}@{start:%Y-%m-%d}"

def load_state():
    try:
        with open(STATE) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def breakout_ok(ticker):
    """알림 가격 대신 업비트 시세로 변동성 돌파 조건 재계산"""
    df = pyupbit.get_ohlcv(ticker, interval="day", count=2)
    prev = df.iloc[0]
    target = prev["close"] + (prev["high"] - prev["low"]) * K
    return pyupbit.get_current_price(ticker) > target

def buy(ticker):
    with lock:
        state = load_state()
        key = session_key(ticker)
        if key in state or not breakout_ok(ticker):
            return
        krw = upbit.get_balance("KRW")
        if krw > 5000:
            state[key] = upbit.buy_market_order(ticker, krw * 0.9995)
            with open(STATE, "w") as f:
                json.dump(state, f, default=str)

@app.post("/relay")
def relay():
    if not hmac.compare_digest(request.headers.get("X-Relay-Token", ""), TOKEN):
        abort(401)
    parts = [p.strip() for p in request.form.get("text", "").replace("[TV]", "").split("|")]
    if len(parts) >= 5 and parts[4] == "실행":
        threading.Thread(target=buy, args=(parts[0],), daemon=True).start()
    return "ok", 200
```

- 응답은 즉시 반환하고, 주문은 백그라운드 스레드에서 처리한다(웹훅 3초 제한과 같은 구조).
- 키는 환경 변수로만 읽는다.

## 7. 판단형 — Claude 루틴 요약

- Gmail 원장(매크로 A)을 매시 읽는 루틴. Gmail 커넥터가 필요하다. 세션 안 `create_trigger`로 만든 루틴에는 커넥터가 붙지 않으므로 claude.ai 루틴 화면 또는 PC `RemoteTrigger`로 만든다.
- 실행 환경은 `기본 루틴들`(Pushover 환경 변수가 이 환경에만 있다).
- 반복 루틴의 최소 주기는 1시간. 지연이 최대 1시간이므로 실행용이 아니라 놓친 알람을 회수·결산하는 용도다.

루틴 프롬프트 전문:

```
단계1 Gmail에서 subject:"[TV]" -label:TV-처리완료 newer_than:2d 로 검색한다.
단계2 각 메일의 제목과 본문에서 티커, 주기, 가격, 조건명, 등급(실행 또는 관찰), 수신 시각(KST)을 뽑는다.
단계3 같은 티커와 조건이 1시간 안에 반복되면 1건으로 묶고 반복 횟수를 적는다.
단계4 새 건이 없으면 아무것도 보내지 않고 끝낸다.
단계5 Pushover로 요약 1건을 보낸다. 제목은 "TV 알람 N건", 본문은 등급 실행 건을 맨 위에 두고 1,024자 이내로 쓴다. 실행 건이 있으면 priority 1, 없으면 0. 환경 변수 PUSHOVER_TOKEN 과 PUSHOVER_USER 의 값은 쉘 변수 참조로 curl --data-urlencode 에 넣고 값을 출력하지 않는다. 응답에 "status":1 이 없으면 1회 재시도하고, 두 번 실패하면 PushNotification 으로 보낸다.
단계6 등급 실행 건은 알림 확인함 규격(completekim/upbit 브랜치 ccr-e1648cf4-uvqpkq 의 alerts/README.md)대로 등록한다.
단계7 처리한 메일에 TV-처리완료 라벨을 붙인다.
```

## 8. Pine Script — 현 전략 이식본

`BTC_autotrade.py`·`VET_autotrade_slack.py`의 변동성 돌파(+MA 필터)를 TradingView Strategy Tester로 수년치 검증하기 위한 이식본. 차트 `UPBIT:BTCKRW`, 1D. TradingView 크립토 일봉은 00:00 UTC = 09:00 KST에 시작해 업비트 일봉 경계와 같다.

```pine
//@version=6
strategy("Volatility Breakout + MA (Upbit Daily)", overlay = true,
     initial_capital = 1000000, currency = currency.KRW,
     default_qty_type = strategy.percent_of_equity, default_qty_value = 99,
     commission_type = strategy.commission.percent, commission_value = 0.05,
     slippage = 2)

k      = input.float(0.5, "K", minval = 0.1, maxval = 1.0, step = 0.1)
useMA  = input.bool(true, "MA filter")
maLen  = input.int(15, "MA length")

// 1) 전일 진입분은 일봉 종가(= 다음날 08:59 KST 직전)에 청산 — 봇의 08:59:50 매도에 대응
if strategy.position_size > 0
    strategy.close("L", immediately = true)

// 2) 다음 봉 목표가 = 오늘 종가 + 오늘 변동폭 * K  (봇의 get_target_price와 동일 식)
target = close + (high - low) * k
ma     = ta.sma(close, maLen)
pass   = not useMA or target > ma   // 봇은 '현재가 > MA15'. 체결가=목표가이므로 근사

// 3) 다음 봉 장중 목표가 돌파 시 스톱 매수
if pass
    strategy.entry("L", strategy.long, stop = target)
else
    strategy.cancel("L")

plot(target[1], "Active target", color.orange, style = plot.style_stepline)
plot(ma, "MA", color.blue)
```

- MA 필터는 근사다. 봇은 당일 미확정 봉을 포함한 15일 평균과 실시간 현재가를 비교하고, 이 스크립트는 전일 종가 기준 MA와 목표가를 비교한다.
- 확정된 전일 봉 값만 쓰므로 재도색(repainting)·미래 참조가 없다. 알람 트리거는 「봉 마감 시 1회」로 둔다.

## 9. 제약·리스크

| 항목 | 내용 | 대응 |
|---|---|---|
| 폰이 단일 중계점 | 전원 꺼짐·절전 종료·오프라인이면 그 사이 알람 소실 | 서버 백업 루프(§6-3) |
| 알림 중복 | 알림 갱신·그룹화로 같은 알람이 두 번 트리거 | 일봉 단위 중복 방지 키(§6-2), 루틴 병합(§7) |
| 알림 본문 잘림 | 긴 메시지가 알림에서 잘릴 수 있음(미검증) | 알람 메시지를 짧은 고정 형식으로(§4) |
| 앱 푸시 자체 지연·누락 | TradingView 푸시는 전달이 보장되지 않음 | 규칙형은 서버가 독립적으로 조건 점검 |
| 루틴 지연 | 최소 주기 1시간 | 판단형 결산에만 사용 |
| 비공식 MCP | 약관상 비표시 용도 금지, 계정 정지 위험 | 사용하지 않음 |
| 백테스트 과적합 | 소표본으로 최적 K를 고르면 의미 없음 | Strategy Tester로 수년치 검증, 수수료 0.05% 반영 |

## 10. 저장소 관련 확인 사항

- **API 키 노출**: 이 저장소는 public이다. `BTC_autotrade.py` 등 자동매매 스크립트와 `AccessKey_SecretKey.txt`에 업비트 access/secret 키가 하드코딩·커밋되어 있고 git 히스토리에도 남아 있다.
- **시간대 결함**: `datetime.datetime.now()`(시간대 정보 없는 로컬 시각)를 pyupbit 일봉 인덱스(KST 09:00 기준)와 비교한다. UTC 서버에서 돌면 매수 구간이 9시간 어긋난다(`docs/timezone-kst.md`와 같은 계열의 문제). §6 서버는 `ZoneInfo("Asia/Seoul")`로 처리한다.
- **백테스트 표본**: `BTC_backtesting.py`·`BTC_best_k.py`는 `count=7`(7일)만 쓴다. 최적 K 선택이 통계적으로 의미가 없다.

## 11. 레퍼런스

- [TradingView Support — How to configure webhook alerts](https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/) — 2FA, 포트 80/443, 3초 제한, IPv6 미지원
- [PickMyTrade — Allowlist TradingView's 4 Webhook IPs](https://blog.pickmytrade.io/how-to-allowlist-tradingviews-4-webhook-ips/) · [TradingView Webhooks FAQ](https://pickmytrade.io/faq/tradingview-webhooks) — 발신 IP, 웹훅은 Essential 이상(중계 업체 자료라 상업적 편향 가능성)
- [PickMyTrade — How to Connect Claude AI to TradingView Using MCP](https://blog.pickmytrade.io/how-to-connect-claude-ai-to-tradingview-using-mcp/) · [bidouilles/mcp-tradingview-server](https://github.com/bidouilles/mcp-tradingview-server) — 비공식 MCP 현황
- [TradingView — Terms of Use, Policies](https://in.tradingview.com/policies) — 비표시 용도(자동매매·알고리즘 판단) 금지
- [TradingView — Pine Script v6 has landed](https://www.tradingview.com/blog/en/pine-script-v6-has-landed-48830)
- [CrossTrade — Pine Script Repainting](https://crosstrade.io/blog/pine-script-repainting) — 미래 참조, `barstate.isconfirmed`
- [TradersPost — TradingView Webhook Alerts Documentation](https://blog.traderspost.io/article/tradingview-webhook-alerts-documentation) — 플레이스홀더는 단순 텍스트로 치환
- [WikiDocs — 업비트 Open API 키 발급](https://wikidocs.net/179292) — 주문 키 허용 IP 등록 필수
- [Wyze Forum — Share MacroDroid Macros](https://forums.wyze.com/t/share-macrodroid-macros-for-wyze-iot/252285/38) — `{not_title}`·`{notification}` 사용 예
- [PhoneArena — MacroDroid Spotlight](https://www.phonearena.com/news/Spotlight-MacroDroid-is-an-automation-playground-for-those-overwhelmed-by-Tasker_id69710) — 무료판 매크로 5개 제한(오래된 기사)
- tradingview.com·docs.upbit.com은 세션 네트워크 정책으로 직접 열지 못했다. 해당 항목은 검색 결과 발췌문으로 확인한 내용이다.
