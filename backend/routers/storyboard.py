from fastapi import APIRouter, Depends, HTTPException, Response, status

from dependencies import get_current_user
from models.user import User
from schemas.storyboard import StoryboardResponse
from services.storyboard import get_frame_at, get_storyboard_formats

router = APIRouter(prefix="/storyboard", tags=["storyboard"])


@router.get("/{video_id}", response_model=StoryboardResponse)
def get_storyboard(video_id: str, _: User = Depends(get_current_user)) -> StoryboardResponse:
    try:
        storyboards = get_storyboard_formats(video_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return StoryboardResponse(video_id=video_id, storyboards=storyboards)


@router.get("/{video_id}/frame")
def get_frame(video_id: str, seconds: float, _: User = Depends(get_current_user)) -> Response:
    try:
        image_bytes = get_frame_at(video_id, seconds)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return Response(content=image_bytes, media_type="image/jpeg")
