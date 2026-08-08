from pydantic import BaseModel


class StoryboardFragment(BaseModel):
    url: str
    duration: float | None = None


class StoryboardFormat(BaseModel):
    format_id: str
    width: int | None = None
    height: int | None = None
    rows: int | None = None
    columns: int | None = None
    fragments: list[StoryboardFragment]


class StoryboardResponse(BaseModel):
    video_id: str
    storyboards: list[StoryboardFormat]
