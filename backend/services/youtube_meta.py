import logging

import yt_dlp

logger = logging.getLogger(__name__)


def get_video_category(video_id: str) -> str | None:
    logger.info("[youtube_meta]: fetching video category for %s", video_id)
    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)
    categories = info.get("categories") or []
    category = categories[0] if categories else None
    logger.info("[youtube_meta]: resolved category for %s: %s", video_id, category)
    return category
