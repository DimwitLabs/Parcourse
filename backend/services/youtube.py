import json
import logging
import re
import urllib.request
from dataclasses import dataclass

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

logger = logging.getLogger(__name__)

_YOUTUBE_ID_RE = re.compile(r"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})")

# Generation is synchronous, so an extraction that retries forever holds a
# worker thread and stalls requests that have nothing to do with it.
_OPTIONS = {
    "skip_download": True,
    "quiet": True,
    "no_warnings": True,
    "socket_timeout": 20,
    "retries": 2,
    "extractor_retries": 1,
}

# yt-dlp reports failures as prose, so these match phrases rather than types.
# A video nobody can play is checked first: its message often also mentions
# being blocked, which is about the video and not about this server.
_UNPLAYABLE_SIGNS = (
    "private video",
    "video unavailable",
    "this video is unavailable",
    "has been removed",
    "age-restricted",
    "sign in to confirm your age",
    "members-only",
    "blocked it in your country",
    "not available in your country",
)
_BLOCKED_SIGNS = (
    "sign in to confirm you're not a bot",
    "sign in to confirm that you're not a bot",
    "too many requests",
    "http error 429",
    "not available on this app",
    "only images are available",
    # Only when YouTube answered. Without the status this also matches a DNS
    # failure or a dead egress, which is this server and not YouTube.
    "unable to download webpage: http error",
)

_NO_CAPTIONS = "This video has no captions, so there's nothing to build a course from."
_UNREADABLE = "This video's transcript couldn't be fetched, so try another video."
_UNPLAYABLE = "This video is private, removed or age-restricted, so it can't be read."
_REFUSED = "YouTube is refusing requests from this server, so courses cannot be made right now."


@dataclass(frozen=True)
class Video:
    title: str
    segments: list[dict]


class TranscriptBlocked(Exception):
    """YouTube turned the request away before it ever looked for captions, so
    every video fails until the block lifts."""


def extract_video_id(url: str) -> str:
    logger.info("[youtube]: extracting video ID from URL")
    match = _YOUTUBE_ID_RE.search(url)
    if not match:
        logger.error("[youtube]: no video ID found in URL")
        raise ValueError("That doesn't look like a YouTube link, so check the URL and try again.")
    video_id = match.group(1)
    logger.info("[youtube]: extracted video ID: %s", video_id)
    return video_id


def _english_track(info: dict) -> list[dict] | None:
    """A track the author wrote beats one the machine guessed, and the original
    beats a translation of it."""
    for source in (info.get("subtitles"), info.get("automatic_captions")):
        for code in ("en-orig", "en", "en-US", "en-GB"):
            tracks = (source or {}).get(code)
            if tracks:
                return tracks
    return None


def _segments_from(track: list[dict]) -> list[dict]:
    chosen = next((t for t in track if t.get("ext") == "json3"), None)
    if not chosen:
        raise ValueError(_NO_CAPTIONS)
    url = chosen.get("url", "")
    if not url.startswith("https://"):
        # The URL arrives from the extractor, and urlopen would honour file://.
        raise ValueError(_UNREADABLE)

    with urllib.request.urlopen(url, timeout=20) as response:
        events = json.load(response).get("events") or []

    segments = []
    for event in events:
        text = "".join(part.get("utf8", "") for part in (event.get("segs") or [])).strip()
        if not text:
            continue
        segments.append({
            "text": text,
            "start": (event.get("tStartMs") or 0) / 1000,
            "duration": (event.get("dDurationMs") or 0) / 1000,
        })
    return segments


def _from_download_error(video_id: str, exc: DownloadError) -> Exception:
    reason = str(exc).lower()
    if any(sign in reason for sign in _UNPLAYABLE_SIGNS):
        logger.warning("[youtube]: video %s cannot be opened", video_id)
        return ValueError(_UNPLAYABLE)
    if any(sign in reason for sign in _BLOCKED_SIGNS):
        logger.error("[youtube]: youtube refused the request for video %s", video_id)
        return TranscriptBlocked(_REFUSED)
    logger.error("[youtube]: fetch failed for video %s: %s", video_id, exc)
    return ValueError(_UNREADABLE)


def fetch_video(video_id: str) -> Video:
    """Title and transcript arrive from one extraction, so asking separately
    would only spend a second request on the same answer."""
    logger.info("[youtube]: fetching video %s", video_id)
    try:
        with YoutubeDL(_OPTIONS) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
        if not info:
            raise ValueError(_UNREADABLE)

        track = _english_track(info)
        if not track:
            logger.warning("[youtube]: video %s has no english captions", video_id)
            raise ValueError(_NO_CAPTIONS)

        segments = _segments_from(track)
        if not segments:
            raise ValueError("This video's captions are empty, so there's nothing to build a course from.")
    except DownloadError as exc:
        raise _from_download_error(video_id, exc) from exc
    except (TranscriptBlocked, ValueError):
        raise
    except Exception as exc:
        # Downloading and parsing the caption track fails in more ways than are
        # worth naming, and none of them should reach the user as a 500.
        logger.error("[youtube]: could not read captions for video %s: %s", video_id, exc)
        raise ValueError(_UNREADABLE) from exc

    logger.info("[youtube]: fetched %d transcript segments for video %s", len(segments), video_id)
    return Video(title=info.get("title") or "", segments=segments)
