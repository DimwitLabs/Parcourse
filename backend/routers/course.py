import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from dependencies import get_current_user
from models.cheatsheet_cache import CachedCheatsheet, SheetStatus
from models.course_cache import CachedCourse
from models.note import CourseNote
from models.quiz_attempt import QuizAttempt
from models.quiz_draft import QuizDraft
from models.section_progress import SectionProgress
from models.user import User
from schemas.course import (
    CheatsheetResponse,
    CheatsheetSection,
    CourseGenerateRequest,
    CourseListEntry,
    CourseResponse,
    CourseResponsePublic,
)
from schemas.transcript import Chapter, TranscriptSegment
from services import cheatsheet
from services.connection import NoConnectionError, resolve
from services.course import generate
from services.knowledge_graph import extract_and_merge, unlink_course
from services.youtube import TranscriptBlocked, fetch_channel, fetch_video

logger = logging.getLogger(__name__)


class DraftPayload(BaseModel):
    mcq_answers: dict[str, str] = {}
    theory_answers: dict[str, str] = {}


class RegeneratePayload(BaseModel):
    feedback: str = ""
    keep_notes: bool = True
    keep_graph: bool = True

router = APIRouter(prefix="/courses", tags=["courses"])


@router.post("/generate", response_model=CourseResponsePublic, status_code=status.HTTP_201_CREATED)
def generate_course(
    body: CourseGenerateRequest,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CourseResponsePublic:
    logger.info("[course]: generate requested for video_id=%s by user %s", body.video_id, user.id)
    existing = session.exec(
        select(CachedCourse).where(
            CachedCourse.user_id == user.id,
            CachedCourse.video_id == body.video_id,
        )
    ).first()
    if existing:
        logger.info("[course]: returning cached course id=%s for video_id=%s", existing.id, body.video_id)
        course = CourseResponse.model_validate_json(existing.course_json)
        return CourseResponsePublic.from_full(course, id=str(existing.id))

    try:
        connection = resolve(session, user)
    except NoConnectionError as exc:
        logger.warning("[course]: no API key for user %s", user.id)
        raise HTTPException(status_code=status.HTTP_412_PRECONDITION_FAILED, detail=str(exc)) from exc
    model = connection.model
    try:
        course = generate(
            body.video_id,
            body.segments,
            connection.credentials,
            model,
            body.video_title,
            body.feedback,
            body.chapters,
            body.channel,
            body.channel_url,
        )
    except Exception as exc:
        logger.error("[course]: AI generation failed for video_id=%s: %s", body.video_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc

    segments = [s.model_dump() for s in body.segments]
    cached = CachedCourse(user_id=user.id, video_id=body.video_id, course_json=course.model_dump_json())
    session.add(cached)
    session.commit()
    session.refresh(cached)
    logger.info("[course]: generated and cached course id=%s for video_id=%s", cached.id, body.video_id)

    try:
        extract_and_merge(session, user.id, cached.id, course, course.video_id, connection.credentials, model)
    except Exception:
        logger.exception("Knowledge graph extraction failed for course %s", cached.id)
        session.rollback()

    if cheatsheet.claim(session, cached.id):
        background.add_task(cheatsheet.write_in_background, cached.id, segments)

    return CourseResponsePublic.from_full(course, id=str(cached.id))


@router.get("/{course_id}/cheatsheet", response_model=CheatsheetResponse)
def get_cheatsheet(
    course_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CheatsheetResponse:
    cached = session.get(CachedCourse, course_id)
    if cached is None or cached.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    course = CourseResponse.model_validate_json(cached.course_json)
    if cheatsheet.claim(session, course_id):
        logger.info("[course]: cheatsheet for course_id=%s is being written", course_id)
        background.add_task(cheatsheet.write_in_background, course_id)

    row = cheatsheet.read(session, course_id)
    if row is None or row.status is not SheetStatus.ready:
        return CheatsheetResponse(
            status=row.status.value if row else SheetStatus.pending.value,
            video_id=course.video_id,
            video_title=course.video_title,
            channel=course.channel,
            channel_url=course.channel_url,
        )

    stored = json.loads(row.sheet_json or "{}")
    return CheatsheetResponse(
        status=SheetStatus.ready.value,
        video_id=course.video_id,
        video_title=course.video_title,
        channel=course.channel,
        channel_url=course.channel_url,
        sections=[CheatsheetSection(**s) for s in stored.get("sections", [])],
    )


@router.get("", response_model=list[CourseListEntry])
def list_courses(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[CourseListEntry]:
    logger.info("[course]: list courses for user %s", user.id)
    rows = session.exec(
        select(CachedCourse)
        .where(CachedCourse.user_id == user.id)
        .order_by(CachedCourse.created_at.desc())
    ).all()

    course_ids = [row.id for row in rows]
    progress_rows = session.exec(
        select(SectionProgress.course_id, SectionProgress.section_index)
        .where(SectionProgress.user_id == user.id, SectionProgress.course_id.in_(course_ids))
    ).all()
    progress_map: dict[uuid.UUID, list[int]] = {}
    for cid, sidx in progress_rows:
        progress_map.setdefault(cid, []).append(sidx)

    quiz_rows = session.exec(
        select(QuizAttempt.course_id, QuizAttempt.percentage)
        .where(QuizAttempt.user_id == user.id, QuizAttempt.course_id.in_(course_ids))
    ).all()
    quiz_map: dict[uuid.UUID, float] = {}
    for cid, pct in quiz_rows:
        quiz_map[cid] = max(quiz_map.get(cid, 0.0), pct)

    sheet_rows = session.exec(
        select(CachedCheatsheet.course_id, CachedCheatsheet.status)
        .where(CachedCheatsheet.course_id.in_(course_ids))
    ).all()
    sheet_map = {cid: st for cid, st in sheet_rows}

    results = []
    for row in rows:
        course = CourseResponse.model_validate_json(row.course_json)
        pub = CourseResponsePublic.from_full(course, id=str(row.id))
        completed = progress_map.get(row.id, [])
        all_done = len(completed) == len(course.sections) and len(course.sections) > 0
        has_passed = quiz_map.get(row.id, 0.0) >= 70.0 and all_done
        results.append(CourseListEntry(
            **pub.model_dump(),
            completed_sections=sorted(completed),
            has_passed_quiz=has_passed,
            # A course with no attempt has no history to open.
            has_attempts=row.id in quiz_map,
            cheatsheet_status=sheet_map.get(row.id, SheetStatus.pending).value,
            created_at=row.created_at,
        ))
    return results


def name_the_creator(course_id: uuid.UUID) -> None:
    """Courses built before the creator was recorded carry no name, so the
    first time one is opened it is looked up and kept. Reading the course does
    not wait for it: the credit is there on the next visit."""
    from database import engine

    with Session(engine) as session:
        cached = session.get(CachedCourse, course_id)
        if cached is None:
            return
        course = CourseResponse.model_validate_json(cached.course_json)
        if course.channel:
            return
        channel, channel_url = fetch_channel(course.video_id)
        if not channel:
            return
        course.channel = channel
        course.channel_url = channel_url
        cached.course_json = course.model_dump_json()
        session.add(cached)
        session.commit()
        logger.info("[course]: filled in the creator for course %s", course_id)


@router.get("/{course_id}", response_model=CourseResponsePublic)
def get_course(
    course_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CourseResponsePublic:
    logger.info("[course]: get course_id=%s by user %s", course_id, user.id)
    cached = session.get(CachedCourse, course_id)
    if cached is None or cached.user_id != user.id:
        logger.warning("[course]: course not found course_id=%s", course_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    course = CourseResponse.model_validate_json(cached.course_json)
    if not course.channel:
        background.add_task(name_the_creator, cached.id)
    return CourseResponsePublic.from_full(course, id=str(cached.id))


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: uuid.UUID,
    cleanup_graph: bool = False,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    logger.info("[course]: delete course_id=%s by user %s, cleanup_graph=%s", course_id, user.id, cleanup_graph)
    cached = session.get(CachedCourse, course_id)
    if cached is None or cached.user_id != user.id:
        logger.warning("[course]: course not found for deletion course_id=%s", course_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    unlink_course(session, user.id, course_id, prune_mastery=cleanup_graph)
    for attempt in session.exec(select(QuizAttempt).where(QuizAttempt.course_id == course_id)).all():
        session.delete(attempt)
    for sp in session.exec(select(SectionProgress).where(SectionProgress.course_id == course_id)).all():
        session.delete(sp)
    draft = session.exec(
        select(QuizDraft).where(QuizDraft.course_id == course_id, QuizDraft.user_id == user.id)
    ).first()
    if draft:
        session.delete(draft)
    # SQLite does not enforce the foreign keys these two declare, so what the
    # course carried has to be swept by hand rather than left to a cascade.
    note = session.get(CourseNote, course_id)
    if note:
        session.delete(note)
    sheet = session.get(CachedCheatsheet, course_id)
    if sheet:
        session.delete(sheet)
    session.flush()
    session.delete(cached)
    session.commit()
    logger.info("[course]: deleted course_id=%s", course_id)


@router.post("/{course_id}/regenerate", response_model=CourseResponsePublic)
def regenerate_course(
    course_id: uuid.UUID,
    body: RegeneratePayload,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CourseResponsePublic:
    """Rebuilds a course in place. The id survives, so what the reader wrote and
    what they learned can survive with it, while everything scored against the
    old questions cannot and is cleared."""
    logger.info("[course]: regenerate requested for course_id=%s by user %s", course_id, user.id)
    cached = session.get(CachedCourse, course_id)
    if cached is None or cached.user_id != user.id:
        logger.warning("[course]: course not found for regeneration course_id=%s", course_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    try:
        connection = resolve(session, user)
    except NoConnectionError as exc:
        logger.warning("[course]: no API key for user %s", user.id)
        raise HTTPException(status_code=status.HTTP_412_PRECONDITION_FAILED, detail=str(exc)) from exc
    model = connection.model

    try:
        video = fetch_video(cached.video_id)
    except TranscriptBlocked as exc:
        logger.error("[course]: youtube blocked this server for video_id=%s", cached.video_id)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        logger.warning("[course]: could not read video_id=%s: %s", cached.video_id, exc)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc

    segments = [TranscriptSegment(**s) for s in video.segments]
    try:
        course = generate(
            cached.video_id,
            segments,
            connection.credentials,
            model,
            video.title,
            body.feedback,
            [Chapter(**c) for c in video.chapters],
            video.channel,
            video.channel_url,
        )
    except Exception as exc:
        logger.error("[course]: AI regeneration failed for course_id=%s: %s", course_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc

    # Answers, drafts and scores all point at questions this course no longer
    # asks, so none of them can be carried across.
    for attempt in session.exec(select(QuizAttempt).where(QuizAttempt.course_id == course_id)).all():
        session.delete(attempt)
    for progress in session.exec(select(SectionProgress).where(SectionProgress.course_id == course_id)).all():
        session.delete(progress)
    draft = session.exec(
        select(QuizDraft).where(QuizDraft.course_id == course_id, QuizDraft.user_id == user.id)
    ).first()
    if draft:
        session.delete(draft)
    sheet = session.get(CachedCheatsheet, course_id)
    if sheet:
        session.delete(sheet)
    if not body.keep_notes:
        note = session.get(CourseNote, course_id)
        if note:
            session.delete(note)
    if not body.keep_graph:
        unlink_course(session, user.id, course_id, prune_mastery=True)

    cached.course_json = course.model_dump_json()
    cached.created_at = datetime.now(timezone.utc)
    session.add(cached)
    session.commit()
    session.refresh(cached)
    logger.info("[course]: regenerated course_id=%s", course_id)

    try:
        extract_and_merge(session, user.id, cached.id, course, course.video_id, connection.credentials, model)
    except Exception:
        logger.exception("Knowledge graph extraction failed for course %s", cached.id)
        session.rollback()

    if cheatsheet.claim(session, cached.id):
        background.add_task(cheatsheet.write_in_background, cached.id, video.segments)

    return CourseResponsePublic.from_full(course, id=str(cached.id))


@router.get("/{course_id}/progress", response_model=list[int])
def get_section_progress(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[int]:
    logger.info("[course]: get progress for course_id=%s by user %s", course_id, user.id)
    rows = session.exec(
        select(SectionProgress.section_index)
        .where(SectionProgress.course_id == course_id, SectionProgress.user_id == user.id)
    ).all()
    return list(rows)


@router.post("/{course_id}/progress/{section_index}", status_code=status.HTTP_204_NO_CONTENT)
def mark_section_done(
    course_id: uuid.UUID,
    section_index: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    logger.info("[course]: mark section %d done for course_id=%s by user %s", section_index, course_id, user.id)
    cached = session.get(CachedCourse, course_id)
    if cached is None or cached.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    existing = session.exec(
        select(SectionProgress).where(
            SectionProgress.course_id == course_id,
            SectionProgress.user_id == user.id,
            SectionProgress.section_index == section_index,
        )
    ).first()
    if existing:
        return
    sp = SectionProgress(user_id=user.id, course_id=course_id, section_index=section_index)
    session.add(sp)
    session.commit()


@router.delete("/{course_id}/progress/{section_index}", status_code=status.HTTP_204_NO_CONTENT)
def unmark_section_done(
    course_id: uuid.UUID,
    section_index: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    logger.info("[course]: unmark section %d for course_id=%s by user %s", section_index, course_id, user.id)
    row = session.exec(
        select(SectionProgress).where(
            SectionProgress.course_id == course_id,
            SectionProgress.user_id == user.id,
            SectionProgress.section_index == section_index,
        )
    ).first()
    if row:
        session.delete(row)
        session.commit()


@router.get("/{course_id}/draft", response_model=DraftPayload)
def get_draft(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> DraftPayload:
    draft = session.exec(
        select(QuizDraft).where(QuizDraft.course_id == course_id, QuizDraft.user_id == user.id)
    ).first()
    if not draft:
        return DraftPayload()
    data = json.loads(draft.answers_json)
    return DraftPayload(
        mcq_answers=data.get("mcq_answers", {}),
        theory_answers=data.get("theory_answers", {}),
    )


@router.put("/{course_id}/draft", status_code=status.HTTP_204_NO_CONTENT)
def save_draft(
    course_id: uuid.UUID,
    body: DraftPayload,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    cached = session.get(CachedCourse, course_id)
    if cached is None or cached.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    draft = session.exec(
        select(QuizDraft).where(QuizDraft.course_id == course_id, QuizDraft.user_id == user.id)
    ).first()
    payload = json.dumps({"mcq_answers": body.mcq_answers, "theory_answers": body.theory_answers})
    if draft:
        draft.answers_json = payload
        draft.updated_at = datetime.now(timezone.utc)
    else:
        draft = QuizDraft(user_id=user.id, course_id=course_id, answers_json=payload)
        session.add(draft)
    session.commit()
