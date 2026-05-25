import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Clock,
  Target,
  Trash2,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Plus,
  X,
  Bot,
  Zap,
  TrendingUp,
  CalendarDays,
  BarChart3,
  Layers,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router";
import {
  API,
  type Roadmap,
  type RoadmapPhase,
  type RoadmapTopic,
  type MasteryScore,
} from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types (local subjects — kept for backward compat)
// ─────────────────────────────────────────────────────────────────────────────

interface LocalTopic { id: number; name: string; completed: boolean; hours: number; dueDate?: string; }
interface LocalSubject { id: number; name: string; color: string; icon: string; goalHours: number; completedHours: number; topics: LocalTopic[]; }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers / constants
// ─────────────────────────────────────────────────────────────────────────────

const GRADIENT_PAIRS = [
  ["from-indigo-500/20", "border-indigo-500/30", "text-indigo-300"],
  ["from-cyan-500/20", "border-cyan-500/30", "text-cyan-300"],
  ["from-emerald-500/20", "border-emerald-500/30", "text-emerald-300"],
  ["from-amber-500/20", "border-amber-500/30", "text-amber-300"],
  ["from-purple-500/20", "border-purple-500/30", "text-purple-300"],
  ["from-pink-500/20", "border-pink-500/30", "text-pink-300"],
];
const gp = (i: number) => GRADIENT_PAIRS[i % GRADIENT_PAIRS.length];

const DIFF_LABELS = ["", "Intro", "Easy", "Easy", "Medium", "Medium", "Medium", "Hard", "Hard", "Expert", "Expert"];
const DIFF_COLORS = ["", "#4ade80", "#86efac", "#86efac", "#fbbf24", "#fbbf24", "#fbbf24", "#f97316", "#f97316", "#ef4444", "#ef4444"];

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/8 p-4 bg-gradient-to-br ${accent} to-transparent`}>
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">{icon}{label}</div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

// ── Roadmap Phase accordion ──────────────────────────────────────────────────

function PhaseAccordion({
  phase,
  index,
  mastery,
}: {
  phase: RoadmapPhase;
  index: number;
  mastery?: MasteryScore;
}) {
  const [open, setOpen] = useState(index === 0);
  const colors = gp(index);
  const done = (phase.topics ?? []).filter((t) => t.status === "completed").length;
  const pct = (phase.topics ?? []).length > 0 ? Math.round((done / (phase.topics ?? []).length) * 100) : 0;

  return (
    <div className={`rounded-2xl border ${colors[1]} bg-gradient-to-br ${colors[0]} to-transparent overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{phase.name}</p>
            {mastery && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${colors[1]} ${colors[2]}`}>
                {mastery.score}% mastery
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {phase.weekRange} · {phase.totalHours}h · {done}/{(phase.topics ?? []).length} topics
          </p>
        </div>

        {/* Compact progress bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, #6366f1, #06b6d4)" }}
            />
          </div>
          <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
        </div>

        {open ? <ChevronDown size={15} className="text-slate-500 shrink-0" /> : <ChevronRight size={15} className="text-slate-500 shrink-0" />}
      </button>

      {/* Body */}
      {open && (
        <div className="px-5 pb-5 space-y-2 border-t border-white/5 pt-4">
          {phase.description && (
            <p className="text-xs text-slate-500 mb-3">{phase.description}</p>
          )}
          {(phase.topics ?? []).map((topic, ti) => (
            <TopicRow key={topic.id} topic={topic} index={ti} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicRow({ topic, index }: { topic: RoadmapTopic; index: number }) {
  const statusIcon =
    topic.status === "completed" ? (
      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
    ) : topic.status === "in-progress" ? (
      <div className="h-4 w-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin shrink-0" />
    ) : (
      <Circle size={16} className="text-slate-700 shrink-0" />
    );

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${topic.status === "completed"
        ? "border-emerald-500/15 bg-emerald-500/5 opacity-70"
        : topic.status === "in-progress"
          ? "border-indigo-500/25 bg-indigo-500/8"
          : "border-white/5 bg-white/[0.02] hover:border-white/10"
        }`}
    >
      {statusIcon}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${topic.status === "completed" ? "line-through text-slate-500" : "text-white"}`}>
          {topic.name}
        </p>
        {topic.notes && <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{topic.notes}</p>}
        {(topic.resources?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(topic.resources || []).slice(0, 2).map((r, ri) => (
              <span key={ri} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-500">
                {r}
              </span>
            ))}
            {(topic.resources?.length ?? 0) > 2 && (
              <span className="text-[10px] text-slate-700">+{(topic.resources?.length ?? 0) - 2}</span>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <span className="text-xs text-slate-500">{topic.estimatedHours}h</span>
        <span
          className="text-[10px] px-1 py-0.5 rounded"
          style={{ color: DIFF_COLORS[topic.difficulty], background: `${DIFF_COLORS[topic.difficulty]}20` }}
        >
          {DIFF_LABELS[topic.difficulty]}
        </span>
      </div>
    </div>
  );
}

// ── Local Subject Card ───────────────────────────────────────────────────────

function SubjectCard({
  subject,
  index,
  onToggleTopic,
  onDelete,
}: {
  subject: LocalSubject;
  index: number;
  onToggleTopic: (sid: number, tid: number) => void;
  onDelete: (sid: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const colors = gp(index);
  const pct = subject.goalHours > 0 ? Math.min(100, Math.round((subject.completedHours / subject.goalHours) * 100)) : 0;
  const doneTopic = (subject.topics || []).filter((t) => t.completed).length;

  return (
    <div className={`rounded-2xl border ${colors[1]} bg-gradient-to-br ${colors[0]} to-transparent overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="text-2xl">{subject.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{subject.name}</p>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {doneTopic}/{(subject.topics || []).length} topics · {subject.completedHours}h / {subject.goalHours}h
          </p>
        </div>
        {/* Mini progress */}
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-white/8 overflow-hidden hidden sm:block">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, #6366f1, #06b6d4)" }}
            />
          </div>
          <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-white transition-all"
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <button
          onClick={() => onDelete(subject.id)}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Topics */}
      {open && (subject.topics || []).length > 0 && (
        <div className="px-5 pb-4 space-y-1.5 border-t border-white/5 pt-3">
          {(subject.topics || []).map((topic) => (
            <button
              key={topic.id}
              onClick={() => onToggleTopic(subject.id, topic.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${topic.completed
                ? "border-emerald-500/15 bg-emerald-500/5 opacity-60"
                : "border-white/5 bg-white/[0.02] hover:border-white/10"
                }`}
            >
              {topic.completed ? (
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              ) : (
                <Circle size={15} className="text-slate-700 shrink-0" />
              )}
              <span className={`text-xs flex-1 text-left ${topic.completed ? "line-through text-slate-600" : "text-white"}`}>
                {topic.name}
              </span>
              <span className="text-[10px] text-slate-600">{topic.hours}h</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add Subject Modal ────────────────────────────────────────────────────────

function AddSubjectModal({ open, onClose, onAdd }: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, goalHours: number) => void;
}) {
  const [name, setName] = useState("");
  const [hours, setHours] = useState("40");
  function submit() {
    if (!name.trim()) { toast.error("Enter a subject name"); return; }
    onAdd(name.trim(), parseInt(hours) || 40);
    setName(""); setHours("40");
    onClose();
  }
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-[20%] z-50 max-w-md mx-auto rounded-2xl border border-white/12 p-6 shadow-2xl" style={{ background: "#0d1117" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Add Subject</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={15} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Subject Name</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g., Physics"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Goal Hours: <span className="text-white">{hours}h</span></label>
            <input type="range" min={5} max={200} step={5} value={hours}
              onChange={(e) => setHours(e.target.value)} className="w-full accent-indigo-500" />
          </div>
          <button onClick={submit}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}
          >
            Add Subject
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function StudyPlanner() {
  const [loading, setLoading] = useState(true);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [masteryScores, setMasteryScores] = useState<MasteryScore[]>([]);
  const [subjects, setSubjects] = useState<LocalSubject[]>([]);
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [activeView, setActiveView] = useState<"roadmap" | "subjects">("roadmap");

  // ── Load ────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentStatus, subjectsRes] = await Promise.all([
        API.getAgentStatus().catch(() => null),
        API.getSubjects().catch(() => ({ subjects: [] })),
      ]);

      if (agentStatus?.roadmap) {
        setRoadmap(agentStatus.roadmap);
        setMasteryScores(agentStatus.latestReport?.masteryScores ?? []);
        setActiveView("roadmap");
      } else {
        setActiveView("subjects");
      }

      setSubjects(subjectsRes.subjects ?? []);
    } catch (err) {
      console.error("StudyPlanner load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Local subject handlers ───────────────────────────────────────────────
  async function persistSubjects(updated: LocalSubject[]) {
    setSubjects(updated);
    try { await API.saveSubjects(updated); }
    catch { toast.error("Failed to save"); }
  }

  async function handleAddSubject(name: string, goalHours: number) {
    const ICONS = ["📚", "🎯", "💡", "🔬", "📐", "⚛️", "🧪", "🖥️", "📊", "🌍"];
    const COLORS = ["bg-indigo-500", "bg-cyan-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500"];
    const newSub: LocalSubject = {
      id: Date.now(), name, goalHours, completedHours: 0, topics: [],
      icon: ICONS[subjects.length % ICONS.length],
      color: COLORS[subjects.length % COLORS.length],
    };
    await persistSubjects([...subjects, newSub]);
    toast.success("Subject added!");
  }

  async function handleDeleteSubject(sid: number) {
    await persistSubjects(subjects.filter((s) => s.id !== sid));
    toast.success("Subject removed");
  }

  async function handleToggleTopic(sid: number, tid: number) {
    const updated = subjects.map((s) => {
      if (s.id !== sid) return s;
      const topics = s.topics.map((t) => t.id === tid ? { ...t, completed: !t.completed } : t);
      const completedHours = topics.filter((t) => t.completed).reduce((sum, t) => sum + t.hours, 0);
      return { ...s, topics, completedHours };
    });
    await persistSubjects(updated);
  }

  // ── Computed stats ───────────────────────────────────────────────────────
  const roadmapStats = roadmap
    ? {
      phases: (roadmap.phases ?? []).length,
      totalTopics: (roadmap.phases ?? []).reduce((s, p) => s + (p.topics ?? []).length, 0),
      doneTopics: (roadmap.phases ?? []).reduce((s, p) => s + (p.topics ?? []).filter((t) => t.status === "completed").length, 0),
      totalHours: roadmap.totalHours,
      weeks: roadmap.totalWeeks,
    }
    : null;
  const roadmapProgress = roadmapStats
    ? roadmapStats.totalTopics > 0
      ? Math.round((roadmapStats.doneTopics / roadmapStats.totalTopics) * 100)
      : 0
    : 0;

  const localStats = {
    subjects: subjects.length,
    totalHours: subjects.reduce((s, sub) => s + sub.goalHours, 0),
    doneHours: subjects.reduce((s, sub) => s + sub.completedHours, 0),
    topics: subjects.reduce((s, sub) => s + (sub.topics || []).length, 0),
    doneTopics: subjects.reduce((s, sub) => s + (sub.topics || []).filter((t) => t.completed).length, 0),
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-24 lg:pb-8 space-y-5"
      style={{
        background: "radial-gradient(ellipse 70% 35% at 50% -5%, rgba(99,102,241,0.08) 0%, transparent 55%), #0a0f1e",
      }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <span
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)", boxShadow: "0 0 20px rgba(99,102,241,0.3)" }}
            >
              📚
            </span>
            Study Planner
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {roadmap ? `AI Roadmap: ${roadmap.subject} · ${roadmap.level}` : "Track your subjects and progress"}
          </p>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2">
          {!roadmap && (
            <Link
              to="/dashboard/ai-agents"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                boxShadow: "0 0 14px rgba(99,102,241,0.3)",
              }}
            >
              <Bot size={15} /> Generate AI Roadmap
            </Link>
          )}
          {activeView === "subjects" && (
            <button
              onClick={() => setAddSubjectOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white border border-white/12 hover:border-white/20 hover:bg-white/5 transition-all"
            >
              <Plus size={15} /> Add Subject
            </button>
          )}
        </div>
      </div>

      {/* ── View toggle (only if both exist) ── */}
      {roadmap && (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/5 w-fit">
          {([["roadmap", "🗺️ AI Roadmap", Layers], ["subjects", "📘 My Subjects", BookOpen]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeView === id
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "text-slate-500 hover:text-slate-300"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════ ROADMAP VIEW ══════════════════════════════════════════════ */}
      {activeView === "roadmap" && roadmap && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={<Layers size={13} className="text-indigo-400" />} label="Phases" value={roadmapStats!.phases} sub={`${roadmap.level} level`} accent="from-indigo-500/10" />
            <StatCard icon={<CheckCircle2 size={13} className="text-emerald-400" />} label="Topics Done" value={`${roadmapStats!.doneTopics}/${roadmapStats!.totalTopics}`} sub={`${roadmapProgress}% complete`} accent="from-emerald-500/10" />
            <StatCard icon={<Clock size={13} className="text-cyan-400" />} label="Total Hours" value={`${roadmapStats!.totalHours}h`} sub={`${roadmapStats!.weeks} weeks`} accent="from-cyan-500/10" />
            <StatCard icon={<BarChart3 size={13} className="text-amber-400" />} label="Your Progress" value={`${roadmapProgress}%`} sub={roadmap.subject} accent="from-amber-500/10" />
          </div>

          {/* Roadmap progress bar */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">{roadmap.subject} Roadmap Progress</span>
              <span className="text-xs text-slate-500">{roadmapStats!.doneTopics} / {roadmapStats!.totalTopics} topics</span>
            </div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${roadmapProgress}%`,
                  background: "linear-gradient(90deg, #6366f1, #06b6d4, #10b981)",
                  boxShadow: "0 0 10px rgba(99,102,241,0.4)",
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>Started</span>
              <span>Estimated completion: {(roadmap.phases ?? [])[(roadmap.phases ?? []).length - 1]?.weekRange?.split("–")[1]?.trim() ?? "TBD"}</span>
            </div>
          </div>

          {/* Phase accordions */}
          <div className="space-y-3">
            {(roadmap.phases ?? []).map((phase, i) => {
              const mastery = masteryScores.find((m) => m.subject.toLowerCase() === roadmap.subject.toLowerCase());
              return <PhaseAccordion key={phase.id} phase={phase} index={i} mastery={mastery} />;
            })}
          </div>

          {/* CTA to generate calendar */}
          <div
            className="rounded-2xl border border-indigo-500/20 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(6,182,212,0.04) 100%)" }}
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <CalendarDays size={15} className="text-cyan-400" /> Ready to schedule?
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Run the Schedule Strategist agent to turn this roadmap into a day-by-day study calendar.
              </p>
            </div>
            <Link
              to="/dashboard/ai-agents"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shrink-0 transition-all"
              style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}
            >
              <Zap size={15} /> Run Agents
            </Link>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════ SUBJECTS VIEW ══════════════════════════════════════════════ */}
      {activeView === "subjects" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={<BookOpen size={13} className="text-indigo-400" />} label="Subjects" value={localStats.subjects} accent="from-indigo-500/10" />
            <StatCard icon={<Target size={13} className="text-cyan-400" />} label="Topics Done" value={`${localStats.doneTopics}/${localStats.topics}`} accent="from-cyan-500/10" />
            <StatCard icon={<Clock size={13} className="text-emerald-400" />} label="Hours Studied" value={`${localStats.doneHours}h`} sub={`of ${localStats.totalHours}h goal`} accent="from-emerald-500/10" />
            <StatCard icon={<Flag size={13} className="text-amber-400" />} label="Avg Progress" value={`${localStats.subjects > 0 ? Math.round((localStats.doneHours / (localStats.totalHours || 1)) * 100) : 0}%`} accent="from-amber-500/10" />
          </div>

          {/* Empty */}
          {subjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center py-16 text-center">
              <div className="text-5xl mb-4">📚</div>
              <h3 className="text-lg font-semibold text-white mb-1">No subjects yet</h3>
              <p className="text-slate-500 text-sm mb-5 max-w-sm">
                Add subjects manually to track hours and topics, or run the AI pipeline for a full roadmap.
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <button
                  onClick={() => setAddSubjectOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white border border-indigo-500/30 bg-indigo-500/15 hover:bg-indigo-500/25 transition-all"
                >
                  <Plus size={14} /> Add Subject
                </button>
                <Link
                  to="/dashboard/ai-agents"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:border-white/20 transition-all"
                >
                  <Sparkles size={14} /> AI Roadmap
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {subjects.map((sub, i) => (
                <SubjectCard
                  key={sub.id}
                  subject={sub}
                  index={i}
                  onToggleTopic={handleToggleTopic}
                  onDelete={handleDeleteSubject}
                />
              ))}

              {/* Add more */}
              <button
                onClick={() => setAddSubjectOpen(true)}
                className="w-full py-3 rounded-2xl border border-dashed border-white/10 text-sm text-slate-600 hover:text-slate-400 hover:border-white/20 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Add another subject
              </button>
            </div>
          )}
        </>
      )}

      {/* ── No roadmap empty state ── */}
      {activeView === "roadmap" && !roadmap && (
        <div
          className="rounded-2xl border border-indigo-500/20 p-10 text-center"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(6,182,212,0.04) 100%)" }}
        >
          <div className="text-5xl mb-4">🗺️</div>
          <h3 className="text-xl font-semibold text-white mb-2">No AI Roadmap Yet</h3>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            Run the <strong className="text-white">Roadmap Architect</strong> agent to generate a personalised,
            phase-by-phase learning roadmap with difficulty scores and time estimates.
          </p>
          <Link
            to="/dashboard/ai-agents"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #6366f1, #06b6d4)",
              boxShadow: "0 0 20px rgba(99,102,241,0.3)",
            }}
          >
            <Bot size={16} /> Launch AI Command Center
          </Link>
        </div>
      )}

      {/* Add subject modal */}
      <AddSubjectModal
        open={addSubjectOpen}
        onClose={() => setAddSubjectOpen(false)}
        onAdd={handleAddSubject}
      />
    </div>
  );
}


