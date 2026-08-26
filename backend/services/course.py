import logging
import uuid


from schemas.course import CourseResponse, CourseSection, MCQOption, MCQQuestion, TheoryQuestion
from schemas.transcript import Chapter, TranscriptSegment
from services.llm import complete_json
from services.transcript_text import format_transcript, sanitize_title
from services.prompts import load

logger = logging.getLogger(__name__)

_PROMPT = load("course")
_BOUNDARIES = load("course_boundaries")
_CHAPTERS = load("course_chapters")


_MAX_FEEDBACK_CHARS = 1000


def _sanitize_feedback(feedback: str) -> str:
    """Collapse the delimiter so a note cannot close the quoted block early, and
    cap the length so a large paste cannot crowd out the transcript."""
    return feedback.strip().replace('"""', '"')[:_MAX_FEEDBACK_CHARS]


_FEEDBACK_TEMPLATE = load("course_feedback")


def _as_lines(chapters: list[Chapter]) -> str:
    """The delimiter is collapsed so a chapter title cannot close the quoted
    block early and be read as instructions."""
    lines = []
    for c in chapters:
        title = c.title.replace('"""', '"')
        lines.append(f"{c.start_seconds:.0f}s - {c.end_seconds:.0f}s: {title}")
    return "\n".join(lines)


def thumbnail_url(video_id: str) -> str:
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def generate(video_id: str, segments: list[TranscriptSegment], credentials: dict[str, str], model: str, video_title: str = "", feedback: str = "", chapters: list[Chapter] | None = None) -> CourseResponse:
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

    target = max(3, min(16, round(total_minutes / 15)))
    min_sections = max(3, target - 1)
    max_sections = min(16, target + 2)

    approx_seconds = total_seconds / target
    approx_minutes = approx_seconds / 60
    min_section_seconds = approx_seconds * 0.4   # allow down to 40% of average
    max_section_seconds = approx_seconds * 2.5   # cap at 250% of average

    formatted = format_transcript(segments)
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
    clean_title = sanitize_title(video_title)
    title_block = f"\nVideo title: {clean_title}\n" if clean_title else ""
    clean_feedback = _sanitize_feedback(feedback)
    feedback_block = _FEEDBACK_TEMPLATE.format(feedback=clean_feedback) if clean_feedback else ""
    if feedback_block:
        logger.info("[course]: regenerating with learner feedback (%d chars)", len(clean_feedback))
    if chapters:
        logger.info("[course]: following %d creator chapters", len(chapters))
        boundaries_block = _CHAPTERS.format(chapters=_as_lines(chapters))
    else:
        boundaries_block = _BOUNDARIES.format(
            total_seconds=total_seconds,
            min_sections=min_sections,
            max_sections=max_sections,
            approx_seconds=approx_seconds,
            approx_minutes=approx_minutes,
            min_section_seconds=min_section_seconds,
            max_section_seconds=max_section_seconds,
        )

    prompt = _PROMPT.format(
        boundaries_block=boundaries_block,
        title_block=title_block,
        feedback_block=feedback_block,
        formatted=formatted,
        total_seconds=total_seconds,
        total_minutes=total_minutes,
    )
    logger.info("[course]: full prompt %d chars (~%d tokens)", len(prompt), len(prompt) // 4)

    logger.info("[course]: generating with model=%s", model)
    data = complete_json(
        model=model,
        credentials=credentials,
        prompt=prompt,
        required_keys=("sections",),
        temperature=0.3,
    )

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
