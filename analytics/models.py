# models.py
from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime
from enum import Enum

class QualityLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"

class ClarityLevel(str, Enum):
    CLEAR = "clear"
    MODERATE = "moderate"
    TURBID = "turbid"
    OPAQUE = "opaque"

class OverallQuality(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    CRITICAL = "critical"

class ChlorophyllIndicator(BaseModel):
    level: QualityLevel
    value: float = Field(description="Estimated µg/L")
    confidence: float = Field(ge=0.0, le=1.0)

class TurbidityIndicator(BaseModel):
    level: QualityLevel
    value: float = Field(description="Estimated NTU")
    confidence: float = Field(ge=0.0, le=1.0)

class AlgaeBloomIndicator(BaseModel):
    detected: bool
    severity: Literal["none", "minor", "moderate", "severe"]
    confidence: float = Field(ge=0.0, le=1.0)

class WaterClarityIndicator(BaseModel):
    level: ClarityLevel
    secchi_depth_estimate: float = Field(description="Estimated metres")
    confidence: float = Field(ge=0.0, le=1.0)

class CyanobacteriaIndicator(BaseModel):
    level: QualityLevel
    confidence: float = Field(ge=0.0, le=1.0)

class WaterQualityIndicators(BaseModel):
    chlorophyll_a: ChlorophyllIndicator
    turbidity: TurbidityIndicator
    algae_bloom: AlgaeBloomIndicator
    water_clarity: WaterClarityIndicator
    cyanobacteria_risk: CyanobacteriaIndicator

class ImageryMetadata(BaseModel):
    item_id: str
    collection: str
    datetime: datetime
    cloud_cover: float
    bbox: list[float]

class WaterQualityResult(BaseModel):
    status: Literal["success", "error"]
    mode: Literal["ai", "indices"]
    metadata: ImageryMetadata
    indicators: WaterQualityIndicators
    water_bodies_detected: bool
    overall_quality: OverallQuality
    overall_quality_score: int = Field(ge=0, le=100)
    summary: str
    concerns: list[str]
    confidence: float = Field(ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=datetime.now)


class LocationResult(BaseModel):
    is_water: bool
    name: str | None
    water_type: str | None
    description: str | None
    message: str | None
    latitude: float
    longitude: float