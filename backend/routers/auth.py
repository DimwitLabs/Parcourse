import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlmodel import Session, delete, select

logger = logging.getLogger(__name__)

from config import (
    OIDC_ENABLED,
    OIDC_ISSUER,
    OIDC_NAME,
    OIDC_POST_LOGIN_URL,
)
from database import get_session
from dependencies import get_current_user
from models.instance_config import INSTANCE_ID, InstanceConfig
from models.oidc_login import OidcLogin
from models.user import User, UserRole
from schemas.auth import (
    ChangePasswordRequest,
    ConfigResponse,
    OidcConfig,
    LoginRequest,
    SetupRequest,
    SetupStatusResponse,
    TokenResponse,
    UserResponse,
)
from services import identity, oidc
from services.auth import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/setup-status", response_model=SetupStatusResponse)
def setup_status(session: Session = Depends(get_session)) -> SetupStatusResponse:
    has_user = session.exec(select(User)).first() is not None
    logger.info("[auth]: setup status check — needs_setup=%s", not has_user)
    return SetupStatusResponse(needs_setup=not has_user)


@router.post("/setup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def setup(body: SetupRequest, session: Session = Depends(get_session)) -> TokenResponse:
    if session.exec(select(User)).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Setup already completed")

    admin = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=UserRole.admin,
        first_name=body.first_name,
        last_name=body.last_name,
    )
    session.add(admin)
    session.add(InstanceConfig(mode=body.mode))
    session.commit()
    session.refresh(admin)
    logger.info("[auth]: setup completed — admin=%s mode=%s", admin.email, body.mode)
    return TokenResponse(access_token=create_token(admin.id, admin.role.value))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)) -> TokenResponse:
    user = session.exec(select(User).where(User.email == body.email)).first()
    if user is None or not verify_password(body.password, user.hashed_password):
        logger.warning("[auth]: failed login attempt for email=%s", body.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    logger.info("[auth]: login success — user=%s role=%s", user.email, user.role.value)
    return TokenResponse(access_token=create_token(user.id, user.role.value))


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(**user.model_dump(), has_password=user.hashed_password is not None)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    logger.info("[auth]: password change requested for user_id=%s", user.id)
    if user.hashed_password is not None:
        if verify_password(body.current_password or "", user.hashed_password) is False:
            logger.warning("[auth]: password change refused, wrong current password for %s", user.id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Incorrect current password",
            )

    user.hashed_password = hash_password(body.password)
    user.must_change_password = False
    session.add(user)
    session.commit()
    logger.info("[auth]: password changed for user_id=%s", user.id)


@router.get("/config", response_model=ConfigResponse)
def get_config(session: Session = Depends(get_session)) -> ConfigResponse:
    config = session.get(InstanceConfig, INSTANCE_ID)
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not set up yet")
    return ConfigResponse(mode=config.mode, oidc=OidcConfig(enabled=OIDC_ENABLED, name=OIDC_NAME))


_LOGIN_VALID_FOR = timedelta(minutes=10)


def _back_to_app(**params: str) -> RedirectResponse:
    """The token goes in the fragment rather than the query, because a fragment
    is never sent to a server and so never lands in an access log or a
    referrer header on the way."""
    return RedirectResponse(f"{OIDC_POST_LOGIN_URL}/auth/callback#{urlencode(params)}")


@router.get("/oidc/start")
def oidc_start(session: Session = Depends(get_session)) -> RedirectResponse:
    if not OIDC_ENABLED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Single sign-on is not configured")

    session.exec(delete(OidcLogin).where(OidcLogin.created_at < datetime.now(timezone.utc) - _LOGIN_VALID_FOR))

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    try:
        destination, verifier = oidc.start(state, nonce)
    except oidc.OidcError as exc:
        logger.error("[oidc]: cannot start sign-in: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    session.add(OidcLogin(state=state, code_verifier=verifier, nonce=nonce))
    session.commit()
    logger.info("[oidc]: sending a sign-in to %s", OIDC_ISSUER)
    return RedirectResponse(destination)


@router.get("/oidc/callback")
def oidc_callback(
    state: str = "",
    code: str = "",
    error: str = "",
    session: Session = Depends(get_session),
) -> RedirectResponse:
    if not OIDC_ENABLED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Single sign-on is not configured")

    if error:
        logger.warning("[oidc]: the provider turned the sign-in down: %s", error)
        return _back_to_app(error=error)

    pending = session.get(OidcLogin, state) if state else None
    if pending is None:
        logger.warning("[oidc]: callback with a state nobody started")
        return _back_to_app(error="This sign-in has expired. Please try again.")

    # Used once, whatever happens next, so a code cannot be replayed against it.
    session.delete(pending)
    session.commit()

    if pending.created_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc) - _LOGIN_VALID_FOR:
        return _back_to_app(error="This sign-in took too long. Please try again.")

    try:
        claims = oidc.claims(code, pending.code_verifier, pending.nonce)
        user = identity.resolve(session, claims)
        session.commit()
    except oidc.OidcError as exc:
        logger.warning("[oidc]: sign-in failed: %s", exc)
        session.rollback()
        return _back_to_app(error=str(exc))

    logger.info("[oidc]: signed in %s", user.email)
    return _back_to_app(token=create_token(user.id, user.role.value))
