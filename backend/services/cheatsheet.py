import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from models.cheatsheet_cache import CachedCheatsheet, SheetStatus
from models.course_cache import CachedCourse
from models.user import User
from schemas.course import CourseResponse
from schemas.transcript import TranscriptSegment
from services.connection import resolve
from services.transcript_text import format_transcript, sanitize_title
from services.llm import complete_json
from services.prompts import load
from services.youtube import fetch_video

logger = logging.getLogger(__name__)

_PROMPT = load("cheatsheet")
_STALE_AFTER = timedelta(minutes=10)


def _points_by_title(data: dict, course: CourseResponse) -> list[dict]:
    """The model is asked for the sections it was given, in order, but a title
    it reworded would otherwise drop a section's points on the floor."""
    written = data.get("sections") or []
    by_title = {str(s.get("title", "")).strip().lower(): s for s in written if isinstance(s, dict)}

    sections = []
    for index, section in enumerate(course.sections):
        match = by_title.get(section.title.strip().lower())
        if match is None and index < len(written) and isinstance(written[index], dict):
            match = written[index]
        points = [str(p).strip() for p in (match or {}).get("points", []) if str(p).strip()]
        sections.append({
            "title": section.title,
            "start_seconds": section.start_seconds,
            "points": points,
        })
    return sections


def write(session: Session, course_id: uuid.UUID, segments: list[dict] | None) -> None:
    """Runs after the response has gone out, so it owns its own session and
    reports failure into the row rather than to anyone waiting."""
    row = session.get(CachedCheatsheet, course_id)
    cached = session.get(CachedCourse, course_id)
    if row is None or cached is None:
        logger.warning("[cheatsheet]: nothing to write for course %s", course_id)
        return

    try:
        user = session.get(User, cached.user_id)
        if user is None:
            raise ValueError("the course has no owner")
        connection = resolve(session, user)
        course = CourseResponse.model_validate_json(cached.course_json)
        # A retry after a restart has outlived the fetch that made the course,
        # and asking YouTube again is cheaper than having kept a copy.
        spoken = segments if segments is not None else fetch_video(course.video_id).segments

        title_block = f"\nVideo title: {sanitize_title(course.video_title)}\n" if course.video_title else ""
        listed = "\n".join(f"{i + 1}. {s.title}" for i, s in enumerate(course.sections))
        prompt = _PROMPT.format(
            title_block=title_block,
            formatted=format_transcript([TranscriptSegment(**s) for s in spoken]),
            sections=listed,
        )
        logger.info("[cheatsheet]: writing for course %s with model=%s", course_id, connection.model)
        data = complete_json(
            model=connection.model,
            credentials=connection.credentials,
            prompt=prompt,
            required_keys=("sections",),
        )
        row.sheet_json = json.dumps({"sections": _points_by_title(data, course)})
        row.status = SheetStatus.ready
        session.add(row)
        session.commit()
        logger.info("[cheatsheet]: written for course %s", course_id)
    except Exception:
        logger.exception("[cheatsheet]: could not write for course %s", course_id)
        session.rollback()
        row = session.get(CachedCheatsheet, course_id)
        if row is not None:
            row.status = SheetStatus.failed
            session.add(row)
            session.commit()


def claim(session: Session, course_id: uuid.UUID) -> bool:
    """Marks the sheet as being written and says whether the caller should do
    the writing. A pending row left behind by a restart is claimed again once
    it is old enough that nothing can still be working on it."""
    row = session.get(CachedCheatsheet, course_id)
    now = datetime.now(timezone.utc)

    if row is None:
        session.add(CachedCheatsheet(course_id=course_id, status=SheetStatus.pending))
        session.commit()
        return True

    if row.status is SheetStatus.ready:
        return False

    started = row.created_at if row.created_at.tzinfo else row.created_at.replace(tzinfo=timezone.utc)
    if row.status is SheetStatus.pending and now - started < _STALE_AFTER:
        return False

    row.status = SheetStatus.pending
    row.created_at = now
    session.add(row)
    session.commit()
    return True


def read(session: Session, course_id: uuid.UUID) -> CachedCheatsheet | None:
    return session.get(CachedCheatsheet, course_id)


def write_in_background(course_id: uuid.UUID, segments: list[dict] | None = None) -> None:
    """The request session closes with the response, so the work that outlives
    it opens one of its own. The transcript rides along rather than being stored
    and read back: the fetch that made the course is the only one there is."""
    from database import engine

    with Session(engine) as session:
        write(session, course_id, segments)
