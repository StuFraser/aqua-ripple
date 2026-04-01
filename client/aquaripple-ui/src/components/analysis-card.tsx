import React from "react";
import type { WaterAnalysisResponse, SafetyStatus, OverallQuality } from "../types/Wateranalysisresponse";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    if (data.activity_safety.swimming.status !== "safe")            warnings.push("Swimming");
    if (data.activity_safety.fishing.activity.status !== "safe")    warnings.push("Fishing");
    if (data.activity_safety.fishing.consumption.status !== "safe") warnings.push("Eating catch");
    if (data.activity_safety.boating.safety.status !== "safe")      warnings.push("Boating");
    if (data.activity_safety.irrigation.status !== "safe")          warnings.push("Irrigation");
    if (data.activity_safety.animal_watering.status !== "safe")     warnings.push("Animal watering");
    return warnings;
}

// ── Config ────────────────────────────────────────────────────────────────────

const qualityConfig: Record<OverallQuality, { label: string; colour: string; bg: string; border: string }> = {
    excellent: { label: "Excellent", colour: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    good:      { label: "Good",      colour: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200"    },
    fair:      { label: "Fair",      colour: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200"   },
    poor:      { label: "Poor",      colour: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200"  },
    very_poor: { label: "Very Poor", colour: "text-red-700",     bg: "bg-red-50",     border: "border-red-200"     },
};

const statusConfig: Record<SafetyStatus, { icon: string; label: string; colour: string; bg: string; border: string }> = {
    safe:    { icon: "✓", label: "All activities safe",    colour: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
    caution: { icon: "⚠", label: "Some caution advised",  colour: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200"   },
    unsafe:  { icon: "✕", label: "Some activities unsafe", colour: "text-red-700",     bg: "bg-red-50",     border: "border-red-200"     },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface AnalysisCardProps {
    data: WaterAnalysisResponse;
    waterName: string | null;
    label?: string;
    onClick: () => void;
}

const AnalysisCard: React.FC<AnalysisCardProps> = ({ data, waterName, label, onClick }) => {
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
                <div className="flex items-center gap-2">
                    {label && (
                        <span className="text-xs font-medium text-gray-400">{label}</span>
                    )}
                    <span className={`text-xs font-bold uppercase tracking-wider ${qc.colour}`}>
                        {qc.label} quality
                    </span>
                </div>
                <span className="text-xs text-gray-400">{satelliteDate}</span>
            </div>

            {/* Card body */}
            <div className="px-4 py-3 flex flex-col gap-2.5">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${sc.bg} ${sc.border}`}>
                    <span className={`text-sm font-bold ${sc.colour}`}>{sc.icon}</span>
                    <span className={`text-xs font-semibold ${sc.colour}`}>{sc.label}</span>
                </div>

                {warnings.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {warnings.map(w => (
                            <span key={w} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                                {w}
                            </span>
                        ))}
                    </div>
                )}

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

export default AnalysisCard;