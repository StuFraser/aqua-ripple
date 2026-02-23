from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Dict, Any
from functools import lru_cache

class AquaSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    box_size: float = 0.005
    satillite_service: str = "https://planetarycomputer.microsoft.com/api/stac/v1"
    search_collections: List[str] = ["sentinel-2-l2a"]
    search_query: Dict[str, Any] = {"eo:cloud_cover": {"lt": 20}}

    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"

@lru_cache()
def get_settings():
    return AquaSettings()