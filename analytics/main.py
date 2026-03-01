from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pystac_client
import planetary_computer
from datetime import datetime, timedelta
from config import get_settings, AquaSettings
from google import genai
from google.genai import types
import json
import re
from models import WaterQualityResult, LocationResult
from typing import Dict

app = FastAPI(title="AquaRipple Water Quality Analyser")

class Coordinates(BaseModel):
    lat: float
    lon: float

def get_image_package(coords: Coordinates, settings: AquaSettings) -> Dict:
    bbox = [
        coords.lon - settings.box_size, coords.lat - settings.box_size,
        coords.lon + settings.box_size, coords.lat + settings.box_size,
    ]
    bbox_str = ",".join(map(str, bbox))

    catalog = pystac_client.Client.open(settings.satillite_service)
    search = catalog.search(
        collections=settings.search_collections,
        bbox=bbox,
        datetime=f"{(datetime.now() - timedelta(days=365)).isoformat()}Z/{(datetime.now()).isoformat()}Z",
        query=settings.search_query,
    )

    items = list(search.get_items())
    if not items:
        raise HTTPException(404, "No satellite imagery found for this location.")

    best_item = min(items, key=lambda item: item.properties["eo:cloud_cover"])
    signed_item = planetary_computer.sign(best_item)

    token = signed_item.assets["visual"].href.split("?")[1]
    base_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{bbox_str}.png"
    common_params = f"collection={signed_item.collection_id}&item={signed_item.id}"

    visual_url = f"{base_url}?{common_params}&assets=visual&rescale=0,3000&{token}"
    false_color_url = f"{base_url}?{common_params}&assets=B08&assets=B04&assets=B03&rescale=0,5000&asset_as_band=True&{token}"
    water_mask_url = f"{base_url}?{common_params}&expression=(B03-B08)/(B03%2BB08)&asset_as_band=True&rescale=0,1&colormap_name=blues&{token}"
    ndci_url = f"{base_url}?{common_params}&expression=(B05-B04)/(B05%2BB04)&asset_as_band=True&rescale=-1,1&colormap_name=greens&{token}"

    return {
        "images": {
            "visual": visual_url,
            "false_color": false_color_url,
            "water_mask": water_mask_url,
            "ndci": ndci_url,
        },
        "metadata": {
            "item_id": signed_item.id,
            "collection": signed_item.collection_id,
            "datetime": best_item.datetime.isoformat(),
            "cloud_cover": best_item.properties["eo:cloud_cover"],
            "bbox": bbox,
        }
    }


def ai_water_analysis(image_package: dict, settings: AquaSettings) -> WaterQualityResult:
    client = genai.Client(api_key=settings.gemini_api_key)

    images = image_package["images"]
    metadata = image_package["metadata"]

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
        "chlorophyll_a": {"level": "low|moderate|high|very_high", "value": <float µg/L>, "confidence": <float>},
        "turbidity": {"level": "low|moderate|high|very_high", "value": <float NTU>, "confidence": <float>},
        "algae_bloom": {"detected": <bool>, "severity": "none|minor|moderate|severe", "confidence": <float>},
        "water_clarity": {"level": "clear|moderate|turbid|opaque", "secchi_depth_estimate": <float metres>, "confidence": <float>},
        "cyanobacteria_risk": {"level": "low|moderate|high|very_high", "confidence": <float>}
    },
    "water_bodies_detected": <bool>,
    "overall_quality": "excellent|good|fair|poor|critical",
    "overall_quality_score": <int 0-100>,
    "summary": "<2-3 sentence plain English summary>",
    "concerns": ["<specific concern>"],
    "confidence": <float overall>
}"""

    contents = [
        prompt,
        types.Part.from_uri(file_uri=images["visual"], mime_type="image/png"),
        types.Part.from_uri(file_uri=images["false_color"], mime_type="image/png"),
        types.Part.from_uri(file_uri=images["water_mask"], mime_type="image/png"),
        types.Part.from_uri(file_uri=images["ndci"], mime_type="image/png"),
    ]

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=contents,
    )

    try:
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", response.text.strip(), flags=re.MULTILINE).strip()
        result_dict = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Gemini returned malformed JSON: {e}. Raw response: {response.text[:300]}")

    result_dict["status"] = "success"
    result_dict["mode"] = "ai"
    result_dict["metadata"] = metadata

    try:
        return WaterQualityResult.model_validate(result_dict)
    except Exception as e:
        raise HTTPException(500, f"AI response failed schema validation: {e}")


def indices_water_analysis(image_package: dict) -> WaterQualityResult:
    # TODO: Implement calculated spectral indices mode
    raise HTTPException(501, "Indices analysis mode not yet implemented")


@app.get("/")
async def root():
    return {"message": "AquaRipple Analyse Service Running"}


@app.post("/analyse", response_model=WaterQualityResult)
async def analyse(coords: Coordinates, analysis_mode: bool = True, settings: AquaSettings = Depends(get_settings)):
    
    try:
        image_package = get_image_package(coords, settings)

        if analysis_mode:
            return ai_water_analysis(image_package, settings)
        else:
            return indices_water_analysis(image_package)

    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})

@app.post("/location/lookup", response_model=LocationResult)
async def location_lookup(coords: Coordinates, settings: AquaSettings = Depends(get_settings)):
    try:
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

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[prompt],
        )

        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", response.text.strip(), flags=re.MULTILINE).strip()
        result_dict = json.loads(raw)
        result_dict["latitude"] = coords.lat
        result_dict["longitude"] = coords.lon

        return LocationResult.model_validate(result_dict)

    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Gemini returned malformed JSON: {e}")
    except Exception as e:
        raise HTTPException(500, f"Location lookup failed: {e}")
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)