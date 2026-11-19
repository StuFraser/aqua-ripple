"""
spectral.py — Sentinel-2 spectral index computation for AquaRipple.

Downloads individual band windows (COG GeoTIFFs) from Planetary Computer
and computes water-quality-relevant spectral indices over water pixels only.

Bands used:
  B03  Green  560nm  — NDWI, MNDWI, turbidity
  B04  Red    665nm  — NDCI, turbidity, FAI
  B05  RedEdge 705nm — NDCI (chlorophyll-a)
  B08  NIR    842nm  — NDWI, NDVI, FAI
  B11  SWIR   1610nm — MNDWI, FAI

All indices are computed over valid (non-NaN, non-zero) water pixels only.
Water pixels are identified by MNDWI > MNDWI_WATER_THRESHOLD.
"""

import logging
import numpy as np
import rasterio
import rasterio.windows
from rasterio.transform import from_bounds
from rasterio.crs import CRS
import requests
from io import BytesIO
from typing import Dict, Optional
from dataclasses import dataclass, field

log = logging.getLogger(__name__)

# Minimum MNDWI value to classify a pixel as water
MNDWI_WATER_THRESHOLD = 0.0

# A requested point must be associated with a contiguous water feature.  A
# percentage-of-bbox threshold rejects perfectly valid narrow rivers because the
# sampling box intentionally includes several kilometres of surrounding land.
# The B03 reference grid is 10 m, so these thresholds represent about 2,500 m²
# of continuous water and a 100 m minimum feature extent.
MIN_CONNECTED_WATER_PIXELS = 25
MIN_CONNECTED_WATER_SPAN_PIXELS = 10
MAX_TARGET_COMPONENT_DISTANCE_PIXELS = 10

REQUIRED_BANDS = ["B03", "B04", "B05", "B08", "B11"]


@dataclass
class SpectralIndices:
    """Computed spectral indices over water pixels."""

    # Core water indices
    ndwi: Optional[float] = None          # (B03-B08)/(B03+B08)  — McFeeters water index
    mndwi: Optional[float] = None         # (B03-B11)/(B03+B11)  — Modified NDWI (Xu 2006)

    # Vegetation / algae separation
    ndvi: Optional[float] = None          # (B08-B04)/(B08+B04)  — vegetation presence

    # Chlorophyll-a proxies
    ndci: Optional[float] = None          # (B05-B04)/(B05+B04)  — Normalised Difference Chlorophyll Index
    red_edge_ratio: Optional[float] = None  # B05/B04             — simpler chl-a proxy

    # Turbidity / suspended sediment
    turbidity_index: Optional[float] = None   # B04/B03  — red-to-green ratio (higher = more turbid)
    ntr: Optional[float] = None               # (B04-B03)/(B04+B03) — Normalised Turbidity Ratio

    # Floating algae / cyanobacteria surface scum
    fai: Optional[float] = None  # B08 - (B04 + (B11-B04)*((842-665)/(1610-665)))

    # Scene metadata
    water_pixel_fraction: Optional[float] = None   # fraction of bbox classified as water
    valid_pixel_fraction: Optional[float] = None   # fraction of bbox with valid (non-NaN) data

    def to_dict(self) -> Dict[str, Optional[float]]:
        return {k: v for k, v in self.__dict__.items()}


class BandDownloadError(Exception):
    """Failed to download or read a Sentinel-2 band window."""


class InsufficientWaterError(Exception):
    """Too few water pixels to compute reliable indices."""


@dataclass(frozen=True)
class WaterComponent:
    """A contiguous MNDWI-classified water feature near the requested point."""

    mask: np.ndarray
    pixel_count: int
    longest_span_pixels: int
    distance_to_target_pixels: float


def _download_band_window(href: str, bbox: list[float]) -> np.ndarray:
    """
    Download a clipped window from a COG GeoTIFF using range requests.

    Returns a 2D float32 array of reflectance values (DN / 10000).
    Zero and negative values are replaced with NaN (fill / no-data).
    """
    lon_min, lat_min, lon_max, lat_max = bbox

    try:
        with rasterio.open(href) as src:
            # Convert bbox to pixel window in the COG's CRS
            # Sentinel-2 L2A from PC is in UTM; reproject bbox corners
            from rasterio.warp import transform as warp_transform

            xs, ys = warp_transform(
                CRS.from_epsg(4326), src.crs,
                [lon_min, lon_max], [lat_min, lat_max]
            )
            window = rasterio.windows.from_bounds(
                min(xs), min(ys), max(xs), max(ys),
                transform=src.transform
            )

            data = src.read(1, window=window).astype(np.float32)

        log.debug("Band window shape=%s min=%.0f max=%.0f", data.shape, np.nanmin(data), np.nanmax(data))

        # Replace fill values with NaN
        data[data <= 0] = np.nan

        # Sentinel-2 L2A DN → surface reflectance (scale factor 10000)
        data = data / 10000.0

        # Clip to physically plausible reflectance range
        data = np.clip(data, 0.0, 1.0)

        return data

    except Exception as e:
        raise BandDownloadError(f"Failed to read band window from {href[:80]}…: {e}") from e


def _safe_index(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Compute (a - b) / (a + b) with NaN where denominator is zero."""
    with np.errstate(invalid="ignore", divide="ignore"):
        result = np.where((a + b) == 0, np.nan, (a - b) / (a + b))
    return result.astype(np.float32)


def _water_mean(arr: np.ndarray, water_mask: np.ndarray) -> Optional[float]:
    """Return mean of arr over water pixels, or None if no valid pixels."""
    vals = arr[water_mask & np.isfinite(arr)]
    if len(vals) == 0:
        return None
    return float(np.mean(vals))


def _select_target_water_component(water_mask: np.ndarray) -> Optional[WaterComponent]:
    """Return the 8-connected water component nearest the centre of the request.

    The request coordinates are the centre of the downloaded bounding box.  This
    ties the analysis to that waterway instead of averaging unrelated lakes,
    rivers, or wet pixels elsewhere in the same box.
    """
    from skimage.measure import label

    labels = label(water_mask, connectivity=2)
    component_ids = np.unique(labels)
    component_ids = component_ids[component_ids != 0]
    if len(component_ids) == 0:
        return None

    target = np.array([(water_mask.shape[0] - 1) / 2, (water_mask.shape[1] - 1) / 2])
    nearest = None

    for component_id in component_ids:
        positions = np.argwhere(labels == component_id)
        squared_distances = np.sum((positions - target) ** 2, axis=1)
        nearest_distance = float(np.sqrt(np.min(squared_distances)))
        row_span = int(positions[:, 0].max() - positions[:, 0].min() + 1)
        column_span = int(positions[:, 1].max() - positions[:, 1].min() + 1)
        candidate = WaterComponent(
            mask=labels == component_id,
            pixel_count=len(positions),
            longest_span_pixels=max(row_span, column_span),
            distance_to_target_pixels=nearest_distance,
        )
        if nearest is None or candidate.distance_to_target_pixels < nearest.distance_to_target_pixels:
            nearest = candidate

    return nearest


def _require_usable_target_component(component: Optional[WaterComponent]) -> WaterComponent:
    """Validate that a component is connected, substantial, and near the pin."""
    if component is None:
        raise InsufficientWaterError("No pixels were classified as water near the requested coordinates.")

    if component.distance_to_target_pixels > MAX_TARGET_COMPONENT_DISTANCE_PIXELS:
        raise InsufficientWaterError(
            "The nearest connected water feature is "
            f"{component.distance_to_target_pixels * 10:.0f} m from the requested coordinates "
            f"(maximum {MAX_TARGET_COMPONENT_DISTANCE_PIXELS * 10} m)."
        )

    if component.pixel_count < MIN_CONNECTED_WATER_PIXELS:
        raise InsufficientWaterError(
            f"Only {component.pixel_count} connected water pixels were found "
            f"(minimum {MIN_CONNECTED_WATER_PIXELS})."
        )

    if component.longest_span_pixels < MIN_CONNECTED_WATER_SPAN_PIXELS:
        raise InsufficientWaterError(
            f"The connected water feature spans only {component.longest_span_pixels * 10} m "
            f"(minimum {MIN_CONNECTED_WATER_SPAN_PIXELS * 10} m)."
        )

    return component


def compute_spectral_indices(signed_item, bbox: list[float]) -> SpectralIndices:
    """
    Download required Sentinel-2 band windows and compute spectral indices.

    Args:
        signed_item: A signed pystac Item with SAS-authenticated asset hrefs.
        bbox:        [lon_min, lat_min, lon_max, lat_max] in WGS84.

    Returns:
        SpectralIndices dataclass with computed values.

    Raises:
        BandDownloadError:    If any required band cannot be downloaded.
        InsufficientWaterError: If water pixel fraction is below threshold.
    """
    item_id = signed_item.id
    log.debug("Downloading bands for indices | item_id=%s bands=%s", item_id, REQUIRED_BANDS)

    bands: Dict[str, np.ndarray] = {}
    for band_name in REQUIRED_BANDS:
        if band_name not in signed_item.assets:
            raise BandDownloadError(
                f"Band '{band_name}' not found in STAC item '{item_id}'. "
                f"Available assets: {list(signed_item.assets.keys())}"
            )
        href = signed_item.assets[band_name].href
        log.debug("Downloading band %s | item_id=%s", band_name, item_id)
        bands[band_name] = _download_band_window(href, bbox)

    # Align all bands to the same shape (B05 is 20m, others 10m on S2)
    # Use B03 as reference shape; resize others if needed
    ref_shape = bands["B03"].shape
    for band_name in REQUIRED_BANDS:
        if bands[band_name].shape != ref_shape:
            from skimage.transform import resize as sk_resize
            bands[band_name] = sk_resize(
                bands[band_name], ref_shape,
                order=1, preserve_range=True, anti_aliasing=True
            ).astype(np.float32)
            log.debug("Resampled %s to %s", band_name, ref_shape)

    B03 = bands["B03"]
    B04 = bands["B04"]
    B05 = bands["B05"]
    B08 = bands["B08"]
    B11 = bands["B11"]

    total_pixels = B03.size
    valid_mask = np.isfinite(B03) & np.isfinite(B08) & np.isfinite(B11)
    valid_fraction = float(np.sum(valid_mask) / total_pixels) if total_pixels > 0 else 0.0

    # ── Water mask (MNDWI > threshold over valid pixels) ──────────────────────
    mndwi_full = _safe_index(B03, B11)
    candidate_water_mask = valid_mask & (mndwi_full > MNDWI_WATER_THRESHOLD)
    target_component = _require_usable_target_component(
        _select_target_water_component(candidate_water_mask)
    )
    water_mask = target_component.mask
    water_fraction = float(np.sum(water_mask) / total_pixels) if total_pixels > 0 else 0.0

    log.debug(
        "Pixel stats | item_id=%s total=%d valid=%.1f%% target_water=%.1f%% "
        "component_pixels=%d component_span=%dm target_distance=%dm",
        item_id, total_pixels, valid_fraction * 100, water_fraction * 100,
        target_component.pixel_count,
        target_component.longest_span_pixels * 10,
        target_component.distance_to_target_pixels * 10,
    )

    # ── Compute indices ────────────────────────────────────────────────────────

    ndwi_arr  = _safe_index(B03, B08)
    mndwi_arr = mndwi_full
    ndvi_arr  = _safe_index(B08, B04)
    ndci_arr  = _safe_index(B05, B04)

    with np.errstate(invalid="ignore", divide="ignore"):
        red_edge_ratio_arr  = np.where(B04 == 0, np.nan, B05 / B04)
        turbidity_index_arr = np.where(B03 == 0, np.nan, B04 / B03)

    ntr_arr = _safe_index(B04, B03)

    # FAI = B08 - (B04 + (B11 - B04) * ((842 - 665) / (1610 - 665)))
    fai_arr = B08 - (B04 + (B11 - B04) * (177.0 / 945.0))

    indices = SpectralIndices(
        ndwi                = _water_mean(ndwi_arr,           water_mask),
        mndwi               = _water_mean(mndwi_arr,          water_mask),
        ndvi                = _water_mean(ndvi_arr,           water_mask),
        ndci                = _water_mean(ndci_arr,           water_mask),
        red_edge_ratio      = _water_mean(red_edge_ratio_arr, water_mask),
        turbidity_index     = _water_mean(turbidity_index_arr, water_mask),
        ntr                 = _water_mean(ntr_arr,            water_mask),
        fai                 = _water_mean(fai_arr,            water_mask),
        water_pixel_fraction = water_fraction,
        valid_pixel_fraction = valid_fraction,
    )

    log.debug(
        "Indices computed | item_id=%s ndwi=%.3f mndwi=%.3f ndci=%.3f turbidity=%.3f fai=%.4f",
        item_id,
        indices.ndwi or 0,
        indices.mndwi or 0,
        indices.ndci or 0,
        indices.turbidity_index or 0,
        indices.fai or 0,
    )

    return indices
