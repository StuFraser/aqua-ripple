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
    VERY_POOR = "very_poor" 


class ChlorophyllIndicator(BaseModel):
    level: QualityLevel
    confidence: float = Field(ge=0.0, le=1.0)


class TurbidityIndicator(BaseModel):
    level: QualityLevel
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


class ActivityStatus(BaseModel):
    status: Literal["safe", "caution", "unsafe"]
    reason: str


class FishingActivity(BaseModel):
    activity: ActivityStatus
    consumption: ActivityStatus


class BoatingActivity(BaseModel):
    safety: ActivityStatus
    biosecurity_advisory: bool
    biosecurity_reason: str


class ActivitySafety(BaseModel):
    swimming: ActivityStatus
    fishing: FishingActivity
    boating: BoatingActivity
    irrigation: ActivityStatus
    animal_watering: ActivityStatus


class WaterQualityResult(BaseModel):
    mode: Literal["ai", "indices"]
    item_id: str
    datetime: datetime
    indicators: WaterQualityIndicators
    activity_safety: ActivitySafety
    overall_quality: OverallQuality
