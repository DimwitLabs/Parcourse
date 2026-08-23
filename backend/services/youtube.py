import json
import logging
import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

from config import VPN_ROTATIONS, YTDLP_PROXY
from services import vpn

logger = logging.getLogger(__name__)

_HOSTS = frozenset({
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "gaming.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "youtu.be",
    "www.youtu.be",
})
_PATH_PREFIXES = frozenset({"shorts", "embed", "live", "v"})
_VIDEO_ID_RE = re.compile(r"^[\w-]{11}$")

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


_IMPATIENT = {"socket_timeout": 8, "retries": 0, "extractor_retries": 0}


def _options() -> dict:
    """A datacenter address is refused by YouTube whatever it asks for, so a
    deployment that has one fetches through somewhere else instead.

    Waiting out a full timeout before each reconnect is the slow way to fail,
    so a deployment that can move gives each attempt less of the clock.
    Asking the same address twice is what the reconnect is for, so yt-dlp
    does not also retry it."""
    options = dict(_OPTIONS)
    if _rotations():
        options.update(_IMPATIENT)
    if not YTDLP_PROXY:
        return options
    options["proxy"] = YTDLP_PROXY
    return options


def _rotations() -> int:
    """Reconnecting only changes the address when the fetch goes through the
    VPN in the first place."""
    return VPN_ROTATIONS if YTDLP_PROXY and vpn.available() else 0


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

# YouTube writes its refusal with a typographic apostrophe, and yt-dlp passes
# the sentence through untouched. Matching the ASCII one alone read the bot
# check as an unknown failure and blamed the video for it.
_APOSTROPHES = str.maketrans({"\u2018": "'", "\u2019": "'", "\u02bc": "'"})

# A proxy that is wrong or down is the operator's problem, and reads nothing
# like a problem with the video the user picked.
_EGRESS_SIGNS = ("unable to connect to proxy", "socks", "proxy")

_NO_CAPTIONS = "This video has no captions, so there's nothing to build a course from."
_UNREADABLE = "This video's transcript couldn't be fetched, so try another video."
_UNPLAYABLE = "This video is private, removed or age-restricted, so it can't be read."
_UNREACHABLE = "This server can't reach YouTube right now, so courses cannot be made."
_REFUSED = "YouTube is refusing requests from this server, so courses cannot be made right now."


@dataclass(frozen=True)
class Video:
    title: str
    segments: list[dict]


class TranscriptBlocked(Exception):
    """YouTube turned the request away before it ever looked for captions, so
    every video fails until the block lifts."""


def _video_id(url: str) -> str | None:
    """Mirrors youTubeVideoId in frontend/src/lib/youtube.ts. The host is checked
    here rather than only the shape of the path, since this is what a request
    actually reaches."""
    text = url.strip()
    if not text:
        return None
    parsed = urlparse(text if re.match(r"^[a-z][a-z\d+.-]*:", text, re.I) else f"https://{text}")
    if parsed.scheme not in ("http", "https"):
        return None
    if (parsed.hostname or "").lower() not in _HOSTS:
        return None

    parts = [p for p in parsed.path.split("/") if p]
    host = (parsed.hostname or "").lower()
    if host.endswith("youtu.be"):
        found = parts[0] if parts else None
    elif parts and parts[0] == "watch":
        found = parse_qs(parsed.query).get("v", [None])[0]
    elif parts and parts[0] in _PATH_PREFIXES:
        found = parts[1] if len(parts) > 1 else None
    else:
        found = None

    return found if found and _VIDEO_ID_RE.match(found) else None


def extract_video_id(url: str) -> str:
    logger.info("[youtube]: extracting video ID from URL")
    video_id = _video_id(url)
    if video_id is None:
        logger.error("[youtube]: no video ID found in URL")
        raise ValueError("That doesn't look like a YouTube link, so check the URL and try again.")
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


def _segments_from(ydl: YoutubeDL, track: list[dict]) -> list[dict]:
    chosen = next((t for t in track if t.get("ext") == "json3"), None)
    if not chosen:
        raise ValueError(_NO_CAPTIONS)
    url = chosen.get("url", "")
    if not url.startswith("https://"):
        # The URL arrives from the extractor, and urlopen would honour file://.
        raise ValueError(_UNREADABLE)

    # yt-dlp's own opener, so the caption track is fetched through the same
    # proxy and the same session that was allowed to list it.
    events = json.loads(ydl.urlopen(url).read()).get("events") or []

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
    reason = str(exc).lower().translate(_APOSTROPHES)
    if any(sign in reason for sign in _UNPLAYABLE_SIGNS):
        logger.warning("[youtube]: video %s cannot be opened", video_id)
        return ValueError(_UNPLAYABLE)
    if YTDLP_PROXY and any(sign in reason for sign in _EGRESS_SIGNS):
        logger.error("[youtube]: the configured YTDLP_PROXY did not carry the request: %s", exc)
        return TranscriptBlocked(_UNREACHABLE)
    if any(sign in reason for sign in _BLOCKED_SIGNS):
        logger.error("[youtube]: youtube refused the request for video %s", video_id)
        return TranscriptBlocked(_REFUSED)
    logger.error("[youtube]: fetch failed for video %s: %s", video_id, exc)
    return ValueError(_UNREADABLE)


def _fetch_once(video_id: str) -> Video:
    """Title and transcript arrive from one extraction, so asking separately
    would only spend a second request on the same answer."""
    try:
        with YoutubeDL(_options()) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            if not info:
                raise ValueError(_UNREADABLE)

            track = _english_track(info)
            if not track:
                logger.warning("[youtube]: video %s has no english captions", video_id)
                raise ValueError(_NO_CAPTIONS)

            segments = _segments_from(ydl, track)
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


def fetch_video(video_id: str) -> Video:
    """A refusal is about the address the request left from and not about the
    video, so the VPN is asked for a different server and the fetch tried
    again. Only once no reconnect is left does the user hear about it."""
    logger.info("[youtube]: fetching video %s", video_id)
    attempts = 1 + _rotations()

    for attempt in range(1, attempts + 1):
        try:
            return _fetch_once(video_id)
        except TranscriptBlocked as refused:
            if attempt == attempts:
                logger.error("[youtube]: still refused after %d attempts for video %s", attempts, video_id)
                raise
            logger.warning(
                "[youtube]: attempt %d of %d was turned away for video %s: %s",
                attempt, attempts, video_id, refused,
            )
            if not vpn.rotate():
                logger.error("[youtube]: no different server was available, so nothing changes by asking again")
                raise

    raise TranscriptBlocked(_REFUSED)
