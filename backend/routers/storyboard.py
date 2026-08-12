import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status

logger = logging.getLogger(__name__)

from dependencies import get_current_user
from models.user import User
from schemas.storyboard import StoryboardResponse
from services.storyboard import get_frame_at, get_storyboard_formats

router = APIRouter(prefix="/storyboard", tags=["storyboard"])


@router.get("/{video_id}", response_model=StoryboardResponse)
def get_storyboard(video_id: str, _: User = Depends(get_current_user)) -> StoryboardResponse:
    logger.info("[storyboard]: get storyboard for video_id=%s", video_id)
    try:
        storyboards = get_storyboard_formats(video_id)
    except Exception as exc:
        logger.error("[storyboard]: failed to fetch storyboard for video_id=%s: %s", video_id, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    logger.info("[storyboard]: found %d formats for video_id=%s", len(storyboards), video_id)
    return StoryboardResponse(video_id=video_id, storyboards=storyboards)


@router.get("/{video_id}/frame")
def get_frame(video_id: str, seconds: float, _: User = Depends(get_current_user)) -> Response:
    logger.info("[storyboard]: get frame for video_id=%s at seconds=%.1f", video_id, seconds)
    try:
        image_bytes = get_frame_at(video_id, seconds)
    except Exception as exc:
        logger.error("[storyboard]: failed to get frame for video_id=%s at %.1f: %s", video_id, seconds, exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    logger.info("[storyboard]: frame retrieved for video_id=%s, size=%d bytes", video_id, len(image_bytes))
    return Response(content=image_bytes, media_type="image/jpeg")
