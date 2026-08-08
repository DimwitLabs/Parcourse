import re

from youtube_transcript_api import YouTubeTranscriptApi

_YOUTUBE_ID_RE = re.compile(r"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})")


def extract_video_id(url: str) -> str:
    match = _YOUTUBE_ID_RE.search(url)
    if not match:
        raise ValueError("Could not find a YouTube video ID in that URL")
    return match.group(1)


def fetch_transcript(video_id: str) -> list[dict]:
    try:
        fetched = YouTubeTranscriptApi().fetch(video_id)
    except Exception as exc:
        raise ValueError("No transcript available for this video") from exc
    return [{"text": s.text, "start": s.start, "duration": s.duration} for s in fetched]
