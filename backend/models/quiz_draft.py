import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, ForeignKey, UniqueConstraint
from sqlmodel import Field

from models.base import SQLModelBase


class QuizDraft(SQLModelBase, table=True):
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="uq_quiz_draft_user_course"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    course_id: uuid.UUID = Field(
        sa_column=Column(ForeignKey("cached_course.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    answers_json: str = Field(default="{}")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
