import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

from database import get_session
from dependencies import get_current_user
from models.instance_config import InstanceConfig
from models.user import User, UserRole
from schemas.auth import (
    ConfigResponse,
    LoginRequest,
    SetupRequest,
    SetupStatusResponse,
    TokenResponse,
    UserResponse,
)
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
    return UserResponse(**user.model_dump())


@router.get("/config", response_model=ConfigResponse)
def get_config(session: Session = Depends(get_session)) -> ConfigResponse:
    config = session.get(InstanceConfig, 1)
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not set up yet")
    return ConfigResponse(mode=config.mode)
