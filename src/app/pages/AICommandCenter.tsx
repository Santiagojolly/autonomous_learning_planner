import { useState, useCallback, useRef, useEffect } from "react";
import {
    Cpu,
    Play,
    Zap,
    AlertCircle,
    ChevronRight,
    BookOpen,
    CalendarDays,
    TrendingUp,
    Clock,
    Hash,
    Layers,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { API, type PipelineParams } from "../lib/api";
import { AgentCard, type AgentStatus } from "../components/AgentCard";
import { PipelineDiagram, type PipelineStepId } from "../components/PipelineDiagram";

// ── Agent definitions ─────────────────────────────────────────────────────────

const AGENTS = [
    {
        id: "architect" as PipelineStepId,
        name: "Roadmap Architect",
        role: "Study plan builder",
        icon: "🗺️",
        accent: "indigo" as const,
        description: "Analyzes your subject, skill level, and goals to generate a structured 4-phase learning roadmap with difficulty-scored topics and curated free resources.",
    },
    {
        id: "strategist" as PipelineStepId,
        name: "Schedule Strategist",
        role: "Smart calendar scheduler",
        icon: "📅",
        accent: "cyan" as const,
        description: "Converts the roadmap into a spaced-repetition calendar. Schedules study, review, and practice sessions around your available time and blocked dates.",
    },
    {
        id: "oracle" as PipelineStepId,
        name: "Progress Oracle",
        role: "Tracker & report generator",
        icon: "🔮",
        accent: "emerald" as const,
        description: "Monitors your progress, calculates mastery scores, generates weekly AI reports, checks for achievements, and triggers adaptive reschedules when needed.",
    },
];

// ── Pipeline form fields ───────────────────────────────────────────────────────

interface PipelineForm {
    subject: string;
    level: "beginner" | "intermediate" | "advanced";
    dailyHours: number;
    timeframeWeeks: number;
    additionalContext: string;
}

const DEFAULT_FORM: PipelineForm = {
    subject: "",
    level: "beginner",
    dailyHours: 2,
    timeframeWeeks: 8,
    additionalContext: "",
};

// ── Agent state ───────────────────────────────────────────────────────────────

interface AgentState {
    status: AgentStatus;
    lastRun: string | null;
    logs: string[];
    result: any;
}

const DEFAULT_AGENT_STATE: AgentState = {
    status: "idle",
    lastRun: null,
    logs: [],
    result: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ResultSummary({ result, agentId }: { result: any; agentId: PipelineStepId }) {
    if (!result) return null;

    if (agentId === "architect" && result.phases) {
        return (
            <>
                <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-indigo-300 font-medium">{result.phases.length} phases generated</span>
                </div>
                {result.phases.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-slate-400">
                        <span>{p.name}</span>
                        <span className="text-slate-500">{p.weekRange} · {p.topics?.length} topics · {p.totalHours}h</span>
                    </div>
                ))}
                <div className="flex items-center gap-2 text-slate-500 pt-1">
                    <Hash className="h-3 w-3" />
                    <span>Total: {result.totalHours}h over {result.totalWeeks} weeks</span>
                </div>
            </>
        );
    }

    if (agentId === "strategist" && result.events) {
        const byType = result.events.reduce((acc: any, e: any) => {
            acc[e.sessionType] = (acc[e.sessionType] ?? 0) + 1;
            return acc;
        }, {});
        return (
            <>
                <div className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="text-cyan-300 font-medium">{result.events.length} sessions scheduled</span>
                </div>
                {Object.entries(byType).map(([type, count]: any) => (
                    <div key={type} className="flex items-center justify-between text-slate-400">
                        <span>{type}</span>
                        <span>{count} sessions</span>
                    </div>
                ))}
                {result.stats && (
                    <>
                        <div className="flex items-center gap-2 text-slate-500 pt-1">
                            <Clock className="h-3 w-3" />
                            <span>{result.stats.totalStudyHours}h total study time</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                            <ChevronRight className="h-3 w-3" />
                            <span>Est. completion: {result.stats.estimatedEndDate}</span>
                        </div>
                    </>
                )}
            </>
        );
    }

    if (agentId === "oracle" && result.weekNumber !== undefined) {
        return (
            <>
                <div className="flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-300 font-medium">Week {result.weekNumber} report generated</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                    <span>Current streak</span>
                    <span>🔥 {result.streakDays} days</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                    <span>Total XP earned</span>
                    <span>⚡ {result.overallXP} XP</span>
                </div>
                <div className="text-slate-400 mt-1 italic text-[11px] leading-relaxed">
                    "{result.recommendation}"
                </div>
            </>
        );
    }

    return (
        <span className="text-slate-500 italic">Agent output ready</span>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function AICommandCenter() {
    const navigate = useNavigate();
    const [form, setForm] = useState<PipelineForm>(DEFAULT_FORM);
    const [formError, setFormError] = useState("");

    const [agentStates, setAgentStates] = useState<Record<PipelineStepId, AgentState>>({
        architect: { ...DEFAULT_AGENT_STATE },
        strategist: { ...DEFAULT_AGENT_STATE },
        oracle: { ...DEFAULT_AGENT_STATE },
    });

    const [pipelineActive, setPipelineActive] = useState(false);
    const [activePipelineStep, setActivePipelineStep] = useState<PipelineStepId | null>(null);
    const [completedPipelineSteps, setCompletedPipelineSteps] = useState<Set<PipelineStepId>>(new Set());
    const [pipelineError, setPipelineError] = useState(false);
    const [pipelineResult, setPipelineResult] = useState<any>(null);

    const logTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Push a log line to an agent with a slight delay for typewriter effect */
    const pushLog = useCallback(
        (agentId: PipelineStepId, line: string, delay = 0) => {
            setTimeout(() => {
                setAgentStates((prev) => ({
                    ...prev,
                    [agentId]: {
                        ...prev[agentId],
                        logs: [...prev[agentId].logs, line],
                    },
                }));
            }, delay);
        },
        []
    );

    const setAgentStatus = useCallback(
        (agentId: PipelineStepId, status: AgentStatus, extra: Partial<AgentState> = {}) => {
            setAgentStates((prev) => ({
                ...prev,
                [agentId]: { ...prev[agentId], status, ...extra },
            }));
        },
        []
    );

    // ── Form validation ────────────────────────────────────────────────────────

    function validateForm(): boolean {
        if (!form.subject.trim()) {
            setFormError("Subject is required");
            return false;
        }
        if (form.dailyHours < 0.5 || form.dailyHours > 12) {
            setFormError("Daily hours must be between 0.5 and 12");
            return false;
        }
        if (form.timeframeWeeks < 1 || form.timeframeWeeks > 52) {
            setFormError("Timeframe must be 1–52 weeks");
            return false;
        }
        setFormError("");
        return true;
    }

    // ── Individual agent runners ───────────────────────────────────────────────

    async function runArchitect() {
        if (!validateForm()) return;
        setAgentStatus("architect", "running", { logs: [] });
        pushLog("architect", "Initialising Roadmap Architect…", 0);
        pushLog("architect", `Subject: "${form.subject}" · Level: ${form.level}`, 200);
        pushLog("architect", `Daily hours: ${form.dailyHours}h · Timeframe: ${form.timeframeWeeks} weeks`, 400);
        pushLog("architect", "Checking Ollama availability…", 700);

        try {
            const res = await API.runRoadmapArchitect({
                subject: form.subject,
                level: form.level,
                dailyHours: form.dailyHours,
                timeframeWeeks: form.timeframeWeeks,
                additionalContext: form.additionalContext,
            });

            const ollama = res.meta.usedOllama ? "✅ Ollama (llama3)" : "⚡ Smart Mock";
            pushLog("architect", `Engine: ${ollama}`, 300);
            pushLog("architect", `Generated ${res.roadmap.phases.length} phases across ${res.roadmap.totalHours}h`, 500);
            res.roadmap.phases.forEach((p: any, i: number) => {
                pushLog("architect", `Phase ${i + 1}: ${p.name}`, 600 + i * 50);
            });
            pushLog("architect", `✅ Roadmap saved (${res.meta.durationMs}ms)`, 700 + res.roadmap.phases.length * 50);

            setTimeout(() => {
                setAgentStatus("architect", "complete", {
                    lastRun: res.meta.ranAt,
                    result: res.roadmap,
                });
                toast.success("Roadmap Architect complete!", { description: `${res.roadmap.phases.length} phases created` });
            }, 800 + res.roadmap.phases.length * 50);
        } catch (err: any) {
            pushLog("architect", `❌ Error: ${err.message}`);
            setAgentStatus("architect", "error");
            toast.error("Roadmap Architect failed", { description: err.message });
        }
    }

    async function runStrategist() {
        setAgentStatus("strategist", "running", { logs: [] });
        pushLog("strategist", "Initialising Schedule Strategist…", 0);
        pushLog("strategist", "Loading roadmap from server…", 200);
        pushLog("strategist", "Applying spaced repetition logic…", 500);
        pushLog("strategist", "Scheduling review sessions every 3 study blocks…", 800);

        try {
            const res = await API.runScheduleStrategist();

            const ollama = res.meta.usedOllama ? "✅ Ollama" : "⚡ Smart Scheduler";
            pushLog("strategist", `Engine: ${ollama}`, 1000);
            pushLog("strategist", `Total sessions: ${res.events.length}`, 1200);
            pushLog("strategist", `Study: ${res.stats.totalStudyHours}h · Reviews: ${res.stats.totalReviewSessions}`, 1400);
            pushLog("strategist", `Est. completion: ${res.stats.estimatedEndDate}`, 1600);
            pushLog("strategist", `✅ Calendar saved (${res.meta.durationMs}ms)`, 1800);

            setTimeout(() => {
                setAgentStatus("strategist", "complete", {
                    lastRun: res.meta.ranAt,
                    result: { events: res.events, stats: res.stats },
                });
                toast.success("Schedule Strategist complete!", {
                    description: `${res.events.length} sessions scheduled`,
                });
            }, 1900);
        } catch (err: any) {
            pushLog("strategist", `❌ Error: ${err.message}`);
            setAgentStatus("strategist", "error");
            toast.error("Schedule Strategist failed", { description: err.message });
        }
    }

    async function runOracle() {
        setAgentStatus("oracle", "running", { logs: [] });
        pushLog("oracle", "Initialising Progress Oracle…", 0);
        pushLog("oracle", "Loading calendar events & roadmap…", 200);
        pushLog("oracle", "Calculating mastery scores…", 500);
        pushLog("oracle", "Checking achievement conditions…", 800);
        pushLog("oracle", "Generating AI progress summary…", 1100);

        try {
            const res = await API.runProgressOracle({ action: "initial-report" });

            const ollama = res.meta.usedOllama ? "✅ Ollama summary" : "⚡ Smart report";
            pushLog("oracle", `Engine: ${ollama}`, 1300);
            pushLog("oracle", `Streak: 🔥 ${res.report?.streakDays ?? 0} days`, 1500);
            pushLog("oracle", `XP: ⚡ ${res.report?.overallXP ?? 0}`, 1700);
            if (res.achievements?.length) {
                pushLog("oracle", `🏆 ${res.achievements.length} new achievement(s) unlocked!`, 1900);
            }
            pushLog("oracle", `✅ Report saved (${res.meta.durationMs}ms)`, 2000);

            setTimeout(() => {
                setAgentStatus("oracle", "complete", {
                    lastRun: res.meta.ranAt,
                    result: res.report,
                });
                toast.success("Progress Oracle complete!", {
                    description: res.achievements?.length
                        ? `${res.achievements.length} achievement(s) unlocked 🏆`
                        : "Weekly report generated",
                });
                if (res.achievements?.length) {
                    res.achievements.forEach((a: any) => {
                        setTimeout(() => {
                            toast.success(`Achievement Unlocked! ${a.icon} ${a.title}`, {
                                description: `+${a.xpBonus} XP · ${a.description}`,
                            });
                        }, 600);
                    });
                }
            }, 2100);
        } catch (err: any) {
            pushLog("oracle", `❌ Error: ${err.message}`);
            setAgentStatus("oracle", "error");
            toast.error("Progress Oracle failed", { description: err.message });
        }
    }

    // ── Full pipeline ──────────────────────────────────────────────────────────

    async function runFullPipeline() {
        if (!validateForm()) return;

        setPipelineActive(true);
        setPipelineError(false);
        setPipelineResult(null);
        setCompletedPipelineSteps(new Set());

        // Reset all agents
        setAgentStates({
            architect: { status: "running", lastRun: null, logs: [], result: null },
            strategist: { status: "idle", lastRun: null, logs: [], result: null },
            oracle: { status: "idle", lastRun: null, logs: [], result: null },
        });

        const params: PipelineParams = {
            subject: form.subject,
            level: form.level,
            dailyHours: form.dailyHours,
            timeframeWeeks: form.timeframeWeeks,
            additionalContext: form.additionalContext,
        };

        try {
            // ── Step 1: Architect ─────────────────────────────────────────────────
            setActivePipelineStep("architect");
            pushLog("architect", "Initialising Roadmap Architect…", 0);
            pushLog("architect", `Subject: "${params.subject}" · Level: ${params.level}`, 200);
            pushLog("architect", "Generating phased roadmap…", 500);

            const roadmapRes = await API.runRoadmapArchitect(params);
            const r1engine = roadmapRes.meta.usedOllama ? "Ollama llama3" : "Smart Mock";
            pushLog("architect", `[${r1engine}] ${roadmapRes.roadmap.phases.length} phases · ${roadmapRes.roadmap.totalHours}h`, 700);
            pushLog("architect", `✅ Done in ${roadmapRes.meta.durationMs}ms`, 900);

            setAgentStatus("architect", "complete", { lastRun: roadmapRes.meta.ranAt, result: roadmapRes.roadmap });
            setCompletedPipelineSteps((prev) => new Set([...prev, "architect"]));
            toast.success("Agent 1 complete", { description: "Roadmap generated ✅" });

            // ── Step 2: Strategist ────────────────────────────────────────────────
            setActivePipelineStep("strategist");
            setAgentStatus("strategist", "running", { logs: [] });
            await new Promise((r) => setTimeout(r, 200)); 

            pushLog("strategist", "Roadmap received from Agent 1 ✅", 0);
            pushLog("strategist", "Applying spaced-repetition algorithm…", 100);
            pushLog("strategist", "Scheduling study · review · practice sessions…", 250);

            const scheduleRes = await API.runScheduleStrategist();
            const r2engine = scheduleRes.meta.usedOllama ? "Ollama" : "Smart Scheduler";
            pushLog("strategist", `[${r2engine}] ${scheduleRes.events.length} sessions`, 400);
            pushLog("strategist", `✅ Done in ${scheduleRes.meta.durationMs}ms`, 500);

            setAgentStatus("strategist", "complete", {
                lastRun: scheduleRes.meta.ranAt,
                result: { events: scheduleRes.events, stats: scheduleRes.stats },
            });
            setCompletedPipelineSteps((prev) => new Set([...prev, "strategist"]));
            toast.success("Agent 2 complete");

            // ── Step 3: Oracle ────────────────────────────────────────────────────
            setActivePipelineStep("oracle");
            setAgentStatus("oracle", "running", { logs: [] });
            await new Promise((r) => setTimeout(r, 200));

            pushLog("oracle", "Calendar received from Agent 2 ✅", 0);
            pushLog("oracle", "Calculating mastery & streak…", 100);
            pushLog("oracle", "Running achievement checks…", 200);
            pushLog("oracle", "Generating AI weekly summary…", 300);

            const oracleRes = await API.runProgressOracle({ action: "initial-report" });
            const r3engine = oracleRes.meta.usedOllama ? "Ollama" : "Smart Oracle";
            pushLog("oracle", `[${r3engine}] Streak: 🔥${oracleRes.report?.streakDays} · XP: ⚡${oracleRes.report?.overallXP}`, 1000);
            pushLog("oracle", `✅ Done in ${oracleRes.meta.durationMs}ms`, 1200);

            setAgentStatus("oracle", "complete", {
                lastRun: oracleRes.meta.ranAt,
                result: oracleRes.report,
            });
            setCompletedPipelineSteps(new Set(["architect", "strategist", "oracle"]));
            setActivePipelineStep(null);

            // Achievements
            if (oracleRes.achievements?.length) {
                oracleRes.achievements.forEach((a: any, i: number) => {
                    setTimeout(() => {
                        toast.success(`🏆 Achievement Unlocked: ${a.title}`, {
                            description: `${a.icon} ${a.description} · +${a.xpBonus} XP`,
                        });
                    }, i * 800);
                });
            }

            toast.success("🚀 Full Pipeline Complete!", {
                description: "Roadmap · Schedule · Report all generated. Navigate to Calendar or Insights to explore.",
                duration: 6000,
            });

            setPipelineResult({
                roadmap: roadmapRes.roadmap,
                events: scheduleRes.events,
                stats: scheduleRes.stats,
                report: oracleRes.report,
                achievements: oracleRes.achievements,
            });
        } catch (err: any) {
            setPipelineError(true);
            setActivePipelineStep(null);
            toast.error("Pipeline failed", { description: err.message });
        } finally {
            setPipelineActive(false);
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div
            className="min-h-screen pb-24 lg:pb-8"
            style={{
                background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 60%), #0a0f1e",
            }}
        >
            {/* ── Header ── */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center border border-white/10"
                        style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)", boxShadow: "0 0 30px rgba(99,102,241,0.3)" }}
                    >
                        <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center relative">
                            <div className="w-2 h-2 bg-white rounded-sm rotate-45 animate-pulse" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold text-white tracking-tighter">
                            HALO Command Center
                        </h1>
                        <p className="text-slate-400 text-base mt-0.5">
                            Orchestrate the <span className="text-white font-medium italic">Trinity of Intelligence</span> to automate your study universe.
                        </p>
                    </div>
                </div>

                {/* Status chips */}
                <div className="flex flex-wrap gap-2 mt-4">
                    <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Ollama · localhost:11434
                    </span>
                    <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                        3 agents ready
                    </span>
                    <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        No API keys required
                    </span>
                </div>
            </div>

            {/* ── Configuration form ── */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="h-4 w-4 text-indigo-400" />
                    <h2 className="text-sm font-semibold text-white">Study Plan Configuration</h2>
                    <span className="text-xs text-slate-500 ml-auto">Required for Roadmap Architect & Pipeline</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Subject */}
                    <div className="sm:col-span-2 lg:col-span-1">
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">Subject / Topic</label>
                        <input
                            id="subject-input"
                            type="text"
                            value={form.subject}
                            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                            placeholder="e.g. Machine Learning, Python, Physics…"
                            className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-white/8 transition-all"
                        />
                    </div>

                    {/* Level */}
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">Current Level</label>
                        <select
                            id="level-select"
                            value={form.level}
                            onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as any }))}
                            className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/60 transition-all"
                            style={{ colorScheme: "dark" }}
                        >
                            <option value="beginner">🌱 Beginner</option>
                            <option value="intermediate">🔥 Intermediate</option>
                            <option value="advanced">⚡ Advanced</option>
                        </select>
                    </div>

                    {/* Daily hours */}
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                            Daily Hours: <span className="text-indigo-400">{form.dailyHours}h</span>
                        </label>
                        <input
                            id="daily-hours-input"
                            type="range"
                            min="0.5"
                            max="8"
                            step="0.5"
                            value={form.dailyHours}
                            onChange={(e) => setForm((f) => ({ ...f, dailyHours: parseFloat(e.target.value) }))}
                            className="w-full accent-indigo-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                            <span>0.5h</span><span>8h</span>
                        </div>
                    </div>

                    {/* Timeframe */}
                    <div>
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                            Timeframe: <span className="text-cyan-400">{form.timeframeWeeks} weeks</span>
                        </label>
                        <input
                            id="timeframe-input"
                            type="range"
                            min="1"
                            max="24"
                            step="1"
                            value={form.timeframeWeeks}
                            onChange={(e) => setForm((f) => ({ ...f, timeframeWeeks: parseInt(e.target.value) }))}
                            className="w-full accent-cyan-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                            <span>1w</span><span>24w</span>
                        </div>
                    </div>

                    {/* Additional context */}
                    <div className="sm:col-span-2 lg:col-span-2">
                        <label className="block text-xs text-slate-400 mb-1.5 font-medium">Additional Context (optional)</label>
                        <input
                            id="context-input"
                            type="text"
                            value={form.additionalContext}
                            onChange={(e) => setForm((f) => ({ ...f, additionalContext: e.target.value }))}
                            placeholder="e.g. focusing on deep learning, exam in 8 weeks, prefer hands-on projects…"
                            className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/60 transition-all"
                        />
                    </div>
                </div>

                {formError && (
                    <div className="flex items-center gap-2 mt-3 text-red-400 text-xs">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {formError}
                    </div>
                )}

                {/* Summary line */}
                <p className="text-xs text-slate-600 mt-3">
                    Total planned: <span className="text-slate-400">{Math.round(form.dailyHours * 7 * form.timeframeWeeks)} hours</span> over <span className="text-slate-400">{form.timeframeWeeks} weeks</span>
                </p>
            </div>

            {/* ── Pipeline Diagram ── */}
            <div className="mb-6">
                <PipelineDiagram
                    activeStep={activePipelineStep}
                    completedSteps={completedPipelineSteps}
                    hasError={pipelineError}
                />
            </div>

            {/* ── Run Full Pipeline button ── */}
            <div className="mb-8">
                <button
                    id="run-pipeline-btn"
                    onClick={runFullPipeline}
                    disabled={pipelineActive}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-white font-semibold text-base transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        background: pipelineActive
                            ? "linear-gradient(135deg, #334155, #1e293b)"
                            : "linear-gradient(135deg, #6366f1, #06b6d4, #10b981)",
                        boxShadow: pipelineActive ? "none" : "0 4px 32px rgba(99,102,241,0.35)",
                    }}
                >
                    {pipelineActive ? (
                        <>
                            <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Running Full Pipeline…
                        </>
                    ) : (
                        <>
                            <Zap className="h-5 w-5" />
                            Run Full Pipeline — All 3 Agents
                            <ChevronRight className="h-5 w-5 ml-auto opacity-60" />
                        </>
                    )}
                </button>

                {pipelineResult && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                        <button
                            onClick={() => navigate("/dashboard/planner")}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs hover:bg-indigo-500/20 transition-colors"
                        >
                            <BookOpen className="h-3.5 w-3.5" /> View Roadmap
                        </button>
                        <button
                            onClick={() => navigate("/dashboard/calendar")}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs hover:bg-cyan-500/20 transition-colors"
                        >
                            <CalendarDays className="h-3.5 w-3.5" /> View Calendar
                        </button>
                        <button
                            onClick={() => navigate("/dashboard/insights")}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs hover:bg-emerald-500/20 transition-colors"
                        >
                            <TrendingUp className="h-3.5 w-3.5" /> View Insights
                        </button>
                    </div>
                )}
            </div>

            {/* ── Agent divider ── */}
            <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-xs text-slate-600 uppercase tracking-widest">or run agents individually</span>
                <div className="h-px flex-1 bg-white/5" />
            </div>

            {/* ── Agent Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {AGENTS.map((agent) => {
                    const state = agentStates[agent.id];
                    const isStrategistDisabled = agent.id === "strategist" && agentStates.architect.status !== "complete";
                    const isOracleDisabled = agent.id === "oracle" && agentStates.strategist.status !== "complete";

                    return (
                        <AgentCard
                            key={agent.id}
                            name={agent.name}
                            role={agent.role}
                            icon={agent.icon}
                            accent={agent.accent}
                            status={state.status}
                            lastRun={state.lastRun}
                            logs={state.logs}
                            disabled={isStrategistDisabled || isOracleDisabled || pipelineActive}
                            onRun={
                                agent.id === "architect"
                                    ? runArchitect
                                    : agent.id === "strategist"
                                        ? runStrategist
                                        : runOracle
                            }
                            result={
                                state.result ? (
                                    <ResultSummary result={state.result} agentId={agent.id} />
                                ) : undefined
                            }
                        />
                    );
                })}
            </div>

            {/* ── Agent descriptions ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {AGENTS.map((agent) => (
                    <div
                        key={agent.id}
                        className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
                    >
                        <p className="text-xs text-slate-500 leading-relaxed">{agent.description}</p>
                    </div>
                ))}
            </div>

            {/* ── How it works ── */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-indigo-400" />
                    How it works
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-500">
                    <div className="flex gap-2">
                        <span className="text-indigo-400 font-mono shrink-0">01</span>
                        <span>All agents run locally — no OpenAI or external API keys needed.</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-cyan-400 font-mono shrink-0">02</span>
                        <span>When Ollama (llama3) is running at localhost:11434, agents use it for richer output.</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-emerald-400 font-mono shrink-0">03</span>
                        <span>If Ollama is offline, a smart deterministic generator produces realistic results instantly.</span>
                    </div>
                    <div className="flex gap-2">
                        <span className="text-indigo-400 font-mono shrink-0">04</span>
                        <span>The pipeline passes data between agents automatically — Architect → Strategist → Oracle.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
