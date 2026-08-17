import logging
import re

import requests
from youtube_transcript_api import (
    AgeRestricted,
    InvalidVideoId,
    IpBlocked,
    NoTranscriptFound,
    PoTokenRequired,
    RequestBlocked,
    TranscriptsDisabled,
    VideoUnavailable,
    VideoUnplayable,
    YouTubeRequestFailed,
    YouTubeTranscriptApi,
)

logger = logging.getLogger(__name__)


class TranscriptBlocked(Exception):
    """YouTube turned the request away before it ever looked for captions, so
    every video fails until the block lifts."""


_BLOCKED = (IpBlocked, RequestBlocked, PoTokenRequired, YouTubeRequestFailed)
_NO_CAPTIONS = (TranscriptsDisabled, NoTranscriptFound)
_UNPLAYABLE = (VideoUnavailable, VideoUnplayable, InvalidVideoId, AgeRestricted)

_YOUTUBE_ID_RE = re.compile(r"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})")


def extract_video_id(url: str) -> str:
    logger.info("[youtube]: extracting video ID from URL")
    match = _YOUTUBE_ID_RE.search(url)
    if not match:
        logger.error("[youtube]: no video ID found in URL")
        raise ValueError("That doesn't look like a YouTube link, so check the URL and try again.")
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
    except _BLOCKED as exc:
        logger.error("[youtube]: youtube refused the request for video %s: %s", video_id, type(exc).__name__)
        raise TranscriptBlocked(
            "YouTube is rate-limiting this server, so try again in a few minutes."
        ) from exc
    except _NO_CAPTIONS as exc:
        logger.warning("[youtube]: video %s has no captions: %s", video_id, type(exc).__name__)
        raise ValueError("This video has no captions, so there's nothing to build a course from.") from exc
    except _UNPLAYABLE as exc:
        logger.warning("[youtube]: video %s cannot be opened: %s", video_id, type(exc).__name__)
        raise ValueError("This video is private, removed or age-restricted, so it can't be read.") from exc
    except Exception as exc:
        logger.error("[youtube]: transcript fetch failed for video %s: %s", video_id, exc)
        raise ValueError("This video's transcript couldn't be fetched, so try another video.") from exc
    segments = [{"text": s.text, "start": s.start, "duration": s.duration} for s in fetched]
    logger.info("[youtube]: fetched %d transcript segments for video %s", len(segments), video_id)
    return segments
