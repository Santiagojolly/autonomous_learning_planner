// @ts-nocheck
/**
 * progressOracle.ts — Agent 3: The Progress Oracle
 *
 * Tracks study progress, calculates mastery scores, detects at-risk patterns,
 * generates weekly reports, and triggers adaptive re-scheduling when needed.
 * Uses local Ollama for natural language report summaries when available.
 * No external API keys required.
 */

import {
    callOllama,
    isOllamaAvailable,
    extractJSON,
    generateId,
    addDays,
    todayISO,
    buildMeta,
    agentLog,
    getPersistentCache,
    setPersistentCache,
} from "./agentUtils";

const AGENT_NAME = "ProgressOracle";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OracleAction =
    | "weekly-report"
    | "check-in"
    | "adaptive-reschedule"
    | "initial-report";

export interface CheckInData {
    eventId: string;
    topicId: string;
    subjectName: string;
    completed: boolean;
    confidenceRating?: number;   // 1–5
    completedResources?: "yes" | "partial" | "no";
    needsMoreTime?: boolean;
    timeSpentHours?: number;
}

export interface MasteryScore {
    subject: string;
    score: number;           // 0–100
    topicsCompleted: number;
    topicsTotal: number;
    hoursInvested: number;
    hoursPlanned: number;
    streak: number;
    trend: "improving" | "stable" | "declining";
}

export interface ProgressAlert {
    id: string;
    type: "behind-schedule" | "streak-at-risk" | "milestone" | "weekly-report" | "achievement";
    severity: "info" | "warning" | "danger";
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
    actionRoute?: string;
}

export interface ProgressReport {
    id: string;
    weekNumber: number;
    generatedAt: string;
    overallXP: number;
    streakDays: number;
    masteryScores: MasteryScore[];
    onTrack: string[];
    behind: string[];
    alerts: ProgressAlert[];
    recommendation: string;
    aiSummary: string;
    predictedCompletion?: string;
    needsAdaptiveReschedule: boolean;
}

export interface ProgressOracleInput {
    action: OracleAction;
    userId: string;
    roadmap?: any;
    calendarEvents?: any[];
    previousReports?: ProgressReport[];
    checkIn?: CheckInData;
}

export interface ProgressOracleOutput {
    success: boolean;
    report?: ProgressReport;
    alerts?: ProgressAlert[];
    updatedEvent?: { eventId: string; completed: boolean; xpAwarded: number };
    achievements?: Achievement[];
    meta: {
        agentName: string;
        ranAt: string;
        usedOllama: boolean;
        durationMs: number;
    };
}

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    xpBonus: number;
    unlockedAt: string;
    rarity: "bronze" | "silver" | "gold" | "platinum";
}

// ─── Mastery Score Calculator ─────────────────────────────────────────────────

function calculateMasteryScores(
    roadmap: any,
    events: any[]
): { scores: MasteryScore[]; totalMissed: number } {
    const subjects: Record<string, any> = {};

    // Group events by subject and detect missed ones
    let totalMissed = 0;
    const now = new Date();
    const today = todayISO();

    for (const evt of events) {
        const s = evt.subject;
        if (!subjects[s]) {
            subjects[s] = {
                subject: s,
                completedEvents: [],
                allEvents: [],
                missedEvents: [],
                streak: 0,
            };
        }
        subjects[s].allEvents.push(evt);
        
        if (evt.completed) {
            subjects[s].completedEvents.push(evt);
        } else if (evt.sessionType !== "Busy") {
            // Check if missed
            let missed = false;
            if (evt.date < today) {
                missed = true;
            } else if (evt.date === today) {
                const [hours, minutes] = (evt.startTime || "00:00").split(":").map(Number);
                const sessionTime = new Date();
                sessionTime.setHours(hours, minutes, 0, 0);
                if (now > sessionTime) missed = true;
            }
            
            if (missed) {
                subjects[s].missedEvents.push(evt);
                totalMissed++;
            }
        }
    }

    // Count topics from roadmap
    const subjectTopics: Record<string, { total: number; completed: number; plannedHours: number }> =
        {};
    for (const phase of roadmap?.phases ?? []) {
        for (const topic of phase.topics ?? []) {
            const s = roadmap.subject;
            if (!subjectTopics[s]) {
                subjectTopics[s] = { total: 0, completed: 0, plannedHours: 0 };
            }
            subjectTopics[s].total++;
            subjectTopics[s].plannedHours += topic.estimatedHours ?? 2;
            if (topic.status === "completed") subjectTopics[s].completed++;
        }
    }

    const scores: MasteryScore[] = [];

    for (const [subject, data] of Object.entries(subjects)) {
        const completed = data.completedEvents.length;
        const total = data.allEvents.length;
        const completionRatio = total > 0 ? completed / total : 0;

        const topicData = subjectTopics[subject] ?? {
            total: total,
            completed: completed,
            plannedHours: total * 2,
        };
        const topicRatio =
            topicData.total > 0 ? topicData.completed / topicData.total : completionRatio;

        const hoursInvested = data.completedEvents.reduce(
            (s: number, e: any) => s + (e.estimatedHours ?? 1),
            0
        );

        // Mastery = weighted average of completion ratio + topic ratio + time ratio
        const timeRatio = Math.min(
            1,
            hoursInvested / Math.max(1, topicData.plannedHours)
        );
        const rawScore =
            (completionRatio * 0.5 + topicRatio * 0.3 + timeRatio * 0.2) * 100;

        // Calculate streak (consecutive days with completed sessions)
        const completedDates = [...new Set(
            data.completedEvents.map((e: any) => e.date)
        )].sort();
        let streak = 0;
        let checkDate = todayISO();
        for (let i = completedDates.length - 1; i >= 0; i--) {
            if (completedDates[i] === checkDate || completedDates[i] === addDays(checkDate, -1)) {
                streak++;
                checkDate = completedDates[i];
            } else {
                break;
            }
        }

        // Determine trend based on raw score AND recent activity
        let trend: MasteryScore["trend"] = "stable";
        if (data.missedEvents.length > 0 || streak === 0) {
            trend = "declining";
        } else if (rawScore > 75 && streak > 2) {
            trend = "improving";
        } else if (rawScore > 40) {
            trend = "stable";
        } else {
            trend = "declining";
        }

        scores.push({
            subject,
            score: Math.round(rawScore),
            topicsCompleted: topicData.completed,
            topicsTotal: topicData.total,
            hoursInvested: Math.round(hoursInvested * 10) / 10,
            hoursPlanned: topicData.plannedHours,
            streak,
            trend,
        });
    }

    return { scores, totalMissed };
}

// ─── Alert Generator ──────────────────────────────────────────────────────────

function generateAlerts(
    masteryScores: MasteryScore[],
    events: any[],
    previousReports: ProgressReport[]
): ProgressAlert[] {
    const alerts: ProgressAlert[] = [];
    const today = todayISO();

    for (const ms of masteryScores) {
        // Behind schedule alert
        if (ms.score < 30 && ms.topicsTotal > 3) {
            alerts.push({
                id: generateId("alert"),
                type: "behind-schedule",
                severity: "danger",
                title: `Behind Schedule: ${ms.subject}`,
                message: `You're only ${ms.score}% through ${ms.subject}. Consider re-scheduling to catch up.`,
                createdAt: today,
                read: false,
                actionRoute: "/dashboard/calendar",
            });
        }

        // Streak at risk
        if (ms.streak === 0) {
            const lastCompleted = events
                .filter((e) => e.subject === ms.subject && e.completed)
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            if (lastCompleted) {
                const daysSince = Math.floor(
                    (new Date(today).getTime() - new Date(lastCompleted.date).getTime()) /
                    (1000 * 60 * 60 * 24)
                );
                if (daysSince >= 2) {
                    alerts.push({
                        id: generateId("alert"),
                        type: "streak-at-risk",
                        severity: "warning",
                        title: "Study Streak at Risk!",
                        message: `You haven't studied ${ms.subject} in ${daysSince} days. Study today to maintain momentum.`,
                        createdAt: today,
                        read: false,
                        actionRoute: "/dashboard/calendar",
                    });
                }
            }
        }

        // Milestone alert
        if (ms.score >= 50 && ms.score < 55) {
            alerts.push({
                id: generateId("alert"),
                type: "milestone",
                severity: "info",
                title: `Halfway There — ${ms.subject}!`,
                message: `You've completed 50% of your ${ms.subject} roadmap. Keep it up!`,
                createdAt: today,
                read: false,
                actionRoute: "/dashboard/insights",
            });
        }

        if (ms.score >= 100) {
            alerts.push({
                id: generateId("alert"),
                type: "milestone",
                severity: "info",
                title: `🏆 ${ms.subject} Mastered!`,
                message: `You've completed your entire ${ms.subject} study plan. Excellent work!`,
                createdAt: today,
                read: false,
                actionRoute: "/dashboard/insights",
            });
        }
    }

    return alerts;
}

// ─── Achievement Checker ──────────────────────────────────────────────────────

function checkAchievements(
    masteryScores: MasteryScore[],
    events: any[],
    previousReports: ProgressReport[]
): Achievement[] {
    const achievements: Achievement[] = [];
    const now = new Date().toISOString();
    const completedEvents = events.filter((e) => e.completed);
    const alreadyUnlocked = new Set(
        previousReports.flatMap((r) => r.alerts.map((a) => a.id))
    );

    const maxStreak = Math.max(0, ...masteryScores.map((m) => m.streak));

    if (completedEvents.length >= 1 && !alreadyUnlocked.has("ach-first-session")) {
        achievements.push({
            id: "ach-first-session",
            title: "First Step",
            description: "Completed your very first study session!",
            icon: "🌱",
            xpBonus: 50,
            unlockedAt: now,
            rarity: "bronze",
        });
    }

    if (maxStreak >= 7 && !alreadyUnlocked.has("ach-7-streak")) {
        achievements.push({
            id: "ach-7-streak",
            title: "Week Warrior",
            description: "Maintained a 7-day study streak!",
            icon: "🔥",
            xpBonus: 200,
            unlockedAt: now,
            rarity: "silver",
        });
    }

    if (maxStreak >= 30 && !alreadyUnlocked.has("ach-30-streak")) {
        achievements.push({
            id: "ach-30-streak",
            title: "Iron Discipline",
            description: "Maintained a 30-day study streak!",
            icon: "⚡",
            xpBonus: 1000,
            unlockedAt: now,
            rarity: "gold",
        });
    }

    const masteredSubjects = masteryScores.filter((m) => m.score >= 100);
    if (masteredSubjects.length >= 1 && !alreadyUnlocked.has("ach-first-mastery")) {
        achievements.push({
            id: "ach-first-mastery",
            title: "Master of the Craft",
            description: `Fully mastered ${masteredSubjects[0].subject}!`,
            icon: "🎓",
            xpBonus: 500,
            unlockedAt: now,
            rarity: "gold",
        });
    }

    if (completedEvents.length >= 50 && !alreadyUnlocked.has("ach-50-sessions")) {
        achievements.push({
            id: "ach-50-sessions",
            title: "Centurion Learner",
            description: "Completed 50 study sessions!",
            icon: "🏅",
            xpBonus: 300,
            unlockedAt: now,
            rarity: "silver",
        });
    }

    return achievements;
}

// ─── Recommendation Generator ─────────────────────────────────────────────────

function generateRecommendation(
    masteryScores: MasteryScore[],
    streakDays: number
): string {
    const behind = masteryScores.filter((m) => m.trend === "declining");
    const improving = masteryScores.filter((m) => m.trend === "improving");

    if (streakDays === 0) {
        return "Your study streak has been broken. Start fresh today — even 30 minutes counts. Consistency beats intensity.";
    }
    if (behind.length > 0) {
        return `Focus this week on ${behind[0].subject} — it's falling behind. Consider adding one extra 30-minute session per day on this subject.`;
    }
    if (improving.length === masteryScores.length) {
        return "Excellent progress across all subjects! Consider increasing the difficulty of your sessions or adding a new subject.";
    }
    if (streakDays >= 7) {
        return `Amazing ${streakDays}-day streak! Your consistency is paying off. Don't forget to take a rest day to let the knowledge consolidate.`;
    }
    return "You're making steady progress. Aim for at least 30 minutes of study daily to maintain momentum.";
}

// ─── Ollama Summary Generator ─────────────────────────────────────────────────

async function generateAISummary(
    masteryScores: MasteryScore[],
    streakDays: number,
    onTrack: string[],
    behind: string[]
): Promise<{ summary: string; usedOllama: boolean }> {

    const prompt = `Generate a supportive study coach progress summary.
Data: ${JSON.stringify({ masteryScores, streakDays, onTrack, behind })}

CRITICAL INSTRUCTIONS:
1. If streakDays is 0 or there are subjects in the 'behind' list, DO NOT say they are "crushing it" or "doing great". 
2. Instead, acknowledge the missed sessions/dip in consistency and provide a gentle "nudge" to restart.
3. If everything is on track, be congratulatory.
4. Keep it to 2-3 sentences. Return ONLY the summary text.`;

    const raw = await callOllama(
        "You are a supportive study coach. Write short, personal, encouraging progress summaries.",
        prompt,
        0.8
    );

    if (!raw || raw.length < 5) {
        throw new Error("Invalid AI response detected: Summary generation failed.");
    }

    return { summary: raw.trim(), usedOllama: true };
}

function generateFallbackSummary(
    masteryScores: MasteryScore[],
    streakDays: number,
    onTrack: string[],
    behind: string[]
): string {
    const avgScore =
        masteryScores.length > 0
            ? Math.round(
                masteryScores.reduce((s, m) => s + m.score, 0) / masteryScores.length
            )
            : 0;

    if (behind.length === 0 && onTrack.length > 0) {
        return `You're crushing it! All ${onTrack.length} subject(s) are on track with an average mastery of ${avgScore}%. Your ${streakDays}-day streak shows real commitment — keep that momentum going into next week! 🚀`;
    }
    if (behind.length > 0 && onTrack.length > 0) {
        return `Good week overall — ${onTrack.join(", ")} ${onTrack.length > 1 ? "are" : "is"} on track. ${behind.join(", ")} ${behind.length > 1 ? "need" : "needs"} a bit more attention. A focused 30-min daily session on ${behind[0]} this week will get you back on track! 💪`;
    }
    if (behind.length > 0 && streakDays === 0) {
        return `This week was tough — it happens to everyone. The key is to restart today, even briefly. Your roadmap is waiting and ${behind[0]} is ready for you to pick back up. Small steps still move you forward! 🌱`;
    }
    return `You've put in solid work this week with a ${streakDays}-day streak. Average mastery across subjects is ${avgScore}%. Stay consistent and you'll see big gains next week! 🎯`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function runProgressOracle(
    input: ProgressOracleInput
): Promise<ProgressOracleOutput> {
    const startTime = Date.now();
    agentLog(AGENT_NAME, "Starting run", {
        action: input.action,
        userId: input.userId,
    });

    const events = input.calendarEvents ?? [];
    
    // ── Cache Layer for Reports ───────────────────────────────────────────────
    if (input.action === "initial-report" || input.action === "weekly-report") {
        // Cache key includes userId and roughly current hour to ensure freshness but speed up repeated loads
        const hourlyStamp = Math.floor(Date.now() / (3600 * 1000));
        const cacheKey = `oracle:${input.action}:${input.userId}:${hourlyStamp}`;
        const cached = getPersistentCache<ProgressOracleOutput>(cacheKey);
        if (cached) {
            agentLog(AGENT_NAME, "Serving report from persistent cache");
            return {
                ...cached,
                meta: buildMeta(AGENT_NAME, false, startTime)
            };
        }
    }

    const roadmap = input.roadmap ?? { phases: [], subject: "General", totalWeeks: 12 };
    const previousReports = input.previousReports ?? [];

    // ── Handle check-in action ────────────────────────────────────────────────
    if (input.action === "check-in" && input.checkIn) {
        const { eventId, completed, confidenceRating = 3 } = input.checkIn;

        // Find the event to check-in
        const evt = events.find((e) => e.id === eventId);
        const xpBase = evt?.xpReward ?? 20;
        // Confidence multiplier: 0.7x at confidence 1 → 1.3x at confidence 5
        const confMultiplier = 0.7 + (confidenceRating - 1) * 0.15;
        const xpAwarded = Math.round(xpBase * confMultiplier);

        const meta = buildMeta(AGENT_NAME, false, startTime);
        agentLog(AGENT_NAME, "Check-in processed", { eventId, xpAwarded });

        return {
            success: true,
            updatedEvent: { eventId, completed, xpAwarded },
            meta,
        };
    }

    // ── Calculate mastery scores ──────────────────────────────────────────────
    const { scores: masteryScores, totalMissed } = calculateMasteryScores(roadmap, events);

    const onTrack = masteryScores.filter((m) => m.trend !== "declining").map((m) => m.subject);
    const behind = masteryScores.filter((m) => m.trend === "declining").map((m) => m.subject);

    // Global streak = max streak across subjects
    const streakDays = Math.max(0, ...masteryScores.map((m) => m.streak));

    // Total XP = sum of all completed event XP rewards
    const overallXP = events
        .filter((e) => e.completed)
        .reduce((s, e) => s + (e.xpReward ?? 10), 0);

    // ── Generate alerts ────────────────────────────────────────────────────────
    const alerts = generateAlerts(masteryScores, events, previousReports);

    // ── Check achievements ────────────────────────────────────────────────────
    const achievements = checkAchievements(masteryScores, events, previousReports);

    // ── Generate AI summary ───────────────────────────────────────────────────
    let aiSummary = "";
    let usedOllama = false;
    const ollamaOk = await isOllamaAvailable();

    if (ollamaOk) {
        try {
            const result = await generateAISummary(
                masteryScores,
                streakDays,
                onTrack,
                behind
            );
            aiSummary = result.summary;
            usedOllama = result.usedOllama;
        } catch (e) {
            agentLog(AGENT_NAME, "Ollama summary failed, using fallback", e);
        }
    }

    if (!usedOllama || !aiSummary) {
        aiSummary = generateFallbackSummary(
            masteryScores,
            streakDays,
            onTrack,
            behind
        );
    }

    // ── Determine predicted completion date ───────────────────────────────────
    const lastScheduledEvent = events
        .filter((e) => !e.completed)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const predictedCompletion = lastScheduledEvent?.date ?? addDays(todayISO(), 30);

    // ── Determine if adaptive re-schedule is needed ───────────────────────────
    let needsAdaptiveReschedule = totalMissed > 0;
    
    // Explicitly clear if the action was just an adaptive reschedule
    if (input.action === "adaptive-reschedule") {
        needsAdaptiveReschedule = false;
    }

    // ── Week number ───────────────────────────────────────────────────────────
    const weekNumber = Math.max(1, (previousReports.length ?? 0) + 1);

    // ── Recommendation ────────────────────────────────────────────────────────
    const recommendation = generateRecommendation(masteryScores, streakDays);

    // ── Assemble report ───────────────────────────────────────────────────────
    const report: ProgressReport = {
        id: generateId("report"),
        weekNumber,
        generatedAt: new Date().toISOString(),
        overallXP,
        streakDays,
        masteryScores,
        onTrack,
        behind,
        alerts,
        recommendation,
        aiSummary,
        predictedCompletion,
        needsAdaptiveReschedule,
    };

    const meta = buildMeta(AGENT_NAME, usedOllama, startTime);

    const output: ProgressOracleOutput = {
        success: true,
        report,
        alerts,
        achievements: achievements.length > 0 ? achievements : undefined,
        meta,
    };

    // Cache the successful report result for 1 hour
    if (input.action === "initial-report" || input.action === "weekly-report") {
        const hourlyStamp = Math.floor(Date.now() / (3600 * 1000));
        const cacheKey = `oracle:${input.action}:${input.userId}:${hourlyStamp}`;
        setPersistentCache(cacheKey, output, 1);
    }

    return output;
}
