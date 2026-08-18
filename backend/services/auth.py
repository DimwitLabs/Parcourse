import logging
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from config import settings

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    logger.info("[auth]: hashing password")
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        result = bcrypt.checkpw(password.encode(), hashed_password.encode())
    except ValueError:
        # Sign-in accepts any string, so the password can be longer than bcrypt
        # reads or the stored hash can predate this scheme. Neither is a match.
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
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        logger.info("[auth]: token decoded successfully for user %s", payload.get("sub"))
        return payload
    except JWTError:
        logger.warning("[auth]: token decode failed — invalid or expired token")
        return None
