"""Turning a transcript and the title above it into the text a prompt carries.

Both the course and its cheatsheet read the same video, so this sits beside them
rather than inside either one.
"""

import re
from collections import defaultdict

from schemas.transcript import TranscriptSegment

_NOISE = re.compile(r"^\s*[\[\(][\w\s,]+[\]\)]\s*$")
_WINDOW = 30  # seconds per merged chunk
_MAX_TITLE_CHARS = 200


def format_transcript(segments: list[TranscriptSegment]) -> str:
    clean = [s for s in segments if not _NOISE.match(s.text)]
    buckets: dict[int, list[str]] = defaultdict(list)
    for s in clean:
        buckets[int(s.start / _WINDOW) * _WINDOW].append(
            s.text.strip().replace("\n", " ")
        )
    return "\n".join(
        f"[{t}] {' '.join(texts)}"
        for t, texts in sorted(buckets.items())
    )


def sanitize_title(title: str) -> str:
    """Titles come from YouTube, so collapse all whitespace to keep them to a
    single line. That alone stops a crafted title adding prompt structure."""
    return " ".join(title.split())[:_MAX_TITLE_CHARS]
