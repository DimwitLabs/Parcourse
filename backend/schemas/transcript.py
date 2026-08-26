from pydantic import BaseModel


class TranscriptRequest(BaseModel):
    url: str


class TranscriptSegment(BaseModel):
    text: str
    start: float
    duration: float


class Chapter(BaseModel):
    title: str
    start_seconds: float
    end_seconds: float


class TranscriptResponse(BaseModel):
    video_id: str
    video_title: str = ""
    segments: list[TranscriptSegment]
    chapters: list[Chapter] = []
