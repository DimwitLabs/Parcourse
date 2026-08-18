import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, ForeignKey, UniqueConstraint
from sqlmodel import Field

from models.base import SQLModelBase


class SectionProgress(SQLModelBase, table=True):
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", "section_index", name="uq_section_progress_user_course_section"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), index=True, nullable=False))
    course_id: uuid.UUID = Field(sa_column=Column(ForeignKey("cached_course.id", ondelete="CASCADE"), index=True, nullable=False))
    section_index: int
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
