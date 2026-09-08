import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr

from models.instance_config import InstanceMode
from models.user import UserRole

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_BYTES = 72


def _check_password(value: str) -> str:
    """Messages read as the tail of "Password ..." once the client prefixes the
    field name, so they start with a verb and carry no field label."""
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"must be at least {PASSWORD_MIN_LENGTH} characters")
    if len(value.encode()) > PASSWORD_MAX_BYTES:
        raise ValueError(f"must be at most {PASSWORD_MAX_BYTES} bytes (accents and emoji count as several)")
    if not any(c.isupper() for c in value):
        raise ValueError("must include an uppercase letter")
    if not any(c.islower() for c in value):
        raise ValueError("must include a lowercase letter")
    if not any(c.isdigit() for c in value):
        raise ValueError("must include a number")
    return value


PasswordStr = Annotated[str, AfterValidator(_check_password)]


class SetupRequest(BaseModel):
    email: EmailStr
    password: PasswordStr | None = None
    mode: InstanceMode
    first_name: str | None = None
    last_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: PasswordStr | None = None
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
    must_change_password: bool = False
    # So the app knows whether to ask for a current password, and whether to
    # offer setting one at all.
    has_password: bool = True


class ChangePasswordRequest(BaseModel):
    password: PasswordStr
    # Left out only by an account that has no password to prove: one that signs
    # in through a provider and is adding a password for the first time.
    current_password: str | None = None


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


class OidcConfig(BaseModel):
    enabled: bool
    name: str
    # The finished button text, so the page never has to assemble it.
    button: str
    only: bool = False


class ConfigResponse(BaseModel):
    # Absent until setup has run. How sign-in works is known from the start,
    # because it comes from the environment rather than the database.
    mode: InstanceMode | None = None
    oidc: OidcConfig
