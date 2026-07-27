# upbit

pyupbit 를 이용한 업비트 자동매매 / 백테스팅 스크립트 모음.

## 설정

API 키는 코드에 넣지 않고 환경변수로 전달합니다.

```bash
cp .env.example .env     # .env 를 열어 본인 키로 채우기
```

실행할 때 환경변수를 읽어오도록 합니다.

```bash
export $(grep -v '^#' .env | xargs)
python BTC_autotrade.py
```

`.env` 는 `.gitignore` 에 등록되어 있어 커밋되지 않습니다.

| 환경변수 | 용도 |
|---|---|
| `UPBIT_ACCESS_KEY` | 업비트 Open API Access Key |
| `UPBIT_SECRET_KEY` | 업비트 Open API Secret Key |
| `SLACK_BOT_TOKEN` | `VET_autotrade_slack.py` 의 슬랙 알림용 |

키 발급은 [업비트 PC > My > Open API 관리](https://upbit.com/mypage/open_api_management) 에서 할 수 있습니다.

## 파일

| 파일 | 설명 |
|---|---|
| `BTC_autotrade.py` | BTC 변동성 돌파 전략 자동매매 |
| `VET_autotrade.py` | VET 변동성 돌파 전략 자동매매 |
| `VET_autotrade_MA15.py` | 변동성 돌파 + 15일 이동평균선 필터 |
| `VET_autotrade_slack.py` | 위 전략에 슬랙 알림 추가 (BTC 기준) |
| `BTC_backtesting.py` | 변동성 돌파 전략 백테스팅, MDD 계산 |
| `BTC_best_k.py` | k 계수별 수익률 비교 |
| `Balance.py` | 보유 잔고 조회 |

## 주의

실제 자금으로 주문을 넣는 스크립트입니다. 소액으로 충분히 검증한 뒤 사용하세요.
