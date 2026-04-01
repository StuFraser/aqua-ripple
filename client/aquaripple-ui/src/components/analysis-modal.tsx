import React, { useEffect } from "react";
import type { WaterAnalysisResponse, SafetyStatus, IndicatorLevel, ClarityLevel, BloomSeverity, OverallQuality } from "../types/Wateranalysisresponse";

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusColour(status: SafetyStatus) {
    return {
        safe: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
        caution: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400" },
        unsafe: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
    }[status];
}

function levelColour(level: IndicatorLevel | ClarityLevel) {
    const map: Record<string, string> = {
        low: "text-emerald-600", clear: "text-emerald-600",
        moderate: "text-amber-600",
        high: "text-orange-600", turbid: "text-orange-600",
        very_high: "text-red-600", opaque: "text-red-600",
    };
    return map[level] ?? "text-gray-600";
}

function qualityColour(q: OverallQuality) {
    return {
        excellent: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
        good: { text: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200" },
        fair: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
        poor: { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" },
        very_poor: { text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
    }[q];
}

function humanLabel(key: string): string {
    return {
        chlorophyll_a: "Chlorophyll-a",
        turbidity: "Turbidity",
        algae_bloom: "Algae Bloom",
        water_clarity: "Water Clarity",
        cyanobacteria_risk: "Cyanobacteria Risk",
        swimming: "Swimming",
        fishing: "Fishing",
        boating: "Boating",
        irrigation: "Irrigation",
        animal_watering: "Animal Watering",
    }[key] ?? key;
}

function bloomDisplay(severity: BloomSeverity): { label: string; colour: string } {
    return {
        none: { label: "None", colour: "text-emerald-600" },
        minor: { label: "Minor", colour: "text-amber-600" },
        moderate: { label: "Moderate", colour: "text-orange-600" },
        severe: { label: "Severe", colour: "text-red-600" },
    }[severity];
}

// ── Sub-components ───────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: SafetyStatus }> = ({ status }) => {
    const c = statusColour(status);
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-bold text-aqua-dark uppercase tracking-widest">{children}</h3>
        <div className="flex-1 h-px bg-gray-100" />
    </div>
);

const ActivityRow: React.FC<{ icon: string; label: string; status: SafetyStatus; reason: string }> = ({ icon, label, status, reason }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
        <span className="text-base shrink-0 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-sm font-semibold text-aqua-dark">{label}</span>
                <StatusPill status={status} />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{reason}</p>
        </div>
    </div>
);

const IndicatorRow: React.FC<{ icon: string; label: string; value: string; valueColour: string; detail?: string }> = ({ icon, label, value, valueColour, detail }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
        <span className="text-base shrink-0">{icon}</span>
        <span className="flex-1 text-sm text-gray-600">{label}</span>
        <div className="text-right">
            <span className={`text-sm font-bold capitalize ${valueColour}`}>{value.replace("_", " ")}</span>
            {detail && <p className="text-xs text-gray-400">{detail}</p>}
        </div>
    </div>
);

const HistoryRow: React.FC<{ entry: WaterAnalysisResponse }> = ({ entry }) => {
    const qc = qualityColour(entry.overall_quality);
    const date = new Date(entry.datetime).toLocaleDateString("en-NZ", {
        day: "numeric", month: "short", year: "numeric"
    });

    // Find the worst indicator to surface as a one-liner
    const worstIndicator = (() => {
        const { chlorophyll_a, turbidity, cyanobacteria_risk, algae_bloom } = entry.indicators;
        if (cyanobacteria_risk.level === "very_high" || cyanobacteria_risk.level === "high")
            return `Cyanobacteria ${cyanobacteria_risk.level.replace("_", " ")}`;
        if (algae_bloom.detected && algae_bloom.severity !== "none")
            return `Algae bloom ${algae_bloom.severity}`;
        if (chlorophyll_a.level === "very_high" || chlorophyll_a.level === "high")
            return `Chlorophyll-a ${chlorophyll_a.level.replace("_", " ")}`;
        if (turbidity.level === "very_high" || turbidity.level === "high")
            return `Turbidity ${turbidity.level.replace("_", " ")}`;
        return "No significant concerns";
    })();

    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-aqua-dark">{date}</p>
                <p className="text-xs text-gray-400 truncate">{worstIndicator}</p>
            </div>
            <div className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${qc.bg} ${qc.text} ${qc.border}`}>
                <span className="capitalize">{entry.overall_quality.replace("_", " ")}</span>
            </div>
        </div>
    );
};

// ── Main modal ───────────────────────────────────────────────────────────────

interface AnalysisModalProps {
    data: WaterAnalysisResponse;
    waterName: string | null;
    onClose: () => void;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ data, waterName, onClose }) => {
    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [onClose]);

    const { indicators, activity_safety, overall_quality } = data;
    const qc = qualityColour(overall_quality);
    const satelliteDate = new Date(data.datetime).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(26, 66, 138, 0.45)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="bg-aqua-dark px-5 py-4 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-0.5">Water Quality Analysis</p>
                            <h2 className="text-white font-bold text-base leading-snug">
                                {waterName ?? "Water Body"}
                            </h2>
                            <p className="text-white/50 text-xs mt-1">Satellite pass: {satelliteDate}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="shrink-0 mt-0.5 text-white/60 hover:text-white transition-colors"
                            aria-label="Close"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Overall quality pill */}
                    <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${qc.bg} ${qc.text} ${qc.border}`}>
                        <span>Overall quality:</span>
                        <span className="capitalize">{overall_quality.replace("_", " ")}</span>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-5">

                    {/* Indicators */}
                    <div>
                        <SectionHeading>Water Indicators</SectionHeading>
                        <IndicatorRow
                            icon="🌿" label={humanLabel("chlorophyll_a")}
                            value={indicators.chlorophyll_a.level}
                            valueColour={levelColour(indicators.chlorophyll_a.level)}
                        />
                        <IndicatorRow
                            icon="☁️" label={humanLabel("turbidity")}
                            value={indicators.turbidity.level}
                            valueColour={levelColour(indicators.turbidity.level)}
                        />
                        <IndicatorRow
                            icon="🌸" label={humanLabel("algae_bloom")}
                            value={indicators.algae_bloom.severity}
                            valueColour={bloomDisplay(indicators.algae_bloom.severity).colour}
                        />
                        <IndicatorRow
                            icon="👁️" label={humanLabel("water_clarity")}
                            value={indicators.water_clarity.level}
                            valueColour={levelColour(indicators.water_clarity.level)}
                            detail={`Secchi depth ~${indicators.water_clarity.secchi_depth_estimate.toFixed(1)} m`}
                        />
                        <IndicatorRow
                            icon="🦠" label={humanLabel("cyanobacteria_risk")}
                            value={indicators.cyanobacteria_risk.level}
                            valueColour={levelColour(indicators.cyanobacteria_risk.level)}
                        />
                    </div>

                    {/* Activity safety */}
                    <div>
                        <SectionHeading>Activity Safety</SectionHeading>
                        <ActivityRow icon="🏊" label="Swimming"
                            status={activity_safety.swimming.status}
                            reason={activity_safety.swimming.reason}
                        />
                        <ActivityRow icon="🎣" label="Fishing (activity)"
                            status={activity_safety.fishing.activity.status}
                            reason={activity_safety.fishing.activity.reason}
                        />
                        <ActivityRow icon="🍽️" label="Eating your catch"
                            status={activity_safety.fishing.consumption.status}
                            reason={activity_safety.fishing.consumption.reason}
                        />
                        <ActivityRow icon="⛵" label="Boating"
                            status={activity_safety.boating.safety.status}
                            reason={activity_safety.boating.safety.reason}
                        />
                        <ActivityRow icon="🌱" label="Irrigation"
                            status={activity_safety.irrigation.status}
                            reason={activity_safety.irrigation.reason}
                        />
                        <ActivityRow icon="🐄" label="Animal Watering"
                            status={activity_safety.animal_watering.status}
                            reason={activity_safety.animal_watering.reason}
                        />

                        {/* Biosecurity advisory */}
                        {activity_safety.boating.biosecurity_advisory && (
                            <div className="mt-3 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <span className="shrink-0">⚠️</span>
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    <span className="font-semibold">Biosecurity advisory: </span>
                                    {activity_safety.boating.biosecurity_reason}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer note */}
                    <p className="text-xs text-gray-400 leading-relaxed pb-1">
                        AI-generated from Sentinel-2 imagery. Not verified by environmental professionals — always check official advisories.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AnalysisModal;