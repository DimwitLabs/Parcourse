import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, func, select

logger = logging.getLogger(__name__)

from database import get_session
from dependencies import require_admin
from models.course_cache import CachedCourse
from models.knowledge_graph import CourseKnowledgeNode, UserKnowledgeProgress
from models.quiz_attempt import QuizAttempt
from models.section_progress import SectionProgress
from models.user import User, UserRole
from schemas.auth import CreateUserRequest, UserResponse, UserWithUsage
from services.auth import hash_password

router = APIRouter(prefix="/users", tags=["users"])


def _delete_user_data(user_id: uuid.UUID, session: Session) -> None:
    for row in session.exec(select(UserKnowledgeProgress).where(UserKnowledgeProgress.user_id == user_id)).all():
        session.delete(row)
    for row in session.exec(select(QuizAttempt).where(QuizAttempt.user_id == user_id)).all():
        session.delete(row)
    for row in session.exec(select(SectionProgress).where(SectionProgress.user_id == user_id)).all():
        session.delete(row)
    session.flush()
    for c in session.exec(select(CachedCourse).where(CachedCourse.user_id == user_id)).all():
        for link in session.exec(select(CourseKnowledgeNode).where(CourseKnowledgeNode.course_id == c.id)).all():
            session.delete(link)
        session.delete(c)
    session.flush()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> UserResponse:
    logger.info("[users]: create user requested, email=%s", body.email)
    if session.exec(select(User).where(User.email == body.email)).first() is not None:
        logger.warning("[users]: email already in use: %s", body.email)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=UserRole.student,
        first_name=body.first_name,
        last_name=body.last_name,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    logger.info("[users]: created user id=%s", user.id)
    return UserResponse(**user.model_dump())


@router.get("", response_model=list[UserWithUsage])
def list_users(
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> list[UserWithUsage]:
    logger.info("[users]: list users requested")
    users = session.exec(select(User)).all()
    counts = dict(
        session.exec(
            select(CachedCourse.user_id, func.count()).group_by(CachedCourse.user_id)
        ).all()
    )
    return [
        UserWithUsage(**u.model_dump(), course_count=counts.get(u.id, 0))
        for u in users
    ]


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> None:
    logger.info("[users]: delete user requested, user_id=%s", user_id)
    user = session.get(User, user_id)
    if user is None:
        logger.warning("[users]: user not found for deletion, user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == admin.id:
        logger.warning("[users]: admin attempted self-deletion, user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself")
    _delete_user_data(user_id, session)
    session.delete(user)
    session.commit()
    logger.info("[users]: deleted user user_id=%s", user_id)


@router.post("/{user_id}/reset-progress", status_code=status.HTTP_204_NO_CONTENT)
def reset_user_progress(
    user_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> None:
    logger.info("[users]: reset progress requested for user_id=%s", user_id)
    user = session.get(User, user_id)
    if user is None:
        logger.warning("[users]: user not found for reset, user_id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    _delete_user_data(user_id, session)
    session.commit()
    logger.info("[users]: progress reset complete for user_id=%s", user_id)
