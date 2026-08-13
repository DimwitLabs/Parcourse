import json
import logging
import re
import uuid
from collections import defaultdict

import litellm

from config import settings
from schemas.course import CourseResponse, CourseSection, MCQOption, MCQQuestion, TheoryQuestion
from schemas.transcript import TranscriptSegment

logger = logging.getLogger(__name__)

_NOISE = re.compile(r"^\s*[\[\(][\w\s,]+[\]\)]\s*$")
_WINDOW = 30  # seconds per merged chunk


def _format_transcript(segments: list[TranscriptSegment]) -> str:
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

_PROMPT = """You are building a structured course from a YouTube video transcript.

Total video duration: {total_minutes:.1f} minutes ({total_seconds:.0f} seconds).

Transcript (each line is a 30-second chunk prefixed with its start time in seconds):
\"\"\"
{formatted}
\"\"\"

Break this into {min_sections}–{max_sections} logical sections that build on each other.

Rules for section boundaries:
- The first section MUST start at 0s and the last section MUST end at exactly {total_seconds:.0f}s.
- Every section should cover roughly {approx_seconds:.0f} seconds (~{approx_minutes:.0f} minutes). \
  No section may be shorter than {min_section_seconds:.0f}s or longer than {max_section_seconds:.0f}s.
- The last section must NOT be a catch-all for the remainder of the video. \
  All sections, including the last, must be approximately equal in length.
- Use the transcript chunk timestamps only as a guide — section boundaries do not need \
  to fall exactly on 30-second marks.

For each section also write 2-3 multiple-choice questions and 1-2 open-ended theory \
questions that test understanding of that section's content.

Return only a JSON object with exactly this field:
- "sections": a list of objects, each with:
  - "title": str
  - "summary": str, 2-3 sentences
  - "key_takeaways": a list of 2-4 short phrases (3-6 words each) capturing the section's core points
  - "start_seconds": float
  - "end_seconds": float
  - "mcqs": a list of 2-3 objects, each with:
    - "question": str
    - "options": a list of 4 objects, each with "label" ("A"/"B"/"C"/"D") and "text"
    - "correct_label": the label of the correct option
    - "explanation": one sentence explaining why the correct answer is right. Never use em dashes
  - "theory_questions": a list of 1-2 objects, each with:
    - "question": an open-ended question requiring a short written answer
    - "reference_answer": a model answer used later to grade student responses
"""


def thumbnail_url(video_id: str) -> str:
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def generate(video_id: str, segments: list[TranscriptSegment], api_key: str, model: str | None = None, video_title: str = "") -> CourseResponse:
    logger.info("[course]: generating course for video %s (%d segments)", video_id, len(segments))
    if segments:
        logger.info(
            "[course]: transcript span %.1fs – %.1fs (%.1f min)",
            segments[0].start,
            segments[-1].start + segments[-1].duration,
            (segments[-1].start + segments[-1].duration) / 60,
        )
    last = segments[-1] if segments else None
    total_seconds = (last.start + last.duration) if last else 0.0
    total_minutes = total_seconds / 60

    # Scale section count: ~1 section per 15 min, clamped to 3–16
    target = max(3, min(16, round(total_minutes / 15)))
    min_sections = max(3, target - 1)
    max_sections = min(16, target + 2)

    # Duration guidance for even distribution
    approx_seconds = total_seconds / target
    approx_minutes = approx_seconds / 60
    min_section_seconds = approx_seconds * 0.4   # allow down to 40% of average
    max_section_seconds = approx_seconds * 2.5   # cap at 250% of average

    formatted = _format_transcript(segments)
    estimated_tokens = len(formatted) // 4
    logger.info(
        "[course]: formatted transcript %d chars (~%d tokens), total=%.1fmin, sections=%d–%d",
        len(formatted),
        estimated_tokens,
        total_minutes,
        min_sections,
        max_sections,
    )
    prompt = _PROMPT.format(
        formatted=formatted,
        total_seconds=total_seconds,
        total_minutes=total_minutes,
        min_sections=min_sections,
        max_sections=max_sections,
        approx_seconds=approx_seconds,
        approx_minutes=approx_minutes,
        min_section_seconds=min_section_seconds,
        max_section_seconds=max_section_seconds,
    )
    logger.info("[course]: full prompt %d chars (~%d tokens)", len(prompt), len(prompt) // 4)

    used_model = model or settings.ai_model
    logger.info("[course]: calling litellm.completion model=%s", used_model)
    response = litellm.completion(
        model=used_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.3,
        api_key=api_key,
    )
    usage = getattr(response, "usage", None)
    logger.info(
        "[course]: completion done — prompt_tokens=%s completion_tokens=%s total_tokens=%s",
        getattr(usage, "prompt_tokens", "?"),
        getattr(usage, "completion_tokens", "?"),
        getattr(usage, "total_tokens", "?"),
    )
    data = json.loads(response.choices[0].message.content)

    sections = []
    for s in data["sections"]:
        mcqs = [
            MCQQuestion(
                id=str(uuid.uuid4()),
                question=m["question"],
                options=[MCQOption(**o) for o in m["options"]],
                correct_label=m["correct_label"],
                explanation=m["explanation"],
            )
            for m in s.get("mcqs", [])
        ]
        theory_questions = [
            TheoryQuestion(
                id=str(uuid.uuid4()),
                question=t["question"],
                reference_answer=t["reference_answer"],
            )
            for t in s.get("theory_questions", [])
        ]
        sections.append(
            CourseSection(
                title=s["title"],
                summary=s["summary"],
                key_takeaways=s.get("key_takeaways", []),
                start_seconds=s["start_seconds"],
                end_seconds=s["end_seconds"],
                mcqs=mcqs,
                theory_questions=theory_questions,
            )
        )

    if sections:
        logger.info(
            "[course]: generated %d sections for video %s covering %.1f – %.1f min",
            len(sections),
            video_id,
            sections[0].start_seconds / 60,
            sections[-1].end_seconds / 60,
        )
    else:
        logger.warning("[course]: no sections generated for video %s", video_id)
    return CourseResponse(video_id=video_id, video_title=video_title, thumbnail_url=thumbnail_url(video_id), sections=sections)
