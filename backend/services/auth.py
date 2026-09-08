import logging
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from config import JWT_SECRET, settings

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    logger.info("[auth]: hashing password")
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed_password: str | None) -> bool:
    if hashed_password is None:
        logger.warning("[auth]: password verification failed — account has no password")
        return False
    try:
        result = bcrypt.checkpw(password.encode(), hashed_password.encode())
    except ValueError:
        logger.warning("[auth]: password verification failed — unreadable password or hash")
        return False
    if result:
        logger.info("[auth]: password verification succeeded")
    else:
        logger.warning("[auth]: password verification failed")
    return result


def create_token(user_id: uuid.UUID, role: str) -> str:
    logger.info("[auth]: creating token for user %s with role %s", user_id, role)
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        logger.info("[auth]: token decoded successfully for user %s", payload.get("sub"))
        return payload
    except JWTError:
        logger.warning("[auth]: token decode failed — invalid or expired token")
        return None
