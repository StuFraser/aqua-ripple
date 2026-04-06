import logging
import time
import json
import re
from datetime import datetime, timedelta
from typing import Dict

import httpx
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import pystac_client
import planetary_computer

from config import get_settings, configure_logging, AquaSettings
from models import WaterQualityResult
from rules_engine import build_activity_safety, derive_overall_quality
from spectral import compute_spectral_indices, SpectralIndices, BandDownloadError, InsufficientWaterError

# ── Logging setup ─────────────────────────────────────────────────────────────

configure_logging(get_settings())
log = logging.getLogger(__name__)

# ── Domain exceptions ─────────────────────────────────────────────────────────

class ImageryNotFoundError(Exception):
    """No usable satellite imagery found for the requested location/period."""

class ImagerySigningError(Exception):
    """Failed to sign a satellite imagery item."""

class LLMRateLimitError(Exception):
    """LLM API quota or rate limit exceeded."""

class LLMResponseError(Exception):
    """LLM returned a response that could not be parsed or validated."""

class RulesEngineError(Exception):
    """Activity rules engine failed to produce a valid result."""

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="AquaRipple Water Quality Analyser")


class Coordinates(BaseModel):
    lat: float
    lon: float

# ── STAC imagery fetch ────────────────────────────────────────────────────────

def get_signed_item(coords: Coordinates, settings: AquaSettings):
    """
    Search Planetary Computer for the lowest-cloud Sentinel-2 scene
    covering coords, sign it, and return (signed_item, bbox, metadata).
    """
    bbox = [
        coords.lon - settings.box_size, coords.lat - settings.box_size,
        coords.lon + settings.box_size, coords.lat + settings.box_size,
    ]
    date_from = (datetime.now() - timedelta(days=365)).isoformat()
    date_to   = datetime.now().isoformat()

    log.debug(
        "Opening STAC catalog | service=%s collections=%s bbox=%s",
        settings.satillite_service, settings.search_collections, bbox
    )

    try:
        catalog = pystac_client.Client.open(settings.satillite_service)
    except Exception as e:
        raise ImageryNotFoundError(f"Failed to connect to STAC catalog: {e}") from e

    try:
        search = catalog.search(
            collections=settings.search_collections,
            bbox=bbox,
            datetime=f"{date_from}Z/{date_to}Z",
            query=settings.search_query,
        )
        items = list(search.get_items())
    except Exception as e:
        raise ImageryNotFoundError(f"STAC search failed: {e}") from e

    log.debug("STAC search returned %d item(s)", len(items))

    if not items:
        raise ImageryNotFoundError(
            f"No satellite imagery found for ({coords.lat}, {coords.lon}) "
            "with cloud cover <20% in the past 12 months."
        )

    best_item = min(items, key=lambda item: item.properties["eo:cloud_cover"])

    imagery_age_days = (datetime.now() - best_item.datetime.replace(tzinfo=None)).days
    if imagery_age_days > settings.max_imagery_age_days:
        raise ImageryNotFoundError(
            f"No recent satellite imagery found for ({coords.lat}, {coords.lon}). "
            f"Best available scene is {imagery_age_days} days old "
            f"(maximum accepted: {settings.max_imagery_age_days} days). "
            "Try again when a more recent pass is available, or raise MAX_IMAGERY_AGE_DAYS to accept older data."
        )

    log.debug(
        "Selected best item | id=%s cloud_cover=%.1f%% age_days=%d",
        best_item.id, best_item.properties["eo:cloud_cover"], imagery_age_days
    )

    try:
        signed_item = planetary_computer.sign(best_item)
    except Exception as e:
        raise ImagerySigningError(
            f"Failed to sign imagery item '{best_item.id}': {e}"
        ) from e

    metadata = {
        "item_id":     signed_item.id,
        "collection":  signed_item.collection_id,
        "datetime":    best_item.datetime.isoformat(),
        "cloud_cover": best_item.properties["eo:cloud_cover"],
        "bbox":        bbox,
    }

    return signed_item, bbox, metadata

# ── Groq LLM client ──────────────────────────────────────────────────────────

def _groq_chat(messages: list[dict], settings: AquaSettings, max_tokens: int = 1024) -> str:
    """
    Call the Groq chat completions endpoint (OpenAI-compatible).
    Returns the raw text content of the first choice.
    Raises LLMRateLimitError or LLMResponseError on failure.
    """
    url = f"{settings.groq_api_base}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.groq_model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.1,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException as e:
        raise LLMResponseError(f"Groq API request timed out: {e}") from e
    except httpx.RequestError as e:
        raise LLMResponseError(f"Groq API request failed: {e}") from e

    if response.status_code == 429:
        raise LLMRateLimitError("Groq API rate limit exceeded — try again in a moment.")

    if response.status_code != 200:
        raise LLMResponseError(
            f"Groq API returned HTTP {response.status_code}: {response.text[:300]}"
        )

    try:
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise LLMResponseError(f"Could not parse Groq response: {e}") from e


def _parse_json_response(raw: str, context: str) -> dict:
    """Strip markdown fences and parse JSON, raising LLMResponseError on failure."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise LLMResponseError(
            f"LLM returned malformed JSON ({context}): {e} | snippet: {raw[:200]!r}"
        ) from e

# ── Spectral indices → LLM interpretation ────────────────────────────────────

_ANALYSIS_SYSTEM = """
You are a calibrated remote-sensing water-quality analyst.
Interpret Sentinel-2 spectral indices conservatively.
Return ONLY valid JSON with no markdown or commentary.
Use thresholds as guides, not rigid rules.
Combine indices holistically and avoid optimistic interpretations.
"""

_ANALYSIS_USER_TEMPLATE = """
Indices:
{indices_json}

Reference ranges (guides):
NDCI (chlorophyll): <0.0 low, 0.0-0.2 moderate, 0.2-0.4 high, >0.4 very_high
Turbidity Index (red/green): <0.6 low, 0.6-0.8 moderate, 0.8-1.0 high, >1.0 very_high
FAI (floating algae): <-0.02 none, -0.02-0 minor, 0-0.05 moderate, >0.05 severe
NTR (turbidity ratio): <0 low, 0-0.1 moderate, 0.1-0.2 high, >0.2 very_high

Secchi depth: estimate from turbidity_index; lower turbidity -> deeper clarity.
Cyanobacteria risk: based on NDCI + FAI together (both low -> low; either elevated -> moderate; both elevated -> high/very_high).

Return exactly:
{{
  "indicators": {{
    "chlorophyll_a":      {{"level": "low|moderate|high|very_high", "confidence": <float>}},
    "turbidity":          {{"level": "low|moderate|high|very_high", "confidence": <float>}},
    "algae_bloom":        {{"detected": <bool>, "severity": "none|minor|moderate|severe", "confidence": <float>}},
    "water_clarity":      {{"level": "clear|moderate|turbid|opaque", "secchi_depth_estimate": <float>, "confidence": <float>}},
    "cyanobacteria_risk": {{"level": "low|moderate|high|very_high", "confidence": <float>}}
  }}
}}

Confidence guidance:
- Increase when multiple indices agree and water_pixel_fraction is high.
- Decrease when water_pixel_fraction is low or signals are ambiguous.
"""


def llm_interpret_indices(
    indices: SpectralIndices,
    metadata: dict,
    settings: AquaSettings,
) -> dict:
    """
    Send computed spectral indices to Groq for structured interpretation.
    Returns the raw indicators dict.
    """
    indices_dict = {
        k: round(v, 4) if isinstance(v, float) else v
        for k, v in indices.to_dict().items()
        if v is not None
    }

    user_msg = _ANALYSIS_USER_TEMPLATE.format(
        indices_json=json.dumps(indices_dict, indent=2)
    )

    log.debug(
        "Sending indices to LLM | item_id=%s model=%s",
        metadata["item_id"], settings.groq_model
    )

    t0 = time.perf_counter()
    raw = _groq_chat(
        messages=[
            {"role": "system", "content": _ANALYSIS_SYSTEM},
            {"role": "user",   "content": user_msg},
        ],
        settings=settings,
        max_tokens=512,
    )
    elapsed = time.perf_counter() - t0

    log.debug(
        "LLM responded in %.2fs | item_id=%s text=%.500s",
        elapsed, metadata["item_id"], raw
    )

    result = _parse_json_response(raw, context=f"analysis item_id={metadata['item_id']}")

    if "indicators" not in result:
        raise LLMResponseError(
            f"LLM response missing 'indicators' key | keys_found={list(result.keys())}"
        )

    return result["indicators"]


# ── Core analysis pipeline ────────────────────────────────────────────────────

def analyse_water_quality(
    signed_item,
    bbox: list[float],
    metadata: dict,
    settings: AquaSettings,
) -> WaterQualityResult:
    """
    Full pipeline: download bands -> compute indices -> LLM interpretation -> rules engine.
    """
    log.debug("Computing spectral indices | item_id=%s", metadata["item_id"])
    t0 = time.perf_counter()
    indices = compute_spectral_indices(signed_item, bbox)
    log.debug(
        "Spectral indices done in %.2fs | item_id=%s water_fraction=%.1f%%",
        time.perf_counter() - t0, metadata["item_id"],
        (indices.water_pixel_fraction or 0) * 100
    )

    indicators = llm_interpret_indices(indices, metadata, settings)
    log.debug("Indicators | item_id=%s indicators=%s", metadata["item_id"], indicators)

    try:
        activity_safety = build_activity_safety(indicators)
        overall_quality = derive_overall_quality(indicators)
    except Exception as e:
        raise RulesEngineError(
            f"Rules engine failed for item '{metadata['item_id']}': {e}"
        ) from e

    result_dict = {
        "mode":            "indices",
        "item_id":         metadata["item_id"],
        "datetime":        metadata["datetime"],
        "indicators":      indicators,
        "activity_safety": activity_safety,
        "overall_quality": overall_quality,
    }

    try:
        result = WaterQualityResult.model_validate(result_dict)
    except Exception as e:
        raise LLMResponseError(
            f"Response failed schema validation for item '{metadata['item_id']}': {e}"
        ) from e

    log.info(
        "Analysis complete | item_id=%s overall_quality=%s cloud_cover=%.1f%% water_fraction=%.1f%%",
        metadata["item_id"], result.overall_quality,
        metadata["cloud_cover"],
        (indices.water_pixel_fraction or 0) * 100,
    )
    return result


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "AquaRipple Analyse Service Running"}


@app.post("/analyse", response_model=WaterQualityResult)
async def analyse(
    coords: Coordinates,
    settings: AquaSettings = Depends(get_settings),
):
    log.info("Analyse request | lat=%.5f lon=%.5f", coords.lat, coords.lon)
    t0 = time.perf_counter()

    try:
        signed_item, bbox, metadata = get_signed_item(coords, settings)
        result = analyse_water_quality(signed_item, bbox, metadata, settings)

        log.info(
            "Analyse complete | lat=%.5f lon=%.5f elapsed=%.2fs",
            coords.lat, coords.lon, time.perf_counter() - t0
        )
        return result

    except ImageryNotFoundError as e:
        log.warning("No imagery | lat=%.5f lon=%.5f reason=%s", coords.lat, coords.lon, e)
        raise HTTPException(status_code=404, detail=str(e))

    except ImagerySigningError as e:
        log.error("Signing failed | lat=%.5f lon=%.5f", coords.lat, coords.lon, exc_info=True)
        raise HTTPException(status_code=502, detail=str(e))

    except BandDownloadError as e:
        log.error("Band download failed | lat=%.5f lon=%.5f", coords.lat, coords.lon, exc_info=True)
        raise HTTPException(status_code=502, detail=str(e))

    except InsufficientWaterError as e:
        log.warning("Insufficient water | lat=%.5f lon=%.5f reason=%s", coords.lat, coords.lon, e)
        raise HTTPException(status_code=422, detail=str(e))

    except LLMRateLimitError as e:
        log.warning("LLM rate limited | lat=%.5f lon=%.5f", coords.lat, coords.lon)
        raise HTTPException(status_code=429, detail=str(e))

    except LLMResponseError as e:
        log.error("LLM error | lat=%.5f lon=%.5f", coords.lat, coords.lon, exc_info=True)
        raise HTTPException(status_code=502, detail=str(e))

    except RulesEngineError as e:
        log.error("Rules engine error | lat=%.5f lon=%.5f", coords.lat, coords.lon, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    except Exception:
        log.exception("Unexpected error | lat=%.5f lon=%.5f", coords.lat, coords.lon)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)