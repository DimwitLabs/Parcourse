from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://parcourse:parcourse@db:5432/parcourse"
    db_schema: str = "public"
    cors_origins: list[str] = ["http://localhost:5173"]
    jwt_secret: str
    jwt_expiry_hours: int = 24
    encryption_key: str

settings = Settings()
