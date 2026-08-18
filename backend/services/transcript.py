import json
import logging

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from models.cached_transcript import CachedTranscript
from services.youtube import Video, fetch_video

logger = logging.getLogger(__name__)


def load_video(session: Session, video_id: str) -> Video:
    """Captions never change, so the first person to ask for a video pays for
    it and everyone after them reads the stored copy."""
    cached = session.get(CachedTranscript, video_id)
    if cached:
        logger.info("[transcript]: cache hit for video %s", video_id)
        return Video(title=cached.title, segments=json.loads(cached.segments_json))

    video = fetch_video(video_id)
    if not video.title:
        # A stored blank title is permanent, and a course wearing one reads
        # as broken forever. Better to ask YouTube again next time.
        logger.warning("[transcript]: video %s came back without a title, not storing", video_id)
        return video

    session.add(
        CachedTranscript(
            video_id=video_id,
            title=video.title,
            segments_json=json.dumps(video.segments),
        )
    )
    try:
        session.commit()
    except IntegrityError:
        # Two people asked for the same new video at once; theirs landed first
        # and it says the same thing as ours.
        session.rollback()
        logger.info("[transcript]: another request stored video %s first", video_id)
    return video
