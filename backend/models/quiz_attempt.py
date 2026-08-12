import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, ForeignKey
from sqlmodel import Field, SQLModel


class QuizAttempt(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    course_id: uuid.UUID = Field(sa_column=Column(ForeignKey("cachedcourse.id", ondelete="CASCADE"), index=True, nullable=False))
    user_id: uuid.UUID = Field(sa_column=Column(ForeignKey("user.id", ondelete="CASCADE"), index=True, nullable=False))
    total_score: float
    max_score: float
    percentage: float
    result_json: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
