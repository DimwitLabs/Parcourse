import logging
import time
from collections.abc import Generator
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, create_engine

from config import DATABASE_URL, IS_POSTGRES, SCHEMA

logger = logging.getLogger(__name__)

def _connect_args() -> dict[str, object]:
    """A pooler hands the next statement to a different backend connection, so
    the prepared statement psycopg makes after a few repeats is not there any
    more. Supabase, PgBouncer and Neon all pool this way."""
    return {"prepare_threshold": None} if IS_POSTGRES else {}


engine = create_engine(DATABASE_URL, connect_args=_connect_args())


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
                raise RuntimeError(_failure_message(DATABASE_URL, SCHEMA, exc)) from exc
            logger.warning("[database]: not ready yet, retrying (%d/%d)", attempt, attempts)
            time.sleep(delay)


_MIGRATIONS = Path(__file__).resolve().parent / "migrations"

BASELINE = "0001"


def _alembic(connection) -> Config:
    config = Config()
    config.set_main_option("script_location", str(_MIGRATIONS))
    config.attributes["connection"] = connection
    return config


def _built_before_migrations(connection) -> bool:
    """An install from before Alembic has the tables and no version to go with
    them, so it is recorded at the baseline rather than asked to create what it
    already has."""
    return "cached_course" in inspect(connection).get_table_names(schema=SCHEMA)


def init_db() -> None:
    _wait_for_database()
    if IS_POSTGRES:
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))

    with engine.begin() as conn:
        config = _alembic(conn)
        stamped = MigrationContext.configure(conn, opts={"version_table_schema": SCHEMA}).get_current_revision()
        if stamped is None and _built_before_migrations(conn):
            logger.info("[database]: existing schema found, recording it at the baseline")
            command.stamp(config, BASELINE)
        command.upgrade(config, "head")
    logger.info("[database]: schema is up to date")
