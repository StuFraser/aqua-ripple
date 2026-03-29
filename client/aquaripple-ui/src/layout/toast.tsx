import React, { useEffect, useState } from "react";

export type ToastState = "warming" | "done" | "hidden";

interface ToastProps {
    state: ToastState;
}

const Toast: React.FC<ToastProps> = ({ state }) => {
    const [visible, setVisible] = useState(false);
    const [phase, setPhase] = useState<"in" | "shown" | "out">("in");

    useEffect(() => {
        if (state === "hidden") {
            setVisible(false);
            setPhase("in");
            return;
        }
        setVisible(true);
        setPhase("in");

        // Trigger slide-in after mount
        const inTimer = requestAnimationFrame(() => setPhase("shown"));
        return () => cancelAnimationFrame(inTimer);
    }, [state]);

    // When done, hold briefly then slide out
    useEffect(() => {
        if (state !== "done") return;
        const timer = setTimeout(() => setPhase("out"), 1800);
        return () => clearTimeout(timer);
    }, [state]);

    // Hide after slide-out animation
    useEffect(() => {
        if (phase !== "out") return;
        const timer = setTimeout(() => setVisible(false), 350);
        return () => clearTimeout(timer);
    }, [phase]);

    if (!visible) return null;

    const isDone = state === "done";

    return (
        <div
            style={{
                position: "absolute",
                top: "0.625rem",
                left: "50%",
                transform: `translateX(-50%) translateY(${phase === "shown" ? "0" : "-110%"})`,
                transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                zIndex: 1000,
                pointerEvents: "none",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.4rem 0.875rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    background: isDone ? "rgba(26, 66, 138, 0.92)" : "rgba(0, 156, 222, 0.92)",
                    color: "#fff",
                    backdropFilter: "blur(6px)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
                    border: `1px solid ${isDone ? "rgba(102, 199, 197, 0.4)" : "rgba(255,255,255,0.25)"}`,
                }}
            >
                {isDone ? (
                    <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Cache warmed
                    </>
                ) : (
                    <>
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            style={{ animation: "spin 1s linear infinite" }}
                        >
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                        </svg>
                        Warming tile cache…
                    </>
                )}
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default Toast;