import { useEffect, useRef, useState } from "react";
import { CheckCircle, AlertCircle, Loader2, Play, ChevronDown, ChevronUp, Clock, Cpu } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AgentStatus = "idle" | "running" | "complete" | "error";

export interface AgentCardProps {
    /** Unique name shown in the card header */
    name: string;
    /** Short role description */
    role: string;
    /** Emoji icon for the agent */
    icon: string;
    /** Accent colour class: "indigo" | "cyan" | "emerald" */
    accent: "indigo" | "cyan" | "emerald";
    /** Current run status */
    status: AgentStatus;
    /** ISO string of last successful run, or null */
    lastRun: string | null;
    /** Log lines streamed while running */
    logs: string[];
    /** Whether the Run button should be disabled */
    disabled?: boolean;
    /** Called when the user clicks Run */
    onRun: () => void;
    /** Optional: collapsed result card shown after completion */
    result?: React.ReactNode;
}

// ── Colour maps ───────────────────────────────────────────────────────────────

const ACCENT = {
    indigo: {
        border: "border-indigo-500/40",
        glow: "shadow-indigo-500/20",
        badge: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        btn: "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30",
        pulse: "bg-indigo-500",
        log: "text-indigo-300",
        iconBg: "bg-indigo-500/20",
        iconText: "text-indigo-400",
        dot: "bg-indigo-400",
    },
    cyan: {
        border: "border-cyan-500/40",
        glow: "shadow-cyan-500/20",
        badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
        btn: "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/30",
        pulse: "bg-cyan-500",
        log: "text-cyan-300",
        iconBg: "bg-cyan-500/20",
        iconText: "text-cyan-400",
        dot: "bg-cyan-400",
    },
    emerald: {
        border: "border-emerald-500/40",
        glow: "shadow-emerald-500/20",
        badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        btn: "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30",
        pulse: "bg-emerald-500",
        log: "text-emerald-300",
        iconBg: "bg-emerald-500/20",
        iconText: "text-emerald-400",
        dot: "bg-emerald-400",
    },
};

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusBadge({
    status,
    accent,
}: {
    status: AgentStatus;
    accent: keyof typeof ACCENT;
}) {
    const c = ACCENT[accent];
    if (status === "running") {
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border ${c.badge} animate-pulse`}>
                <span className={`h-1.5 w-1.5 rounded-full ${c.pulse}`} />
                Running…
            </span>
        );
    }
    if (status === "complete") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                <CheckCircle className="h-3 w-3" />
                Complete
            </span>
        );
    }
    if (status === "error") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border bg-red-500/20 text-red-300 border-red-500/30">
                <AlertCircle className="h-3 w-3" />
                Error
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border bg-slate-500/20 text-slate-400 border-slate-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Idle
        </span>
    );
}

// ── Log stream ────────────────────────────────────────────────────────────────

function LogStream({ logs, accent }: { logs: string[]; accent: keyof typeof ACCENT }) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    return (
        <div className="rounded-lg bg-black/40 border border-white/5 p-3 font-mono text-xs space-y-1 max-h-36 overflow-y-auto">
            {logs.length === 0 ? (
                <span className="text-slate-600">Waiting for agent output…</span>
            ) : (
                logs.map((line, i) => (
                    <div
                        key={i}
                        className={`${ACCENT[accent].log} leading-relaxed`}
                        style={{ animation: "fadeIn 0.3s ease-in" }}
                    >
                        <span className="text-slate-600 mr-2 select-none">›</span>
                        {line}
                    </div>
                ))
            )}
            <div ref={bottomRef} />
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AgentCard({
    name,
    role,
    icon,
    accent,
    status,
    lastRun,
    logs,
    disabled = false,
    onRun,
    result,
}: AgentCardProps) {
    const c = ACCENT[accent];
    const [showResult, setShowResult] = useState(false);

    const showLogs = status === "running" || (status === "complete" && logs.length > 0);

    const formattedLastRun = lastRun
        ? new Date(lastRun).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        })
        : null;

    return (
        <div
            className={`
        relative rounded-2xl border ${c.border}
        bg-white/[0.03] backdrop-blur-sm
        shadow-xl ${c.glow}
        transition-all duration-500
        ${status === "running" ? "scale-[1.01]" : ""}
        overflow-hidden
      `}
        >
            {/* Running shimmer overlay */}
            {status === "running" && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `linear-gradient(90deg, transparent 0%, ${accent === "indigo" ? "rgba(99,102,241,0.06)" : accent === "cyan" ? "rgba(6,182,212,0.06)" : "rgba(16,185,129,0.06)"} 50%, transparent 100%)`,
                        animation: "shimmer 1.8s ease-in-out infinite",
                        backgroundSize: "200% 100%",
                    }}
                />
            )}

            {/* Complete glow ring */}
            {status === "complete" && (
                <div
                    className={`absolute inset-0 rounded-2xl pointer-events-none border-2 ${c.border} opacity-60`}
                    style={{ animation: "pulseRing 2s ease-in-out 3" }}
                />
            )}

            <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`h-12 w-12 rounded-xl ${c.iconBg} flex items-center justify-center text-2xl shrink-0`}>
                            {icon}
                        </div>
                        <div>
                            <h3 className="font-semibold text-white text-sm leading-tight">{name}</h3>
                            <p className={`text-xs mt-0.5 ${c.iconText}`}>{role}</p>
                        </div>
                    </div>
                    <StatusBadge status={status} accent={accent} />
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formattedLastRun ? `Last run: ${formattedLastRun}` : "Never run"}
                    </span>
                    <span className="flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        Local AI
                    </span>
                </div>

                {/* Log stream (shown while running or after completion) */}
                {showLogs && <LogStream logs={logs} accent={accent} />}

                {/* Result section */}
                {status === "complete" && result && (
                    <div>
                        <button
                            onClick={() => setShowResult((v) => !v)}
                            className={`flex items-center gap-1.5 text-xs ${c.iconText} hover:opacity-80 transition-opacity`}
                        >
                            {showResult ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {showResult ? "Hide" : "View"} Output
                        </button>
                        {showResult && (
                            <div className="mt-3 rounded-xl bg-black/30 border border-white/5 p-3 text-xs text-slate-300 space-y-1.5">
                                {result}
                            </div>
                        )}
                    </div>
                )}

                {/* Run button */}
                <button
                    onClick={onRun}
                    disabled={disabled || status === "running"}
                    className={`
            w-full flex items-center justify-center gap-2
            px-4 py-2.5 rounded-xl text-sm font-medium text-white
            ${c.btn} shadow-lg
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-200
            active:scale-95
          `}
                >
                    {status === "running" ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Running…
                        </>
                    ) : (
                        <>
                            <Play className="h-4 w-4" />
                            Run {name}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
