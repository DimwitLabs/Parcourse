import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr

from models.instance_config import InstanceMode
from models.user import UserRole

PASSWORD_MIN_LENGTH = 8


def _check_password(value: str) -> str:
    """Messages read as the tail of "Password ..." once the client prefixes the
    field name, so they start with a verb and carry no field label."""
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"must be at least {PASSWORD_MIN_LENGTH} characters")
    if not any(c.isupper() for c in value):
        raise ValueError("must include an uppercase letter")
    if not any(c.islower() for c in value):
        raise ValueError("must include a lowercase letter")
    if not any(c.isdigit() for c in value):
        raise ValueError("must include a number")
    return value


# Every place a password is *set*. LoginRequest deliberately stays unconstrained:
# an existing weak password must still be able to sign in.
PasswordStr = Annotated[str, AfterValidator(_check_password)]


class SetupRequest(BaseModel):
    email: EmailStr
    password: PasswordStr
    mode: InstanceMode
    first_name: str | None = None
    last_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: PasswordStr
    first_name: str | None = None
    last_name: str | None = None


class ResetPasswordRequest(BaseModel):
    password: PasswordStr


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
