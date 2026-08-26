from datetime import datetime

from pydantic import BaseModel, Field

LONGEST_SHEET_WORTH_KEEPING = 200_000


class NoteResponse(BaseModel):
    body: str
    updated_at: datetime | None


class NoteSaveRequest(BaseModel):
    body: str = Field(max_length=LONGEST_SHEET_WORTH_KEEPING)
