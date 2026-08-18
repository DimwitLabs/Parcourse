import logging
import re
import sys
import time
from collections.abc import Generator

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, SQLModel, create_engine

from config import settings

logger = logging.getLogger(__name__)

_PLAIN_PREFIXES = ("postgresql://", "postgres://")
_SCHEMA_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


def with_driver(url: str) -> str:
    """Hosted Postgres is handed out as postgresql:// or postgres://, which
    SQLAlchemy reads as psycopg2. This image carries psycopg 3, so name it
    rather than making everyone paste a driver into their connection string."""
    for prefix in _PLAIN_PREFIXES:
        if url.startswith(prefix):
            return f"postgresql+psycopg://{url[len(prefix):]}"
    return url


def checked_schema(name: str) -> str:
    if not _SCHEMA_RE.match(name):
        raise ValueError(
            f"DB_SCHEMA must be lower-case letters, digits and underscores: {name!r}"
        )
    return name


def _connect_args(url: str, schema: str) -> dict:
    """Models carry no schema, so search_path picks the target: public unless
    DB_SCHEMA says otherwise. Only that one is listed, because with public also
    on the path create_all could match tables there and skip creating them."""
    if not url.startswith("postgresql"):
        return {}
    return {"options": f"-csearch_path={schema}"}


SCHEMA = checked_schema(settings.db_schema)
DATABASE_URL = with_driver(settings.database_url)

engine = create_engine(DATABASE_URL, connect_args=_connect_args(DATABASE_URL, SCHEMA))

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

def failure_message(url: str, schema: str, exc: Exception) -> str:
    """The driver buries the cause under a stack that never names the setting
    at fault."""
    target = make_url(url)
    where = f"{target.host or 'the host'}:{target.port or 5432}/{target.database or ''}"
    cause = str(getattr(exc, "orig", exc)).strip().splitlines()
    return (
        f"Cannot use the database at {where} (schema {schema}): "
        f"{cause[0] if cause else exc}. Check DATABASE_URL and DB_SCHEMA."
    )


def wait_for_database(attempts: int = 5, delay: float = 2.0) -> None:
    for attempt in range(1, attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("select 1"))
            return
        except SQLAlchemyError as exc:
            if attempt == attempts:
                logger.error("[database]: %s", failure_message(DATABASE_URL, SCHEMA, exc))
                sys.exit(1)
            logger.warning("[database]: not ready yet, retrying (%d/%d)", attempt, attempts)
            time.sleep(delay)


def init_db() -> None:
    wait_for_database()
    if DATABASE_URL.startswith("postgresql"):
        with engine.begin() as conn:
            conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
    SQLModel.metadata.create_all(engine)
