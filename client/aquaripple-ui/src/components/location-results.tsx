import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WaterAnalysisResponse } from "../types/Wateranalysisresponse";
import type { LocationAnalysisResponse } from "../types/LocationAnalysis";
import AnalysisCard from "./analysis-card";
import AnalysisModal from "./analysis-modal";
import { apiClient } from "../api/client";

// ── Fetch ─────────────────────────────────────────────────────────────────────

const fetchAnalysis = async (
    lat: number,
    lng: number,
    waterBodyName: string | null
): Promise<LocationAnalysisResponse> => {
    return apiClient.post<LocationAnalysisResponse>('/api/analysis/analyse', {
        latitude: lat,
        longitude: lng,
        waterBodyName: waterBodyName ?? undefined,
    });
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeLabel(datetime: string): string {
    const diffMs = Date.now() - new Date(datetime).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1)   return "Less than an hour ago";
    if (diffHours < 24)  return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    if (diffDays === 1)  return "Yesterday";
    return `${diffDays} days ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LocationResultsProps {
    clickedLocation: [number, number] | undefined;
    isWaterBody: boolean | undefined;
    waterName: string | null | undefined;
}

const LocationResults: React.FC<LocationResultsProps> = ({ clickedLocation, isWaterBody, waterName }) => {
    const [modalData, setModalData] = useState<WaterAnalysisResponse | null>(null);

    const { data, isFetching, isError } = useQuery({
        queryKey: ['analysis', clickedLocation, waterName],
        queryFn: () => fetchAnalysis(clickedLocation![0], clickedLocation![1], waterName ?? null),
        enabled: !!clickedLocation && isWaterBody === true,
    });

    if (!clickedLocation) return null;

    if (isWaterBody === false) {
        return (
            <div className="py-4 text-center">
                <p className="text-xs text-gray-400">Pin a location on a water body to see quality data.</p>
            </div>
        );
    }

    if (isWaterBody === undefined) return null;

    if (isFetching) {
        return (
            <div className="flex flex-col gap-2 py-3">
                <div className="flex items-center gap-2 text-sm text-aqua-dark">
                    <svg className="animate-spin h-4 w-4 text-aqua-brand shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Analysing satellite imagery…
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                    Fetching the clearest recent pass and running AI analysis. This can take up to 30 seconds.
                </p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-red-50 border border-red-200">
                <span className="text-red-500 text-sm">⚠</span>
                <p className="text-xs text-red-700">Analysis unavailable for this location.</p>
            </div>
        );
    }

    if (!data) return null;

    return (
        <>
            <div className="flex flex-col gap-3">

                {/* Current result */}
                <AnalysisCard
                    data={data.current}
                    waterName={waterName ?? null}
                    onClick={() => setModalData(data.current)}
                />

                {/* History */}
                {data.history.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold text-aqua-dark uppercase tracking-wider">
                            Recent History
                        </p>
                        {data.history.map((entry, i) => (
                            <AnalysisCard
                                key={entry.item_id ?? i}
                                data={entry}
                                waterName={waterName ?? null}
                                label={relativeLabel(entry.datetime)}
                                onClick={() => setModalData(entry)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Single modal instance driven by modalData */}
            {modalData && (
                <AnalysisModal
                    data={modalData}
                    waterName={waterName ?? null}
                    onClose={() => setModalData(null)}
                />
            )}
        </>
    );
};

export default LocationResults;