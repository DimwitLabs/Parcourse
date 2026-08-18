from enum import Enum

from sqlmodel import Field

from models.base import SQLModelBase

INSTANCE_ID = 1


class InstanceMode(str, Enum):
    single = "single"
    multi = "multi"


class InstanceConfig(SQLModelBase, table=True):
    id: int = Field(default=INSTANCE_ID, primary_key=True)
    mode: InstanceMode
    default_connection: str | None = Field(default=None)
