from pydantic import BaseModel

from models.user import LearningStyle


class ProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None


class LearningStyleUpdateRequest(BaseModel):
    learning_style: LearningStyle


class ProviderFieldResponse(BaseModel):
    name: str
    label: str
    placeholder: str = ""
    secret: bool = False
    default: str = ""


class ProviderResponse(BaseModel):
    key: str
    label: str
    fields: list[ProviderFieldResponse]
    models: list[str] = []
    docs: str = ""
    curated: bool = False


class ConnectionResponse(BaseModel):
    configured: bool
    provider: str | None = None
    model: str | None = None


class ConnectionUpdateRequest(BaseModel):
    provider: str
    model: str
    credentials: dict[str, str] = {}


class TestConnectionResponse(BaseModel):
    ok: bool
    detail: str
    json_mode: str = ""


class AiStatusResponse(BaseModel):
    ready: bool
    provider: str | None = None
    model: str | None = None
