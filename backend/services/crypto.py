import logging

from cryptography.fernet import Fernet

from config import settings

logger = logging.getLogger(__name__)

_fernet = Fernet(settings.encryption_key.encode())


def encrypt(value: str) -> str:
    logger.info("[crypto]: encrypting value (length=%d)", len(value))
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    logger.info("[crypto]: decrypting value (length=%d)", len(value))
    return _fernet.decrypt(value.encode()).decode()
