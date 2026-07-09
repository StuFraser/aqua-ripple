import React from "react";
import Badge from "./primitives/badge";

interface ModeBadgeProps {
    mode: string;
    fallback?: boolean;
}

// Surfaces which engine actually produced a result. When `fallback` is set, the
// caller requested AI but Groq was rate limited, so the rules engine stepped in —
// shown distinctly rather than as a deliberate AI result or a plain rules result.
// History can include records from before mode-tracking existed (or any other
// unrecognised value) — those render as "Unknown source" rather than guessing.
const ModeBadge: React.FC<ModeBadgeProps> = ({ mode, fallback }) => {
    if (fallback) {
        return <Badge variant="warning">Rule-based · AI unavailable</Badge>;
    }
    if (mode === "ai") {
        return <Badge variant="info">AI-assisted</Badge>;
    }
    if (mode === "rules") {
        return <Badge variant="water">Rule-based</Badge>;
    }
    return <Badge variant="neutral">Unknown source</Badge>;
};

export default ModeBadge;
