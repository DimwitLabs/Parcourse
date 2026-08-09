import yt_dlp


def get_video_category(video_id: str) -> str | None:
    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)
    categories = info.get("categories") or []
    return categories[0] if categories else None
