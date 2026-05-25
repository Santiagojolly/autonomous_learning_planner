import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Flame,
  Zap,
  Bot,
  RefreshCw,
  Clock,
  CheckCircle2,
  Circle,
  Loader2,
  LayoutGrid,
  List,
  Plus,
  X,
  BookOpen,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { API, type CalendarEvent } from "../lib/api";
import { DayDetailDrawer } from "../components/DayDetailDrawer";
import { useAuth } from "../context/AuthContext";

// ── Session colours ───────────────────────────────────────────────────────────

const SESSION_COLORS: Record<string, string> = {
  Study: "bg-indigo-500",
  Review: "bg-cyan-500",
  Practice: "bg-emerald-500",
  Assessment: "bg-amber-500",
  Busy: "bg-slate-500",
};

const SESSION_PILL: Record<string, string> = {
  Study: "bg-indigo-500/20 border-indigo-500/40 text-indigo-300",
  Review: "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
  Practice: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
  Assessment: "bg-amber-500/20 border-amber-500/40 text-amber-300",
  Busy: "bg-slate-500/20 border-slate-500/40 text-slate-300",
};

type ViewMode = "month" | "list";

// ── Legend chips ──────────────────────────────────────────────────────────────

const LEGEND = [
  { label: "Study", cls: "bg-indigo-500" },
  { label: "Review", cls: "bg-cyan-500" },
  { label: "Practice", cls: "bg-emerald-500" },
  { label: "Assessment", cls: "bg-amber-500" },
  { label: "Personal", cls: "bg-slate-500" },
];

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({
  events,
  loading,
}: {
  events: CalendarEvent[];
  loading: boolean;
}) {
  const stats = API.computeStatistics(events);
  const today = new Date().toISOString().split("T")[0];
  const todaySessions = events.filter((e) => e.date === today && e.sessionType !== "Busy");
  const todayDone = todaySessions.filter((e) => e.completed).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {[
        {
          label: "Today",
          value: loading ? "…" : `${todayDone}/${todaySessions.length}`,
          sub: "sessions done",
          icon: <CalendarDays size={16} className="text-indigo-400" />,
          bg: "from-indigo-500/10 to-transparent",
        },
        {
          label: "Completion",
          value: loading ? "…" : `${stats.completionRate}%`,
          sub: `${stats.completedSessions} of ${stats.totalSessions}`,
          icon: <CheckCircle2 size={16} className="text-cyan-400" />,
          bg: "from-cyan-500/10 to-transparent",
        },
        {
          label: "Streak",
          value: loading ? "…" : `🔥 ${stats.streak}`,
          sub: "days in a row",
          icon: <Flame size={16} className="text-amber-400" />,
          bg: "from-amber-500/10 to-transparent",
        },
        {
          label: "XP Earned",
          value: loading ? "…" : `⚡ ${stats.totalXP}`,
          sub: `${stats.totalHoursStudied}h studied`,
          icon: <Zap size={16} className="text-emerald-400" />,
          bg: "from-emerald-500/10 to-transparent",
        },
      ].map((s) => (
        <div
          key={s.label}
          className={`rounded-xl border border-white/8 bg-gradient-to-br ${s.bg} bg-white/[0.02] p-3.5`}
        >
          <div className="flex items-center gap-2 mb-1">
            {s.icon}
            <span className="text-xs text-slate-500">{s.label}</span>
          </div>
          <p className="text-xl font-bold text-white">{s.value}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Month cell  ───────────────────────────────────────────────────────────────

function MonthCell({
  day,
  isToday,
  isSelected,
  events,
  onClick,
}: {
  day: number;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEvent[];
  onClick: () => void;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  
  const completed = events.filter((e) => e.completed).length;
  const allDone = events.length > 0 && completed === events.length;
  
  const missedCount = events.filter(e => {
    if (e.completed || e.sessionType === "Busy") return false;
    if (e.date < todayStr) return true;
    if (e.date === todayStr) {
      const [h, m] = e.startTime.split(':').map(Number);
      const sessionTime = new Date();
      sessionTime.setHours(h, m, 0, 0);
      return now > sessionTime;
    }
    return false;
  }).length;

  return (
    <button
      onClick={onClick}
      className={`
        relative aspect-square rounded-xl border transition-all duration-200 p-1.5 text-left group
        ${isSelected
          ? "border-indigo-500/60 bg-indigo-500/15 shadow-lg shadow-indigo-500/10"
          : isToday
            ? "border-indigo-500/30 bg-indigo-500/8"
            : "border-white/5 bg-white/[0.01] hover:border-white/12 hover:bg-white/[0.04]"
        }
        ${events.length > 0 ? "cursor-pointer" : "cursor-default"}
      `}
    >
      {/* Day number */}
      <span
        className={`text-xs font-medium ${isToday
          ? "text-indigo-400"
          : isSelected
            ? "text-white"
            : "text-slate-400 group-hover:text-slate-300"
          }`}
      >
        {day}
      </span>

      {/* All-done ring */}
      {allDone && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
      )}

      {/* Event dots */}
      {events.length > 0 && (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-0.5">
          {events.slice(0, 4).map((e) => (
            <span
              key={e.id}
              className={`h-1 flex-1 min-w-[4px] rounded-full opacity-80 ${e.completed
                ? "bg-emerald-400"
                : (() => {
                    const isMissed = !e.completed && e.sessionType !== "Busy" && (
                      e.date < todayStr || (e.date === todayStr && (() => {
                        const [h, m] = e.startTime.split(':').map(Number);
                        const sessionTime = new Date();
                        sessionTime.setHours(h, m, 0, 0);
                        return now > sessionTime;
                      })())
                    );
                    return isMissed ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" : (SESSION_COLORS[e.sessionType] ?? "bg-indigo-500");
                  })()
                }`}
            />
          ))}
          {events.length > 4 && (
            <span className="text-[8px] text-slate-600 leading-none">+{events.length - 4}</span>
          )}
        </div>
      )}
    </button>
  );
}

// ── List-view row ─────────────────────────────────────────────────────────────

function ListRow({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const isMissed = !event.completed && event.sessionType !== "Busy" && (
    event.date < todayStr || (event.date === todayStr && (() => {
      const [h, m] = event.startTime.split(':').map(Number);
      const sessionTime = new Date();
      sessionTime.setHours(h, m, 0, 0);
      return now > sessionTime;
    })())
  );

  const pillCls = isMissed ? "bg-red-500/20 border-red-500/40 text-red-400" : (SESSION_PILL[event.sessionType] ?? SESSION_PILL["Study"]);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
        isMissed 
          ? "border-red-500/20 bg-red-500/[0.03] hover:bg-red-500/[0.05]" 
          : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
      }`}
    >
      {/* Done indicator */}
      <div className="shrink-0">
        {event.completed ? (
          <CheckCircle2 size={18} className="text-emerald-400" />
        ) : (
          <Circle size={18} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
        )}
      </div>

      {/* Date chip */}
      <div className="shrink-0 w-10 text-center">
        <p className="text-[10px] text-slate-600 uppercase">
          {new Date(event.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
        </p>
        <p className="text-sm font-semibold text-white">
          {new Date(event.date + "T00:00:00").getDate()}
        </p>
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${event.completed ? "line-through text-slate-500" : "text-white"
            }`}
        >
          {event.topic}
          {isMissed && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-500/10 border border-red-500/30 text-[9px] uppercase font-bold text-red-500">
              Missed
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500 truncate">{event.subject} · {event.phase}</p>
      </div>

      {/* Right chips */}
      <div className="shrink-0 flex items-center gap-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${pillCls} hidden sm:inline-block`}>
          {event.sessionType}
        </span>
        <span className="flex items-center gap-0.5 text-xs text-slate-500">
          <Clock size={11} />
          {event.estimatedHours}h
        </span>
        <span className="flex items-center gap-0.5 text-xs text-amber-400">
          <Zap size={11} />
          {event.xpReward}
        </span>
      </div>
    </button>
  );
}

// ── Add Session Panel ─────────────────────────────────────────────────────────

function AddSessionPanel({
  onAdd,
  onClose,
}: {
  onAdd: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    subject: "",
    topic: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "10:00",
    sessionType: "Study" as "Study" | "Busy",
    difficulty: 5
  });

  const isStudy = form.sessionType === "Study";

  const submit = () => {
    if (!form.topic || (isStudy && !form.subject)) {
      toast.error("Please fill in all required fields");
      return;
    }
    onAdd(form);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus size={14} className="text-indigo-400" />
            {isStudy ? "Add Study Session" : "Quick Add: Personal Event"}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Type Toggle */}
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
            <button
              onClick={() => setForm({ ...form, sessionType: "Study" })}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${isStudy ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
            >
              Study Session
            </button>
            <button
              onClick={() => setForm({ ...form, sessionType: "Busy" })}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${!isStudy ? "bg-slate-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
            >
              Personal Event (Busy)
            </button>
          </div>

          <div className="space-y-4">
            {isStudy && (
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1.5 ml-1 italic tracking-wider">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Mathematics"
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1.5 ml-1 italic tracking-wider">
                {isStudy ? "Topic Name" : "Event Description"}
              </label>
              <input
                type="text"
                placeholder={isStudy ? "e.g. Calculus Basics" : "e.g. Gym, Work, Lunch"}
                className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1.5 ml-1 italic tracking-wider">Date</label>
                <input
                  type="date"
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-2 py-3 text-[13px] text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1.5 ml-1 italic tracking-wider">From</label>
                <input
                  type="time"
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-2 py-3 text-[13px] text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  value={form.startTime}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    const [h, m] = newStart.split(":").map(Number);
                    const newEnd = `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                    setForm({ ...form, startTime: newStart, endTime: newEnd });
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1.5 ml-1 italic tracking-wider">To</label>
                <input
                  type="time"
                  className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-2 py-3 text-[13px] text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>
          </div>

          <button
            onClick={submit}
            className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] mt-2"
            style={{
              background: isStudy
                ? "linear-gradient(135deg, #6366f1, #06b6d4)"
                : "linear-gradient(135deg, #64748b, #475569)",
              boxShadow: isStudy
                ? "0 0 16px rgba(99,102,241,0.35)"
                : "0 0 16px rgba(100,116,139,0.3)",
            }}
          >
            {isStudy ? "Schedule Study Session" : "Lock Busy Slot"}
          </button>

          {!isStudy && (
            <p className="text-[10px] text-slate-500 text-center uppercase tracking-tight font-medium">
              AIE Agent will automatically move study blocks around this event.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Calendar Page
// ─────────────────────────────────────────────────────────────────────────────

export function Calendar() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── Load events ─────────────────────────────────────────────────────────────

  const loadEvents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await API.getCalendarEvents();
      setEvents(res.events ?? []);
    } catch (err: any) {
      console.error("Failed to load calendar events:", err);
      if (!silent) toast.error("Could not load calendar", { description: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadEvents();
    else setLoading(false);
  }, [isAuthenticated, loadEvents]);

  const handleAdaptiveReschedule = async () => {
    const tid = toast.loading("AI is healing your schedule...");
    try {
      await API.adaptiveReschedule();
      toast.success("Schedule recovered! Missed tasks moved forward.", { id: tid });
      loadEvents();
    } catch {
      toast.error("Failed to reschedule", { id: tid });
    }
  };

  // ── Calendar calculations ────────────────────────────────────────────────────

  const { year, month } = {
    year: currentDate.getFullYear(),
    month: currentDate.getMonth(),
  };
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  function dateStr(day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function eventsForDay(day: number): CalendarEvent[] {
    const d = dateStr(day);
    return events.filter((e) => e.date === d);
  }

  const monthLabel = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // ── Navigation ───────────────────────────────────────────────────────────────

  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(todayStr);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleDayClick(day: number) {
    const d = dateStr(day);
    const dayEvents = eventsForDay(day);
    setSelectedDate(d);
    // If there are events open drawer, otherwise just highlight
  }

  function handleEventUpdated(updatedEvent: CalendarEvent) {
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
    );
  }

  async function handleAddSession(data: any) {
    const isBusy = data.sessionType === "Busy";
    const startTime = data.startTime;
    const endTime = data.endTime;
    const date = data.date;

    const newSession: CalendarEvent = {
      id: `man_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      subject: isBusy ? "Personal" : data.subject,
      phase: isBusy ? "Busy Block" : "Manual Entry",
      phaseId: "man",
      topicId: "man",
      estimatedHours: 1,
      completed: isBusy ? (date < todayStr) : false,
      xpReward: isBusy ? 0 : 30
    };

    // MISSION: Conflict Awareness & Self-Healing
    const hasConflict = events.some(e =>
      e.date === date &&
      !e.completed &&
      e.startTime < endTime &&
      e.endTime > startTime
    );

    if (isBusy && hasConflict) {
      const loadingToast = toast.info("Conflict detected. Activating Self-Healing Scheduler...", { duration: 3000 });
      try {
        const settings = await API.getSettings();
        const healingResult = await API.runSelfHealingScheduler({
          current_schedule: [...events, newSession] as any,
          disruption_type: "new_event",
          unfinished_topics: [], // Scheduler will detect and populate from new_event
          new_event: {
            date,
            start_time: startTime,
            end_time: endTime,
            title: data.topic
          },
          daily_available_hours: settings.settings.dailyHours || 2,
          energy_pattern: {
            peak_hours: settings.settings.timePreference === "morning" ? "08:00-11:00" : "14:00-17:00",
            low_energy_hours: "20:00-22:00"
          }
        });

        if (healingResult.success) {
          await API.saveCalendarEvents(healingResult.healed_schedule);
          setEvents(healingResult.healed_schedule);
          toast.dismiss(loadingToast);
          toast.success("Schedule repaired!", {
            description: healingResult.reasoning || "Conflict resolved."
          });
          setAddPanelOpen(false);
        } else {
          throw new Error("Healing failed");
        }
      } catch (err: any) {
        toast.dismiss(loadingToast);
        toast.error("Self-healing failed. Adding event without repair.", { description: err.message });
        const updated = [...events, newSession];
        setEvents(updated);
        await API.saveCalendarEvents(updated);
        setAddPanelOpen(false);
      }
    } else {
      const updated = [...events, newSession];
      setEvents(updated);
      try {
        await API.saveCalendarEvents(updated);
        toast.success("Session added to calendar!");
        setAddPanelOpen(false);
      } catch {
        toast.error("Failed to save session");
      }
    }
  }

  // ── List view ─────────────────────────────────────────────────────────────────

  const listEvents = events
    .filter((e) => {
      const d = new Date(e.date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

  // ── Empty state (no agent events yet) ────────────────────────────────────────

  const hasAgentEvents = events.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen pb-24 lg:pb-8"
      style={{
        background:
          "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(6,182,212,0.08) 0%, transparent 55%), #0a0f1e",
      }}
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <span
              className="h-10 w-10 rounded-xl flex items-center justify-center text-xl"
              style={{
                background: "linear-gradient(135deg, #06b6d4, #6366f1)",
                boxShadow: "0 0 20px rgba(6,182,212,0.3)",
              }}
            >
              📅
            </span>
            Study Calendar
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            AI-generated sessions · click any day to view &amp; check in
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Add Manual Session */}
          <button
            onClick={() => setAddPanelOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #6366f1, #06b6d4)",
              boxShadow: "0 0 16px rgba(99,102,241,0.3)",
            }}
          >
            <Plus size={16} strokeWidth={3} />
            Quick Add
          </button>

          {/* Refresh */}
          <button
            onClick={() => loadEvents(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/8 bg-white/[0.03] text-slate-400 hover:text-white hover:border-white/15 text-sm transition-all disabled:opacity-40"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Sync
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl border border-white/8 bg-white/[0.03]">
            <button
              onClick={() => setView("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === "month"
                ? "bg-white/10 text-white"
                : "text-slate-500 hover:text-slate-300"
                }`}
            >
              <LayoutGrid size={13} /> Month
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === "list"
                ? "bg-white/10 text-white"
                : "text-slate-500 hover:text-slate-300"
                }`}
            >
              <List size={13} /> List
            </button>
          </div>

          {/* Go to AI Agents if no events */}
          {!hasAgentEvents && !loading && (
            <button
              onClick={() => navigate("/dashboard/ai-agents")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                boxShadow: "0 0 16px rgba(99,102,241,0.3)",
              }}
            >
              <Bot size={14} />
              Generate Schedule
            </button>
          )}
        </div>
      </div>

      {/* ── Stats bar ── */}
      {!loading && <StatsBar events={events} loading={loading} />}

      {/* ── Adaptive Reschedule Alert ── */}
      {!loading && (() => {
        const missedSessions = events.filter(e => {
          if (e.completed || e.sessionType === "Busy") return false;
          const d = new Date().toISOString().split('T')[0];
          if (e.date < d) return true;
          if (e.date === d) {
             const [h, m] = e.startTime.split(':').map(Number);
             const sessionTime = new Date();
             sessionTime.setHours(h, m, 0, 0);
             return new Date() > sessionTime;
          }
          return false;
        });

        if (missedSessions.length === 0) return null;

        return (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                <RefreshCw size={20} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-white">Guardian: Streak at Risk</h3>
                <p className="text-xs text-slate-400">You have {missedSessions.length} missed sessions. Reschedule to keep your momentum.</p>
              </div>
            </div>
            <button
              onClick={handleAdaptiveReschedule}
              className="w-full sm:w-auto px-6 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]"
            >
              Heal Schedule
            </button>
          </div>
        );
      })()}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      )}

      {!loading && (
        <>
          {/* ── No events CTA ── */}
          {!hasAgentEvents && (
            <div
              className="rounded-2xl border border-indigo-500/20 p-8 mb-6 text-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(6,182,212,0.04) 100%)",
              }}
            >
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                No AI sessions yet
              </h3>
              <p className="text-slate-400 text-sm mb-5 max-w-md mx-auto">
                Run the AI Agent Pipeline to generate a personalised study calendar with
                spaced-repetition sessions, review blocks, and practice days.
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
                Open AI Command Center
              </button>
            </div>
          )}

          {/* ── Calendar card ── */}
          <div
            className="rounded-2xl border border-white/8 overflow-hidden mb-6"
            style={{ background: "rgba(13,17,23,0.8)" }}
          >
            {/* Month navigation */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-white/5"
              style={{
                background:
                  "linear-gradient(135deg, rgba(99,102,241,0.05) 0%, transparent 60%)",
              }}
            >
              <button
                onClick={prevMonth}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-white">{monthLabel}</h2>
                <button
                  onClick={goToday}
                  className="text-xs px-2.5 py-1 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all"
                >
                  Today
                </button>
              </div>

              <button
                onClick={nextMonth}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap px-5 py-2.5 border-b border-white/5">
              {LEGEND.map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${l.cls}`} />
                  <span className="text-[11px] text-slate-500">{l.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <span className="text-[11px] text-slate-500">All done</span>
              </div>
            </div>

            {/* ── Month grid ── */}
            {view === "month" && (
              <div className="p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                  {WEEK_DAYS.map((d) => (
                    <div
                      key={d}
                      className="text-center text-[11px] text-slate-600 py-1 font-medium"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1.5">
                  {/* Leading blanks */}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`blank-${i}`} className="aspect-square" />
                  ))}

                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const d = dateStr(day);
                    return (
                      <MonthCell
                        key={day}
                        day={day}
                        isToday={d === todayStr}
                        isSelected={d === selectedDate}
                        events={eventsForDay(day)}
                        onClick={() => {
                          handleDayClick(day);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── List view ── */}
            {view === "list" && (
              <div className="p-4 space-y-2">
                {listEvents.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-8">
                    No sessions in {monthLabel}
                  </p>
                ) : (
                  listEvents.map((event) => (
                    <ListRow
                      key={event.id}
                      event={event}
                      onClick={() => setSelectedDate(event.date)}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── Upcoming sessions ── */}
          {hasAgentEvents && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h3 className="text-sm font-semibold text-white">Upcoming Sessions</h3>
                <span className="text-xs text-slate-500">Next 7</span>
              </div>
              <div className="p-4 space-y-2">
                {events
                  .filter((e) => e.date >= todayStr && !e.completed)
                  .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                  .slice(0, 7)
                  .map((event) => (
                    <ListRow
                      key={event.id}
                      event={event}
                      onClick={() => setSelectedDate(event.date)}
                    />
                  ))}
                {events.filter((e) => e.date >= todayStr && !e.completed).length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-6">
                    🎉 All upcoming sessions are complete!
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Day Detail Drawer ── */}
      <DayDetailDrawer
        date={selectedDate}
        events={events}
        onClose={() => setSelectedDate(null)}
        onEventUpdated={handleEventUpdated}
      />

      {/* ── Add Session Modal ── */}
      {addPanelOpen && (
        <AddSessionPanel
          onAdd={handleAddSession}
          onClose={() => setAddPanelOpen(false)}
        />
      )}
    </div>
  );
}
