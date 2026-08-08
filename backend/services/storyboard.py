import yt_dlp


def get_storyboard_formats(video_id: str) -> list[dict]:
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
    return result
