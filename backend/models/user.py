import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    admin = "admin"
    student = "student"


class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: UserRole = Field(default=UserRole.student)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    first_name: str | None = Field(default=None)
    last_name: str | None = Field(default=None)
    connection: str | None = Field(default=None)
    must_change_password: bool = Field(default=False)
