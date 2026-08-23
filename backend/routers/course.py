import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from dependencies import get_current_user
from models.course_cache import CachedCourse
from models.knowledge_graph import CourseKnowledgeNode, EdgeType, KnowledgeEdge, UserKnowledgeProgress
from models.quiz_attempt import QuizAttempt
from models.quiz_draft import QuizDraft
from models.section_progress import SectionProgress
from models.user import User
from schemas.course import CourseGenerateRequest, CourseListEntry, CourseResponse, CourseResponsePublic
from services.connection import NoConnectionError, resolve
from services.course import generate
from services.knowledge_graph import extract_and_merge

logger = logging.getLogger(__name__)


class DraftPayload(BaseModel):
    mcq_answers: dict[str, str] = {}
    theory_answers: dict[str, str] = {}

router = APIRouter(prefix="/courses", tags=["courses"])


@router.post("/generate", response_model=CourseResponsePublic, status_code=status.HTTP_201_CREATED)
def generate_course(
    body: CourseGenerateRequest,
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
        course = generate(body.video_id, body.segments, connection.credentials, model, body.video_title, body.feedback)
    except Exception as exc:
        logger.error("[course]: AI generation failed for video_id=%s: %s", body.video_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc

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

    return CourseResponsePublic.from_full(course, id=str(cached.id))


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
        ))
    return results


@router.get("/{course_id}", response_model=CourseResponsePublic)
def get_course(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CourseResponsePublic:
    logger.info("[course]: get course_id=%s by user %s", course_id, user.id)
    cached = session.get(CachedCourse, course_id)
    if cached is None or cached.user_id != user.id:
        logger.warning("[course]: course not found course_id=%s", course_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    course = CourseResponse.model_validate_json(cached.course_json)
    return CourseResponsePublic.from_full(course, id=str(cached.id))


def _keeping(session: Session, surviving: set[uuid.UUID]) -> set[uuid.UUID]:
    """Everything a surviving concept still hangs from. A skill outlives its
    course when another one teaches it, and removing the topic it belongs to
    would leave it floating with nothing to join it to the rest."""
    keeping = set(surviving)
    frontier = set(surviving)
    while frontier:
        parents = session.exec(
            select(KnowledgeEdge.target_id).where(
                KnowledgeEdge.source_id.in_(frontier),
                KnowledgeEdge.edge_type == EdgeType.belongs_to,
            )
        ).all()
        frontier = set(parents) - keeping
        keeping |= frontier
    return keeping


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

    links = session.exec(select(CourseKnowledgeNode).where(CourseKnowledgeNode.course_id == course_id)).all()

    if cleanup_graph:
        losing = set()
        for link in links:
            # A course the user still holds is the only thing keeping a
            # concept alive, so ask that rather than keeping a tally.
            still_reached = session.exec(
                select(CourseKnowledgeNode.course_id)
                .join(CachedCourse, CachedCourse.id == CourseKnowledgeNode.course_id)
                .where(
                    CourseKnowledgeNode.node_id == link.node_id,
                    CourseKnowledgeNode.course_id != course_id,
                    CachedCourse.user_id == user.id,
                )
            ).first()
            if still_reached is None:
                losing.add(link.node_id)

        owned = {
            p.node_id: p
            for p in session.exec(
                select(UserKnowledgeProgress).where(UserKnowledgeProgress.user_id == user.id)
            ).all()
        }
        for node_id in losing - _keeping(session, set(owned) - losing):
            progress = owned.get(node_id)
            if progress is not None:
                session.delete(progress)
        session.flush()

    for link in links:
        session.delete(link)
    for attempt in session.exec(select(QuizAttempt).where(QuizAttempt.course_id == course_id)).all():
        session.delete(attempt)
    for sp in session.exec(select(SectionProgress).where(SectionProgress.course_id == course_id)).all():
        session.delete(sp)
    draft = session.exec(
        select(QuizDraft).where(QuizDraft.course_id == course_id, QuizDraft.user_id == user.id)
    ).first()
    if draft:
        session.delete(draft)
    session.flush()
    session.delete(cached)
    session.commit()
    logger.info("[course]: deleted course_id=%s", course_id)


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
