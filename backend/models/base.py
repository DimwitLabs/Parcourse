from pydantic.alias_generators import to_snake
from sqlalchemy import MetaData
from sqlalchemy.orm import declared_attr
from sqlmodel import SQLModel

from config import SCHEMA


class SQLModelBase(SQLModel):
    """SQLModel names a table after the lower-cased class, which runs the words
    together, and leaves the schema to whatever search_path happens to say."""

    metadata = MetaData(schema=SCHEMA)

    @declared_attr.directive
    def __tablename__(cls) -> str:  # noqa: N805
        return to_snake(cls.__name__)
