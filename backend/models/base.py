from pydantic.alias_generators import to_snake
from sqlalchemy.orm import declared_attr
from sqlmodel import SQLModel


class SQLModelBase(SQLModel):
    """SQLModel names a table after the lower-cased class, which runs the words
    together. Tables inherit from here to be named the way they are read."""

    @declared_attr.directive
    def __tablename__(cls) -> str:  # noqa: N805
        return to_snake(cls.__name__)
