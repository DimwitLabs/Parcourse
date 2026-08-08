from fastapi import APIRouter, Depends, HTTPException, status

from dependencies import get_current_user
from models.user import User
from schemas.course import CourseGenerateRequest, CourseResponse
from services.course import generate

router = APIRouter(prefix="/course", tags=["course"])


@router.post("/generate", response_model=CourseResponse)
def generate_course(
    body: CourseGenerateRequest, _: User = Depends(get_current_user)
) -> CourseResponse:
    try:
        return generate(body.video_id, body.segments)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"AI provider request failed: {exc}"
        ) from exc
