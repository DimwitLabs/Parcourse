from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user, require_admin
from models.instance_config import InstanceConfig
from models.user import User
from schemas.auth import UserResponse
from schemas.settings import ApiKeyStatusResponse, ApiKeyUpdateRequest, ModelResponse, ModelUpdateRequest, ProfileUpdateRequest
from services.crypto import encrypt

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/api-key", response_model=ApiKeyStatusResponse)
def get_my_api_key_status(user: User = Depends(get_current_user)) -> ApiKeyStatusResponse:
    return ApiKeyStatusResponse(has_key=bool(user.openrouter_key))


@router.put("/api-key", response_model=ApiKeyStatusResponse)
def set_my_api_key(
    body: ApiKeyUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ApiKeyStatusResponse:
    user.openrouter_key = encrypt(body.api_key) if body.api_key.strip() else None
    session.add(user)
    session.commit()
    return ApiKeyStatusResponse(has_key=bool(user.openrouter_key))


@router.get("/instance-key", response_model=ApiKeyStatusResponse)
def get_instance_api_key_status(
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ApiKeyStatusResponse:
    instance = session.get(InstanceConfig, 1)
    return ApiKeyStatusResponse(has_key=bool(instance and instance.default_openrouter_key))


@router.put("/instance-key", response_model=ApiKeyStatusResponse)
def set_instance_api_key(
    body: ApiKeyUpdateRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ApiKeyStatusResponse:
    instance = session.get(InstanceConfig, 1)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not configured")
    instance.default_openrouter_key = encrypt(body.api_key) if body.api_key.strip() else None
    session.add(instance)
    session.commit()
    return ApiKeyStatusResponse(has_key=bool(instance.default_openrouter_key))


@router.get("/model", response_model=ModelResponse)
def get_model(
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ModelResponse:
    instance = session.get(InstanceConfig, 1)
    return ModelResponse(model=instance.ai_model if instance else "openrouter/openai/gpt-4o-mini")


@router.put("/model", response_model=ModelResponse)
def set_model(
    body: ModelUpdateRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ModelResponse:
    instance = session.get(InstanceConfig, 1)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not configured")
    instance.ai_model = body.model.strip()
    session.add(instance)
    session.commit()
    return ModelResponse(model=instance.ai_model)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    body: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> UserResponse:
    user.first_name = body.first_name
    user.last_name = body.last_name
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserResponse(**user.model_dump())
