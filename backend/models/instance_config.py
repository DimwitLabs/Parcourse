from enum import Enum

from sqlmodel import Field, SQLModel

from config import DEFAULT_AI_MODEL

INSTANCE_ID = 1


class InstanceMode(str, Enum):
    single = "single"
    multi = "multi"


class InstanceConfig(SQLModel, table=True):
    id: int = Field(default=INSTANCE_ID, primary_key=True)
    mode: InstanceMode
    # Holds an encrypted connection blob for any provider. The column name
    # predates provider support and is kept to avoid a migration.
    default_openrouter_key: str | None = Field(default=None)
    ai_model: str = Field(default=DEFAULT_AI_MODEL)
