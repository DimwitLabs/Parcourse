import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

logger = logging.getLogger(__name__)

from database import get_session
from dependencies import get_current_user, require_admin
from models.instance_config import INSTANCE_ID, InstanceConfig
from models.user import User
from schemas.auth import UserResponse
from config import settings
from schemas.settings import (
    ApiKeyStatusResponse,
    ApiKeyUpdateRequest,
    ConnectionResponse,
    ConnectionUpdateRequest,
    ModelResponse,
    ModelUpdateRequest,
    ProfileUpdateRequest,
    ProviderFieldResponse,
    ProviderResponse,
    TestConnectionResponse,
)
from services.connection import deserialize, serialize
from services.crypto import encrypt
from services.llm import complete_json, describe_json_mode
from services.providers import PROVIDERS, qualify

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
    instance = session.get(InstanceConfig, INSTANCE_ID)
    return ApiKeyStatusResponse(has_key=bool(instance and instance.default_openrouter_key))


@router.put("/instance-key", response_model=ApiKeyStatusResponse)
def set_instance_api_key(
    body: ApiKeyUpdateRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ApiKeyStatusResponse:
    logger.info("[settings]: set instance API key")
    instance = session.get(InstanceConfig, INSTANCE_ID)
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
    instance = session.get(InstanceConfig, INSTANCE_ID)
    return ModelResponse(model=instance.ai_model if instance else "openrouter/openai/gpt-4o-mini")


@router.put("/model", response_model=ModelResponse)
def set_model(
    body: ModelUpdateRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ModelResponse:
    logger.info("[settings]: set model to %s", body.model)
    instance = session.get(InstanceConfig, INSTANCE_ID)
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


@router.get("/providers", response_model=list[ProviderResponse])
def list_providers(_: User = Depends(get_current_user)) -> list[ProviderResponse]:
    logger.info("[settings]: listing %d providers", len(PROVIDERS))
    ordered = sorted(PROVIDERS.values(), key=lambda p: (not p.curated, p.label.lower()))
    return [
        ProviderResponse(
            key=p.key,
            label=p.label,
            fields=[ProviderFieldResponse(**vars(f)) for f in p.fields],
            models=list(p.models),
            docs=p.docs,
            curated=p.curated,
        )
        for p in ordered
    ]


def _connection_response(blob: str | None, fallback: str) -> ConnectionResponse:
    connection = deserialize(blob, fallback)
    if connection is None or not connection.has_credentials:
        return ConnectionResponse(configured=False)
    return ConnectionResponse(
        configured=True, provider=connection.provider, model=connection.model
    )


def _store(body: ConnectionUpdateRequest, existing: str | None, fallback: str) -> str:
    """Credentials are never sent back to the client, so the edit form posts
    them blank to mean "keep what is stored". Clearing is an explicit DELETE."""
    credentials = body.credentials
    if not any(v.strip() for v in credentials.values()):
        current = deserialize(existing, fallback)
        if current is None or current.provider != body.provider or not current.has_credentials:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Credentials are required for this provider.",
            )
        credentials = current.credentials
    try:
        return serialize(body.provider, body.model, credentials)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/connection", response_model=ConnectionResponse)
def get_my_connection(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    instance = session.get(InstanceConfig, INSTANCE_ID)
    return _connection_response(user.openrouter_key, instance.ai_model if instance else settings.ai_model)


@router.put("/connection", response_model=ConnectionResponse)
def set_my_connection(
    body: ConnectionUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    logger.info("[settings]: set connection for user %s, provider=%s", user.id, body.provider)
    instance = session.get(InstanceConfig, INSTANCE_ID)
    fallback = instance.ai_model if instance else settings.ai_model
    user.openrouter_key = _store(body, user.openrouter_key, fallback)
    session.add(user)
    session.commit()
    return _connection_response(user.openrouter_key, fallback)


@router.delete("/connection", response_model=ConnectionResponse)
def clear_my_connection(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    logger.info("[settings]: clearing connection for user %s", user.id)
    user.openrouter_key = None
    session.add(user)
    session.commit()
    return ConnectionResponse(configured=False)


@router.get("/instance-connection", response_model=ConnectionResponse)
def get_instance_connection(
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    instance = session.get(InstanceConfig, INSTANCE_ID)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not configured")
    return _connection_response(instance.default_openrouter_key, instance.ai_model)


@router.put("/instance-connection", response_model=ConnectionResponse)
def set_instance_connection(
    body: ConnectionUpdateRequest,
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    logger.info("[settings]: set instance connection, provider=%s", body.provider)
    instance = session.get(InstanceConfig, INSTANCE_ID)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not configured")
    instance.default_openrouter_key = _store(body, instance.default_openrouter_key, instance.ai_model)
    instance.ai_model = qualify(body.provider, body.model)
    session.add(instance)
    session.commit()
    return _connection_response(instance.default_openrouter_key, instance.ai_model)


@router.delete("/instance-connection", response_model=ConnectionResponse)
def clear_instance_connection(
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    logger.info("[settings]: clearing instance connection")
    instance = session.get(InstanceConfig, INSTANCE_ID)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not configured")
    instance.default_openrouter_key = None
    session.add(instance)
    session.commit()
    return ConnectionResponse(configured=False)


@router.post("/test-connection", response_model=TestConnectionResponse)
def test_connection(
    body: ConnectionUpdateRequest,
    user: User = Depends(get_current_user),
) -> TestConnectionResponse:
    """Runs the smallest real request the app makes: a JSON completion. That
    catches a bad key, an unreachable host and a model that cannot do JSON."""
    try:
        model = qualify(body.provider, body.model)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    logger.info("[settings]: testing connection for user %s, model=%s", user.id, model)
    try:
        complete_json(
            model=model,
            credentials=body.credentials,
            prompt='Reply with this JSON object and nothing else: {"ok": true}',
            required_keys=("ok",),
            temperature=0,
        )
    except Exception as exc:
        logger.warning("[settings]: connection test failed: %s", exc)
        return TestConnectionResponse(ok=False, detail=str(exc)[:400])

    return TestConnectionResponse(
        ok=True, detail=f"{model} responded", json_mode=describe_json_mode(model)
    )
