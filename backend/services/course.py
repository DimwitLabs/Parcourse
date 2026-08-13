import json
import logging
import re
import uuid
from collections import defaultdict

import litellm

from config import settings
from schemas.course import CourseResponse, CourseSection, MCQOption, MCQQuestion, TheoryQuestion
from schemas.transcript import TranscriptSegment
from services.prompts import load

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

_PROMPT = load("course")


_MAX_FEEDBACK_CHARS = 1000
_MAX_TITLE_CHARS = 200


def _sanitize_feedback(feedback: str) -> str:
    """Collapse the delimiter so a note cannot close the quoted block early, and
    cap the length so a large paste cannot crowd out the transcript."""
    return feedback.strip().replace('"""', '"')[:_MAX_FEEDBACK_CHARS]


def _sanitize_title(title: str) -> str:
    """Titles come from YouTube, so collapse all whitespace to keep them to a
    single line. That alone stops a crafted title adding prompt structure."""
    return " ".join(title.split())[:_MAX_TITLE_CHARS]


_FEEDBACK_TEMPLATE = load("course_feedback")


def thumbnail_url(video_id: str) -> str:
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def generate(video_id: str, segments: list[TranscriptSegment], api_key: str, model: str | None = None, video_title: str = "", feedback: str = "") -> CourseResponse:
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
    # Both are substituted values, so any braces inside them are never re-parsed.
    clean_title = _sanitize_title(video_title)
    title_block = f"\nVideo title: {clean_title}\n" if clean_title else ""
    clean_feedback = _sanitize_feedback(feedback)
    feedback_block = _FEEDBACK_TEMPLATE.format(feedback=clean_feedback) if clean_feedback else ""
    if feedback_block:
        logger.info("[course]: regenerating with learner feedback (%d chars)", len(clean_feedback))
    prompt = _PROMPT.format(
        title_block=title_block,
        feedback_block=feedback_block,
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
