from sqlmodel import Session

from config import settings
from models.instance_config import InstanceConfig
from models.user import User
from services.crypto import decrypt


class NoApiKeyError(Exception):
    pass


def resolve_model(session: Session) -> str:
    instance = session.get(InstanceConfig, 1)
    if instance and instance.ai_model:
        return instance.ai_model
    return settings.ai_model


def resolve_api_key(session: Session, user: User) -> str:
    if user.openrouter_key:
        return decrypt(user.openrouter_key)

    instance = session.get(InstanceConfig, 1)
    if instance and instance.default_openrouter_key:
        return decrypt(instance.default_openrouter_key)

    if settings.openrouter_api_key:
        return settings.openrouter_api_key

    raise NoApiKeyError("No AI provider key configured. Add one in Settings.")
