import {
  Clock,
  Flame,
  Zap,
  CheckCircle2,
  Circle,
  Sparkles,
  Bot,
  CalendarDays,
  TrendingUp,
  Trophy,
  ChevronRight,
  Loader2,
  BookOpen,
  Youtube,
  FileText,
  LayoutList,
  History,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router";
import { toast } from "sonner";
import { API, type CalendarEvent, type ProgressReport, type Achievement, type TopicRecommendation } from "../lib/api";

// ── Dark tooltip ──────────────────────────────────────────────────────────────

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

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  gradient,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  href?: string;
}) {
  const inner = (
    <div
      className={`rounded-2xl border border-white/8 p-4 bg-gradient-to-br ${gradient} relative overflow-hidden group hover:border-white/15 transition-all duration-200`}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/5 blur-xl" />
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

  if (href) return <Link to={href}>{inner}</Link>;
  return inner;
}

// ── Today session row ─────────────────────────────────────────────────────────

function TodaySessionRow({
  event,
  onComplete,
}: {
  event: CalendarEvent;
  onComplete: (id: string) => void;
}) {
  const COLOR: Record<string, string> = {
    Study: "bg-indigo-500/20 border-indigo-500/40",
    Review: "bg-cyan-500/20 border-cyan-500/40",
    Practice: "bg-emerald-500/20 border-emerald-500/40",
    Assessment: "bg-amber-500/20 border-amber-500/40",
  };

  const [recs, setRecs] = useState<TopicRecommendation | null>(null);
  const [strategy, setStrategy] = useState("");
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [showRecs, setShowRecs] = useState(false);

  const fetchSYNAPSE = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (recs) {
      setShowRecs(!showRecs);
      return;
    }
    setLoadingRecs(true);
    try {
      const res = await API.runAcademicResourceIntelligence({
        topic_request: [{
          subject: event.subject,
          topic: event.topic,
          difficulty_level: event.difficulty >= 7 ? "hard" : event.difficulty <= 3 ? "easy" : "medium",
          student_level: "intermediate"
        }],
        exam_type: "Standard Competitive",
        weak_areas: [],
        preferred_learning_style: "mixed",
        time_available_minutes: event.estimatedHours * 60,
        past_performance: {
          topic: event.topic,
          score: 75,
          confidence_rating: 4
        }
      });
      if (res.success && res.resource_recommendations.length > 0) {
        setRecs(res.resource_recommendations[0]);
        setStrategy(res.learning_strategy_note || "");
        setShowRecs(true);
      }
    } catch (err) {
      toast.error("SYNAPSE failed to curate resources");
    } finally {
      setLoadingRecs(false);
    }
  };

  const pill = COLOR[event.sessionType] ?? COLOR["Study"];

  // Check if session is missed (in the past and not completed)
  const isMissed = !event.completed && (() => {
    const now = new Date();
    const today = new Date().toISOString().split('T')[0];
    if (event.date < today) return true;
    if (event.date === today) {
      const [hours, minutes] = event.startTime.split(':').map(Number);
      const sessionTime = new Date();
      sessionTime.setHours(hours, minutes, 0, 0);
      return now > sessionTime;
    }
    return false;
  })();

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${event.completed
          ? "border-emerald-500/15 bg-emerald-500/5 opacity-60"
          : isMissed
            ? "border-red-500/30 bg-red-500/5"
            : "border-white/5 bg-white/[0.02] hover:border-white/10"
          }`}
      >
        <button
          onClick={() => !event.completed && onComplete(event.id)}
          className="shrink-0"
          disabled={event.completed}
        >
          {event.completed ? (
            <CheckCircle2 size={18} className="text-emerald-400" />
          ) : (
            <Circle size={18} className="text-slate-600 hover:text-indigo-400 transition-colors" />
          )}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={(e) => !event.completed && fetchSYNAPSE(e)}>
          <p
            className={`text-sm font-medium truncate ${event.completed ? "line-through text-slate-500" : "text-white"
              }`}
          >
            {event.topic}
            {isMissed && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-[9px] uppercase font-bold text-red-500/90 shadow-[0_0_5px_rgba(239,68,68,0.2)]">
                Missed
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500">{event.subject}</span>
            {!event.completed && (
              <span className="flex items-center gap-1 text-[9px] text-indigo-400/80 font-medium">
                <Sparkles size={10} /> [AI Intelligence] Click to Study
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {!event.completed && (
            <button
              onClick={fetchSYNAPSE}
              disabled={loadingRecs}
              className={`h-7 px-2 rounded-lg flex items-center gap-1.5 border transition-all ${showRecs ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-400" : "bg-white/5 border-white/8 text-slate-600 hover:text-white"}`}
            >
              {loadingRecs ? <Loader2 size={12} className="animate-spin text-indigo-400" /> : <Sparkles size={12} className={showRecs ? "animate-pulse" : ""} />}
              <span className="text-[10px] font-bold uppercase tracking-wider hidden xs:block">Curate</span>
            </button>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${pill} hidden sm:inline-block`}>
            {event.sessionType}
          </span>
          <span className="text-xs text-slate-500">{event.startTime}</span>
          <span className="flex items-center gap-0.5 text-xs text-amber-400">
            <Zap size={11} />
            {event.xpReward}
          </span>
        </div>
      </div>

      {/* SYNAPSE Recommendations Panel (Dashboard View) */}
      {showRecs && recs && (
        <div className="ml-8 animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="bg-indigo-500/5 rounded-xl border border-indigo-500/10 overflow-hidden">
            <div className="p-2 bg-indigo-500/10 border-b border-indigo-500/10 flex items-center justify-between">
              <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={10} />
                SYNAPSE Research
              </span>
              <span className="text-[9px] text-indigo-400 font-medium">Exam-Match</span>
            </div>

            <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* YouTube */}
              <a
                href={recs.recommended_resources.youtube_lecture.url}
                target="_blank"
                rel="noreferrer"
                className="flex gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors group/item"
              >
                <div className="h-7 w-7 rounded bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 group-hover/item:bg-red-500/20 transition-all">
                  <Youtube size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white line-clamp-1 group-hover/item:text-red-400 transition-colors">{recs.recommended_resources.youtube_lecture.title}</p>
                  <p className="text-[9px] text-slate-500 line-clamp-1">{recs.recommended_resources.youtube_lecture.creator} · {recs.recommended_resources.youtube_lecture.duration_minutes}m</p>
                </div>
              </a>

              {/* PDF */}
              <a
                href={recs.recommended_resources.pdf_notes.url}
                target="_blank"
                rel="noreferrer"
                className="flex gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors group/item"
              >
                <div className="h-7 w-7 rounded bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 text-blue-400 group-hover/item:bg-blue-500/20 transition-all">
                  <FileText size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white line-clamp-1 group-hover/item:text-blue-400 transition-colors">{recs.recommended_resources.pdf_notes.title}</p>
                  <p className="text-[9px] text-slate-500 line-clamp-1">{recs.recommended_resources.pdf_notes.source} · {recs.recommended_resources.pdf_notes.pages} pgs</p>
                </div>
              </a>

              {/* Practice */}
              <a
                href={recs.recommended_resources.practice_questions.url}
                target="_blank"
                rel="noreferrer"
                className="flex gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors group/item"
              >
                <div className="h-7 w-7 rounded bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 text-emerald-400 group-hover/item:bg-emerald-500/20 transition-all">
                  <LayoutList size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white line-clamp-1 group-hover/item:text-emerald-400 transition-colors">{recs.recommended_resources.practice_questions.estimated_questions}+ Qs</p>
                  <p className="text-[9px] text-slate-500 line-clamp-1">{recs.recommended_resources.practice_questions.type} level</p>
                </div>
              </a>

              {/* PYQs */}
              <a
                href={recs.recommended_resources.previous_year_questions.url}
                target="_blank"
                rel="noreferrer"
                className="flex gap-2 p-1.5 rounded-lg hover:bg-white/5 transition-colors group/item"
              >
                <div className="h-7 w-7 rounded bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 text-amber-400 group-hover/item:bg-amber-500/20 transition-all">
                  <History size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white line-clamp-1 group-hover/item:text-amber-400 transition-colors">PYQ Availability</p>
                  <p className="text-[9px] text-slate-500 line-clamp-1">{recs.recommended_resources.previous_year_questions.availability === "yes" ? "Included" : "Limited"}</p>
                </div>
              </a>
            </div>
            <div className="px-3 pb-3">
              <p className="text-[9px] text-indigo-300/60 italic leading-snug border-t border-indigo-500/10 pt-2">“{strategy}”</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [xp, setXP] = useState<{ total: number; level: number; levelName: string }>({
    total: 0,
    level: 1,
    levelName: "Novice",
  });
  const [notifications, setNotifications] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const dashboard = await API.getDashboardData();
      setEvents(dashboard.events ?? []);
      setReport(dashboard.latestReport ?? null);
      setXP(dashboard.xp ?? { total: 0, level: 1, levelName: "Novice" });
      setAchievements(dashboard.achievements ?? []);
      setNotifications(dashboard.notifications ?? []);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Quick complete from dashboard ───────────────────────────────────────────

  async function handleQuickComplete(eventId: string) {
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    try {
      await API.completeSession(event);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, completed: true } : e))
      );
    } catch (err) {
      console.error("Complete session error:", err);
    }
  }

  const handleAdaptiveReschedule = async () => {
    const tid = toast.loading("AI is rewriting your schedule...");
    try {
      await API.adaptiveReschedule();
      toast.success("Schedule healed! Your missed tasks have been moved to today.", { id: tid });
      loadData();
    } catch {
      toast.error("Failed to reschedule", { id: tid });
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────────

  const stats = API.computeStatistics(events);
  const todayStr = new Date().toISOString().split("T")[0];
  const todaySessions = events
    .filter((e) => e.date === todayStr && e.sessionType !== "Busy")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const todayDone = todaySessions.filter((e) => e.completed).length;
  const hasAgentData = events.length > 0;

  // ── Dynamic Summary Correction ──
  // If the AI is being "too nice" but the user has missed sessions, we override it client-side
  const missedSessions = events.filter(e => {
    if (e.completed || e.sessionType === "Busy") return false;
    const d = todayStr;
    if (e.date < d) return true;
    if (e.date === d) {
      const [h, m] = e.startTime.split(':').map(Number);
      const sessionTime = new Date();
      sessionTime.setHours(h, m, 0, 0);
      return new Date() > sessionTime;
    }
    return false;
  });
  
  const isActuallyCrushingIt = stats.streak > 0 && missedSessions.length === 0;
  const rawSummary = report?.aiSummary || "No report generated yet.";
  const displaySummary = (!isActuallyCrushingIt && (rawSummary.toLowerCase().includes("crushing it") || rawSummary.toLowerCase().includes("fantastic")))
    ? "Consistency has dipped. You have missed some scheduled sessions, which has broken your streak. Use the button below to reschedule and get back on track."
    : rawSummary;

  // 7-day chart data from events
  const weeklyChart = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().split("T")[0];
    const dayEvents = events.filter((e) => e.date === ds && e.sessionType !== "Busy");
    const done = dayEvents.filter((e) => e.completed);
    return {
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      sessions: dayEvents.length,
      completed: done.length,
      xp: done.reduce((s, e) => s + e.xpReward, 0),
    };
  });

  // XP to next level (every 500 XP = 1 level)
  const xpInLevel = xp.total % 500;
  const xpPct = Math.round((xpInLevel / 500) * 100);

  // Greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

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
          "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(99,102,241,0.09) 0%, transparent 55%), #0a0f1e",
      }}
    >
      {/* ── Welcome ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {greeting}, {user?.name?.split(" ")[0] || "Student"} 👋
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            {hasAgentData
              ? `${todayDone}/${todaySessions.length} sessions done today · ${stats.streak} day streak 🔥`
              : "Set up your AI study plan to get started."}
          </p>
        </div>

        {/* Unread notifications badge */}
        {notifications.filter((n) => !n.read).length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            {notifications.filter((n) => !n.read).length} alert{notifications.filter((n) => !n.read).length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Flame size={14} className="text-amber-400" />}
          label="Streak"
          value={`🔥 ${stats.streak}`}
          sub="consecutive days"
          gradient="from-amber-500/10 to-transparent"
          href="/dashboard/calendar"
        />
        <StatCard
          icon={<Zap size={14} className="text-indigo-400" />}
          label="XP Level"
          value={`Lv.${xp.level}`}
          sub={`${xp.total} XP · ${xp.levelName}`}
          gradient="from-indigo-500/10 to-transparent"
          href="/dashboard/insights"
        />
        <StatCard
          icon={<CheckCircle2 size={14} className="text-emerald-400" />}
          label="Sessions"
          value={`${stats.completedSessions}/${stats.totalSessions}`}
          sub={`${stats.completionRate}% done`}
          gradient="from-emerald-500/10 to-transparent"
          href="/dashboard/calendar"
        />
        <StatCard
          icon={<Clock size={14} className="text-cyan-400" />}
          label="Hours Studied"
          value={`${stats.totalHoursStudied}h`}
          sub={`${stats.totalHoursPlanned}h planned`}
          gradient="from-cyan-500/10 to-transparent"
          href="/dashboard/insights"
        />
      </div>

      {/* ── XP progress bar ── */}
      {hasAgentData && (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white flex items-center gap-2">
              <Zap size={14} className="text-indigo-400" />
              Level {xp.level} · {xp.levelName}
            </span>
            <span className="text-xs text-slate-500">{xpInLevel} / 500 XP</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${xpPct}%`,
                background: "linear-gradient(90deg, #6366f1, #fbbf24)",
                boxShadow: "0 0 10px rgba(99,102,241,0.5)",
              }}
            />
          </div>
          <p className="text-[10px] text-slate-600 mt-1 text-right">
            {500 - xpInLevel} XP to Level {xp.level + 1}
          </p>
        </div>
      )}

      {/* ── Empty state if no agent data ── */}
      {!hasAgentData && (
        <div
          className="rounded-2xl border border-indigo-500/20 p-8 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(6,182,212,0.04) 100%)",
          }}
        >
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Your AI study plan awaits
          </h3>
          <p className="text-slate-400 text-sm mb-5 max-w-md mx-auto">
            Run the Agent Pipeline to generate your personalised roadmap, calendar, and
            first progress report — all in one click.
          </p>
          <button
            onClick={() => navigate("/dashboard/ai-agents")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #6366f1, #06b6d4)",
              boxShadow: "0 0 20px rgba(99,102,241,0.3)",
            }}
          >
            <Bot size={16} />
            Launch AI Command Center
          </button>
        </div>
      )}

      {/* ── Main content grid ── */}
      {hasAgentData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column: today's sessions + chart */}
          <div className="lg:col-span-2 space-y-5">
            {/* Today's sessions */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <CalendarDays size={14} className="text-cyan-400" />
                  Today's Sessions
                </h2>
                <Link
                  to="/dashboard/calendar"
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  View all <ChevronRight size={12} />
                </Link>
              </div>
              <div className="p-4 space-y-2">
                {todaySessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No sessions scheduled for today
                    <br />
                    <span className="text-xs text-slate-600">
                      Check the Calendar for upcoming sessions
                    </span>
                  </div>
                ) : (
                  todaySessions.map((event) => (
                    <TodaySessionRow
                      key={event.id}
                      event={event}
                      onComplete={handleQuickComplete}
                    />
                  ))
                )}
              </div>
            </div>

            {/* 7-day chart */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <TrendingUp size={14} className="text-emerald-400" />
                7-Day Activity
              </h2>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={weeklyChart}>
                  <defs>
                    <linearGradient id="homeXpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#475569", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#475569", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DarkTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#6366f1"
                    fill="url(#homeXpGrad)"
                    strokeWidth={2}
                    name="Sessions"
                    dot={{ fill: "#6366f1", r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right column: quick links + report snippet + achievements */}
          <div className="space-y-5">
            {/* ── Autonomous AI Recommendation Card ── */}
            {report?.needsAdaptiveReschedule && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                  <Bot size={40} className="text-amber-400" />
                </div>
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <Zap size={15} className="fill-amber-400" />
                    AI Brain: Alert
                  </h3>
                  <div className="px-2 py-0.5 rounded-lg bg-red-500/20 text-[10px] font-bold text-red-400 border border-red-500/30 animate-pulse">
                    URGENT
                  </div>
                </div>
                <p className="text-sm font-medium text-white mb-2 relative z-10">
                  Reschedule Required
                </p>
                <p className="text-xs text-slate-300 mb-4 leading-relaxed relative z-10 italic">
                  "{displaySummary}"
                </p>
                <button
                  onClick={handleAdaptiveReschedule}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-white transition-all bg-amber-500 hover:bg-amber-400 active:scale-[0.98] shadow-lg shadow-amber-500/20"
                >
                  Apply Autonomous Reschedule
                </button>
              </div>
            )}

            {/* Quick nav */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
              </div>
              <div className="p-3 space-y-1">
                {[
                  { href: "/dashboard/ai-agents", icon: <Bot size={16} className="text-indigo-400" />, label: "AI Command Center" },
                  { href: "/dashboard/calendar", icon: <CalendarDays size={16} className="text-cyan-400" />, label: "Study Calendar" },
                  { href: "/dashboard/insights", icon: <Sparkles size={16} className="text-purple-400" />, label: "AI Insights" },
                  { href: "/dashboard/planner", icon: <BookOpen size={16} className="text-emerald-400" />, label: "Study Planner" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    {link.icon}
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                      {link.label}
                    </span>
                    <ChevronRight size={12} className="ml-auto text-slate-700 group-hover:text-slate-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Latest report snippet */}
            {report && (
              <div
                className="rounded-2xl border border-indigo-500/20 p-4"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(168,85,247,0.04) 100%)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-300">AI Insight</span>
                </div>
                <p className="text-xs text-slate-300 italic leading-relaxed mb-3 line-clamp-3">
                  "{report.recommendation}"
                </p>
                <Link
                  to="/dashboard/insights"
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Full report <ChevronRight size={12} />
                </Link>
              </div>
            )}

            {/* Recent achievements */}
            {achievements.length > 0 && (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Trophy size={14} className="text-amber-400" />
                    Achievements
                  </h2>
                  <span className="text-xs text-slate-600">{achievements.length}</span>
                </div>
                <div className="p-3 space-y-2">
                  {achievements.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/3 transition-colors"
                    >
                      <span className="text-xl shrink-0">{a.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{a.title}</p>
                        <p className="text-[10px] text-slate-500">+{a.xpBonus} XP</p>
                      </div>
                    </div>
                  ))}
                  {achievements.length > 3 && (
                    <Link
                      to="/dashboard/insights"
                      className="block text-xs text-slate-600 hover:text-indigo-400 text-center py-1 transition-colors"
                    >
                      +{achievements.length - 3} more
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}