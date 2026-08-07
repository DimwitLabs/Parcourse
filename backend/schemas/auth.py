import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr

from models.instance_config import InstanceMode
from models.user import UserRole


class SetupRequest(BaseModel):
    email: EmailStr
    password: str
    mode: InstanceMode


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    created_at: datetime


class SetupStatusResponse(BaseModel):
    needs_setup: bool


class ConfigResponse(BaseModel):
    mode: InstanceMode
