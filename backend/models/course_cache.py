import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, ForeignKey
from sqlmodel import Field

from models.base import SQLModelBase


class CachedCourse(SQLModelBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), index=True, nullable=False))
    video_id: str = Field(index=True)
    course_json: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
