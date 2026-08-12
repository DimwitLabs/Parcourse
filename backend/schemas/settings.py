from pydantic import BaseModel


class ApiKeyUpdateRequest(BaseModel):
    api_key: str


class ApiKeyStatusResponse(BaseModel):
    has_key: bool


class ModelUpdateRequest(BaseModel):
    model: str


class ModelResponse(BaseModel):
    model: str


class ProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
