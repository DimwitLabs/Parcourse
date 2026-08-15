"""An AI connection: which provider, which model, and the credentials for it.

Stored as an encrypted JSON blob in the existing key columns, so adding this
needs no migration. Values written before this existed decrypt to a bare key
string and are read as an OpenRouter connection.
"""
import json
import logging
from dataclasses import dataclass

from services.crypto import decrypt, encrypt
from services.providers import DEFAULT_PROVIDER, get, qualify

logger = logging.getLogger(__name__)


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


def deserialize(blob: str | None, fallback_model: str) -> Connection | None:
    if not blob:
        return None
    raw = decrypt(blob)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        logger.info("[connection]: reading a pre-provider key as OpenRouter")
        return Connection(DEFAULT_PROVIDER, fallback_model, {"api_key": raw})

    if not isinstance(payload, dict) or "provider" not in payload:
        logger.warning("[connection]: stored blob has no provider, treating as OpenRouter")
        return Connection(DEFAULT_PROVIDER, fallback_model, {"api_key": raw})

    return Connection(
        provider=payload["provider"],
        model=payload.get("model") or fallback_model,
        credentials=payload.get("credentials") or {},
    )
