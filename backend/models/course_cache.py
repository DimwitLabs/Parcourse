import uuid
from datetime import datetime

from sqlmodel import Field, SQLModel


class CachedCourse(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    video_id: str = Field(index=True)
    course_json: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
