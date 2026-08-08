from pydantic import BaseModel

from schemas.transcript import TranscriptSegment


class CourseGenerateRequest(BaseModel):
    video_id: str
    segments: list[TranscriptSegment]


class CourseSection(BaseModel):
    title: str
    summary: str
    start_seconds: float
    end_seconds: float


class CourseResponse(BaseModel):
    video_id: str
    thumbnail_url: str
    sections: list[CourseSection]
