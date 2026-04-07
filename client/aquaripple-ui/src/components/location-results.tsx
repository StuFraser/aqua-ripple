import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WaterAnalysisResponse } from "../types/Wateranalysisresponse";
import type { LocationAnalysisResponse } from "../types/LocationAnalysis";
import AnalysisCard from "./analysis-card";
import AnalysisModal from "./analysis-modal";
import { apiClient, isApiError } from "../api/client";

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

// ── Error display ─────────────────────────────────────────────────────────────

function AnalysisError({ error }: { error: unknown }) {
    if (isApiError(error)) {
        if (error.errorCode === 'IMAGERY_NOT_FOUND') {
            return (
                <div className="flex flex-col gap-1.5 py-2 px-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-sm">🛰️</span>
                        <p className="text-xs font-semibold text-slate-700">No imagery available</p>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        No suitable satellite pass found for this location yet. Check back after the next Sentinel-2 overpass (every 5 days).
                    </p>
                </div>
            );
        }

        if (error.errorCode === 'INSUFFICIENT_WATER') {
            return (
                <div className="flex flex-col gap-1.5 py-2 px-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-sm">📍</span>
                        <p className="text-xs font-semibold text-slate-700">Pin not over open water</p>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Not enough water pixels detected at this location. Move the pin to the centre of the water body and try again.
                    </p>
                </div>
            );
        }

        if (error.errorCode === 'RATE_LIMITED' || error.errorCode === 'CONCURRENCY_LIMIT') {
            return (
                <div className="flex flex-col gap-1.5 py-2 px-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2">
                        <span className="text-amber-500 text-sm">⏳</span>
                        <p className="text-xs font-semibold text-amber-800">
                            {error.errorCode === 'CONCURRENCY_LIMIT'
                                ? 'Server busy'
                                : 'Too many requests'}
                        </p>
                    </div>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        {error.errorCode === 'CONCURRENCY_LIMIT'
                            ? 'The analysis service is handling the maximum number of requests. Please try again in a moment.'
                            : 'You\'ve sent too many analysis requests. Please wait a moment before trying again.'}
                    </p>
                </div>
            );
        }

        if (error.errorCode === 'UPSTREAM_RATE_LIMIT') {
            return (
                <div className="flex flex-col gap-1.5 py-2 px-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2">
                        <span className="text-amber-500 text-sm">⏳</span>
                        <p className="text-xs font-semibold text-amber-800">AI quota reached</p>
                    </div>
                    <p className="text-xs text-amber-700 leading-relaxed">
                        The AI analysis service is temporarily rate-limited. Please wait a moment and try again.
                    </p>
                </div>
            );
        }

        if (error.errorCode === 'CIRCUIT_OPEN') {
            return (
                <div className="flex flex-col gap-1.5 py-2 px-3 rounded-lg bg-orange-50 border border-orange-200">
                    <div className="flex items-center gap-2">
                        <span className="text-orange-500 text-sm">🔌</span>
                        <p className="text-xs font-semibold text-orange-800">Service temporarily paused</p>
                    </div>
                    <p className="text-xs text-orange-700 leading-relaxed">
                        The analysis service is recovering from repeated errors. Requests are paused briefly — please try again in 30 seconds.
                    </p>
                </div>
            );
        }

        if (error.errorCode === 'UPSTREAM_TIMEOUT') {
            return (
                <div className="flex flex-col gap-1.5 py-2 px-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2">
                        <span className="text-blue-500 text-sm">🕐</span>
                        <p className="text-xs font-semibold text-blue-800">Analysis timed out</p>
                    </div>
                    <p className="text-xs text-blue-700 leading-relaxed">
                        Satellite imagery retrieval took too long. This sometimes happens with larger water bodies — try again in a moment.
                    </p>
                </div>
            );
        }

        if (error.errorCode === 'UPSTREAM_SERVICE_ERROR' || error.errorCode === 'UPSTREAM_HTTP_ERROR') {
            return (
                <div className="flex flex-col gap-1.5 py-2 px-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex items-center gap-2">
                        <span className="text-red-500 text-sm">⚠</span>
                        <p className="text-xs font-semibold text-red-800">Analysis service unavailable</p>
                    </div>
                    <p className="text-xs text-red-700 leading-relaxed">
                        The satellite analytics service is temporarily unavailable. Please try again shortly.
                    </p>
                </div>
            );
        }
    }

    // Generic fallback
    return (
        <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-red-50 border border-red-200">
            <span className="text-red-500 text-sm">⚠</span>
            <p className="text-xs text-red-700">Analysis unavailable for this location.</p>
        </div>
    );
}

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

    const { data, isFetching, isError, error } = useQuery({
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
        return <AnalysisError error={error} />;
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