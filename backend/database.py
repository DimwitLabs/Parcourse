from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from config import settings

engine = create_engine(settings.database_url)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

def init_db() -> None:
    SQLModel.metadata.create_all(engine)
