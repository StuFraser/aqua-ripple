from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import pystac_client
import planetary_computer
from datetime import datetime, timedelta
import pystac
from config import get_settings, AquaSettings


app = FastAPI(title="AquaRipple Water Quality Analyser")

class Coordinates(BaseModel):
    lat: float
    lon: float

from datetime import datetime, timedelta
from typing import List, Dict
import pystac_client
import planetary_computer
from fastapi import HTTPException

def get_image_package(coords: Coordinates, settings: AquaSettings) -> Dict[str, str]:

    
    bbox = [
        coords.lon - settings.box_size, coords.lat - settings.box_size,
        coords.lon + settings.box_size, coords.lat + settings.box_size,
    ]
    bbox_str = ",".join(map(str, bbox))

    #Search for the best Sentinel-2 item
    catalog = pystac_client.Client.open(settings.satillite_service)
    search = catalog.search(
        collections=settings.search_collections,
        bbox=bbox,
        datetime=f"{(datetime.now() - timedelta(days=365)).isoformat()}Z/{(datetime.now()).isoformat()}Z",
        query=settings.search_query,
    )
    
    items = list(search.get_items()) # get_all_items is deprecated in newer pystac versions
    if not items: 
        raise HTTPException(404, "No satellite imagery found for this location.")
    
    # Select the item with the lowest cloud cover
    best_item = min(items, key=lambda item: item.properties["eo:cloud_cover"])
    signed_item = planetary_computer.sign(best_item)
    
    # Extract the shared SAS token (everything after the ?)
    token = signed_item.assets["visual"].href.split("?")[1]
    
    base_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{bbox_str}.png"
    common_params = f"collection={signed_item.collection_id}&item={signed_item.id}"

    # IMAGE 1: True Color (Human Context) ---
    visual_url = (
        f"{base_url}?{common_params}&"
        f"assets=visual&rescale=0,3000&"
        f"{token}"
    )

    # IMAGE 2: False Color (Biological/Algae Context) ---
    # NIR (B08) -> Red channel, Red (B04) -> Green channel, Green (B03) -> Blue channel
    false_color_url = (
        f"{base_url}?{common_params}&"
        f"assets=B08&assets=B04&assets=B03&"
        f"rescale=0,5000&asset_as_band=True&"
        f"{token}"
    )

    # --- IMAGE 3: NDWI Water Mask(The Extraction Map) ---
    # Formula: (Green - NIR) / (Green + NIR)
    # We use %2B for the '+' to avoid URL encoding errors
    water_mask_url = (
        f"{base_url}?{common_params}&"
        f"expression=(B03-B08)/(B03%2BB08)&"
        f"asset_as_band=True&rescale=0,1&"
        f"colormap_name=blues&"
        f"{token}"
    )

    ndci_url = (
        f"{base_url}?{common_params}&"
        f"expression=(B05-B04)/(B05%2BB04)&"
        f"asset_as_band=True&rescale=-1,1&"
        f"colormap_name=greens&{token}"      # deeper green = more chlorophyll/algae
    )

    return {
        # Images for visualisation and AI mode
        "images": {
            "visual": visual_url,
            "false_color": false_color_url,
            "water_mask": water_mask_url,
            "ndci": ndci_url,
        },
        # Metadata for indices mode and AI context
        "metadata": {
            "item_id": signed_item.id,
            "collection": signed_item.collection_id,
            "datetime": best_item.datetime.isoformat(),
            "cloud_cover": best_item.properties["eo:cloud_cover"],
            "bbox": bbox,
        }
    }


def water_analysis(item: pystac.Item) -> dict:
    """
    Performs water quality analysis on a given STAC item.
    (Currently a stub)
    """
    signed_item = planetary_computer.sign(item)
    visual_asset_href = signed_item.assets["visual"].href

    # TODO: Implement actual water quality analysis using the image data
    return {
        "status": "success",
        "confidence": 0.87,
        "image_metadata": {
            "asset_href": visual_asset_href,
            "collection": signed_item.collection_id,
            "datetime": signed_item.datetime.isoformat(),
            "cloud_coverage": signed_item.properties["eo:cloud_cover"],
        },
        "indicators": {
            "chlorophyll_a": {
                "level": "moderate",
                "value": 12.5,
                "confidence": 0.85
            },
            "turbidity": {
                "level": "low",
                "value": 3.2,
                "confidence": 0.92
            },
            "algae_bloom": {
                "detected": False,
                "confidence": 0.78
            },
            "water_clarity": {
                "level": "clear",
                "secchi_depth_estimate": 2.5,
                "confidence": 0.81
            }
        },
        "overall_quality": "good",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/")
async def root():
    return {"message": "AquaRipple Analyse Service Running"}

@app.post("/analyse")
async def analyse(coords: Coordinates, settings: AquaSettings = Depends(get_settings)):
    """
    Analyse water quality from satellite imagery for a given coordinate.
    """
    try:
        best_item = get_image_package(coords, settings)

        return best_item

        # result = water_analysis(best_item)
        # return result
        
    except HTTPException as e:
        return JSONResponse(
            status_code=e.status_code,
            content={"status": "error", "message": e.detail}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
