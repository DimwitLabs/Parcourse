import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user
from models.course_cache import CachedCourse
from models.user import User
from schemas.course import CourseResponse
from schemas.quiz import QuizResultResponse, QuizSubmitRequest
from services.quiz import score_submission

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.post("/score", response_model=QuizResultResponse)
def score_quiz(
    body: QuizSubmitRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> QuizResultResponse:
    try:
        course_uuid = uuid.UUID(body.course_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid course_id") from exc

    cached = session.get(CachedCourse, course_uuid)
    if cached is None or cached.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    course = CourseResponse.model_validate_json(cached.course_json)

    try:
        return score_submission(body.course_id, course, body.mcq_answers, body.theory_answers)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc
