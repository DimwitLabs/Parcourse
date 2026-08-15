import logging

from sqlmodel import Session

from config import DEFAULT_AI_MODEL
from models.instance_config import INSTANCE_ID, InstanceConfig
from models.user import User
from services.connection import Connection, deserialize

logger = logging.getLogger(__name__)


class NoApiKeyError(Exception):
    pass


def fallback_model(instance: InstanceConfig | None) -> str:
    if instance and instance.ai_model:
        return instance.ai_model
    return DEFAULT_AI_MODEL


def resolve_connection(session: Session, user: User) -> Connection:
    """A user's own connection wins, then the instance default. Credentials are
    never read from the environment: they are configured in the app so they can
    be rotated and removed without a redeploy."""
    instance = session.get(InstanceConfig, INSTANCE_ID)
    fallback = fallback_model(instance)

    own = deserialize(user.openrouter_key, fallback)
    if own and own.has_credentials:
        logger.info("[api_key]: using user connection, provider=%s model=%s", own.provider, own.model)
        return own

    shared = deserialize(instance.default_openrouter_key if instance else None, fallback)
    if shared and shared.has_credentials:
        logger.info("[api_key]: using instance connection, provider=%s model=%s", shared.provider, shared.model)
        return shared

    logger.error("[api_key]: no connection configured for user %s", user.id)
    raise NoApiKeyError("No AI provider configured. Add one in Settings.")
