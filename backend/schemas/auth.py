import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from models.instance_config import InstanceMode
from models.user import UserRole


class SetupRequest(BaseModel):
    email: EmailStr
    password: str
    mode: InstanceMode
    first_name: str | None = None
    last_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str | None = None
    last_name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    created_at: datetime
    first_name: str | None = None
    last_name: str | None = None


class UserWithUsage(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    created_at: datetime
    first_name: str | None = None
    last_name: str | None = None
    course_count: int


class SetupStatusResponse(BaseModel):
    needs_setup: bool


class ConfigResponse(BaseModel):
    mode: InstanceMode
