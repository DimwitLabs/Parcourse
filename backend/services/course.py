import json

import litellm

from config import settings
from schemas.course import CourseResponse, CourseSection
from schemas.transcript import TranscriptSegment

_PROMPT = """You are building a structured course from a YouTube video transcript.

Transcript (each line prefixed with its start time in seconds):
\"\"\"
{formatted}
\"\"\"

Break this into 3-8 logical sections that build on each other.

Return only a JSON object with exactly this field:
- "sections": a list of objects, each with "title" (str), "summary" (str, 2-3 sentences), \
"start_seconds" (float), "end_seconds" (float)

Sections must be in chronological order and cover the full video with no gaps.
"""


def thumbnail_url(video_id: str) -> str:
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def generate(video_id: str, segments: list[TranscriptSegment]) -> CourseResponse:
    formatted = "\n".join(f"[{s.start:.1f}s] {s.text}" for s in segments)
    prompt = _PROMPT.format(formatted=formatted[:12000])

    response = litellm.completion(
        model=settings.ai_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    data = json.loads(response.choices[0].message.content)
    sections = [CourseSection(**s) for s in data["sections"]]

    return CourseResponse(video_id=video_id, thumbnail_url=thumbnail_url(video_id), sections=sections)
