import { useState } from "react";
import type { AnalysisMode } from "../types/Wateranalysisresponse";

const STORAGE_KEY = "aquaripple:analysisMode";
const DEFAULT_MODE: AnalysisMode = "rules";

function readStoredMode(): AnalysisMode {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === "ai" || stored === "rules" ? stored : DEFAULT_MODE;
    } catch {
        // localStorage unavailable (private browsing, etc.) — fall back to default
        return DEFAULT_MODE;
    }
}

// Persists the user's last chosen analysis mode across sessions via localStorage,
// defaulting to the free, rate-limit-free rules engine for anyone who hasn't chosen yet.
export function useAnalysisMode() {
    const [mode, setModeState] = useState<AnalysisMode>(readStoredMode);

    const setMode = (next: AnalysisMode) => {
        setModeState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // ignore — persistence is a nicety, not a requirement
        }
    };

    return [mode, setMode] as const;
}
