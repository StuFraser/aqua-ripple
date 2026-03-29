import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Dict, Any
from functools import lru_cache

class AquaSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    box_size: float = 0.02
    satillite_service: str = "https://planetarycomputer.microsoft.com/api/stac/v1"
    search_collections: List[str] = ["sentinel-2-l2a"]
    search_query: Dict[str, Any] = {"eo:cloud_cover": {"lt": 20}}

    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"

    log_level: str = "INFO"

@lru_cache()
def get_settings():
    return AquaSettings()

def configure_logging(settings: AquaSettings) -> None:
    """Configure root logging from settings. Call once at app startup."""
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    # Quieten noisy third-party loggers even in DEBUG mode
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("pystac_client").setLevel(logging.WARNING)
    logging.getLogger("planetary_computer").setLevel(logging.WARNING)