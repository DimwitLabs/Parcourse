import uuid
from datetime import datetime
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
    created_at: datetime = Field(default_factory=datetime.utcnow)
