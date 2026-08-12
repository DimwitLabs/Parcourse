import io
import logging

import requests
import yt_dlp
from PIL import Image

logger = logging.getLogger(__name__)


def get_storyboard_formats(video_id: str) -> list[dict]:
    logger.info("[storyboard]: fetching storyboard formats for video %s", video_id)
    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)

    result = []
    for f in info.get("formats", []):
        if f.get("format_note") != "storyboard":
            continue
        result.append(
            {
                "format_id": f.get("format_id"),
                "width": f.get("width"),
                "height": f.get("height"),
                "rows": f.get("rows"),
                "columns": f.get("columns"),
                "fragments": [
                    {"url": frag.get("url"), "duration": frag.get("duration")}
                    for frag in f.get("fragments", [])
                ],
            }
        )
    logger.info("[storyboard]: found %d storyboard formats for video %s", len(result), video_id)
    return result


def get_frame_at(video_id: str, seconds: float) -> bytes:
    logger.info("[storyboard]: extracting frame at %.1fs for video %s", seconds, video_id)
    boards = get_storyboard_formats(video_id)
    if not boards:
        logger.error("[storyboard]: no storyboard available for video %s", video_id)
        raise ValueError("No storyboard available for this video")

    board = max(boards, key=lambda b: (b["rows"] or 0) * (b["columns"] or 0))
    rows, columns = board["rows"], board["columns"]

    elapsed = 0.0
    fragment = None
    offset_in_fragment = 0.0
    for frag in board["fragments"]:
        duration = frag["duration"] or 0.0
        if seconds < elapsed + duration or frag is board["fragments"][-1]:
            fragment = frag
            offset_in_fragment = seconds - elapsed
            break
        elapsed += duration

    if fragment is None:
        logger.error("[storyboard]: could not locate frame at %.1fs for video %s", seconds, video_id)
        raise ValueError("Could not locate a frame for that timestamp")

    cells_per_fragment = rows * columns
    cell_duration = (fragment["duration"] or 1.0) / cells_per_fragment
    cell_index = max(0, min(int(offset_in_fragment / cell_duration), cells_per_fragment - 1))
    row, col = divmod(cell_index, columns)

    logger.info("[storyboard]: downloading sprite sheet from fragment URL")
    response = requests.get(fragment["url"], timeout=10)
    response.raise_for_status()
    sprite = Image.open(io.BytesIO(response.content))

    cell_width = sprite.width // columns
    cell_height = sprite.height // rows
    box = (col * cell_width, row * cell_height, (col + 1) * cell_width, (row + 1) * cell_height)
    cropped = sprite.crop(box)

    buffer = io.BytesIO()
    cropped.convert("RGB").save(buffer, format="JPEG")
    logger.info("[storyboard]: extracted frame at %.1fs, cell (%d, %d)", seconds, row, col)
    return buffer.getvalue()
