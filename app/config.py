from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str = Field(alias="DATABASE_URL")
    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )

    cors_allowed_origins: str = Field(default="", alias="CORS_ALLOWED_ORIGINS")

    cloudinary_cloud_name: str = Field(default="", alias="CLOUDINARY_CLOUD_NAME")
    cloudinary_api_key: str = Field(default="", alias="CLOUDINARY_API_KEY")
    cloudinary_api_secret: str = Field(default="", alias="CLOUDINARY_API_SECRET")
    cloudinary_folder: str = Field(
        default="parqueadero", alias="CLOUDINARY_FOLDER"
    )

    admin_username: str = Field(default="admin", alias="ADMIN_USERNAME")
    admin_password: str = Field(alias="ADMIN_PASSWORD")
    vigilante_username: str = Field(default="vigilante", alias="VIGILANTE_USERNAME")
    vigilante_password: str = Field(alias="VIGILANTE_PASSWORD")
    superadmin_username: str = Field(default="superadmin", alias="SUPERADMIN_USERNAME")
    superadmin_password: str = Field(default="", alias="SUPERADMIN_PASSWORD")

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.cors_allowed_origins.strip():
            return []
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
