"""An AI connection: which provider, which model, and the credentials for it,
stored as one encrypted JSON blob per row."""
import json
import logging
from dataclasses import dataclass

from sqlmodel import Session

from models.instance_config import INSTANCE_ID, InstanceConfig
from models.user import User
from services.crypto import decrypt, encrypt
from services.providers import get, qualify

logger = logging.getLogger(__name__)


class NoConnectionError(Exception):
    pass


@dataclass(frozen=True)
class Connection:
    provider: str
    model: str
    credentials: dict[str, str]

    @property
    def has_credentials(self) -> bool:
        return any(v.strip() for v in self.credentials.values())


def serialize(provider: str, model: str, credentials: dict[str, str]) -> str:
    allowed = {f.name for f in get(provider).fields}
    unknown = set(credentials) - allowed
    if unknown:
        raise ValueError(f"Unknown fields for {provider}: {', '.join(sorted(unknown))}")
    payload = {
        "provider": provider,
        "model": qualify(provider, model),
        "credentials": {k: v for k, v in credentials.items() if v.strip()},
    }
    return encrypt(json.dumps(payload))


def deserialize(blob: str | None) -> Connection | None:
    if not blob:
        return None
    try:
        payload = json.loads(decrypt(blob))
        return Connection(
            provider=payload["provider"],
            model=payload["model"],
            credentials=payload.get("credentials") or {},
        )
    except (json.JSONDecodeError, KeyError, TypeError) as exc:
        logger.error("[connection]: stored connection is unreadable: %s", exc)
        raise ValueError("Stored connection is unreadable. Save the connection again.") from exc


def resolve(session: Session, user: User) -> Connection:
    """A user's own connection wins, then the instance default. Credentials are
    never read from the environment: they are configured in the app so they can
    be rotated and removed without a redeploy."""
    own = deserialize(user.connection)
    if own and own.has_credentials:
        logger.info("[connection]: using user connection, provider=%s model=%s", own.provider, own.model)
        return own

    instance = session.get(InstanceConfig, INSTANCE_ID)
    shared = deserialize(instance.default_connection if instance else None)
    if shared and shared.has_credentials:
        logger.info("[connection]: using instance connection, provider=%s model=%s", shared.provider, shared.model)
        return shared

    logger.error("[connection]: none configured for user %s", user.id)
    raise NoConnectionError("No AI provider configured. Add one in Settings.")
