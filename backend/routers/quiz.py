import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

from database import get_session
from dependencies import get_current_user
from models.course_cache import CachedCourse
from models.knowledge_graph import CourseKnowledgeNode, UserKnowledgeProgress
from models.quiz_attempt import QuizAttempt
from models.user import User
from schemas.course import CourseResponse
from schemas.quiz import QuizResultResponse, QuizSubmitRequest
from services.api_key import NoApiKeyError, resolve_connection
from services.quiz import score_submission

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.post("/score", response_model=QuizResultResponse)
def score_quiz(
    body: QuizSubmitRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> QuizResultResponse:
    logger.info("[quiz]: score requested for course_id=%s by user %s", body.course_id, user.id)
    try:
        course_uuid = uuid.UUID(body.course_id)
    except ValueError as exc:
        logger.warning("[quiz]: invalid course_id=%s", body.course_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course_id") from exc

    cached = session.get(CachedCourse, course_uuid)
    if cached is None or cached.user_id != user.id:
        logger.warning("[quiz]: course not found course_id=%s", body.course_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    course = CourseResponse.model_validate_json(cached.course_json)
    try:
        connection = resolve_connection(session, user)
    except NoApiKeyError as exc:
        raise HTTPException(status_code=status.HTTP_412_PRECONDITION_FAILED, detail=str(exc)) from exc
    model = connection.model

    try:
        result = score_submission(body.course_id, course, body.mcq_answers, body.theory_answers, connection.credentials, model)
    except Exception as exc:
        logger.error("[quiz]: AI scoring failed for course_id=%s: %s", body.course_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc

    logger.info("[quiz]: scored course_id=%s, score=%s/%s (%.1f%%)", body.course_id, result.total_score, result.max_score, result.percentage)
    attempt = QuizAttempt(
        course_id=course_uuid,
        user_id=user.id,
        total_score=result.total_score,
        max_score=result.max_score,
        percentage=result.percentage,
        result_json=result.model_dump_json(),
    )
    session.add(attempt)

    mastery_score = result.percentage / 100.0
    links = session.exec(select(CourseKnowledgeNode).where(CourseKnowledgeNode.course_id == course_uuid)).all()
    for link in links:
        progress = session.exec(
            select(UserKnowledgeProgress).where(
                UserKnowledgeProgress.user_id == user.id,
                UserKnowledgeProgress.node_id == link.node_id,
            )
        ).first()
        if progress is None:
            progress = UserKnowledgeProgress(user_id=user.id, node_id=link.node_id, mastery_score=mastery_score)
        else:
            progress.mastery_score = max(progress.mastery_score, mastery_score)
            progress.last_touched_at = datetime.now(timezone.utc)
        session.add(progress)

    session.commit()

    return result


@router.get("/attempts/{course_id}", response_model=QuizResultResponse)
def get_latest_attempt(
    course_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> QuizResultResponse:
    logger.info("[quiz]: get latest attempt for course_id=%s by user %s", course_id, user.id)
    attempt = session.exec(
        select(QuizAttempt)
        .where(QuizAttempt.course_id == course_id, QuizAttempt.user_id == user.id)
        .order_by(QuizAttempt.created_at.desc())
    ).first()
    if attempt is None:
        logger.warning("[quiz]: no attempt found for course_id=%s", course_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No attempt found")
    return QuizResultResponse.model_validate_json(attempt.result_json)
