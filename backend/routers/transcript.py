from fastapi import APIRouter, HTTPException, status

from schemas.transcript import TranscriptRequest, TranscriptResponse, TranscriptSegment
from services.youtube import extract_video_id, fetch_transcript

router = APIRouter(prefix="/transcript", tags=["transcript"])


@router.post("/extract", response_model=TranscriptResponse)
def extract(body: TranscriptRequest) -> TranscriptResponse:
    try:
        video_id = extract_video_id(body.url)
        segments = fetch_transcript(video_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    return TranscriptResponse(video_id=video_id, segments=[TranscriptSegment(**s) for s in segments])
