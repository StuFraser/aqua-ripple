from pydantic_settings import BaseSettings
from typing import List, Dict, Any
from functools import lru_cache

class AquaSettings(BaseSettings):
    box_size: float = 0.01
    satillite_service: str = "https://planetarycomputer.microsoft.com/api/stac/v1"
    search_collections: List[str] = ["sentinel-2-l2a"]
    search_query: Dict[str, Any] = {"eo:cloud_cover": {"lt": 20}}

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return AquaSettings()

