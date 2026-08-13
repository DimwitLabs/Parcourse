import logging
import re

import requests
from youtube_transcript_api import YouTubeTranscriptApi

logger = logging.getLogger(__name__)

_YOUTUBE_ID_RE = re.compile(r"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})")


def extract_video_id(url: str) -> str:
    logger.info("[youtube]: extracting video ID from URL")
    match = _YOUTUBE_ID_RE.search(url)
    if not match:
        logger.error("[youtube]: no video ID found in URL")
        raise ValueError("Could not find a YouTube video ID in that URL")
    video_id = match.group(1)
    logger.info("[youtube]: extracted video ID: %s", video_id)
    return video_id


def fetch_video_title(video_id: str) -> str:
    logger.info("[youtube]: fetching title for video %s", video_id)
    try:
        url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        r = requests.get(url, timeout=5)
        r.raise_for_status()
        raw = r.json().get("title", "")
        return raw.title() if raw else ""
    except Exception as exc:
        logger.warning("[youtube]: title fetch failed for video %s: %s", video_id, exc)
        return ""


def fetch_transcript(video_id: str) -> list[dict]:
    logger.info("[youtube]: fetching transcript for video %s", video_id)
    try:
        fetched = YouTubeTranscriptApi().fetch(video_id)
    except Exception as exc:
        logger.error("[youtube]: transcript fetch failed for video %s: %s", video_id, exc)
        raise ValueError("No transcript available for this video") from exc
    segments = [{"text": s.text, "start": s.start, "duration": s.duration} for s in fetched]
    logger.info("[youtube]: fetched %d transcript segments for video %s", len(segments), video_id)
    return segments
