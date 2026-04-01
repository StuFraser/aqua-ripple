// src/types/LocationAnalysisResponse.ts
import type { WaterAnalysisResponse } from './Wateranalysisresponse';

export interface LocationAnalysisResponse {
    current: WaterAnalysisResponse;
    history: WaterAnalysisResponse[];
}