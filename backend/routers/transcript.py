import logging

from fastapi import APIRouter, Depends, HTTPException, status

logger = logging.getLogger(__name__)

from dependencies import get_current_user
from models.user import User
from schemas.transcript import TranscriptRequest, TranscriptResponse, TranscriptSegment
from services.youtube import extract_video_id, fetch_transcript, fetch_video_title

router = APIRouter(prefix="/transcript", tags=["transcript"])


@router.post("/extract", response_model=TranscriptResponse)
def extract(body: TranscriptRequest, _: User = Depends(get_current_user)) -> TranscriptResponse:
    logger.info("[transcript]: extract requested for url=%s", body.url)
    try:
        video_id = extract_video_id(body.url)
        segments = fetch_transcript(video_id)
    except ValueError as exc:
        logger.warning("[transcript]: extraction failed for url=%s: %s", body.url, exc)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    logger.info("[transcript]: extracted %d segments for video_id=%s", len(segments), video_id)
    video_title = fetch_video_title(video_id)
    return TranscriptResponse(video_id=video_id, video_title=video_title, segments=[TranscriptSegment(**s) for s in segments])
