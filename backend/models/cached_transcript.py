from sqlmodel import Field

from models.base import SQLModelBase


class CachedTranscript(SQLModelBase, table=True):
    """A transcript belongs to the video, not to whoever asked for it first, so
    it is keyed by video alone and every later reader is spared the fetch."""

    video_id: str = Field(primary_key=True)
    title: str
    segments_json: str
    chapters_json: str = ""
