import logging
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from joserfc import jwt
from joserfc.errors import JoseError
from joserfc.jwk import OctKey

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


_KEY = OctKey.import_key(JWT_SECRET)
_CLAIMS = jwt.JWTClaimsRegistry()


def create_token(user_id: uuid.UUID, role: str) -> str:
    logger.info("[auth]: creating token for user %s with role %s", user_id, role)
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours)
    payload = {"sub": str(user_id), "role": role, "exp": int(expire.timestamp())}
    return jwt.encode({"alg": "HS256"}, payload, _KEY)


def decode_token(token: str) -> dict | None:
    try:
        decoded = jwt.decode(token, _KEY, algorithms=["HS256"])
        _CLAIMS.validate(decoded.claims)
    except (JoseError, ValueError) as exc:
        logger.warning("[auth]: token decode failed — %s", exc)
        return None
    logger.info("[auth]: token decoded successfully for user %s", decoded.claims.get("sub"))
    return decoded.claims
