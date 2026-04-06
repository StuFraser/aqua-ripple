import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Dict, Any
from functools import lru_cache


class AquaSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Spatial ───────────────────────────────────────────────────────────────
    box_size: float = 0.02

    # ── Satellite / STAC ──────────────────────────────────────────────────────
    satillite_service: str = "https://planetarycomputer.microsoft.com/api/stac/v1"
    search_collections: List[str] = ["sentinel-2-l2a"]
    search_query: Dict[str, Any] = {"eo:cloud_cover": {"lt": 20}}
    max_imagery_age_days: int = 365

    # ── LLM — Groq ────────────────────────────────────────────────────────────
    groq_api_key: str
    # llama-3.3-70b-versatile: strong instruction-following, reliable JSON output
    groq_model: str = "llama-3.3-70b-versatile"
    groq_api_base: str = "https://api.groq.com/openai/v1"

    # ── Logging ───────────────────────────────────────────────────────────────
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
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("pystac_client").setLevel(logging.WARNING)
    logging.getLogger("planetary_computer").setLevel(logging.WARNING)
    logging.getLogger("rasterio").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)