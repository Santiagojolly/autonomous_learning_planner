import { useEffect, useState, useCallback } from "react";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Zap,
  Trophy,
  Target,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Bot,
  Sparkles,
  Clock,
  BarChart3,
  Star,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  API,
  type ProgressReport,
  type MasteryScore,
  type CalendarEvent,
  type Achievement,
  type ProgressAlert,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function trendIcon(trend: MasteryScore["trend"]) {
  if (trend === "improving")
    return <TrendingUp size={14} className="text-emerald-400" />;
  if (trend === "declining")
    return <TrendingDown size={14} className="text-red-400" />;
  return <Minus size={14} className="text-slate-500" />;
}

function rarityColor(rarity: Achievement["rarity"]) {
  return {
    bronze: "text-amber-600 border-amber-600/40 bg-amber-600/10",
    silver: "text-slate-300 border-slate-400/40 bg-slate-400/10",
    gold: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    platinum:
      "text-cyan-300 border-cyan-400/40 bg-cyan-400/10",
  }[rarity];
}

function alertSeverityStyle(severity: ProgressAlert["severity"]) {
  return {
    info: "border-indigo-500/30 bg-indigo-500/8 text-indigo-300",
    warning: "border-amber-500/30 bg-amber-500/8 text-amber-300",
    danger: "border-red-500/30 bg-red-500/8 text-red-400",
  }[severity];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Gradient stat card */
function StatCard({
  icon,
  label,
  value,
  sub,
  gradient,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/8 p-4 bg-gradient-to-br ${gradient} relative overflow-hidden`}
    >
      <div className="absolute inset-0 opacity-5">
        <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white blur-xl" />
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
          {icon}
          {label}
        </div>
        <p className="text-3xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

/** Mastery score card for one subject */
function MasteryCard({ score }: { score: MasteryScore }) {
  const pct = score.score;
  const color =
    pct >= 75 ? "#34d399" : pct >= 50 ? "#fbbf24" : pct >= 25 ? "#818cf8" : "#ef4444";

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{score.subject}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {score.topicsCompleted}/{score.topicsTotal} topics · {score.hoursInvested.toFixed(1)}h invested
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {trendIcon(score.trend)}
          <span
            className={
              score.trend === "improving"
                ? "text-emerald-400"
                : score.trend === "declining"
                  ? "text-red-400"
                  : "text-slate-500"
            }
          >
            {score.trend}
          </span>
        </div>
      </div>

      {/* Score ring */}
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-white">{pct}%</span>
          </div>
        </div>

        {/* Progress bar breakdown */}
        <div className="flex-1 space-y-1.5">
          <div>
            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
              <span>Mastery</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {score.streak > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400">
                <Flame size={10} /> {score.streak}d streak
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Clock size={10} /> {score.hoursPlanned.toFixed(1)}h planned
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Achievement badge */
function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const cls = rarityColor(achievement.rarity);
  return (
    <div className={`rounded-xl border p-3 flex items-start gap-3 ${cls}`}>
      <span className="text-2xl shrink-0">{achievement.icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{achievement.title}</p>
        <p className="text-xs opacity-70 mt-0.5 leading-relaxed">
          {achievement.description}
        </p>
        <p className="text-[10px] mt-1 opacity-50">
          +{achievement.xpBonus} XP ·{" "}
          {new Date(achievement.unlockedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}

/** Alert row */
function AlertRow({ alert }: { alert: ProgressAlert }) {
  const cls = alertSeverityStyle(alert.severity);
  const Icon =
    alert.severity === "danger"
      ? AlertTriangle
      : alert.severity === "warning"
        ? AlertTriangle
        : CheckCircle2;

  return (
    <div className={`rounded-xl border p-3.5 flex items-start gap-3 ${cls}`}>
      <Icon size={16} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{alert.title}</p>
        <p className="text-xs opacity-80 mt-0.5 leading-relaxed">{alert.message}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom chart tooltips (dark theme)
// ─────────────────────────────────────────────────────────────────────────────

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1117] px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function AIInsights() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [report, setReport] = useState<ProgressReport | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [xp, setXP] = useState<{ total: number; level: number; levelName: string } | null>(null);

  // ── Load data ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [statusRes, achievementsRes, xpRes] = await Promise.all([
        API.getAgentStatus().catch(() => ({
          roadmap: null,
          calendarEvents: [],
          latestReport: null,
          xp: { total: 0, level: 1, levelName: "Novice" },
          achievements: [],
        })),
        API.getAchievements().catch(() => ({ achievements: [] })),
        API.getXP().catch(() => ({ xp: { total: 0, level: 1, levelName: "Novice" } })),
      ]);

      setReport(statusRes.latestReport);
      setEvents(statusRes.calendarEvents ?? []);
      setAchievements(achievementsRes.achievements ?? []);
      setXP(xpRes.xp);
    } catch (err: any) {
      console.error("Insights load error:", err);
      if (!silent) toast.error("Failed to load insights", { description: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadData();
    else setLoading(false);
  }, [isAuthenticated, loadData]);

  // ── Generate weekly report ──────────────────────────────────────────────────

  async function generateReport() {
    setGenerating(true);
    try {
      const res = await API.runProgressOracle({ action: "weekly-report" });
      if (res.report) {
        setReport(res.report);
        toast.success("Weekly report generated!", {
          description: res.meta.usedOllama ? "Powered by Ollama" : "Smart report generated",
        });
        if (res.achievements?.length) {
          setAchievements((prev) => [...(res.achievements ?? []), ...prev]);
          res.achievements.forEach((a, i) => {
            setTimeout(() => {
              toast.success(`🏆 Achievement: ${a.title}`, {
                description: `${a.icon} +${a.xpBonus} XP`,
              });
            }, (i + 1) * 700);
          });
        }
      }
    } catch (err: any) {
      toast.error("Failed to generate report", { description: err.message });
    } finally {
      setGenerating(false);
    }
  }

  // ── Derived data for charts ─────────────────────────────────────────────────

  const stats = API.computeStatistics(events);

  // Build 7-day completion history from events
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    const dayEvents = events.filter((e) => e.date === dateStr && e.sessionType !== "Busy");
    const done = dayEvents.filter((e) => e.completed);
    return {
      date: d.toLocaleDateString("en-US", { weekday: "short" }),
      sessions: dayEvents.length,
      completed: done.length,
      xp: done.reduce((s, e) => s + e.xpReward, 0),
    };
  });

  // Mastery radar from mastery scores
  const radarData = (report?.masteryScores ?? []).map((m) => ({
    subject:
      m.subject.length > 10 ? m.subject.substring(0, 10) + "…" : m.subject,
    mastery: m.score,
  }));

  // Subject performance bar from stats
  const subjectBars = stats.subjects.map((s) => ({
    name: s.name.length > 12 ? s.name.substring(0, 12) + "…" : s.name,
    completion: s.percentage,
    planned: s.planned,
    done: s.completed,
  }));

  // XP per-day for area chart
  const xpChartData = last7Days;

  const hasData = events.length > 0 || report !== null;

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen pb-24 lg:pb-8 space-y-6"
      style={{
        background:
          "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(99,102,241,0.10) 0%, transparent 55%), #0a0f1e",
      }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              boxShadow: "0 0 20px rgba(99,102,241,0.4)",
            }}
          >
            🧠
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">AI Insights</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Progress Oracle · mastery scores · achievements
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/8 bg-white/[0.03] text-slate-400 hover:text-white text-sm transition-all disabled:opacity-40"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={generateReport}
            disabled={generating || !hasData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              boxShadow: "0 0 16px rgba(99,102,241,0.3)",
            }}
          >
            {generating ? (
              <><Loader2 size={14} className="animate-spin" /> Generating…</>
            ) : (
              <><Sparkles size={14} /> Generate Report</>
            )}
          </button>
        </div>
      </div>

      {/* ── No data CTA ── */}
      {!hasData && (
        <div
          className="rounded-2xl border border-indigo-500/20 p-8 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(168,85,247,0.04) 100%)",
          }}
        >
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-white mb-2">No data yet</h3>
          <p className="text-slate-400 text-sm mb-5 max-w-md mx-auto">
            Run the AI Agent Pipeline first to generate a study plan. Insights will appear
            here after you complete your first sessions.
          </p>
          <button
            onClick={() => navigate("/dashboard/ai-agents")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}
          >
            <Bot size={16} /> Go to AI Command Center
          </button>
        </div>
      )}

      {hasData && (
        <>
          {/* ── Top stats ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={<Flame size={14} className="text-amber-400" />}
              label="Study Streak"
              value={`🔥 ${stats.streak}`}
              sub="consecutive days"
              gradient="from-amber-500/10 to-transparent"
            />
            <StatCard
              icon={<Zap size={14} className="text-indigo-400" />}
              label="Total XP"
              value={xp?.total ?? stats.totalXP}
              sub={`Level ${xp?.level ?? 1} · ${xp?.levelName ?? "Novice"}`}
              gradient="from-indigo-500/10 to-transparent"
            />
            <StatCard
              icon={<CheckCircle2 size={14} className="text-emerald-400" />}
              label="Sessions Done"
              value={`${stats.completedSessions}/${stats.totalSessions}`}
              sub={`${stats.completionRate}% completion`}
              gradient="from-emerald-500/10 to-transparent"
            />
            <StatCard
              icon={<Clock size={14} className="text-cyan-400" />}
              label="Hours Studied"
              value={`${stats.totalHoursStudied}h`}
              sub={`${stats.totalHoursPlanned}h planned`}
              gradient="from-cyan-500/10 to-transparent"
            />
          </div>

          {/* ── AI Weekly Report ── */}
          {report && (
            <div
              className="rounded-2xl border border-indigo-500/20 p-5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(168,85,247,0.04) 100%)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-indigo-400" />
                <h2 className="text-sm font-semibold text-white">
                  Week {report.weekNumber} · AI Report
                </h2>
                <span className="ml-auto text-xs text-slate-500">
                  {new Date(report.generatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed italic mb-3">
                "{report.aiSummary}"
              </p>
              <div className="rounded-xl bg-white/5 border border-white/5 p-3 text-xs text-slate-400">
                <strong className="text-slate-300">🎯 Recommendation:</strong>{" "}
                {report.recommendation}
              </div>

              {/* On-track / Behind */}
              {(report.onTrack.length > 0 || report.behind.length > 0) && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {report.onTrack.length > 0 && (
                    <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3">
                      <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-2 font-medium">
                        ✅ On Track
                      </p>
                      {report.onTrack.map((s) => (
                        <p key={s} className="text-xs text-slate-300">{s}</p>
                      ))}
                    </div>
                  )}
                  {report.behind.length > 0 && (
                    <div className="rounded-xl bg-red-500/8 border border-red-500/20 p-3">
                      <p className="text-[10px] text-red-400 uppercase tracking-wider mb-2 font-medium">
                        ⚠️ Behind
                      </p>
                      {report.behind.map((s) => (
                        <p key={s} className="text-xs text-slate-300">{s}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Alerts ── */}
          {report?.alerts && report.alerts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-400" />
                Active Alerts
              </h2>
              <div className="space-y-2">
                {report.alerts.slice(0, 4).map((a) => (
                  <AlertRow key={a.id} alert={a} />
                ))}
              </div>
            </div>
          )}

          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 7-day XP & sessions area chart */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 size={14} className="text-indigo-400" />
                7-Day Activity
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={xpChartData}>
                  <defs>
                    <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="xp"
                    stroke="#6366f1"
                    fill="url(#xpGrad)"
                    strokeWidth={2}
                    name="XP Earned"
                    dot={{ fill: "#6366f1", r: 3 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#34d399"
                    fill="url(#sessGrad)"
                    strokeWidth={2}
                    name="Sessions Done"
                    dot={{ fill: "#34d399", r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Mastery radar or subject bars */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              {radarData.length > 2 ? (
                <>
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Target size={14} className="text-cyan-400" />
                    Mastery Radar
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#1e293b" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: "#64748b", fontSize: 11 }}
                      />
                      <Radar
                        name="Mastery"
                        dataKey="mastery"
                        stroke="#6366f1"
                        fill="#6366f1"
                        fillOpacity={0.25}
                        strokeWidth={2}
                      />
                      <Tooltip content={<DarkTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <BookOpen size={14} className="text-cyan-400" />
                    Subject Completion
                  </h3>
                  {subjectBars.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={subjectBars} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                        <XAxis
                          type="number"
                          domain={[0, 100]}
                          tick={{ fill: "#475569", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: "#64748b", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={80}
                        />
                        <Tooltip content={<DarkTooltip />} />
                        <Bar
                          dataKey="completion"
                          fill="#6366f1"
                          radius={[0, 6, 6, 0]}
                          name="Completion %"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[220px] text-slate-600">
                      <BarChart3 size={32} className="mb-3 opacity-30" />
                      <p className="text-sm">No subject data yet</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Mastery Scores per subject ── */}
          {report?.masteryScores && report.masteryScores.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Brain size={14} className="text-indigo-400" />
                Mastery Scores
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {report.masteryScores.map((m) => (
                  <MasteryCard key={m.subject} score={m} />
                ))}
              </div>
            </div>
          )}

          {/* ── Achievements ── */}
          {achievements.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Trophy size={14} className="text-amber-400" />
                Achievements
                <span className="ml-auto text-xs text-slate-500">
                  {achievements.length} unlocked
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {achievements.map((a) => (
                  <AchievementBadge key={a.id} achievement={a} />
                ))}
              </div>
            </div>
          )}

          {/* ── XP level bar ── */}
          {xp && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-yellow-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Level {xp.level} · {xp.levelName}
                  </h3>
                </div>
                <span className="text-xs text-slate-500">{xp.total} XP total</span>
              </div>
              {/* XP progress to next level — each level = 500 XP */}
              {(() => {
                const xpInLevel = xp.total % 500;
                const pct = Math.round((xpInLevel / 500) * 100);
                return (
                  <>
                    <div className="h-2.5 bg-white/5 rounded-full overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: "linear-gradient(90deg, #6366f1, #fbbf24)",
                          boxShadow: "0 0 8px rgba(99,102,241,0.5)",
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>{xpInLevel} XP into level {xp.level}</span>
                      <span>{500 - xpInLevel} XP to level {xp.level + 1}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
