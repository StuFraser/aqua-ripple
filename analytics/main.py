import logging
import time
import json
import re
from datetime import datetime, timedelta
from typing import Dict

from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pystac_client
import planetary_computer
from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError

from config import get_settings, configure_logging, AquaSettings
from models import WaterQualityResult, LocationResult
from rules_engine import build_activity_safety, derive_overall_quality

# ── Logging setup ─────────────────────────────────────────────────────────────

configure_logging(get_settings())
log = logging.getLogger(__name__)

# ── Domain exceptions ─────────────────────────────────────────────────────────

class ImageryNotFoundError(Exception):
    """No usable satellite imagery found for the requested location/period."""

class ImagerySigningError(Exception):
    """Failed to sign or build URLs for a satellite imagery item."""

class GeminiRateLimitError(Exception):
    """Gemini API quota or rate limit exceeded."""

class GeminiResponseError(Exception):
    """Gemini returned a response that could not be parsed or validated."""

class RulesEngineError(Exception):
    """Activity rules engine failed to produce a valid result."""

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="AquaRipple Water Quality Analyser")

class Coordinates(BaseModel):
    lat: float
    lon: float

# ── Image package ─────────────────────────────────────────────────────────────

def get_image_package(coords: Coordinates, settings: AquaSettings) -> Dict:
    bbox = [
        coords.lon - settings.box_size, coords.lat - settings.box_size,
        coords.lon + settings.box_size, coords.lat + settings.box_size,
    ]
    bbox_str = ",".join(map(str, bbox))
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

    log.debug(
        "Searching imagery | date_range=%s/%s query=%s",
        date_from, date_to, settings.search_query
    )

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
            f"No satellite imagery found for ({coords.lat}, {coords.lon}) in the past 12 months."
        )

    best_item = min(items, key=lambda item: item.properties["eo:cloud_cover"])
    log.debug(
        "Selected best item | id=%s cloud_cover=%.1f%%",
        best_item.id, best_item.properties["eo:cloud_cover"]
    )

    try:
        signed_item = planetary_computer.sign(best_item)
        token = signed_item.assets["visual"].href.split("?")[1]
    except (KeyError, IndexError) as e:
        raise ImagerySigningError(
            f"Could not extract SAS token from signed item '{best_item.id}': {e}"
        ) from e
    except Exception as e:
        raise ImagerySigningError(
            f"Failed to sign imagery item '{best_item.id}': {e}"
        ) from e

    base_url      = f"https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{bbox_str}.png"
    common_params = f"collection={signed_item.collection_id}&item={signed_item.id}"

    image_package = {
        "images": {
            "visual":      f"{base_url}?{common_params}&assets=visual&rescale=0,3000&{token}",
            "false_color": f"{base_url}?{common_params}&assets=B08&assets=B04&assets=B03&rescale=0,5000&asset_as_band=True&{token}",
            "water_mask":  f"{base_url}?{common_params}&expression=(B03-B08)/(B03%2BB08)&asset_as_band=True&rescale=0,1&colormap_name=blues&{token}",
            "ndci":        f"{base_url}?{common_params}&expression=(B05-B04)/(B05%2BB04)&asset_as_band=True&rescale=-1,1&colormap_name=greens&{token}",
        },
        "metadata": {
            "item_id":     signed_item.id,
            "collection":  signed_item.collection_id,
            "datetime":    best_item.datetime.isoformat(),
            "cloud_cover": best_item.properties["eo:cloud_cover"],
            "bbox":        bbox,
        }
    }

    log.debug("Image package built | item_id=%s", signed_item.id)
    return image_package

# ── AI analysis ───────────────────────────────────────────────────────────────

def ai_water_analysis(image_package: dict, settings: AquaSettings) -> WaterQualityResult:
    metadata = image_package["metadata"]
    images   = image_package["images"]

    log.debug(
        "Starting Gemini analysis | item_id=%s model=%s",
        metadata["item_id"], settings.gemini_model
    )

    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = """You are an expert remote sensing water quality analyst. Analyse the four provided
Sentinel-2 satellite images and return a water quality assessment as a single valid JSON object
with no markdown, no explanation, just the JSON.

Image sequence:
1. TRUE COLOR - Natural RGB for geographic context
2. FALSE COLOR (NIR/Red/Green) - Bright red = dense vegetation/algae, dark = open water
3. NDWI WATER MASK - Blues highlight water bodies
4. NDCI CHLOROPHYLL INDEX - Deeper green = higher chlorophyll/algae concentration

Return this exact JSON structure:
{
    "indicators": {
        "chlorophyll_a": {"level": "low|moderate|high|very_high", "confidence": <float>},
        "turbidity": {"level": "low|moderate|high|very_high", "confidence": <float>},
        "algae_bloom": {"detected": <bool>, "severity": "none|minor|moderate|severe", "confidence": <float>},
        "water_clarity": {"level": "clear|moderate|turbid|opaque", "secchi_depth_estimate": <float metres>, "confidence": <float>},
        "cyanobacteria_risk": {"level": "low|moderate|high|very_high", "confidence": <float>}
    }
}

Rules:
- Return only what the imagery supports, do not infer beyond what is visible
- Set severity to "none" when algae_bloom detected is false
- Confidence values are floats between 0 and 1"""

    contents = [
        prompt,
        types.Part.from_uri(file_uri=images["visual"],      mime_type="image/png"),
        types.Part.from_uri(file_uri=images["false_color"], mime_type="image/png"),
        types.Part.from_uri(file_uri=images["water_mask"],  mime_type="image/png"),
        types.Part.from_uri(file_uri=images["ndci"],        mime_type="image/png"),
    ]

    t0 = time.perf_counter()
    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=contents,
        )
    except ClientError as e:
        if e.code == 429:
            log.warning(
                "Gemini rate limit hit | item_id=%s status=%s",
                metadata["item_id"], e.status
            )
            raise GeminiRateLimitError(
                f"Gemini API quota exceeded — try again in a moment. (status={e.status})"
            ) from e
        log.error(
            "Gemini client error | item_id=%s code=%s status=%s",
            metadata["item_id"], e.code, e.status, exc_info=True
        )
        raise GeminiResponseError(
            f"Gemini rejected the request (HTTP {e.code} {e.status}): {e.message}"
        ) from e
    except ServerError as e:
        log.error(
            "Gemini server error | item_id=%s code=%s",
            metadata["item_id"], e.code, exc_info=True
        )
        raise GeminiResponseError(
            f"Gemini service error (HTTP {e.code}): {e.message}"
        ) from e
    except Exception as e:
        raise GeminiResponseError(f"Gemini API call failed: {e}") from e

    elapsed = time.perf_counter() - t0
    log.debug("Gemini responded in %.2fs | item_id=%s", elapsed, metadata["item_id"])
    log.debug(
        "Gemini raw response | item_id=%s text=%.500s",
        metadata["item_id"], response.text
    )

    try:
        raw = re.sub(
            r"^```(?:json)?\s*|\s*```$", "", response.text.strip(), flags=re.MULTILINE
        ).strip()
        result_dict = json.loads(raw)
    except json.JSONDecodeError as e:
        raise GeminiResponseError(
            f"Gemini returned malformed JSON: {e} | snippet: {response.text[:200]!r}"
        ) from e

    if "indicators" not in result_dict:
        raise GeminiResponseError(
            f"Gemini response missing 'indicators' key | keys_found={list(result_dict.keys())}"
        )

    indicators = result_dict["indicators"]
    log.debug(
        "Indicators parsed | item_id=%s indicators=%s",
        metadata["item_id"], indicators
    )

    try:
        result_dict["activity_safety"] = build_activity_safety(indicators)
        result_dict["overall_quality"] = derive_overall_quality(indicators)
    except Exception as e:
        raise RulesEngineError(
            f"Rules engine failed for item '{metadata['item_id']}': {e}"
        ) from e

    result_dict["mode"]     = "ai"
    result_dict["item_id"]  = metadata["item_id"]
    result_dict["datetime"] = metadata["datetime"]

    try:
        result = WaterQualityResult.model_validate(result_dict)
    except Exception as e:
        raise GeminiResponseError(
            f"AI response failed schema validation for item '{metadata['item_id']}': {e}"
        ) from e

    log.info(
        "Analysis complete | item_id=%s overall_quality=%s cloud_cover=%.1f%%",
        metadata["item_id"], result.overall_quality, metadata["cloud_cover"]
    )
    return result

# ── Indices analysis (stub) ───────────────────────────────────────────────────

def indices_water_analysis(image_package: dict) -> WaterQualityResult:
    raise NotImplementedError("Indices analysis mode not yet implemented")

# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "AquaRipple Analyse Service Running"}


@app.post("/analyse", response_model=WaterQualityResult)
async def analyse(
    coords: Coordinates,
    analysis_mode: bool = True,
    settings: AquaSettings = Depends(get_settings),
):
    log.info(
        "Analyse request | lat=%.5f lon=%.5f mode=%s",
        coords.lat, coords.lon, "ai" if analysis_mode else "indices"
    )
    t0 = time.perf_counter()

    try:
        image_package = get_image_package(coords, settings)

        if analysis_mode:
            result = ai_water_analysis(image_package, settings)
        else:
            result = indices_water_analysis(image_package)

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

    except GeminiRateLimitError as e:
        log.warning("Rate limited | lat=%.5f lon=%.5f", coords.lat, coords.lon)
        raise HTTPException(status_code=429, detail=str(e))

    except GeminiResponseError as e:
        log.error("Gemini error | lat=%.5f lon=%.5f", coords.lat, coords.lon, exc_info=True)
        raise HTTPException(status_code=502, detail=str(e))

    except RulesEngineError as e:
        log.error("Rules engine error | lat=%.5f lon=%.5f", coords.lat, coords.lon, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    except NotImplementedError as e:
        log.warning("Unimplemented mode | lat=%.5f lon=%.5f", coords.lat, coords.lon)
        raise HTTPException(status_code=501, detail=str(e))

    except Exception:
        log.exception("Unexpected error | lat=%.5f lon=%.5f", coords.lat, coords.lon)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")


@app.post("/location/lookup", response_model=LocationResult)
async def location_lookup(
    coords: Coordinates,
    settings: AquaSettings = Depends(get_settings),
):
    log.info("Location lookup | lat=%.5f lon=%.5f", coords.lat, coords.lon)

    client = genai.Client(api_key=settings.gemini_api_key)

    prompt = f"""You are a precise geographic lookup tool. Given EXACTLY these coordinates: latitude={coords.lat}, longitude={coords.lon}

Your task: identify the water body located AT these exact coordinates.

Rules:
- Only return a water body if it is directly at or immediately touching these coordinates (within ~100 metres)
- Do NOT return nearby landmarks, famous lakes, or well-known features that are not at this exact location
- Do NOT guess or infer based on general area knowledge
- If you are not confident a water body exists at exactly these coordinates, set is_water to false
- Distance matters: a result 1km away is wrong, 10km away is very wrong

Respond only with valid JSON, no markdown:
{{
"is_water": true or false,
"name": "exact name of water body at these coordinates or null",
"water_type": "river|lake|estuary|ocean|reservoir|canal|stream|other or null",
"description": "1-2 sentence description or null",
"message": "null if is_water is true, otherwise friendly message that location appears to be on land"
}}"""

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[prompt],
        )
    except ClientError as e:
        if e.code == 429:
            log.warning("Gemini rate limit hit on location lookup | lat=%.5f lon=%.5f", coords.lat, coords.lon)
            raise HTTPException(status_code=429, detail="Gemini API quota exceeded — try again in a moment.")
        log.error("Gemini client error on location lookup | code=%s", e.code, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Gemini error (HTTP {e.code}): {e.message}")
    except ServerError as e:
        log.error("Gemini server error on location lookup | code=%s", e.code, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Gemini service error (HTTP {e.code}): {e.message}")
    except Exception as e:
        log.exception("Unexpected error on location lookup | lat=%.5f lon=%.5f", coords.lat, coords.lon)
        raise HTTPException(status_code=500, detail=f"Location lookup failed: {e}")

    log.debug("Location lookup raw response | lat=%.5f lon=%.5f text=%.300s", coords.lat, coords.lon, response.text)

    try:
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", response.text.strip(), flags=re.MULTILINE).strip()
        result_dict = json.loads(raw)
    except json.JSONDecodeError as e:
        log.error("Malformed JSON from Gemini on location lookup | lat=%.5f lon=%.5f", coords.lat, coords.lon)
        raise HTTPException(status_code=502, detail=f"Gemini returned malformed JSON: {e}")

    result_dict["latitude"]  = coords.lat
    result_dict["longitude"] = coords.lon

    try:
        result = LocationResult.model_validate(result_dict)
    except Exception as e:
        log.error("Schema validation failed on location lookup | lat=%.5f lon=%.5f error=%s", coords.lat, coords.lon, e)
        raise HTTPException(status_code=502, detail=f"Location lookup response failed validation: {e}")

    log.info(
        "Location lookup complete | lat=%.5f lon=%.5f is_water=%s name=%s",
        coords.lat, coords.lon, result.is_water, result.name
    )
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)