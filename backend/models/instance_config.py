from enum import Enum

from sqlmodel import Field, SQLModel


class InstanceMode(str, Enum):
    single = "single"
    multi = "multi"


class InstanceConfig(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    mode: InstanceMode
