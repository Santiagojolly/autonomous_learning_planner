import { useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PipelineStepId = "architect" | "strategist" | "oracle";

export interface PipelineStep {
    id: PipelineStepId;
    label: string;
    shortLabel: string;
    icon: string;
    color: string;         // CSS colour string for SVG stroke
    glowColor: string;     // Tailwind shadow/bg class fragment
}

export interface PipelineDiagramProps {
    /** Which step is currently active (running). null = not started. */
    activeStep: PipelineStepId | null;
    /** Set of completed step IDs */
    completedSteps: Set<PipelineStepId>;
    /** Whether the entire pipeline has errored */
    hasError?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS: PipelineStep[] = [
    {
        id: "architect",
        label: "Roadmap Architect",
        shortLabel: "Architect",
        icon: "🗺️",
        color: "#818cf8",    // indigo-400
        glowColor: "indigo",
    },
    {
        id: "strategist",
        label: "Schedule Strategist",
        shortLabel: "Strategist",
        icon: "📅",
        color: "#22d3ee",    // cyan-400
        glowColor: "cyan",
    },
    {
        id: "oracle",
        label: "Progress Oracle",
        shortLabel: "Oracle",
        icon: "🔮",
        color: "#34d399",    // emerald-400
        glowColor: "emerald",
    },
];

// ── Animated SVG Arrow ────────────────────────────────────────────────────────

function AnimatedArrow({
    active,
    done,
    color,
}: {
    active: boolean;
    done: boolean;
    color: string;
}) {
    return (
        <div className="flex-1 flex items-center justify-center px-1 min-w-0 max-w-[80px] sm:max-w-none">
            <svg
                width="100%"
                height="24"
                viewBox="0 0 80 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full max-w-[80px]"
            >
                {/* Track line */}
                <line
                    x1="0"
                    y1="12"
                    x2="68"
                    y2="12"
                    stroke="#1e293b"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                />

                {/* Active data-flow line */}
                {(active || done) && (
                    <line
                        x1="0"
                        y1="12"
                        x2="68"
                        y2="12"
                        stroke={done ? color : color}
                        strokeWidth="2"
                        strokeDasharray="4 3"
                        strokeOpacity={done ? 1 : 0.8}
                        style={{
                            animation: active ? "dashFlow 0.8s linear infinite" : "none",
                            strokeDashoffset: active ? undefined : 0,
                        }}
                    />
                )}

                {/* Arrowhead */}
                <polygon
                    points="68,7 80,12 68,17"
                    fill={active || done ? color : "#1e293b"}
                    opacity={active || done ? 1 : 0.4}
                    style={{
                        transition: "fill 0.4s ease, opacity 0.4s ease",
                    }}
                />

                {/* Moving dot (only when active) */}
                {active && (
                    <circle r="3" fill={color} opacity="0.9">
                        <animateMotion
                            dur="0.9s"
                            repeatCount="indefinite"
                            path="M0,12 L68,12"
                        />
                    </circle>
                )}
            </svg>
        </div>
    );
}

// ── Step Node ─────────────────────────────────────────────────────────────────

function StepNode({
    step,
    isActive,
    isDone,
    hasError,
    index,
}: {
    step: PipelineStep;
    isActive: boolean;
    isDone: boolean;
    hasError: boolean;
    index: number;
}) {
    const borderColor = isDone
        ? step.color
        : isActive
            ? step.color
            : "#1e293b";
    const bgOpacity = isDone ? 0.18 : isActive ? 0.13 : 0.05;

    return (
        <div className="flex flex-col items-center gap-2 shrink-0">
            {/* Circle node */}
            <div
                className="relative flex items-center justify-center rounded-full transition-all duration-500"
                style={{
                    width: 64,
                    height: 64,
                    border: `2px solid ${borderColor}`,
                    background: `rgba(${step.glowColor === "indigo"
                            ? "99,102,241"
                            : step.glowColor === "cyan"
                                ? "6,182,212"
                                : "16,185,129"
                        },${bgOpacity})`,
                    boxShadow: (isActive || isDone)
                        ? `0 0 20px 4px rgba(${step.glowColor === "indigo"
                            ? "99,102,241"
                            : step.glowColor === "cyan"
                                ? "6,182,212"
                                : "16,185,129"
                        },0.25)`
                        : "none",
                    transform: isActive ? "scale(1.08)" : "scale(1)",
                }}
            >
                {/* Spinner ring when active */}
                {isActive && (
                    <div
                        className="absolute inset-[-4px] rounded-full border-2 border-transparent"
                        style={{
                            borderTopColor: step.color,
                            animation: "spin 1s linear infinite",
                        }}
                    />
                )}

                {/* Content */}
                {isDone && !hasError ? (
                    <span className="text-2xl" style={{ filter: "drop-shadow(0 0 6px currentColor)" }}>✅</span>
                ) : hasError && isActive ? (
                    <span className="text-2xl">❌</span>
                ) : (
                    <span className="text-2xl" style={{ animation: isActive ? "iconPulse 1s ease-in-out infinite alternate" : "none" }}>
                        {step.icon}
                    </span>
                )}

                {/* Step number badge */}
                <div
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ background: borderColor }}
                >
                    {index + 1}
                </div>
            </div>

            {/* Label */}
            <div className="text-center">
                <p
                    className="text-xs font-medium transition-colors duration-300"
                    style={{ color: isActive || isDone ? step.color : "#475569" }}
                >
                    {step.shortLabel}
                </p>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PipelineDiagram({
    activeStep,
    completedSteps,
    hasError = false,
}: PipelineDiagramProps) {
    const activeIndex = STEPS.findIndex((s) => s.id === activeStep);

    return (
        <div className="w-full rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">
                    Agent Pipeline Flow
                </p>
                {completedSteps.size === STEPS.length && (
                    <span className="text-xs text-emerald-400 font-medium animate-pulse">
                        ✅ Pipeline Complete
                    </span>
                )}
                {hasError && (
                    <span className="text-xs text-red-400 font-medium">
                        ❌ Pipeline Error
                    </span>
                )}
                {activeStep && !hasError && completedSteps.size < STEPS.length && (
                    <span className="text-xs text-slate-400 animate-pulse">
                        Running step {Math.min(activeIndex + 1, STEPS.length)} of {STEPS.length}…
                    </span>
                )}
            </div>

            {/* Diagram */}
            <div className="flex items-center justify-between gap-0">
                {STEPS.map((step, i) => {
                    const isActive = activeStep === step.id;
                    const isDone = completedSteps.has(step.id);
                    const prevDone = i === 0 || completedSteps.has(STEPS[i - 1].id);

                    return (
                        <div key={step.id} className="flex items-center flex-1 min-w-0">
                            <StepNode
                                step={step}
                                isActive={isActive}
                                isDone={isDone}
                                hasError={hasError}
                                index={i}
                            />

                            {/* Arrow between steps */}
                            {i < STEPS.length - 1 && (
                                <AnimatedArrow
                                    active={isActive}
                                    done={isDone}
                                    color={step.color}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Progress bar */}
            <div className="mt-6">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">Overall Progress</span>
                    <span className="text-xs text-slate-400">
                        {completedSteps.size}/{STEPS.length} agents
                    </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                            width: `${(completedSteps.size / STEPS.length) * 100}%`,
                            background:
                                "linear-gradient(90deg, #818cf8 0%, #22d3ee 50%, #34d399 100%)",
                            boxShadow: "0 0 8px rgba(99,102,241,0.5)",
                        }}
                    />
                </div>
            </div>

            {/* Inject keyframes */}
            <style>{`
        @keyframes dashFlow {
          to { stroke-dashoffset: -14; }
        }
        @keyframes iconPulse {
          from { transform: scale(1); }
          to   { transform: scale(1.15); }
        }
        @keyframes pulseRing {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
