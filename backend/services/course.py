import json
import logging
import uuid

import litellm

from config import settings
from schemas.course import CourseResponse, CourseSection, MCQOption, MCQQuestion, TheoryQuestion
from schemas.transcript import TranscriptSegment

logger = logging.getLogger(__name__)

_PROMPT = """You are building a structured course from a YouTube video transcript.

Transcript (each line prefixed with its start time in seconds):
\"\"\"
{formatted}
\"\"\"

Break this into 3-8 logical sections that build on each other. For each section, also \
write 2-3 multiple-choice questions and 1-2 open-ended theory questions that test \
understanding of that section's content.

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

Sections must be in chronological order and cover the full video with no gaps.
"""


def thumbnail_url(video_id: str) -> str:
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def generate(video_id: str, segments: list[TranscriptSegment], api_key: str, model: str | None = None) -> CourseResponse:
    logger.info("[course]: generating course for video %s (%d segments)", video_id, len(segments))
    if segments:
        logger.info(
            "[course]: transcript span %.1fs – %.1fs (%.1f min)",
            segments[0].start,
            segments[-1].start + segments[-1].duration,
            (segments[-1].start + segments[-1].duration) / 60,
        )
    formatted = "\n".join(f"[{s.start:.1f}s] {s.text}" for s in segments)
    estimated_tokens = len(formatted) // 4
    logger.info(
        "[course]: formatted transcript %d chars (~%d tokens)",
        len(formatted),
        estimated_tokens,
    )
    prompt = _PROMPT.format(formatted=formatted)
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
    return CourseResponse(video_id=video_id, thumbnail_url=thumbnail_url(video_id), sections=sections)
