# CLAUDE.md

## 시간대 규칙 (필수)

- 사용자는 대한민국에 있다. 모든 날짜·시간의 기준은 **KST (Asia/Seoul, UTC+09:00)** 이다.
- 이 실행 환경(클라우드 컨테이너)의 시계는 **UTC**다. 시스템이 알려주는 "Today's date"와 `date` 출력은 UTC 기준이므로 그대로 "오늘"로 쓰지 않는다.
- "오늘", "내일", "오후 2시" 같은 상대적 표현은 반드시 먼저 KST 현재 시각을 확인한 뒤 해석한다:
  `TZ=Asia/Seoul date '+%Y-%m-%d %H:%M %Z'`
  (UTC 15:00 이후는 KST로 이미 다음 날이다.)
- Google 캘린더 일정 생성·수정 시:
  - `startTime`/`endTime`은 `+09:00` 오프셋으로, `timeZone`은 `Asia/Seoul`로 지정한다.
  - 기본 캘린더는 `wsc627@gmail.com` (Asia/Seoul).
  - 종료 시간이 지정되지 않으면 30분으로 잡는다.
- 사용자에게 시간을 보여줄 때는 KST로 표기한다. UTC는 필요할 때만 괄호로 덧붙인다.
