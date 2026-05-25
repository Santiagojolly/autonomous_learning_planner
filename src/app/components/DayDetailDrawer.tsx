import React, { useState, useEffect, useRef } from "react";
import {
    Zap,
    Send,
    MessageSquare,
    RotateCcw,
    X,
    CheckCircle2,
    Circle,
    Clock,
    Flame,
    Star,
    BookOpen,
    Repeat2,
    Dumbbell,
    ClipboardList,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Loader2,
    Youtube,
    FileText,
    LayoutList,
    History,
    Sparkles,
    Search,
} from "lucide-react";
import { API, askSynapse, type CalendarEvent, type TopicRecommendation } from "../lib/api";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DayDetailDrawerProps {
    /** YYYY-MM-DD date string of the selected day, or null to close */
    date: string | null;
    /** All calendar events (pre-loaded for performance) */
    events: CalendarEvent[];
    /** Called when the drawer should close */
    onClose: () => void;
    /** Called after a session is marked complete so the parent can re-fetch */
    onEventUpdated: (updatedEvent: CalendarEvent) => void;
}

interface CheckInState {
    confidence: number;       // 1–5
    resources: "yes" | "partial" | "no";
    needsMoreTime: boolean;
    timeSpent: number;
}

// ── Session-type icons & colours ──────────────────────────────────────────────

const SESSION_META: Record<
    string,
    { icon: React.ElementType; color: string; bg: string; label: string }
> = {
    Study: {
        icon: BookOpen,
        color: "text-indigo-400",
        bg: "bg-indigo-500/15 border-indigo-500/30",
        label: "Study",
    },
    Review: {
        icon: Repeat2,
        color: "text-cyan-400",
        bg: "bg-cyan-500/15 border-cyan-500/30",
        label: "Review",
    },
    Practice: {
        icon: Dumbbell,
        color: "text-emerald-400",
        bg: "bg-emerald-500/15 border-emerald-500/30",
        label: "Practice",
    },
    Assessment: {
        icon: ClipboardList,
        color: "text-amber-400",
        bg: "bg-amber-500/15 border-amber-500/30",
        label: "Assessment",
    },
    Busy: {
        icon: Clock,
        color: "text-slate-400",
        bg: "bg-slate-500/15 border-slate-500/30",
        label: "Personal",
    }
};

function getSessionMeta(type: string) {
    return SESSION_META[type] ?? SESSION_META["Study"];
}

// ── Difficulty dots ───────────────────────────────────────────────────────────

function DifficultyDots({ value }: { value: number }) {
    const filled = Math.round(value / 2); // 1-10 → 1-5
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${i < filled
                        ? value <= 3
                            ? "bg-emerald-400"
                            : value <= 6
                                ? "bg-amber-400"
                                : "bg-red-400"
                        : "bg-white/10"
                        }`}
                />
            ))}
        </div>
    );
}

// ── Individual Session Card ───────────────────────────────────────────────────

function SessionCard({
    event,
    onComplete,
}: {
    event: CalendarEvent;
    onComplete: (event: CalendarEvent, checkIn: CheckInState) => Promise<void>;
}) {
    const [expanded, setExpanded] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [checkIn, setCheckIn] = useState<CheckInState>({
        confidence: 3,
        resources: "yes",
        needsMoreTime: false,
        timeSpent: event.estimatedHours,
    });

    const [recs, setRecs] = useState<TopicRecommendation | null>(null);
    const [showRecs, setShowRecs] = useState(false);
    const [strategy, setStrategy] = useState("");
    const [loadingRecs, setLoadingRecs] = useState(false);
    const [showQuiz, setShowQuiz] = useState(false);
    const [showNotes, setShowNotes] = useState(false);

    // AI Chat State
    const [chatInput, setChatInput] = useState("");
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'aria', content: string }[]>([]);
    const [isAsking, setIsAsking] = useState(false);
    const [chatPersona, setChatPersona] = useState<"tutor" | "examiner" | "hacker">("tutor");
    // Flashcard State
    const [showFlashcards, setShowFlashcards] = useState(false);
    const [cardIndex, setCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    // Initial Load: Fetch History & Cached Recs
    useEffect(() => {
        if (showNotes && recs) {
            import("../lib/api").then(api => {
                api.getChatHistory(recs.topic, recs.subject).then(res => {
                    if (res.history) setChatHistory(res.history);
                });
            });
        }
    }, [showNotes, recs]);

    // Check for cached recs when card is expanded
    useEffect(() => {
        if (expanded && !recs && !loadingRecs) {
            fetchSYNAPSE();
        }
    }, [expanded]);

    const handleAsk = async () => {
        if (!chatInput.trim() || !recs || isAsking) return;
        const msg = chatInput;
        setChatInput("");
        setChatHistory((prev: { role: 'user' | 'aria'; content: string }[]) => [...prev, { role: 'user', content: msg }]);
        setIsAsking(true);

        try {
            const res = await askSynapse(recs.topic, recs.subject, msg, chatPersona);
            setChatHistory(res.history || []); // Use server-persisted history
        } catch (err) {
            toast.error("SYNAPSE is busy. Try again.");
        } finally {
            setIsAsking(false);
        }
    };

    const downloadWorksheet = () => {
        if (!recs) return;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Practice Worksheet: ${recs.topic}</title>
                        <style>
                            body { font-family: sans-serif; padding: 40px; line-height: 1.6; }
                            h1 { color: #333; border-bottom: 2px solid #555; padding-bottom: 10px; }
                            .topic { color: #666; font-style: italic; margin-bottom: 30px; }
                            .question { margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-left: 5px solid #6366f1; }
                            .footer { margin-top: 50px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <h1>Practice Worksheet: ${recs.topic}</h1>
                        <div class="topic">Subject: ${recs.subject} | Difficulty: Exam-Level</div>
                        ${recs.recommended_resources.practice_questions.questions?.map((q: string, i: number) => `
                            <div class="question">
                                <strong>Question ${i + 1}:</strong><br/>
                                ${q}
                            </div>
                        `).join('')}
                        <div class="footer">Generated by Academic Intelligence Planner - SYNAPSE Research Core</div>
                        <script>window.onload = () => { window.print(); window.close(); }</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const downloadPYQ = () => {
        if (!recs) return;
        const pyqs = recs.recommended_resources.previous_year_questions.pyq_questions;
        if (!pyqs || pyqs.length === 0) { toast.error("No PYQs found. Try curating again."); return; }
        const gateQs = pyqs.filter(q => q.exam === 'GATE');
        const btechQs = pyqs.filter(q => q.exam === 'B.Tech');
        const ktuUrl = recs.recommended_resources.previous_year_questions.url;
        const w = window.open('', '_blank');
        if (w) {
            w.document.write(`<html><head><title>PYQ: ${recs.topic}</title><style>
                *{box-sizing:border-box}
                body{font-family:'Segoe UI',sans-serif;padding:48px;color:#1a1a2e;line-height:1.7;background:#fff}
                h1{font-size:26px;border-bottom:4px solid #6366f1;padding-bottom:12px;color:#1e1b4b}
                .badge{display:inline-block;background:#6366f1;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;margin-left:10px;vertical-align:middle}
                h2{font-size:15px;margin-top:36px;padding:10px 16px;border-radius:8px;letter-spacing:.02em}
                .gate{background:#eef2ff;color:#3730a3;border-left:6px solid #6366f1}
                .btech{background:#ecfdf5;color:#065f46;border-left:6px solid #10b981}
                .ktu{background:#fffbeb;color:#92400e;border-left:6px solid #f59e0b}
                .q{margin-bottom:14px;padding:14px 16px;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb}
                .q:hover{border-color:#6366f1}
                .meta{font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;margin-bottom:6px;letter-spacing:.05em}
                .paper-link{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:10px;text-decoration:none;color:#1e1b4b;background:#f9fafb}
                .paper-link:hover{background:#eef2ff;border-color:#6366f1}
                .paper-link .yr{font-weight:700;font-size:15px;color:#6366f1}
                .paper-link .dl{background:#6366f1;color:#fff;padding:4px 14px;border-radius:16px;font-size:12px;font-weight:700}
                .footer{margin-top:60px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:20px}
            </style></head><body>
                <h1>🎯 KTU + GATE Question Bank <span class="badge">${recs.subject}</span></h1>
                <p style="color:#6b7280;font-size:13px;margin-top:4px">Topic: <b>${recs.topic}</b> &nbsp;|&nbsp; Source: ktunotes.in + GATE Archive</p>

                <h2 class="ktu">📄 KTU B.Tech Previous Year Question Papers (Direct Download)</h2>
                <p style="font-size:12px;color:#78716c;margin-bottom:16px">Click any year to open the actual question paper PDF in a new tab.</p>
                ${btechQs.length > 0 ? btechQs.map((q: any, i: number) => `
                    <a class="paper-link" href="${q.url || ktuUrl}" target="_blank">
                        <span><span class="yr">B.Tech ${q.year}</span> &nbsp;—&nbsp; ${recs.subject} Question Paper</span>
                        <span class="dl">Open PDF ↗</span>
                    </a>
                `).join('') : `<a class="paper-link" href="${ktuUrl}" target="_blank"><span class="yr">KTU Question Papers Portal</span><span class="dl">Open ↗</span></a>`}

                <h2 class="gate">⚡ GATE Previous Year Questions (${gateQs.length} MCQs)</h2>
                ${gateQs.map((q: any, i: number) => `<div class="q"><div class="meta">GATE ${q.year} — MCQ Q${i + 1}</div>${q.question}</div>`).join('')}

                <h2 class="btech">📝 B.Tech Theory Questions (Descriptive)</h2>
                ${btechQs.map((q: any, i: number) => `<div class="q"><div class="meta">B.Tech ${q.year} — Q${i + 1}</div>${q.question}</div>`).join('')}

                <div class="footer">Academic Intelligence Planner — SYNAPSE Research Core &nbsp;·&nbsp; Powered by ktunotes.in &amp; GateOverflow</div>
                <script>window.onload=()=>{window.print();}</script>
            </body></html>`);
            w.document.close();
        }
    };

    const fetchSYNAPSE = async () => {
        if (showRecs) {
            setShowRecs(false);
            return;
        }

        // If already loaded in state, just show
        if (recs) {
            setShowRecs(true);
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

    const meta = getSessionMeta(event.sessionType);
    const Icon = meta.icon;

    async function handleComplete() {
        setCompleting(true);
        try {
            await onComplete(event, checkIn);
            setExpanded(false);
        } finally {
            setCompleting(false);
        }
    }

    return (
        <div
            className={`
        rounded-xl border transition-all duration-300
        ${event.completed
                    ? "border-emerald-500/20 bg-emerald-500/5 opacity-70"
                    : `border ${meta.bg}`
                }
        overflow-hidden
      `}
        >
            {/* Session header */}
            <div className="p-3.5">
                <div className="flex items-start gap-3">
                    <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${event.completed ? "bg-emerald-500/20" : meta.bg
                            }`}
                    >
                        {event.completed ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" size={18} />
                        ) : (
                            <Icon className={`${meta.color}`} size={18} />
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white truncate">{event.topic}</span>
                            {event.completed && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                                    ✓ Done
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{event.subject} · {event.phase}</p>

                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                                <Clock size={11} />
                                {event.startTime} – {event.endTime}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-md border ${meta.bg} ${meta.color} font-medium`}>
                                {meta.label}
                            </span>
                            <DifficultyDots value={event.difficulty} />
                            <span className="flex items-center gap-1 text-xs text-amber-400">
                                <Zap size={11} />
                                {event.xpReward} XP
                            </span>
                        </div>
                    </div>

                    {/* Intelligence Action */}
                    {!event.completed && event.sessionType !== "Busy" && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                fetchSYNAPSE();
                            }}
                            disabled={loadingRecs}
                            className={`shrink-0 h-8 px-3 rounded-lg flex items-center gap-1.5 border transition-all duration-300 ${showRecs
                                ? "bg-gradient-to-r from-indigo-500/30 to-violet-500/20 border-indigo-400/50 text-indigo-200 shadow-lg shadow-indigo-500/20"
                                : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:shadow-md hover:shadow-indigo-500/10"
                                } ${loadingRecs ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {loadingRecs ? (
                                <Loader2 size={12} className="animate-spin text-indigo-300" />
                            ) : (
                                <Sparkles size={12} className={showRecs ? "animate-pulse text-indigo-200" : ""} />
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wider">
                                {loadingRecs ? 'Thinking…' : showRecs ? 'SYNAPSE ✓' : 'Curate'}
                            </span>
                        </button>
                    )}

                    {!event.completed && (
                        <button
                            onClick={() => setExpanded((v) => !v)}
                            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    )}
                </div>
            </div>

            {/* SYNAPSE Recommendations Panel */}
            {showRecs && recs && (
                <div className="px-3.5 pb-3.5 pt-0 animate-in fade-in slide-in-from-top-2 duration-400">
                    <div className="rounded-xl border border-indigo-500/20 overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.04) 100%)', boxShadow: '0 0 20px rgba(99,102,241,0.08) inset' }}>
                        <div className="p-2.5 border-b border-indigo-500/15 flex items-center justify-between"
                            style={{ background: 'linear-gradient(90deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 100%)' }}>
                            <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles size={10} className="animate-pulse" />
                                SYNAPSE Research Intelligence
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-bold">● LIVE</span>
                                <span className="text-[8px] text-indigo-400/70 font-medium">Exam-Match</span>
                            </div>
                        </div>

                        <div className="p-3 space-y-3">
                            {showFlashcards ? (
                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                            <Zap size={9} /> Mastery Flashcards
                                        </span>
                                        <button onClick={() => setShowFlashcards(false)} className="text-[9px] text-slate-500 hover:text-white transition-colors">← Back</button>
                                    </div>

                                    {/* 3D Card Area */}
                                    <div className="perspective-1000 min-h-[160px] relative mt-2 group">
                                        <div
                                            onClick={() => setIsFlipped(!isFlipped)}
                                            style={{ transformStyle: 'preserve-3d' }}
                                            className={`relative w-full h-40 transition-all duration-500 cursor-pointer ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                                        >
                                            {/* Front */}
                                            <div className="absolute inset-0 [backface-visibility:hidden] bg-gradient-to-br from-white/10 to-white/5 rounded-2xl border border-white/10 flex flex-col items-center justify-center p-6 text-center shadow-xl overflow-hidden">
                                                <div className="absolute top-2 left-3 text-[8px] font-bold text-amber-500/50 uppercase tracking-tighter">Question</div>
                                                <p className="text-[12px] font-bold text-white leading-tight">
                                                    {((recs.recommended_resources as any).flashcards || [])[cardIndex]?.question}
                                                </p>
                                                <div className="mt-4 flex items-center gap-2 text-amber-400/60 animate-pulse text-[9px]">
                                                    <RotateCcw size={10} /> Flip to reveal
                                                </div>
                                            </div>

                                            {/* Back */}
                                            <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-indigo-500/10 to-indigo-900/40 rounded-2xl border border-indigo-500/30 flex flex-col items-center justify-center p-6 text-center shadow-xl">
                                                <div className="absolute top-2 left-3 text-[8px] font-bold text-indigo-400/50 uppercase tracking-tighter">Answer</div>
                                                <p className="text-[11px] text-slate-200 leading-relaxed italic">
                                                    {((recs.recommended_resources as any).flashcards || [])[cardIndex]?.answer}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex gap-2">
                                        <button
                                            disabled={cardIndex === 0}
                                            onClick={(e) => { e.stopPropagation(); setCardIndex((prev: number) => prev - 1); setIsFlipped(false); }}
                                            className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-[10px] font-medium disabled:opacity-20"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const total = ((recs.recommended_resources as any).flashcards || []).length;
                                                if (cardIndex < total - 1) {
                                                    setCardIndex(cardIndex + 1);
                                                    setIsFlipped(false);
                                                } else {
                                                    setShowFlashcards(false);
                                                    toast.success("Topics mastered!");
                                                }
                                            }}
                                            className="flex-[2] py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold hover:bg-amber-500/30"
                                        >
                                            {cardIndex === ((recs.recommended_resources as any).flashcards || []).length - 1 ? "Finish Check" : "Next Card"}
                                        </button>
                                    </div>
                                </div>
                            ) : showQuiz ? (
                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                            <Search size={9} /> Practice Questions
                                        </span>
                                        <button onClick={() => setShowQuiz(false)} className="text-[9px] text-slate-500 hover:text-white transition-colors">← Back</button>
                                    </div>
                                    <div className="rounded-xl border border-white/8 max-h-[280px] overflow-y-auto custom-scrollbar bg-black/20">
                                        {recs.recommended_resources.practice_questions.questions?.map((q, idx) => (
                                            <div key={idx} className="flex gap-3 p-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors group/q">
                                                <span className="text-[9px] font-bold text-emerald-400/60 mt-0.5 shrink-0 w-4 text-right">{idx + 1}.</span>
                                                <p className="text-[10.5px] text-slate-300 leading-relaxed group-hover/q:text-white transition-colors">{q}</p>
                                            </div>
                                        )) || (
                                                <p className="text-center text-[10px] text-slate-500 py-6 italic">No questions generated.</p>
                                            )}
                                    </div>
                                    <button
                                        onClick={() => downloadWorksheet()}
                                        className="w-full text-center text-[10px] py-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors font-bold"
                                    >
                                        📥 Download Practice PDF
                                    </button>
                                </div>
                            ) : showNotes ? (
                                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                                            <Sparkles size={9} /> SYNAPSE Study Intelligence
                                        </span>
                                        <button onClick={() => setShowNotes(false)} className="text-[9px] text-slate-500 hover:text-white transition-colors">← Back</button>
                                    </div>
                                    <div className="bg-black/20 rounded-xl border border-white/8 max-h-[350px] overflow-y-auto custom-scrollbar p-4 space-y-3">
                                        {(recs.recommended_resources.cheat_sheet_markdown || '').split('\n').map((line: string, idx: number) => {
                                            if (line.startsWith('# ')) return <h1 key={idx} className="text-[14px] font-bold text-white mb-2">{line.slice(2)}</h1>;
                                            if (line.startsWith('## ')) return <h2 key={idx} className="text-[12px] font-bold text-indigo-300 mt-4">{line.slice(3)}</h2>;
                                            if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) return (
                                                <div key={idx} className="flex gap-2 text-[10.5px] pl-1"><span className="text-indigo-400 shrink-0 font-bold">•</span><span className="text-slate-100" dangerouslySetInnerHTML={{ __html: line.trim().slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>') }} /></div>
                                            );
                                            return line.trim() === '' ? <div key={idx} className="h-1" /> : (
                                                <p key={idx} className="text-[10.5px] text-slate-100 leading-relaxed" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>') }} />
                                            );
                                        })}

                                        <div className="mt-6 pt-4 border-t border-indigo-500/20">
                                            <div className="flex items-center gap-2 mb-3">
                                                <MessageSquare size={13} className="text-indigo-400 fill-indigo-400/10" />
                                                <span className="text-[11px] font-bold text-white tracking-wide">Ask SYNAPSE</span>

                                                {/* Persona Selector */}
                                                <div className="flex gap-1.5 ml-auto bg-black/40 p-1 rounded-lg border border-white/5">
                                                    {(['tutor', 'examiner', 'hacker'] as const).map(p => (
                                                        <button
                                                            key={p}
                                                            onClick={() => setChatPersona(p)}
                                                            className={`text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter transition-all ${chatPersona === p
                                                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                                                : 'text-slate-500 hover:text-slate-300'
                                                                }`}
                                                        >
                                                            {p}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-2 mb-3">
                                                {chatHistory.map((chat, i) => (
                                                    <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`p-3 rounded-2xl text-[10.5px] max-w-[90%] leading-relaxed ${chat.role === 'user'
                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/10'
                                                            : 'bg-white/10 text-slate-200 border border-white/5'
                                                            }`}>
                                                            {chat.content.split('\n').map((line: string, lIdx: number) => {
                                                                if (line.startsWith('# ')) return <h1 key={lIdx} className="text-[14px] font-bold text-white mb-2 mt-2">{line.slice(2)}</h1>;
                                                                if (line.startsWith('## ')) return <h2 key={lIdx} className="text-[12.5px] font-bold text-indigo-300 mb-2 mt-2">{line.slice(3)}</h2>;
                                                                if (line.startsWith('### ')) return <h3 key={lIdx} className="text-[11px] text-white font-bold mb-2 mt-1 flex items-center gap-1.5">{line.slice(4)}</h3>;
                                                                if (line.startsWith('```')) return null; // Simple code block skip for now

                                                                const listMatch = line.trim().match(/^(\* |- |\d+\.\s)(.*)/);
                                                                const isListItem = !!listMatch;
                                                                const contentLine = isListItem ? listMatch[2] : line;
                                                                const formatted = contentLine.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');

                                                                if (isListItem) {
                                                                    const marker = listMatch[1].trim();
                                                                    const displayMarker = marker === '*' || marker === '-' ? '•' : marker;
                                                                    return (
                                                                        <div key={lIdx} className="flex gap-2 text-[10.5px] pl-1 mb-1.5">
                                                                            <span className="text-indigo-400 shrink-0 font-bold">{displayMarker}</span>
                                                                            <span className="text-slate-100" dangerouslySetInnerHTML={{ __html: formatted }} />
                                                                        </div>
                                                                    );
                                                                }

                                                                return (
                                                                    <p key={lIdx} className={line.trim() === '' ? 'h-2' : 'mb-1.5'}
                                                                        dangerouslySetInnerHTML={{ __html: formatted }} />
                                                                );
                                                            })}
                                                            {chat.content.includes('```') && (
                                                                <div className="bg-black/40 rounded-lg p-2 mt-2 font-mono text-[9px] text-emerald-400 border border-white/10 overflow-x-auto">
                                                                    {chat.content.split('```')[1]}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={chatInput}
                                                    onChange={e => setChatInput(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleAsk()}
                                                    placeholder="Ask SYNAPSE..."
                                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
                                                />
                                                <button
                                                    onClick={handleAsk}
                                                    disabled={isAsking}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 disabled:opacity-30 transition-all p-1"
                                                >
                                                    {isAsking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} className="fill-indigo-400/20" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <a
                                        href={recs.recommended_resources.youtube_lecture.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex gap-2 p-2 rounded-lg hover:bg-red-500/8 border border-transparent hover:border-red-500/15 transition-all text-left group"
                                    >
                                        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20 text-red-400 group-hover:bg-red-500/20"><Youtube size={15} /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-semibold text-white truncate">{recs.recommended_resources.youtube_lecture.title}</p>
                                            <p className="text-[9px] text-slate-500">▶ Most Viewed Lecture</p>
                                        </div>
                                        <ExternalLink size={10} className="text-slate-600 group-hover:text-red-400 self-center" />
                                    </a>

                                    {recs.recommended_resources.pdf_notes?.url && (
                                        <a
                                            href={recs.recommended_resources.pdf_notes.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="w-full flex gap-2 p-2 rounded-lg hover:bg-indigo-500/8 border border-transparent hover:border-indigo-500/15 transition-all text-left group"
                                        >
                                            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20"><BookOpen size={15} /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-semibold text-white truncate">Direct PDF Resources</p>
                                                <p className="text-[9px] text-slate-500">📄 External study material</p>
                                            </div>
                                            <ExternalLink size={10} className="text-slate-600 group-hover:text-indigo-400 self-center" />
                                        </a>
                                    )}

                                    <button
                                        onClick={() => setShowNotes(true)}
                                        className="w-full flex gap-2 p-2 rounded-lg hover:bg-blue-500/8 border border-transparent hover:border-blue-500/15 transition-all text-left group"
                                    >
                                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20"><FileText size={15} /></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-semibold text-white truncate">AI Brain Hack Sheet</p>
                                            <p className="text-[9px] text-slate-500">🧠 Personal tutor notes</p>
                                        </div>
                                        <ExternalLink size={10} className="text-slate-600 group-hover:text-blue-400 self-center" />
                                    </button>

                                    {(recs.recommended_resources as any).flashcards && (
                                        <button
                                            onClick={() => { setShowFlashcards(true); setCardIndex(0); setIsFlipped(false); }}
                                            className="w-full flex gap-2 p-2 rounded-lg hover:bg-amber-500/8 border border-transparent hover:border-amber-500/15 transition-all text-left"
                                        >
                                            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 text-amber-400"><Zap size={15} /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] font-semibold text-white truncate">Interactive Flashcards</p>
                                                <p className="text-[9px] text-slate-500">🃏 Self-mastery mode</p>
                                            </div>
                                            <ChevronDown className="-rotate-90 text-slate-600 self-center" size={10} />
                                        </button>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => downloadWorksheet()} className="p-2 rounded-lg border border-emerald-500/20 text-left bg-emerald-500/5 hover:bg-emerald-500/10 transition-all">
                                            <p className="text-[10px] font-bold text-white">📥 Practice Set</p>
                                            <p className="text-[8px] text-slate-500">25+ Selected Qs</p>
                                        </button>
                                        <button onClick={() => downloadPYQ()} className="p-2 rounded-lg border border-amber-500/20 text-left bg-amber-500/5 hover:bg-amber-500/10 transition-all">
                                            <p className="text-[10px] font-bold text-white">📋 Exam Papers</p>
                                            <p className="text-[8px] text-slate-500">KTU + GATE</p>
                                        </button>
                                    </div>
                                    <p className="text-[9px] text-indigo-300/60 italic">“{strategy}”</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {expanded && !event.completed && (
                <div className="px-3.5 pb-3.5 border-t border-white/5 mt-0 pt-3.5 space-y-3.5 bg-white/2">
                    <div>
                        <label className="block text-xs text-slate-400 mb-2 font-medium">Confidence level</label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((v) => (
                                <button
                                    key={v}
                                    onClick={() => setCheckIn((c) => ({ ...c, confidence: v }))}
                                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all text-xs font-medium border ${checkIn.confidence === v
                                        ? "border-amber-500/60 bg-amber-500/20 text-amber-300"
                                        : "border-white/8 bg-white/3 text-slate-500"
                                        }`}
                                >
                                    <Star size={12} className={checkIn.confidence >= v ? "fill-amber-400 text-amber-400" : "text-slate-600"} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleComplete}
                        disabled={completing}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/10"
                    >
                        {completing ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Mark Complete · +{event.xpReward} XP</>}
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function DayDetailDrawer({
    date,
    events,
    onClose,
    onEventUpdated,
}: DayDetailDrawerProps) {
    const drawerRef = useRef<HTMLDivElement>(null);
    const isOpen = date !== null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) document.addEventListener("keydown", fn);
        return () => document.removeEventListener("keydown", fn);
    }, [isOpen, onClose]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    const dayEvents = events
        .filter((e) => e.date === date)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const studySessions = dayEvents.filter(e => e.sessionType !== "Busy");
    const completed = studySessions.filter((e) => e.completed).length;
    const totalXP = studySessions.filter((e) => e.completed).reduce((s, e) => s + e.xpReward, 0);

    const formattedDate = date
        ? new Date(date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
        })
        : "";

    const isToday = date === new Date().toISOString().split("T")[0];

    async function handleCompleteSession(event: CalendarEvent, checkIn: CheckInState) {
        try {
            const res = await API.completeSession(event, {
                confidenceRating: checkIn.confidence,
                completedResources: checkIn.resources,
                needsMoreTime: checkIn.needsMoreTime,
                timeSpentHours: checkIn.timeSpent,
            });

            const updatedEvent: CalendarEvent = {
                ...event,
                completed: true,
                completedAt: new Date().toISOString(),
            };
            onEventUpdated(updatedEvent);

            if (res.updatedEvent?.xpAwarded) {
                toast.success(`+${res.updatedEvent.xpAwarded} XP earned!`, {
                    description: `${event.topic} completed 🎉`,
                });
            } else {
                toast.success(`Session complete!`, { description: event.topic });
            }

            if (res.achievements?.length) {
                res.achievements.forEach((a, i) => {
                    setTimeout(() => {
                        toast.success(`🏆 Achievement: ${a.title}`, {
                            description: `${a.icon} +${a.xpBonus} XP`,
                        });
                    }, (i + 1) * 700);
                });
            }
        } catch (err: any) {
            toast.error("Failed to save session", { description: err.message });
        }
    }

    return (
        <>
            <div
                className={`fixed inset-0 z-40 transition-all duration-500 ${isOpen
                    ? "bg-black/60 backdrop-blur-md pointer-events-auto"
                    : "opacity-0 pointer-events-none"
                    }`}
                onClick={handleBackdropClick}
            />

            <div
                ref={drawerRef}
                className={`
          fixed right-0 top-0 z-50 h-full w-full max-w-md
          border-l border-white/8
          shadow-2xl shadow-black/80
          flex flex-col
          transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
                style={{ willChange: "transform", background: 'linear-gradient(180deg, #0d1117 0%, #0a0e16 100%)' }}
            >
                <div
                    className="flex items-start justify-between p-5 border-b border-white/8"
                    style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.05) 50%, transparent 100%)' }}
                >
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg font-semibold text-white tracking-tight">{formattedDate}</h2>
                            {isToday && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold animate-pulse">
                                    ● Today
                                </span>
                            )}
                            {completed === studySessions.length && studySessions.length > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                    🔥 All Done!
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {studySessions.length === 0
                                ? (dayEvents.length > 0 ? "Personal schedule only" : "No sessions scheduled")
                                : `${studySessions.length} study session${studySessions.length !== 1 ? 's' : ''} · ${completed} completed`}
                        </p>

                        {dayEvents.length > 0 && (
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <Clock size={10} />
                                    {dayEvents.reduce((s, e) => s + e.estimatedHours, 0).toFixed(1)}h planned
                                </span>
                                {totalXP > 0 && (
                                    <span className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold">
                                        <Zap size={10} className="fill-amber-400" />
                                        {totalXP} XP earned
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 border border-transparent hover:border-white/10 transition-all duration-200 shrink-0"
                    >
                        <X size={16} />
                    </button>
                </div>

                {studySessions.length > 0 && (
                    <div className="px-5 py-2.5 border-b border-white/5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-slate-500 font-medium">Day Progress</span>
                            <span className="text-[10px] font-bold" style={{ color: completed === studySessions.length ? '#34d399' : '#a5b4fc' }}>
                                {completed}/{studySessions.length} · {Math.round((completed / studySessions.length) * 100)}%
                            </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out relative"
                                style={{
                                    width: `${(completed / studySessions.length) * 100}%`,
                                    background: completed === studySessions.length
                                        ? 'linear-gradient(90deg, #34d399, #10b981)'
                                        : 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
                                    boxShadow: completed > 0 ? '0 0 8px rgba(99,102,241,0.6)' : 'none'
                                }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                    {dayEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
                            <div className="text-6xl opacity-40" style={{ animation: 'float 3s ease-in-out infinite' }}>📅</div>
                            <p className="text-slate-400 text-sm">No sessions scheduled for this day.</p>
                            <p className="text-slate-600 text-xs">Select another day on the calendar.</p>
                        </div>
                    ) : (
                        dayEvents.map((event, i) => (
                            <div key={event.id} style={{ animationDelay: `${i * 60}ms` }} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <SessionCard
                                    event={event}
                                    onComplete={handleCompleteSession}
                                />
                            </div>
                        ))
                    )}
                </div>

                <div className="p-3 border-t border-white/5" style={{ background: 'rgba(99,102,241,0.03)' }}>
                    <div className="flex items-center justify-between">
                        <p className="text-[9px] text-slate-600">🤖 Powered by SYNAPSE Neuro-Kernel</p>
                        <p className="text-[9px] text-slate-600 flex items-center gap-1">
                            <Sparkles size={8} className="text-indigo-500" />
                            {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
