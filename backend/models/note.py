import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, ForeignKey
from sqlmodel import Field

from models.base import SQLModelBase


class CourseNote(SQLModelBase, table=True):
    """One sheet per course. A course already belongs to one person, so the
    course is the whole key and there is nothing left to scope by user."""

    course_id: uuid.UUID = Field(sa_column=Column(ForeignKey("cached_course.id", ondelete="CASCADE"), primary_key=True))
    body: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
