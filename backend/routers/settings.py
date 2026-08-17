import logging
import re

import litellm

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user, require_admin
from models.instance_config import INSTANCE_ID, InstanceConfig
from models.user import User, UserRole
from schemas.auth import UserResponse
from schemas.settings import (
    AiStatusResponse,
    ConnectionResponse,
    ConnectionUpdateRequest,
    ProfileUpdateRequest,
    ProviderFieldResponse,
    ProviderResponse,
    TestConnectionResponse,
)
from services.connection import NoConnectionError, deserialize, resolve, serialize
from services.llm import complete_json, describe_json_mode
from services.providers import PROVIDERS, qualify

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

# Ordered: the first matching class wins, so narrower errors come first.
_ERROR_MESSAGES: tuple[tuple[type[Exception], str], ...] = (
    (litellm.AuthenticationError, "Those credentials were rejected. Check the key and try again."),
    (litellm.NotFoundError, "{model} is not a model this provider offers. Check the model ID."),
    (litellm.RateLimitError, "The provider is rate limiting this key. Try again shortly."),
    (litellm.Timeout, "Could not reach the provider. Check the server URL and that it is running."),
    (litellm.APIConnectionError, "Could not reach the provider. Check the server URL and that it is running."),
    (litellm.ServiceUnavailableError, "The provider is unavailable right now. Try again shortly."),
    (litellm.BadRequestError, "The provider rejected the request for {model}."),
)


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


def _connection_response(blob: str | None) -> ConnectionResponse:
    connection = deserialize(blob)
    if connection is None or not connection.has_credentials:
        return ConnectionResponse(configured=False)
    return ConnectionResponse(
        configured=True, provider=connection.provider, model=connection.model
    )


def _store(body: ConnectionUpdateRequest, existing: str | None) -> str:
    """Credentials are never sent back to the client, so a blank field means
    "keep what is stored". Per field, or editing an endpoint would wipe the key
    beside it. Clearing is an explicit DELETE."""
    current = deserialize(existing)
    stored = current.credentials if current and current.provider == body.provider else {}
    credentials = {
        name: value if value.strip() else stored.get(name, "")
        for name, value in body.credentials.items()
    }
    if not any(v.strip() for v in credentials.values()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credentials are required for this provider.",
        )
    try:
        return serialize(body.provider, body.model, credentials)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/connection", response_model=ConnectionResponse)
def get_my_connection(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    return _connection_response(user.connection)


@router.put("/connection", response_model=ConnectionResponse)
def set_my_connection(
    body: ConnectionUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    logger.info("[settings]: set connection for user %s, provider=%s", user.id, body.provider)
    user.connection = _store(body, user.connection)
    session.add(user)
    session.commit()
    return _connection_response(user.connection)


@router.delete("/connection", response_model=ConnectionResponse)
def clear_my_connection(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    logger.info("[settings]: clearing connection for user %s", user.id)
    user.connection = None
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
    return _connection_response(instance.default_connection)


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
    instance.default_connection = _store(body, instance.default_connection)
    session.add(instance)
    session.commit()
    return _connection_response(instance.default_connection)


@router.delete("/instance-connection", response_model=ConnectionResponse)
def clear_instance_connection(
    _: User = Depends(require_admin),
    session: Session = Depends(get_session),
) -> ConnectionResponse:
    logger.info("[settings]: clearing instance connection")
    instance = session.get(InstanceConfig, INSTANCE_ID)
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not configured")
    instance.default_connection = None
    session.add(instance)
    session.commit()
    return ConnectionResponse(configured=False)


def _credentials_for_test(
    body: ConnectionUpdateRequest, user: User, session: Session
) -> dict[str, str]:
    """Blank credentials mean "test what is already saved", so the form can
    verify a connection without making the user paste the key again. Only the
    one that scope owns, so nobody can spend a key they cannot see."""
    if any(v.strip() for v in body.credentials.values()):
        return body.credentials
    instance = session.get(InstanceConfig, INSTANCE_ID)
    if user.role == UserRole.admin:
        blob = instance.default_connection if instance else None
    else:
        blob = user.connection
    stored = deserialize(blob)
    if stored and stored.provider == body.provider and stored.has_credentials:
        return stored.credentials
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Credentials are required for this provider.",
    )


def _readable_error(exc: Exception, model: str) -> str:
    """LiteLLM raises with the provider's whole JSON envelope attached, so the
    class says what went wrong and the envelope says why."""
    for kind, message in _ERROR_MESSAGES:
        if isinstance(exc, kind):
            return message.format(model=model)

    match = re.search(r"[\'\"]message[\'\"]:\s*[\'\"](.+?)[\'\"][,}]", str(exc), re.S)
    if match:
        return match.group(1).strip()[:200]
    return f"The request failed: {type(exc).__name__}."


@router.post("/test-connection", response_model=TestConnectionResponse)
def test_connection(
    body: ConnectionUpdateRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TestConnectionResponse:
    """Runs the smallest real request the app makes: a JSON completion. That
    catches a bad key, an unreachable host and a model that cannot do JSON."""
    try:
        model = qualify(body.provider, body.model)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    credentials = _credentials_for_test(body, user, session)
    logger.info("[settings]: testing connection for user %s, model=%s", user.id, model)
    try:
        complete_json(
            model=model,
            credentials=credentials,
            prompt='Reply with this JSON object and nothing else: {"ok": true}',
            required_keys=("ok",),
            temperature=0,
        )
    except Exception as exc:
        logger.warning("[settings]: connection test failed: %s", exc)
        return TestConnectionResponse(ok=False, detail=_readable_error(exc, model))

    return TestConnectionResponse(
        ok=True, detail=f"{model} responded", json_mode=describe_json_mode(model)
    )


@router.get("/ai-status", response_model=AiStatusResponse)
def ai_status(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AiStatusResponse:
    """Whether this user can generate anything at all, counting their own
    connection and the instance default."""
    try:
        connection = resolve(session, user)
    except NoConnectionError:
        logger.info("[settings]: ai-status not ready for user %s", user.id)
        return AiStatusResponse(ready=False)
    return AiStatusResponse(ready=True, provider=connection.provider, model=connection.model)
