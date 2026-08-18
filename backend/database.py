import logging
import sys
import time
from collections.abc import Generator

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, create_engine

from config import DATABASE_URL, IS_POSTGRES, SCHEMA
from models.base import SQLModelBase

logger = logging.getLogger(__name__)

engine = create_engine(DATABASE_URL)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def _failure_message(url: str, schema: str | None, exc: Exception) -> str:
    """The driver buries the cause under a stack that never names the setting
    at fault."""
    target = make_url(url)
    where = f"{target.host or 'the host'}:{target.port or 5432}/{target.database or ''}"
    cause = str(getattr(exc, "orig", exc)).strip().splitlines()
    return (
        f"Cannot use the database at {where} (schema {schema or 'none'}): "
        f"{cause[0] if cause else exc}. Check DATABASE_URL and DB_SCHEMA."
    )


def _wait_for_database(attempts: int = 5, delay: float = 2.0) -> None:
    """A managed database can outlast the container start, so a first refusal
    is worth retrying before calling it misconfigured."""
    for attempt in range(1, attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("select 1"))
            return
        except SQLAlchemyError as exc:
            if attempt == attempts:
                logger.error("[database]: %s", _failure_message(DATABASE_URL, SCHEMA, exc))
                sys.exit(1)
            logger.warning("[database]: not ready yet, retrying (%d/%d)", attempt, attempts)
            time.sleep(delay)


def init_db() -> None:
    _wait_for_database()
    if IS_POSTGRES:
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))
    SQLModelBase.metadata.create_all(engine)
