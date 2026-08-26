from alembic import context
from sqlalchemy import engine_from_config, pool, text

from config import DATABASE_URL, SCHEMA
from models.base import SQLModelBase
import models  # noqa: F401  a table has to be imported to be seen

target_metadata = SQLModelBase.metadata


def _run(connection) -> None:
    if SCHEMA:
        connection.execute(text(f'SET search_path TO "{SCHEMA}"'))

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table_schema=SCHEMA,
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


handed = context.config.attributes.get("connection")
if handed is not None:
    _run(handed)
else:
    config = context.config
    config.set_main_option("sqlalchemy.url", DATABASE_URL)
    engine = engine_from_config(config.get_section(config.config_ini_section, {}), poolclass=pool.NullPool)
    with engine.connect() as connection:
        _run(connection)
