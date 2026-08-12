import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

from database import get_session
from dependencies import get_current_user
from models.course_cache import CachedCourse
from models.knowledge_graph import CourseKnowledgeNode
from models.quiz_attempt import QuizAttempt
from models.user import User
from schemas.course import CourseGenerateRequest, CourseResponse, CourseResponsePublic
from services.api_key import NoApiKeyError, resolve_api_key, resolve_model
from services.course import generate
from services.knowledge_graph import extract_and_merge

router = APIRouter(prefix="/course", tags=["course"])


@router.post("/generate", response_model=CourseResponsePublic, status_code=status.HTTP_201_CREATED)
def generate_course(
    body: CourseGenerateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CourseResponsePublic:
    existing = session.exec(
        select(CachedCourse).where(
            CachedCourse.user_id == user.id,
            CachedCourse.video_id == body.video_id,
        )
    ).first()
    if existing:
        course = CourseResponse.model_validate_json(existing.course_json)
        return CourseResponsePublic.from_full(course, id=str(existing.id))

    try:
        api_key = resolve_api_key(session, user)
    except NoApiKeyError as exc:
        raise HTTPException(status_code=status.HTTP_412_PRECONDITION_FAILED, detail=str(exc)) from exc
    model = resolve_model(session)
    try:
        course = generate(body.video_id, body.segments, api_key, model)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc

    cached = CachedCourse(user_id=user.id, video_id=body.video_id, course_json=course.model_dump_json())
    session.add(cached)
    session.commit()
    session.refresh(cached)

    try:
        extract_and_merge(session, user.id, cached.id, course, course.video_id, api_key, model)
    except Exception:
        logger.exception("Knowledge graph extraction failed for course %s", cached.id)
        session.rollback()

    return CourseResponsePublic.from_full(course, id=str(cached.id))


@router.get("s", response_model=list[CourseResponsePublic])
def list_courses(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[CourseResponsePublic]:
    rows = session.exec(
        select(CachedCourse)
        .where(CachedCourse.user_id == user.id)
        .order_by(CachedCourse.created_at.desc())
    ).all()
    results = []
    for row in rows:
        course = CourseResponse.model_validate_json(row.course_json)
        results.append(CourseResponsePublic.from_full(course, id=str(row.id)))
    return results


@router.get("/{course_id}", response_model=CourseResponsePublic)
def get_course(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CourseResponsePublic:
    cached = session.get(CachedCourse, course_id)
    if cached is None or cached.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    course = CourseResponse.model_validate_json(cached.course_json)
    return CourseResponsePublic.from_full(course, id=str(cached.id))


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    cached = session.get(CachedCourse, course_id)
    if cached is None or cached.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    for link in session.exec(select(CourseKnowledgeNode).where(CourseKnowledgeNode.course_id == course_id)).all():
        session.delete(link)
    for attempt in session.exec(select(QuizAttempt).where(QuizAttempt.course_id == course_id)).all():
        session.delete(attempt)
    session.delete(cached)
    session.commit()
