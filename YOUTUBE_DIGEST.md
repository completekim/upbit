# 유튜브 자막 + 스크린샷 추출

영상을 다 보지 않고 Claude에게 내용 파악을 시키기 위한 추출 방법 정리.

---

## 방법 1 — 설치 없이, 유튜브 웹에서 자막만 복사 (가장 빠름)

1. 영상 아래 설명란 펼치기 → **스크립트 표시 (Show transcript)** 클릭
2. 오른쪽 스크립트 패널의 점 3개 메뉴 → **타임스탬프 전환**으로 시간 표시 끄기 (원하면)
3. 전체 드래그해서 복사 → Claude에 붙여넣기

한계: 스크립트 버튼이 없는 영상(자막 자체가 없음)은 불가, 스크린샷은 따로 캡처해야 함,
긴 영상은 스크롤 복사가 번거로움.

---

## 방법 2 — yt-dlp 한 줄 (자막만, 반복 작업에 좋음)

```bash
pip install -U yt-dlp

# 한국어 자막(없으면 자동생성 자막)을 vtt로 저장, 영상은 받지 않음
yt-dlp --skip-download --write-subs --write-auto-subs \
       --sub-langs "ko,en" --sub-format vtt \
       "https://youtu.be/VIDEO_ID"

# 어떤 언어의 자막이 있는지 먼저 확인
yt-dlp --list-subs "https://youtu.be/VIDEO_ID"
```

받은 `.vtt`는 타임스탬프와 중복 줄이 많아서 그대로 붙여넣으면 토큰이 크게 낭비된다.
아래 방법 3이 그 정리까지 해준다.

---

## 방법 3 — `youtube_digest.py` (자막 정리 + 스크린샷, 권장)

### 설치

```bash
pip install -U yt-dlp        # 자막 (필수)
brew install ffmpeg          # 스크린샷 (옵션) — Linux면 apt install ffmpeg
```

### 사용

```bash
# 자막만
python youtube_digest.py "https://youtu.be/VIDEO_ID"

# 자막 + 균등 간격 스크린샷 12장
python youtube_digest.py "https://youtu.be/VIDEO_ID" --shots 12

# 자막 + 챕터 시작점마다 스크린샷 (챕터 없으면 균등 분할로 대체)
python youtube_digest.py "https://youtu.be/VIDEO_ID" --at chapters

# 자막 + 원하는 시점만 (차트/표가 나오는 구간을 콕 집어서)
python youtube_digest.py "https://youtu.be/VIDEO_ID" --at 1:23,4:56,10:02

# 5분마다 한 장
python youtube_digest.py "https://youtu.be/VIDEO_ID" --interval 300
```

### 주요 옵션

| 옵션 | 설명 |
|---|---|
| `--lang ko,en` | 자막 언어 우선순위. 수동 자막을 먼저 찾고 없으면 자동생성 자막 사용 |
| `--shots N` | 영상을 균등 분할해 N장 캡처 |
| `--interval SEC` | SEC초마다 캡처 |
| `--at 1:23,4:56` 또는 `--at chapters` | 캡처 시점 직접 지정 / 챕터 기준 |
| `--block 30` | 자막을 몇 초 단위 문단으로 묶을지 (기본 30초) |
| `--quality 720` | 캡처용 최대 해상도 |
| `--cookies-from-browser chrome` | 연령 제한·로그인 필요 영상 |
| `--keep-vtt` | 원본 자막 파일도 남김 |
| `--out DIR` | 출력 폴더 (기본 `./youtube_digest/<영상ID>`) |

### 결과물

```
youtube_digest/<영상ID>/
├── digest.md        ← 제목·챕터·스크린샷·자막이 한 파일에 (Claude에 이걸 주면 됨)
├── transcript.txt   ← 자막 텍스트만
└── shots/           ← 스크린샷 jpg
    ├── 000_02m00s.jpg
    └── ...
```

`digest.md`의 자막은 `[03:20] 내용...` 형태로 30초씩 묶여 있어서,
Claude가 요약할 때 "몇 분 지점 이야기인지" 같이 답할 수 있다.

---

## Claude에 넘기는 방법

```bash
# 터미널에서 바로
claude "이 유튜브 내용을 5줄로 요약하고 핵심 주장과 근거를 정리해줘" < youtube_digest/VIDEO_ID/digest.md
```

또는 Claude 앱/웹에 `digest.md`와 `shots/` 이미지를 첨부.
스크린샷은 자막만으로 안 잡히는 것(화면의 차트, 코드, 표, 슬라이드)을 채워주므로,
발표·강의·차트 분석 영상일수록 8~15장 정도 같이 넣는 게 효과가 크다.

---

## 참고

- **자동생성 자막은 오탈자가 있다.** 고유명사·숫자는 원본 확인 필요.
- **자막이 아예 없는 영상**은 이 방법으로 안 된다. 음성을 직접 STT(Whisper 등) 해야 한다.
- 스크린샷은 영상 전체를 받지 않고 해당 시점 프레임 한 장씩만 가져오므로 긴 영상에서도 빠르다.
- 추출한 자료는 개인적인 내용 파악 용도로 쓰고, 재배포는 하지 말 것.
