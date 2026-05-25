import { useState, useEffect, useCallback } from "react";
import {
    User,
    Mail,
    Target,
    Bell,
    Lock,
    Save,
    Loader2,
    Clock,
    CalendarDays,
    Bot,
    Shield,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    ChevronDown,
    Zap,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { API, type UserSettings, type TimePreference } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileData {
    name: string;
    email: string;
    joinDate: string;
    weeklyGoal: number;
    dailyGoal: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Section card wrapper */
function Section({
    icon,
    title,
    description,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <div
                className="flex items-center gap-3 px-5 py-4 border-b border-white/5"
                style={{
                    background: "linear-gradient(135deg, rgba(99,102,241,0.05) 0%, transparent 60%)",
                }}
            >
                <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center">
                    {icon}
                </div>
                <div>
                    <h2 className="text-sm font-semibold text-white">{title}</h2>
                    {description && (
                        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                    )}
                </div>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

/** Labelled text input */
function Field({
    id,
    label,
    type = "text",
    value,
    onChange,
    disabled,
    placeholder,
}: {
    id: string;
    label: string;
    type?: string;
    value: string;
    onChange?: (v: string) => void;
    disabled?: boolean;
    placeholder?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
            <input
                id={id}
                type={type}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-40 transition-all"
            />
        </div>
    );
}

/** Toggle row */
function ToggleRow({
    id,
    label,
    description,
    checked,
    onChange,
}: {
    id: string;
    label: string;
    description?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
            <div>
                <label htmlFor={id} className="text-sm text-white font-medium cursor-pointer">
                    {label}
                </label>
                {description && (
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                )}
            </div>
            <button
                id={id}
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`relative h-6 w-11 rounded-full transition-colors duration-200 shrink-0 ${checked ? "bg-indigo-500" : "bg-white/10"
                    }`}
                style={{ boxShadow: checked ? "0 0 10px rgba(99,102,241,0.4)" : "none" }}
            >
                <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-1"
                        }`}
                />
            </button>
        </div>
    );
}

/** Day-of-week picker */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function StudyDayPicker({
    selected,
    onChange,
}: {
    selected: number[];
    onChange: (days: number[]) => void;
}) {
    function toggle(day: number) {
        if (selected.includes(day)) {
            onChange(selected.filter((d) => d !== day));
        } else {
            onChange([...selected, day].sort());
        }
    }

    return (
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
                Study Days
            </label>
            <div className="flex gap-1.5 flex-wrap">
                {DAY_NAMES.map((name, idx) => (
                    <button
                        key={idx}
                        onClick={() => toggle(idx)}
                        className={`h-9 w-10 rounded-xl text-xs font-medium border transition-all ${selected.includes(idx)
                                ? "border-indigo-500/60 bg-indigo-500/20 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.3)]"
                                : "border-white/8 bg-white/3 text-slate-500 hover:border-white/15 hover:text-slate-300"
                            }`}
                    >
                        {name}
                    </button>
                ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5">
                {selected.length} days/week selected
            </p>
        </div>
    );
}

/** Time preference selector */
const TIME_OPTIONS: { value: TimePreference; label: string; sub: string; emoji: string }[] = [
    { value: "morning", label: "Morning", sub: "6 AM – 12 PM", emoji: "🌅" },
    { value: "afternoon", label: "Afternoon", sub: "12 PM – 6 PM", emoji: "☀️" },
    { value: "evening", label: "Evening", sub: "6 PM – 11 PM", emoji: "🌙" },
    { value: "any", label: "Any time", sub: "No preference", emoji: "🕐" },
];

function TimePreferencePicker({
    value,
    onChange,
}: {
    value: TimePreference;
    onChange: (v: TimePreference) => void;
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
                Preferred Study Time
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIME_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`p-3 rounded-xl border text-center transition-all ${value === opt.value
                                ? "border-indigo-500/60 bg-indigo-500/15 shadow-[0_0_10px_rgba(99,102,241,0.25)]"
                                : "border-white/8 bg-white/[0.02] hover:border-white/15"
                            }`}
                    >
                        <div className="text-xl mb-1">{opt.emoji}</div>
                        <p className="text-xs font-medium text-white">{opt.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{opt.sub}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Blocked date list */
function BlockedDates({
    dates,
    onChange,
}: {
    dates: string[];
    onChange: (d: string[]) => void;
}) {
    const [newDate, setNewDate] = useState("");

    function add() {
        const trimmed = newDate.trim();
        if (!trimmed || dates.includes(trimmed)) return;
        onChange([...dates, trimmed].sort());
        setNewDate("");
    }

    function remove(d: string) {
        onChange(dates.filter((x) => x !== d));
    }

    return (
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
                Blocked / Holiday Dates
            </label>
            <div className="flex gap-2 mb-3">
                <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                />
                <button
                    onClick={add}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all"
                >
                    Block
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {dates.length === 0 ? (
                    <p className="text-xs text-slate-600">No blocked dates</p>
                ) : (
                    dates.map((d) => (
                        <span
                            key={d}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300"
                        >
                            {new Date(d + "T00:00:00").toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                            })}
                            <button onClick={() => remove(d)} className="hover:text-white transition-colors">
                                ×
                            </button>
                        </span>
                    ))
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Save button
// ─────────────────────────────────────────────────────────────────────────────

function SaveBtn({
    onClick,
    saving,
    label = "Save Changes",
}: {
    onClick: () => void;
    saving: boolean;
    label?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-all active:scale-[0.98]"
            style={{
                background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                boxShadow: "0 0 14px rgba(99,102,241,0.3)",
            }}
        >
            {saving ? (
                <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : (
                <><Save size={14} /> {label}</>
            )}
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Settings Page
// ─────────────────────────────────────────────────────────────────────────────

export function Settings() {
    const { user, signOut } = useAuth();

    // ── Loading state ─────────────────────────────────────────────────────

    const [loading, setLoading] = useState(true);
    const [checkingOllama, setCheckingOllama] = useState(false);
    const [ollamaStatus, setOllamaStatus] = useState<"unknown" | "online" | "offline">("unknown");

    // ── Profile ───────────────────────────────────────────────────────────

    const [profileSaving, setProfileSaving] = useState(false);
    const [profile, setProfile] = useState<ProfileData>({
        name: "",
        email: "",
        joinDate: "",
        weeklyGoal: 30,
        dailyGoal: 5,
    });

    // ── Settings ──────────────────────────────────────────────────────────

    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settings, setSettings] = useState<UserSettings>({
        timePreference: "morning",
        studyDays: [1, 2, 3, 4, 5],
        blockedDates: [],
        dailyHours: 2,
        notificationsEnabled: true,
    });

    // Notification toggles (separate from UserSettings — local only to Profile)
    const [notifPrefs, setNotifPrefs] = useState({
        sessionReminders: true,
        weeklyReports: true,
        streakAlerts: true,
        achievements: true,
    });

    // ── Password ──────────────────────────────────────────────────────────

    const [pwSaving, setPwSaving] = useState(false);
    const [pwForm, setPwForm] = useState({
        current: "",
        next: "",
        confirm: "",
    });

    // ── Load ──────────────────────────────────────────────────────────────

    const loadAll = useCallback(async () => {
        try {
            const [profileRes, settingsRes] = await Promise.all([
                API.getProfile().catch(() => null),
                API.getSettings().catch(() => null),
            ]);

            if (profileRes?.profile) {
                const p = profileRes.profile;
                setProfile({
                    name: p.name || user?.name || "",
                    email: p.email || user?.email || "",
                    joinDate: p.joinDate
                        ? new Date(p.joinDate).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                        })
                        : "February 2026",
                    weeklyGoal: p.weeklyGoal ?? 30,
                    dailyGoal: p.dailyGoal ?? 5,
                });
            } else if (user) {
                setProfile((prev) => ({
                    ...prev,
                    name: user.name || "",
                    email: user.email || "",
                }));
            }

            if (settingsRes?.settings) {
                setSettings(settingsRes.settings);
            }
        } catch (err) {
            console.error("Settings load error:", err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // ── Check Ollama ──────────────────────────────────────────────────────

    async function checkOllama() {
        setCheckingOllama(true);
        try {
            const res = await fetch("http://localhost:11434/api/tags", {
                signal: AbortSignal.timeout(3000),
            });
            setOllamaStatus(res.ok ? "online" : "offline");
        } catch {
            setOllamaStatus("offline");
        } finally {
            setCheckingOllama(false);
        }
    }

    // ── Save profile ──────────────────────────────────────────────────────

    async function saveProfile() {
        setProfileSaving(true);
        try {
            await API.saveProfile({
                name: profile.name,
                email: profile.email,
                weeklyGoal: profile.weeklyGoal,
                dailyGoal: profile.dailyGoal,
            });
            toast.success("Profile saved!");
        } catch (err: any) {
            toast.error("Failed to save profile", { description: err.message });
        } finally {
            setProfileSaving(false);
        }
    }

    // ── Save settings (AI + schedule settings) ────────────────────────────

    async function saveSettings() {
        setSettingsSaving(true);
        try {
            await API.saveSettings(settings);
            toast.success("Settings saved!", {
                description: "Next pipeline run will use these preferences.",
            });
        } catch (err: any) {
            toast.error("Failed to save settings", { description: err.message });
        } finally {
            setSettingsSaving(false);
        }
    }

    // ── Change password (stub) ────────────────────────────────────────────

    async function changePassword() {
        if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
            toast.error("Please fill in all password fields");
            return;
        }
        if (pwForm.next !== pwForm.confirm) {
            toast.error("New passwords do not match");
            return;
        }
        if (pwForm.next.length < 8) {
            toast.error("Password must be at least 8 characters");
            return;
        }
        setPwSaving(true);
        try {
            await new Promise((r) => setTimeout(r, 800)); // stub
            toast.success("Password updated!");
            setPwForm({ current: "", next: "", confirm: "" });
        } finally {
            setPwSaving(false);
        }
    }

    // ── Loading ───────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            </div>
        );
    }

    const initials = profile.name
        ? profile.name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase()
        : "U";

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div
            className="min-h-screen pb-24 lg:pb-8 space-y-5"
            style={{
                background:
                    "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(99,102,241,0.08) 0%, transparent 55%), #0a0f1e",
            }}
        >
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <span
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-xl"
                        style={{
                            background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                            boxShadow: "0 0 20px rgba(99,102,241,0.3)",
                        }}
                    >
                        ⚙️
                    </span>
                    Settings
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                    Profile, schedule preferences, AI configuration
                </p>
            </div>

            {/* ── Profile ── */}
            <Section
                icon={<User size={16} className="text-indigo-400" />}
                title="Profile"
                description="Your account information"
            >
                {/* Avatar */}
                <div className="flex items-center gap-4 mb-5">
                    <div
                        className="h-16 w-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0"
                        style={{
                            background: "linear-gradient(135deg, #6366f1, #a855f7)",
                            boxShadow: "0 0 20px rgba(99,102,241,0.4)",
                        }}
                    >
                        {initials}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">{profile.name || "Your Name"}</p>
                        <p className="text-xs text-slate-500">{profile.email}</p>
                        <p className="text-xs text-slate-600 mt-0.5">Member since {profile.joinDate}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    <Field
                        id="name"
                        label="Full Name"
                        value={profile.name}
                        onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
                    />
                    <Field
                        id="email"
                        label="Email"
                        type="email"
                        value={profile.email}
                        onChange={(v) => setProfile((p) => ({ ...p, email: v }))}
                    />
                </div>

                {/* Study goals */}
                <div className="rounded-xl bg-white/3 border border-white/5 p-4 mb-5">
                    <p className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-2">
                        <Target size={13} /> Study Goals
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1.5">
                                Weekly goal: <span className="text-white">{profile.weeklyGoal}h</span>
                            </label>
                            <input
                                type="range"
                                min={5}
                                max={60}
                                step={1}
                                value={profile.weeklyGoal}
                                onChange={(e) =>
                                    setProfile((p) => ({ ...p, weeklyGoal: parseInt(e.target.value) }))
                                }
                                className="w-full accent-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1.5">
                                Daily goal: <span className="text-white">{profile.dailyGoal}h</span>
                            </label>
                            <input
                                type="range"
                                min={0.5}
                                max={12}
                                step={0.5}
                                value={profile.dailyGoal}
                                onChange={(e) =>
                                    setProfile((p) => ({ ...p, dailyGoal: parseFloat(e.target.value) }))
                                }
                                className="w-full accent-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                <SaveBtn onClick={saveProfile} saving={profileSaving} />
            </Section>

            {/* ── Schedule Preferences ── */}
            <Section
                icon={<CalendarDays size={16} className="text-cyan-400" />}
                title="Schedule Preferences"
                description="Controls how Agent 2 builds your study calendar"
            >
                <div className="space-y-5">
                    <TimePreferencePicker
                        value={settings.timePreference}
                        onChange={(v) => setSettings((s) => ({ ...s, timePreference: v }))}
                    />

                    <StudyDayPicker
                        selected={settings.studyDays}
                        onChange={(days) => setSettings((s) => ({ ...s, studyDays: days }))}
                    />

                    {/* Daily hours for rescheduling */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">
                            Daily Study Hours (for Agent scheduling):{" "}
                            <span className="text-white">{settings.dailyHours}h</span>
                        </label>
                        <input
                            type="range"
                            min={0.5}
                            max={12}
                            step={0.5}
                            value={settings.dailyHours}
                            onChange={(e) =>
                                setSettings((s) => ({ ...s, dailyHours: parseFloat(e.target.value) }))
                            }
                            className="w-full accent-cyan-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                            <span>0.5h (minimalist)</span>
                            <span>12h (intensive)</span>
                        </div>
                    </div>

                    <BlockedDates
                        dates={settings.blockedDates}
                        onChange={(d) => setSettings((s) => ({ ...s, blockedDates: d }))}
                    />

                    <SaveBtn onClick={saveSettings} saving={settingsSaving} label="Save Schedule Prefs" />
                </div>
            </Section>

            {/* ── Notifications ── */}
            <Section
                icon={<Bell size={16} className="text-amber-400" />}
                title="Notifications"
                description="Choose what alerts to receive"
            >
                <ToggleRow
                    id="notif-sessions"
                    label="Session Reminders"
                    description="Get reminded 15 minutes before a scheduled session"
                    checked={notifPrefs.sessionReminders}
                    onChange={(v) => setNotifPrefs((n) => ({ ...n, sessionReminders: v }))}
                />
                <ToggleRow
                    id="notif-weekly"
                    label="Weekly Progress Reports"
                    description="Progress Oracle generates a summary each Sunday"
                    checked={notifPrefs.weeklyReports}
                    onChange={(v) => setNotifPrefs((n) => ({ ...n, weeklyReports: v }))}
                />
                <ToggleRow
                    id="notif-streak"
                    label="Streak Alerts"
                    description="Warning when your streak is at risk of breaking"
                    checked={notifPrefs.streakAlerts}
                    onChange={(v) => setNotifPrefs((n) => ({ ...n, streakAlerts: v }))}
                />
                <ToggleRow
                    id="notif-achievements"
                    label="Achievement Unlocks"
                    description="Celebrate new milestones with a notification"
                    checked={notifPrefs.achievements}
                    onChange={(v) => setNotifPrefs((n) => ({ ...n, achievements: v }))}
                />
                <ToggleRow
                    id="master-notif"
                    label="Master Switch"
                    description="Disable all notifications at once"
                    checked={settings.notificationsEnabled}
                    onChange={(v) => setSettings((s) => ({ ...s, notificationsEnabled: v }))}
                />
                <div className="pt-3">
                    <SaveBtn
                        onClick={saveSettings}
                        saving={settingsSaving}
                        label="Save Notification Prefs"
                    />
                </div>
            </Section>

            {/* ── AI / Ollama ── */}
            <Section
                icon={<Bot size={16} className="text-emerald-400" />}
                title="AI Configuration"
                description="Local Ollama model settings · no API key required"
            >
                <div className="space-y-4">
                    {/* Ollama status */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/5">
                        <div className="flex items-center gap-3">
                            <div
                                className={`h-2.5 w-2.5 rounded-full ${ollamaStatus === "online"
                                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                                        : ollamaStatus === "offline"
                                            ? "bg-red-400"
                                            : "bg-slate-500"
                                    }`}
                            />
                            <div>
                                <p className="text-sm text-white font-medium">
                                    Ollama:{" "}
                                    <span
                                        className={
                                            ollamaStatus === "online"
                                                ? "text-emerald-400"
                                                : ollamaStatus === "offline"
                                                    ? "text-red-400"
                                                    : "text-slate-400"
                                        }
                                    >
                                        {ollamaStatus === "unknown" ? "Not checked" : ollamaStatus}
                                    </span>
                                </p>
                                <p className="text-xs text-slate-500">
                                    http://localhost:11434
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={checkOllama}
                            disabled={checkingOllama}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
                        >
                            <RefreshCw size={12} className={checkingOllama ? "animate-spin" : ""} />
                            Check
                        </button>
                    </div>

                    {/* Architecture explainer */}
                    <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-4 text-xs text-slate-400 space-y-2">
                        <p className="font-semibold text-indigo-300 flex items-center gap-2">
                            <Zap size={12} /> How AI works in this app
                        </p>
                        <p>
                            All 3 agents (Roadmap Architect, Schedule Strategist, Progress Oracle) run{" "}
                            <strong className="text-white">100% locally</strong> on your machine —
                            no external API keys, no subscription fees.
                        </p>
                        <div className="space-y-1">
                            <div className="flex items-start gap-2">
                                <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                                <span>
                                    <strong className="text-white">Ollama online</strong> — agents use your
                                    local LLM (llama3, mistral, etc.)
                                </span>
                            </div>
                            <div className="flex items-start gap-2">
                                <CheckCircle2 size={12} className="text-cyan-400 mt-0.5 shrink-0" />
                                <span>
                                    <strong className="text-white">Ollama offline</strong> — agents fall back
                                    to smart deterministic algorithms (no AI, still useful)
                                </span>
                            </div>
                        </div>

                        <div className="pt-1 text-[10px] text-slate-600 border-t border-white/5">
                            Install Ollama: brew install ollama · ollama pull llama3
                        </div>
                    </div>

                    {/* Ollama setup instructions */}
                    {ollamaStatus === "offline" && (
                        <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-3 text-xs text-amber-300">
                            <p className="font-semibold flex items-center gap-2 mb-1">
                                <AlertTriangle size={12} /> Ollama not detected
                            </p>
                            <p className="text-amber-400/70">
                                The app works fine in mock mode. To enable real AI: install Ollama at{" "}
                                <a
                                    href="https://ollama.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-amber-300"
                                >
                                    ollama.com
                                </a>
                                , then run <code className="bg-black/30 px-1 rounded">ollama pull llama3</code>.
                            </p>
                        </div>
                    )}
                </div>
            </Section>

            {/* ── Security ── */}
            <Section
                icon={<Lock size={16} className="text-slate-400" />}
                title="Security"
                description="Change your password"
            >
                <div className="space-y-3 max-w-sm">
                    <Field
                        id="current-pw"
                        label="Current Password"
                        type="password"
                        value={pwForm.current}
                        onChange={(v) => setPwForm((f) => ({ ...f, current: v }))}
                        placeholder="••••••••"
                    />
                    <Field
                        id="new-pw"
                        label="New Password"
                        type="password"
                        value={pwForm.next}
                        onChange={(v) => setPwForm((f) => ({ ...f, next: v }))}
                        placeholder="Min. 8 characters"
                    />
                    <Field
                        id="confirm-pw"
                        label="Confirm New Password"
                        type="password"
                        value={pwForm.confirm}
                        onChange={(v) => setPwForm((f) => ({ ...f, confirm: v }))}
                        placeholder="••••••••"
                    />
                    <SaveBtn onClick={changePassword} saving={pwSaving} label="Update Password" />
                </div>
            </Section>

            {/* ── Danger Zone ── */}
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-red-500/10">
                    <h2 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                        <Shield size={14} /> Danger Zone
                    </h2>
                </div>
                <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-sm text-white font-medium">Delete Account</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Permanently delete your account and all study data. This cannot be undone.
                        </p>
                    </div>
                    <button
                        onClick={() => toast.error("Contact support to delete your account.")}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all"
                    >
                        <Trash2 size={14} />
                        Delete Account
                    </button>
                </div>
            </div>
        </div>
    );
}
