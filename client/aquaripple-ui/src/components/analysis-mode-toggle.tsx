import React from "react";
import type { AnalysisMode } from "../types/Wateranalysisresponse";

interface AnalysisModeToggleProps {
    mode: AnalysisMode;
    onChange: (mode: AnalysisMode) => void;
    // Hides the description line for tight spaces (e.g. the header bar) — the
    // full label + a title tooltip on each button still convey the meaning.
    compact?: boolean;
}

const OPTIONS: { value: AnalysisMode; label: string; description: string }[] = [
    { value: "rules", label: "Rule-based", description: "Deterministic spectral indices — instant, no limits" },
    { value: "ai", label: "AI-assisted", description: "Groq LLM interpretation — opt-in, rate limited" },
];

const AnalysisModeToggle: React.FC<AnalysisModeToggleProps> = ({ mode, onChange, compact = false }) => {
    const toggle = (
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 self-start shrink-0">
            {OPTIONS.map(opt => (
                <button
                    key={opt.value}
                    type="button"
                    title={opt.description}
                    onClick={() => onChange(opt.value)}
                    aria-pressed={mode === opt.value}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                        mode === opt.value
                            ? "bg-white text-aqua-brand shadow-sm"
                            : "text-gray-500 hover:text-aqua-dark"
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );

    if (compact) return toggle;

    return (
        <div className="flex flex-col gap-1.5">
            {toggle}
            <p className="text-xs text-gray-400">
                {OPTIONS.find(o => o.value === mode)?.description}
            </p>
        </div>
    );
};

export default AnalysisModeToggle;
