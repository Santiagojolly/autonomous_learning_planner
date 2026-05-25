import { useEffect, useRef, useState, useCallback } from "react";
import {
    Bell,
    BellOff,
    AlertTriangle,
    Info,
    CheckCircle2,
    Trophy,
    X,
    ExternalLink,
    Loader2,
    RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router";
import { API, type ProgressAlert } from "../lib/api";

// ── Severity styles ───────────────────────────────────────────────────────────
const SEVERITY_STYLE: Record<
    ProgressAlert["severity"],
    { bg: string; border: string; icon: React.ElementType; iconCls: string }
> = {
    info: {
        bg: "bg-indigo-500/8",
        border: "border-indigo-500/20",
        icon: Info,
        iconCls: "text-indigo-400",
    },
    warning: {
        bg: "bg-amber-500/8",
        border: "border-amber-500/20",
        icon: AlertTriangle,
        iconCls: "text-amber-400",
    },
    danger: {
        bg: "bg-red-500/8",
        border: "border-red-500/20",
        icon: AlertTriangle,
        iconCls: "text-red-400",
    },
};

const TYPE_ICON: Record<ProgressAlert["type"], React.ElementType> = {
    "behind-schedule": AlertTriangle,
    "streak-at-risk": AlertTriangle,
    milestone: CheckCircle2,
    "weekly-report": Info,
    achievement: Trophy,
};

// ── Single row ────────────────────────────────────────────────────────────────
function NotifRow({
    notif,
    onRead,
}: {
    notif: ProgressAlert;
    onRead: (id: string, route?: string) => void;
}) {
    const style = SEVERITY_STYLE[notif.severity] ?? SEVERITY_STYLE.info;
    const Icon = TYPE_ICON[notif.type] ?? Info;
    const timeAgo = (() => {
        const ms = Date.now() - new Date(notif.createdAt).getTime();
        const m = Math.floor(ms / 60_000);
        const h = Math.floor(m / 60);
        const d = Math.floor(h / 24);
        if (d > 0) return `${d}d ago`;
        if (h > 0) return `${h}h ago`;
        if (m > 0) return `${m}m ago`;
        return "just now";
    })();

    return (
        <button
            onClick={() => onRead(notif.id, notif.actionRoute)}
            className={`
        w-full text-left p-3.5 rounded-xl border flex items-start gap-3 transition-all
        ${style.bg} ${style.border}
        ${notif.read ? "opacity-50" : "hover:opacity-90"}
      `}
        >
            {/* Icon */}
            <div
                className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center bg-white/5`}
            >
                <Icon size={16} className={style.iconCls} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white leading-tight">{notif.title}</p>
                    <span className="text-[10px] text-slate-600 shrink-0">{timeAgo}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{notif.message}</p>
                {notif.actionRoute && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-indigo-400">
                        <ExternalLink size={10} /> View details
                    </div>
                )}
            </div>

            {/* Unread dot */}
            {!notif.read && (
                <span className="h-2 w-2 rounded-full bg-indigo-400 shrink-0 mt-1 animate-pulse" />
            )}
        </button>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface NotificationPanelProps {
    /** Current unread count — used by parent (DashboardLayout) badge */
    unreadCount: number;
    onUnreadChange: (n: number) => void;
}

export function NotificationPanel({
    unreadCount,
    onUnreadChange,
}: NotificationPanelProps) {
    const navigate = useNavigate();
    const wrapRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [notifications, setNotifications] = useState<ProgressAlert[]>([]);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await API.getNotifications();
            const notifs = res.notifications ?? [];
            setNotifications(notifs);
            onUnreadChange(notifs.filter((n) => !n.read).length);
        } catch {
            /* swallow — not critical */
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [onUnreadChange]);

    // Load when panel first opens
    useEffect(() => {
        if (open && notifications.length === 0) load();
    }, [open, load, notifications.length]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const fn = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", fn);
        return () => document.removeEventListener("mousedown", fn);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("keydown", fn);
        return () => document.removeEventListener("keydown", fn);
    }, []);

    // ── Handlers ──────────────────────────────────────────────────────────
    async function handleRead(id: string, route?: string) {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        const newUnread = notifications.filter((n) => n.id !== id && !n.read).length;
        onUnreadChange(newUnread);

        try {
            await API.markNotificationRead(id);
        } catch { /* optimistic update already applied */ }

        if (route) {
            setOpen(false);
            navigate(route);
        }
    }

    async function markAllRead() {
        const unread = notifications.filter((n) => !n.read);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        onUnreadChange(0);
        for (const n of unread) {
            API.markNotificationRead(n.id).catch(() => { });
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div ref={wrapRef} className="relative">
            {/* Bell button */}
            <button
                id="notification-bell-btn"
                onClick={() => setOpen((v) => !v)}
                className={`relative h-9 w-9 rounded-xl flex items-center justify-center transition-all ${open
                        ? "bg-indigo-500/20 text-indigo-400"
                        : "text-slate-400 hover:text-white hover:bg-white/8"
                    }`}
            >
                <Bell size={17} />
                {unreadCount > 0 && (
                    <span
                        className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white font-bold flex items-center justify-center leading-none"
                        style={{ boxShadow: "0 0 6px rgba(239,68,68,0.6)" }}
                    >
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            <div
                className={`
          absolute right-0 top-full mt-2 w-80 z-50
          rounded-2xl border border-white/10 shadow-2xl shadow-black/60
          bg-[#0d1117]
          transition-all duration-200 origin-top-right
          ${open
                        ? "opacity-100 scale-100 pointer-events-auto"
                        : "opacity-0 scale-95 pointer-events-none"
                    }
        `}
                style={{ willChange: "transform, opacity" }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3.5 border-b border-white/8"
                    style={{
                        background:
                            "linear-gradient(135deg, rgba(99,102,241,0.07) 0%, transparent 60%)",
                    }}
                >
                    <div className="flex items-center gap-2">
                        <Bell size={14} className="text-indigo-400" />
                        <span className="text-sm font-semibold text-white">Notifications</span>
                        {unreadCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => load(true)}
                            disabled={refreshing}
                            className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                        </button>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                                Mark all read
                            </button>
                        )}
                        <button
                            onClick={() => setOpen(false)}
                            className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={18} className="animate-spin text-indigo-400" />
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <BellOff size={28} className="text-slate-700 mb-3" />
                            <p className="text-sm text-slate-500">No notifications yet</p>
                            <p className="text-xs text-slate-700 mt-1">
                                Alerts appear after you run the AI pipeline
                            </p>
                        </div>
                    ) : (
                        [...notifications]
                            .sort((a, b) => {
                                // unread first, then by date desc
                                if (a.read !== b.read) return a.read ? 1 : -1;
                                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                            })
                            .slice(0, 20)
                            .map((n) => (
                                <NotifRow key={n.id} notif={n} onRead={handleRead} />
                            ))
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="px-4 py-3 border-t border-white/5 text-center">
                        <button
                            onClick={() => {
                                setOpen(false);
                                navigate("/dashboard/insights");
                            }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                            View all in AI Insights →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
