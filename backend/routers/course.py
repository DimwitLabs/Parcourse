import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user
from models.course_cache import CachedCourse
from models.user import User
from schemas.course import CourseGenerateRequest, CourseResponse, CourseResponsePublic
from services.course import generate
from services.knowledge_graph import extract_and_merge

router = APIRouter(prefix="/course", tags=["course"])


@router.post("/generate", response_model=CourseResponsePublic, status_code=status.HTTP_201_CREATED)
def generate_course(
    body: CourseGenerateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> CourseResponsePublic:
    try:
        course = generate(body.video_id, body.segments)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc

    cached = CachedCourse(user_id=user.id, video_id=course.video_id, course_json=course.model_dump_json())
    session.add(cached)
    session.commit()
    session.refresh(cached)

    try:
        extract_and_merge(session, user.id, cached.id, course, course.video_id)
    except Exception:
        # Knowledge graph extraction is best-effort — a failure here shouldn't block the course.
        session.rollback()

    return CourseResponsePublic.from_full(course, id=str(cached.id))


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
