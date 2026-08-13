import logging

from sqlmodel import Session

from config import settings
from models.instance_config import INSTANCE_ID, InstanceConfig
from models.user import User
from services.crypto import decrypt

logger = logging.getLogger(__name__)


class NoApiKeyError(Exception):
    pass


def resolve_model(session: Session) -> str:
    instance = session.get(InstanceConfig, INSTANCE_ID)
    if instance and instance.ai_model:
        logger.info("[api_key]: resolved model from instance config: %s", instance.ai_model)
        return instance.ai_model
    logger.info("[api_key]: using default model from settings: %s", settings.ai_model)
    return settings.ai_model


def resolve_api_key(session: Session, user: User) -> str:
    logger.info("[api_key]: resolving API key for user %s", user.id)
    if user.openrouter_key:
        logger.info("[api_key]: using user-level OpenRouter key")
        return decrypt(user.openrouter_key)

    instance = session.get(InstanceConfig, INSTANCE_ID)
    if instance and instance.default_openrouter_key:
        logger.info("[api_key]: using instance-level default OpenRouter key")
        return decrypt(instance.default_openrouter_key)

    if settings.openrouter_api_key:
        logger.info("[api_key]: using environment OpenRouter key from settings")
        return settings.openrouter_api_key

    logger.error("[api_key]: no API key found for user %s", user.id)
    raise NoApiKeyError("No AI provider key configured. Add one in Settings.")
