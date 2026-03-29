export type IndicatorLevel = "low" | "moderate" | "high" | "very_high";
export type ClarityLevel = "clear" | "moderate" | "turbid" | "opaque";
export type BloomSeverity = "none" | "minor" | "moderate" | "severe";
export type SafetyStatus = "safe" | "caution" | "unsafe";
export type OverallQuality = "excellent" | "good" | "fair" | "poor" | "very_poor";

export interface SafetyResult {
    status: SafetyStatus;
    reason: string;
}

export interface WaterAnalysisResponse {
    mode: "ai";
    item_id: string;
    datetime: string;
    overall_quality: OverallQuality;
    indicators: {
        chlorophyll_a: { level: IndicatorLevel; confidence: number };
        turbidity: { level: IndicatorLevel; confidence: number };
        algae_bloom: { detected: boolean; severity: BloomSeverity; confidence: number };
        water_clarity: { level: ClarityLevel; secchi_depth_estimate: number; confidence: number };
        cyanobacteria_risk: { level: IndicatorLevel; confidence: number };
    };
    activity_safety: {
        swimming: SafetyResult;
        fishing: {
            activity: SafetyResult;
            consumption: SafetyResult;
        };
        boating: {
            safety: SafetyResult;
            biosecurity_advisory: boolean;
            biosecurity_reason: string;
        };
        irrigation: SafetyResult;
        animal_watering: SafetyResult;
    };
}