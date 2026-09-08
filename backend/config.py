import re

from pydantic_settings import BaseSettings, SettingsConfigDict

_PLAIN_PREFIXES = ("postgresql://", "postgres://")
_SCHEMA_RE = re.compile(r"^[a-z_][a-z0-9_]*$")
_LOG_LEVELS = ("debug", "info", "warning", "error", "critical")
_PUBLISHED_JWT_SECRET = "change-this-in-production"
_PUBLISHED_ENCRYPTION_KEY = "uvSAXyWG429v7tYFyht42Jud0v--hr42pitofMf0pTY="


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://parcourse:parcourse@db:5432/parcourse"
    db_schema: str = "public"
    log_level: str = "info"
    cors_origins: list[str] = ["http://localhost:5173"]
    ytdlp_proxy: str = ""
    vpn_control_url: str = ""
    vpn_rotations: int = 2
    jwt_secret: str
    jwt_expiry_hours: int = 24
    encryption_key: str

settings = Settings()


def _with_driver(url: str) -> str:
    """Hosted Postgres is handed out as postgresql:// or postgres://, which
    SQLAlchemy reads as psycopg2. This image carries psycopg 3, so name it
    rather than making everyone paste a driver into their connection string."""
    for prefix in _PLAIN_PREFIXES:
        if url.startswith(prefix):
            return f"postgresql+psycopg://{url[len(prefix):]}"
    return url


def _checked_schema(name: str) -> str:
    """The name reaches CREATE SCHEMA as text, so nothing but a plain
    identifier may pass. Lower case only, because an unquoted one folds."""
    if not _SCHEMA_RE.match(name):
        raise ValueError(
            f"DB_SCHEMA must be lower-case letters, digits and underscores: {name!r}"
        )
    return name


def _checked_log_level(name: str) -> str:
    """getattr on the logging module answers for any name it happens to
    carry, so BASIC_FORMAT would arrive as a level and crash the app."""
    if name.lower() not in _LOG_LEVELS:
        raise ValueError(f"LOG_LEVEL must be one of {', '.join(_LOG_LEVELS)}: {name!r}")
    return name.upper()


def _checked_secret(name: str, value: str, published: str, generate: str) -> str:
    """An instance that kept the published value has none of the protection it
    thinks it has: its tokens can be forged and its stored keys read. Refusing
    to start is how the operator finds out before someone else does."""
    cleaned = value.strip()
    if cleaned in ("", published):
        raise ValueError(
            f"{name} is empty or still the value Parcourse used to ship. "
            f"Generate one with: {generate}"
        )
    return cleaned


YTDLP_PROXY = settings.ytdlp_proxy.strip()
VPN_CONTROL_URL = settings.vpn_control_url.strip().rstrip("/")
VPN_ROTATIONS = max(0, settings.vpn_rotations)
DATABASE_URL = _with_driver(settings.database_url)
IS_POSTGRES = DATABASE_URL.startswith("postgresql")
# Tables carry the schema themselves, so nothing depends on search_path and
# extensions in public still resolve. Only Postgres has schemas.
SCHEMA = _checked_schema(settings.db_schema) if IS_POSTGRES else None
LOG_LEVEL = _checked_log_level(settings.log_level)
JWT_SECRET = _checked_secret(
    "JWT_SECRET", settings.jwt_secret, _PUBLISHED_JWT_SECRET, "openssl rand -hex 32"
)
ENCRYPTION_KEY = _checked_secret(
    "ENCRYPTION_KEY",
    settings.encryption_key,
    _PUBLISHED_ENCRYPTION_KEY,
    'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"',
)
