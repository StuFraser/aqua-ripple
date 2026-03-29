import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WaterAnalysisResponse, SafetyStatus, OverallQuality } from "../types/Wateranalysisresponse";
import AnalysisModal from "./analysis-modal";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// ── Fetch ────────────────────────────────────────────────────────────────────

const fetchAnalysis = async (lat: number, lng: number): Promise<WaterAnalysisResponse> => {
    const response = await fetch(`${API_BASE}/api/analysis/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
    if (!response.ok) throw new Error('Analysis failed');
    return response.json();
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function worstStatus(data: WaterAnalysisResponse): SafetyStatus {
    const statuses: SafetyStatus[] = [
        data.activity_safety.swimming.status,
        data.activity_safety.fishing.activity.status,
        data.activity_safety.fishing.consumption.status,
        data.activity_safety.boating.safety.status,
        data.activity_safety.irrigation.status,
        data.activity_safety.animal_watering.status,
    ];
    if (statuses.includes("unsafe"))  return "unsafe";
    if (statuses.includes("caution")) return "caution";
    return "safe";
}

function warningActivities(data: WaterAnalysisResponse): string[] {
    const warnings: string[] = [];
    if (data.activity_safety.swimming.status !== "safe")             warnings.push("Swimming");
    if (data.activity_safety.fishing.activity.status !== "safe")     warnings.push("Fishing");
    if (data.activity_safety.fishing.consumption.status !== "safe")  warnings.push("Eating catch");
    if (data.activity_safety.boating.safety.status !== "safe")       warnings.push("Boating");
    if (data.activity_safety.irrigation.status !== "safe")           warnings.push("Irrigation");
    if (data.activity_safety.animal_watering.status !== "safe")      warnings.push("Animal watering");
    return warnings;
}

const qualityConfig: Record<OverallQuality, { label: string; colour: string; bg: string; border: string }> = {
    excellent: { label: "Excellent",  colour: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
    good:      { label: "Good",       colour: "text-teal-700",    bg: "bg-teal-50",     border: "border-teal-200"    },
    fair:      { label: "Fair",       colour: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200"   },
    poor:      { label: "Poor",       colour: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200"  },
    very_poor: { label: "Very Poor",  colour: "text-red-700",     bg: "bg-red-50",      border: "border-red-200"     },
};

const statusConfig: Record<SafetyStatus, { icon: string; label: string; colour: string; bg: string; border: string }> = {
    safe:    { icon: "✓", label: "All activities safe",    colour: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
    caution: { icon: "⚠", label: "Some caution advised",  colour: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200"   },
    unsafe:  { icon: "✕", label: "Some activities unsafe", colour: "text-red-700",     bg: "bg-red-50",      border: "border-red-200"     },
};

// ── Result card ───────────────────────────────────────────────────────────────

interface AnalysisCardProps {
    data: WaterAnalysisResponse;
    waterName: string | null;
    onClick: () => void;
}

const AnalysisCard: React.FC<AnalysisCardProps> = ({ data, waterName, onClick }) => {
    const worst = worstStatus(data);
    const warnings = warningActivities(data);
    const sc = statusConfig[worst];
    const qc = qualityConfig[data.overall_quality];
    const satelliteDate = new Date(data.datetime).toLocaleDateString("en-NZ", {
        day: "numeric", month: "short", year: "numeric"
    });

    return (
        <button
            onClick={onClick}
            className="w-full text-left rounded-xl border border-gray-100 bg-white hover:border-aqua-brand/40 hover:shadow-md transition-all duration-200 overflow-hidden group"
        >
            {/* Card header bar */}
            <div className={`px-4 py-2.5 flex items-center justify-between gap-2 border-b ${qc.bg} ${qc.border} border-b`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${qc.colour}`}>
                    {qc.label} quality
                </span>
                <span className="text-xs text-gray-400">
                    {satelliteDate}
                </span>
            </div>

            {/* Card body */}
            <div className="px-4 py-3 flex flex-col gap-2.5">

                {/* Activity safety summary */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${sc.bg} ${sc.border}`}>
                    <span className={`text-sm font-bold ${sc.colour}`}>{sc.icon}</span>
                    <span className={`text-xs font-semibold ${sc.colour}`}>{sc.label}</span>
                </div>

                {/* Warning list when not all safe */}
                {warnings.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {warnings.map(w => (
                            <span key={w} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                                {w}
                            </span>
                        ))}
                    </div>
                )}

                {/* Quick indicator glance */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-0.5">
                    <span>Tap for full results</span>
                    <svg className="h-3.5 w-3.5 text-aqua-brand/60 group-hover:text-aqua-brand transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </div>
        </button>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

interface LocationResultsProps {
    clickedLocation: [number, number] | undefined;
    isWaterBody: boolean | undefined;
    waterName: string | null | undefined;
}

const LocationResults: React.FC<LocationResultsProps> = ({ clickedLocation, isWaterBody, waterName }) => {
    const [modalOpen, setModalOpen] = useState(false);

    const { data, isFetching, isError } = useQuery({
        queryKey: ['analysis', clickedLocation],
        queryFn: () => fetchAnalysis(clickedLocation![0], clickedLocation![1]),
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
            <AnalysisCard
                data={data}
                waterName={waterName ?? null}
                onClick={() => setModalOpen(true)}
            />

            {modalOpen && (
                <AnalysisModal
                    data={data}
                    waterName={waterName ?? null}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
};

export default LocationResults;