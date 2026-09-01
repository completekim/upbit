"""
유튜브 영상을 안 보고 내용만 파악하기 위한 추출기.

하나의 영상에서
  1) 자막(수동 자막 우선, 없으면 자동 생성 자막)을 타임스탬프가 붙은 텍스트로,
  2) (옵션) 특정 시점의 스크린샷을
뽑아서 Claude에 그대로 붙여넣을 수 있는 digest.md 를 만든다.

필요한 것
  pip install yt-dlp          # 자막 추출 (필수)
  ffmpeg                      # 스크린샷 (옵션, 없으면 자막만 추출)

사용 예
  # 자막만
  python youtube_digest.py "https://youtu.be/VIDEO_ID"

  # 자막 + 균등 간격 스크린샷 12장
  python youtube_digest.py "https://youtu.be/VIDEO_ID" --shots 12

  # 자막 + 챕터마다 스크린샷 (챕터 없으면 균등 분할로 대체)
  python youtube_digest.py "https://youtu.be/VIDEO_ID" --at chapters

  # 자막 + 원하는 시점만 콕 집어서
  python youtube_digest.py "https://youtu.be/VIDEO_ID" --at 1:23,4:56,10:02

  # 로그인이 필요한 영상 (연령 제한 등)
  python youtube_digest.py URL --cookies-from-browser chrome
"""

import argparse
import os
import re
import shutil
import subprocess
import sys

try:
    import yt_dlp
except ImportError:
    sys.exit("yt-dlp 가 필요합니다.  pip install -U yt-dlp")


# --------------------------------------------------------------------------
# 자막
# --------------------------------------------------------------------------

def pick_subtitle(info, langs):
    """수동 자막을 먼저, 없으면 자동 생성 자막을 언어 우선순위대로 고른다."""
    manual = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}

    for source, tracks in (("manual", manual), ("auto", auto)):
        for want in langs:
            for code in sorted(tracks):                     # ko, ko-orig, en, en-US ...
                if code == want or code.startswith(want + "-") or code.startswith(want + "_"):
                    formats = tracks[code]
                    # vtt 를 최우선, 없으면 아무거나
                    fmt = next((f for f in formats if f.get("ext") == "vtt"), None) or formats[-1]
                    return source, code, fmt
    return None, None, None


def parse_timestamp(text):
    """'00:01:02.500' / '1:02' / '75' -> 초(float)"""
    text = text.strip().replace(",", ".")
    parts = text.split(":")
    try:
        parts = [float(p) for p in parts]
    except ValueError:
        raise ValueError(f"시간 형식을 이해할 수 없습니다: {text!r}")
    seconds = 0.0
    for p in parts:
        seconds = seconds * 60 + p
    return seconds


def clean_cue_text(raw):
    """VTT 큐에서 태그와 인라인 타이밍을 걷어내고 순수 텍스트 줄만 남긴다."""
    lines = []
    for line in raw.splitlines():
        line = re.sub(r"<[^>]+>", "", line)                 # <c>, <00:00:01.000> 등
        line = line.replace("&nbsp;", " ")
        line = line.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
        line = line.replace("&#39;", "'").replace("&quot;", '"')
        line = " ".join(line.split())
        if line:
            lines.append(line)
    return lines


def parse_vtt(vtt_text):
    """VTT -> [(시작초, 텍스트줄)]. 자동자막의 롤링 중복 줄은 제거한다."""
    cue_time = re.compile(r"(\d{1,2}:\d{2}:\d{2}[.,]\d{3}|\d{1,2}:\d{2}[.,]\d{3})\s*-->\s*(\S+)")
    entries = []
    recent = []                                             # 최근에 내보낸 줄들 (중복 차단용)

    blocks = re.split(r"\n\s*\n", vtt_text.replace("\r\n", "\n"))
    for block in blocks:
        match = cue_time.search(block)
        if not match:
            continue
        start = parse_timestamp(match.group(1))
        # 타이밍 줄의 나머지(align:start position:0% 같은 큐 설정)는 본문이 아니다
        newline = block.find("\n", match.end())
        body = block[newline + 1:] if newline != -1 else ""
        for line in clean_cue_text(body):
            if line in recent:                              # 롤링 자막이 같은 줄을 반복함
                continue
            entries.append((start, line))
            recent.append(line)
            if len(recent) > 4:
                recent.pop(0)
    return entries


def format_clock(seconds):
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def group_transcript(entries, block_seconds=30):
    """비슷한 시간대의 줄을 한 문단으로 묶어 '[mm:ss] 내용' 형태로 만든다."""
    out = []
    bucket_start = None
    bucket = []
    for start, line in entries:
        if bucket_start is None or start - bucket_start >= block_seconds:
            if bucket:
                out.append(f"[{format_clock(bucket_start)}] " + " ".join(bucket))
            bucket_start, bucket = start, []
        bucket.append(line)
    if bucket:
        out.append(f"[{format_clock(bucket_start)}] " + " ".join(bucket))
    return out


# --------------------------------------------------------------------------
# 스크린샷
# --------------------------------------------------------------------------

def shot_times(args, info):
    """스크린샷을 찍을 시점(초) 목록을 만든다."""
    duration = info.get("duration") or 0
    chapters = info.get("chapters") or []

    if args.at and args.at.strip().lower() == "chapters":
        if chapters:
            return [c["start_time"] + 2 for c in chapters], [c.get("title", "") for c in chapters]
        print("챕터 정보가 없어 균등 분할로 대체합니다.", file=sys.stderr)
        args.shots = args.shots or 10
    elif args.at:
        times = [parse_timestamp(t) for t in args.at.split(",") if t.strip()]
        return times, [""] * len(times)

    if args.interval:
        times = [t for t in range(0, int(duration), args.interval)]
    elif args.shots:
        n = args.shots
        step = duration / (n + 1) if duration else 0
        times = [step * (i + 1) for i in range(n)]
    else:
        return [], []
    return times, [""] * len(times)


def stream_url(url, quality, extra_opts):
    """영상 전체를 받지 않고 ffmpeg 가 seek 할 수 있는 직접 스트림 주소를 얻는다."""
    opts = dict(extra_opts)
    opts.update({
        "quiet": True,
        "no_warnings": True,
        "format": f"best[height<={quality}][ext=mp4]/best[height<={quality}]/best",
    })
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    if "url" in info:
        return info["url"]
    for f in info.get("requested_formats", []):             # 영상+음성 분리된 경우 영상 트랙
        if f.get("vcodec") != "none":
            return f["url"]
    raise RuntimeError("스크린샷용 스트림 주소를 찾지 못했습니다.")


def grab_shots(url, times, titles, out_dir, quality, extra_opts):
    """ffmpeg 로 해당 시점 프레임 한 장씩만 뽑는다 (전체 다운로드 없음)."""
    if not shutil.which("ffmpeg"):
        print("ffmpeg 가 없어 스크린샷을 건너뜁니다. (brew install ffmpeg / apt install ffmpeg)",
              file=sys.stderr)
        return []

    src = stream_url(url, quality, extra_opts)
    shots_dir = os.path.join(out_dir, "shots")
    os.makedirs(shots_dir, exist_ok=True)

    saved = []
    for i, t in enumerate(times):
        name = f"{i:03d}_{format_clock(t).replace(':', 'm', 1).replace(':', 's')}.jpg"
        path = os.path.join(shots_dir, name)
        cmd = ["ffmpeg", "-y", "-loglevel", "error",
               "-ss", f"{t:.2f}", "-i", src,
               "-frames:v", "1", "-q:v", "3", path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0 or not os.path.exists(path):
            print(f"  {format_clock(t)} 캡처 실패: {result.stderr.strip()[:200]}", file=sys.stderr)
            continue
        saved.append((t, titles[i] if i < len(titles) else "", os.path.join("shots", name)))
        print(f"  캡처 {format_clock(t)} -> {name}")
    return saved


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="유튜브 자막(+스크린샷) 추출기")
    ap.add_argument("url")
    ap.add_argument("--lang", default="ko,en", help="자막 언어 우선순위 (기본: ko,en)")
    ap.add_argument("--out", default=None, help="출력 폴더 (기본: ./youtube_digest/<영상ID>)")
    ap.add_argument("--shots", type=int, help="균등 간격으로 N장 캡처")
    ap.add_argument("--interval", type=int, help="N초마다 캡처")
    ap.add_argument("--at", help="캡처 시점 직접 지정 (예: 1:23,4:56) 또는 chapters")
    ap.add_argument("--quality", type=int, default=720, help="캡처용 최대 해상도 (기본 720)")
    ap.add_argument("--block", type=int, default=30, help="자막 문단 묶음 초 (기본 30)")
    ap.add_argument("--cookies-from-browser", dest="cookies", help="chrome, firefox, edge ...")
    ap.add_argument("--keep-vtt", action="store_true", help="원본 VTT 파일도 남김")
    args = ap.parse_args()

    extra_opts = {}
    if args.cookies:
        extra_opts["cookiesfrombrowser"] = (args.cookies,)

    info_opts = dict(extra_opts)
    info_opts.update({"quiet": True, "no_warnings": True, "skip_download": True})

    with yt_dlp.YoutubeDL(info_opts) as ydl:
        info = ydl.extract_info(args.url, download=False)

        video_id = info.get("id", "video")
        out_dir = args.out or os.path.join("youtube_digest", video_id)
        os.makedirs(out_dir, exist_ok=True)

        langs = [l.strip() for l in args.lang.split(",") if l.strip()]
        source, code, fmt = pick_subtitle(info, langs)
        if not fmt:
            available = sorted(set(info.get("subtitles", {})) | set(info.get("automatic_captions", {})))
            sys.exit(f"{langs} 자막이 없습니다. 사용 가능한 언어: {', '.join(available) or '없음'}")

        print(f"자막: {code} ({'수동' if source == 'manual' else '자동생성'}, {fmt.get('ext')})")
        raw = ydl.urlopen(fmt["url"]).read().decode("utf-8", "replace")

    if args.keep_vtt:
        with open(os.path.join(out_dir, f"subtitle.{code}.{fmt.get('ext')}"), "w", encoding="utf-8") as f:
            f.write(raw)

    entries = parse_vtt(raw)
    if not entries:
        sys.exit("자막을 파싱하지 못했습니다. --keep-vtt 로 원본을 확인해 보세요.")
    paragraphs = group_transcript(entries, args.block)

    times, titles = shot_times(args, info)
    saved = grab_shots(args.url, times, titles, out_dir, args.quality, extra_opts) if times else []

    watch_url = f"https://youtu.be/{info.get('id')}"
    lines = [
        f"# {info.get('title', '')}",
        "",
        f"- 채널: {info.get('uploader', '')}",
        f"- 길이: {format_clock(info.get('duration') or 0)}",
        f"- 업로드: {info.get('upload_date', '')}",
        f"- 링크: {watch_url}",
        "",
    ]

    chapters = info.get("chapters") or []
    if chapters:
        lines += ["## 챕터", ""]
        lines += [f"- [{format_clock(c['start_time'])}] {c.get('title', '')}" for c in chapters]
        lines.append("")

    if saved:
        lines += ["## 스크린샷", ""]
        for t, title, rel in saved:
            label = f"{format_clock(t)}" + (f" — {title}" if title else "")
            lines += [f"### {label}", f"{watch_url}?t={int(t)}", f"![{label}]({rel})", ""]

    lines += ["## 자막", ""] + paragraphs + [""]

    digest = os.path.join(out_dir, "digest.md")
    with open(digest, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    transcript = os.path.join(out_dir, "transcript.txt")
    with open(transcript, "w", encoding="utf-8") as f:
        f.write("\n".join(paragraphs) + "\n")

    words = sum(len(p.split()) for p in paragraphs)
    print(f"\n완료: {digest}")
    print(f"      {transcript}  (문단 {len(paragraphs)}개, 약 {words} 단어)")
    if saved:
        print(f"      스크린샷 {len(saved)}장 -> {os.path.join(out_dir, 'shots')}")


if __name__ == "__main__":
    main()
