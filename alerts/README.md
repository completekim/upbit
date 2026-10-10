# 알림 확인함 — 확인 누를 때까지 다시 보내기

폰 알림을 밀어서 지우면 루틴은 사용자가 봤는지 알 수 없다. 그래서 「확인」을 서버에 남기는 곳을 따로 두고,
확인이 없는 알림은 정해진 시각마다 다시 보낸다.

| 구성 | 위치 |
|---|---|
| 확인 페이지 (db: `alerts`) | https://claude.ai/artifact/R6P14nEFrYg4mDMWPvNqMA |
| 재발송 판정 스크립트 | `alerts/ack_resend.py` — 루틴 프롬프트에 같은 코드를 넣어 두고 실행 때 Write 로 저장해 돌린다. 루틴 세션의 자동 권한 검사가 인터넷에서 받은 스크립트 실행을 막기 때문이다(2026-10-11 시험에서 확인). 이 파일을 고치면 루틴 프롬프트도 같이 고친다 |
| 재발송 루틴 | 「미확인 알림 재발송 (매일 08:07·12:07·18:07·21:07)」 `trig_01GBJjr5izE6DzNmZsE5Murr`, 환경 「기본 루틴들」 |

## 흐름

1. 원래 루틴이 알림을 보낼 때 `alerts/<id>` 문서를 하나 만든다 (아래 규격).
2. 알림을 누르면 확인 페이지가 열린다. 「확인했어요」를 누르면 `status: "acked"`.
3. 재발송 루틴은 `status == "pending"` 이고 만료 전이며 마지막 발송 뒤 50분이 지난 알림을 다시 보낸다.
   3번째부터는 ntfy priority 5(urgent).
4. 만료 시각이 지나면 `status: "expired"` 로 바꾸고 더 보내지 않는다.

## 원래 루틴에 넣는 등록 블록 (복사용)

```
【확인 대기 등록】 알림을 보낸 직후(발송 성공·실패와 무관하게) ToolSearch "select:ArtifactData" 로 도구를 불러
ArtifactData action "set", url "https://claude.ai/artifact/R6P14nEFrYg4mDMWPvNqMA", collection "alerts",
doc_id "<id>", data:
  {"title": <알림 제목>, "message": <알림 본문>, "source": "<루틴 이름>",
   "created": <지금 UTC ISO, date -u +%Y-%m-%dT%H:%M:%SZ>, "last_sent": <같은 값>, "sent_count": 1,
   "expires": <만료 UTC ISO>, "status": "pending", "click": <원래 링크 또는 null>}
같은 doc_id 가 이미 있다는 오류(if_version 요구)가 나면 이미 등록된 것이니 그대로 둔다.
첫 알림의 Click(클릭 URL)은 확인 페이지 https://claude.ai/artifact/R6P14nEFrYg4mDMWPvNqMA 로 한다.
```

- `doc_id`: `<루틴약칭>-<YYYYMMDD>` (예: `culture-20261022`, `hwadam-20270310`). 문자는 영문·숫자·`-`만.
- `expires`: 그 알림이 의미를 잃는 시각. 지나면 재발송을 멈춘다. 반드시 넣는다.
- 공개 ntfy 토픽으로 나가므로 제목·본문에 이름·번호·금액 상세를 넣지 않는다.

## 발송 경로

Pushover(환경 변수 있을 때) → ntfy JSON → PushNotification(Claude 앱 푸시). 2026-10-11 시험에서 ntfy.sh 가 클라우드 공용 IP 일일 한도(429)로 거부해 Claude 앱 푸시로 나갔다. 어느 경로로 오든 눌렀을 때 확인 페이지가 열리는 것은 ntfy·Pushover 뿐이고, Claude 앱 푸시는 본문만 보인다.

## 적용 중인 루틴

- 화담숲 예약 오픈 알림 (`hwadam-<YYYYMMDD>`, 점심 실행은 `-noon`)
- 위례 컬처클럽 접수 알림 (`culture-<접수일 YYYYMMDD>`)
