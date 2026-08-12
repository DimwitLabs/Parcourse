import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

logger = logging.getLogger(__name__)

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
    logger.info("[settings]: get API key status for user %s", user.id)
    return ApiKeyStatusResponse(has_key=bool(user.openrouter_key))


@router.put("/api-key", response_model=ApiKeyStatusResponse)
def set_my_api_key(
    body: ApiKeyUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ApiKeyStatusResponse:
    logger.info("[settings]: set API key for user %s", user.id)
    user.openrouter_key = encrypt(body.api_key) if body.api_key.strip() else None
    session.add(user)
    session.commit()
    logger.info("[settings]: API key updated for user %s, has_key=%s", user.id, bool(user.openrouter_key))
    return ApiKeyStatusResponse(has_key=bool(user.openrouter_key))


@router.get("/instance-key", response_model=ApiKeyStatusResponse)
def get_instance_api_key_status(
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ApiKeyStatusResponse:
    logger.info("[settings]: get instance API key status")
    instance = session.get(InstanceConfig, 1)
    return ApiKeyStatusResponse(has_key=bool(instance and instance.default_openrouter_key))


@router.put("/instance-key", response_model=ApiKeyStatusResponse)
def set_instance_api_key(
    body: ApiKeyUpdateRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ApiKeyStatusResponse:
    logger.info("[settings]: set instance API key")
    instance = session.get(InstanceConfig, 1)
    if instance is None:
        logger.error("[settings]: instance not configured when setting instance key")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not configured")
    instance.default_openrouter_key = encrypt(body.api_key) if body.api_key.strip() else None
    session.add(instance)
    session.commit()
    logger.info("[settings]: instance API key updated, has_key=%s", bool(instance.default_openrouter_key))
    return ApiKeyStatusResponse(has_key=bool(instance.default_openrouter_key))


@router.get("/model", response_model=ModelResponse)
def get_model(
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ModelResponse:
    logger.info("[settings]: get model")
    instance = session.get(InstanceConfig, 1)
    return ModelResponse(model=instance.ai_model if instance else "openrouter/openai/gpt-4o-mini")


@router.put("/model", response_model=ModelResponse)
def set_model(
    body: ModelUpdateRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ModelResponse:
    logger.info("[settings]: set model to %s", body.model)
    instance = session.get(InstanceConfig, 1)
    if instance is None:
        logger.error("[settings]: instance not configured when setting model")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not configured")
    instance.ai_model = body.model.strip()
    session.add(instance)
    session.commit()
    logger.info("[settings]: model updated to %s", instance.ai_model)
    return ModelResponse(model=instance.ai_model)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    body: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> UserResponse:
    logger.info("[settings]: update profile for user %s", user.id)
    user.first_name = body.first_name
    user.last_name = body.last_name
    session.add(user)
    session.commit()
    session.refresh(user)
    logger.info("[settings]: profile updated for user %s", user.id)
    return UserResponse(**user.model_dump())
