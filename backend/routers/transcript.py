import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user
from models.user import User
from schemas.transcript import TranscriptRequest, TranscriptResponse, TranscriptSegment
from services.transcript import load_video
from services.youtube import TranscriptBlocked, extract_video_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transcript", tags=["transcript"])


@router.post("/extract", response_model=TranscriptResponse)
def extract(
    body: TranscriptRequest,
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
) -> TranscriptResponse:
    logger.info("[transcript]: extract requested for url=%s", body.url)
    try:
        video_id = extract_video_id(body.url)
        video = load_video(session, video_id)
    except TranscriptBlocked as exc:
        logger.error("[transcript]: youtube blocked this server for url=%s", body.url)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        logger.warning("[transcript]: extraction failed for url=%s: %s", body.url, exc)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    logger.info("[transcript]: extracted %d segments for video_id=%s", len(video.segments), video_id)
    return TranscriptResponse(
        video_id=video_id,
        video_title=video.title,
        segments=[TranscriptSegment(**s) for s in video.segments],
    )
