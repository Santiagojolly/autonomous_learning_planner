// @ts-nocheck
/**
 * scheduleStrategist.ts — Agent 2: The Schedule Strategist
 *
 * Converts a roadmap (from Agent 1) into a smart, spaced-repetition-aware
 * calendar schedule. Respects user time preferences and blocked dates.
 * Uses local Ollama when available, otherwise generates a rich deterministic schedule.
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
} from "./agentUtils.ts";

const AGENT_NAME = "ScheduleStrategist";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
    id: string;
    date: string;          // YYYY-MM-DD
    startTime: string;     // HH:MM
    endTime: string;       // HH:MM
    subject: string;
    topic: string;
    phase: string;
    phaseId: string;
    topicId: string;
    sessionType: "Study" | "Review" | "Practice" | "Assessment";
    difficulty: number;
    estimatedHours: number;
    completed: boolean;
    completedAt?: string;
    xpReward: number;
}

export type TimePreference = "morning" | "afternoon" | "evening" | "any";

export interface ScheduleStrategistInput {
    roadmap: any;                    // Output roadmap object from Agent 1
    startDate?: string;              // YYYY-MM-DD, defaults to today
    timePreference?: TimePreference;
    studyDays?: number[];            // 0=Sun … 6=Sat, default [1,2,3,4,5]
    blockedDates?: string[];         // YYYY-MM-DD strings
    dailyHours: number;
}

export interface ScheduleStrategistOutput {
    success: boolean;
    events: CalendarEvent[];
    stats: {
        totalSessions: number;
        totalStudyHours: number;
        totalReviewSessions: number;
        estimatedEndDate: string;
        averageDifficulty: number;
    };
    meta: {
        agentName: string;
        ranAt: string;
        usedOllama: boolean;
        durationMs: number;
    };
}

// ─── Time-slot helpers ────────────────────────────────────────────────────────

const TIME_SLOTS: Record<TimePreference, { start: string; peak: number }> = {
    morning: { start: "07:00", peak: 9 },
    afternoon: { start: "13:00", peak: 15 },
    evening: { start: "18:00", peak: 19 },
    any: { start: "09:00", peak: 10 },
};

function addHoursToTime(time: string, hours: number): string {
    const [h, m] = time.split(":").map(Number);
    const totalMinutes = h * 60 + m + Math.round(hours * 60);
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

/**
 * Calculates XP based on difficulty (1-10) → 10–50 XP
 */
function calcXP(difficulty: number): number {
    return Math.max(10, Math.min(50, 10 + (difficulty - 1) * 4.5));
}

/**
 * Spaced repetition review multipliers.
 * After N sessions of a topic, schedule a review.
 */
const REVIEW_INTERVAL = 3; // every 3rd study session triggers a review

// ─── Ollama Helpers ───────────────────────────────────────────────────────────

function buildScheduleSystemPrompt(): string {
    return `You are the Schedule Strategist, an expert AI scheduler that creates optimal study calendars.
You apply spaced repetition, cognitive load balancing, and energy-level awareness to schedule study sessions.
You always return ONLY valid JSON — no explanations, markdown, or extra text.`;
}

function buildScheduleUserPrompt(input: ScheduleStrategistInput): string {
    const topicsSummary = input.roadmap.phases
        ?.flatMap((p: any) =>
            p.topics.map((t: any) => ({
                topicId: t.id,
                topic: t.name,
                phase: p.name,
                phaseId: p.id,
                difficulty: t.difficulty,
                estimatedHours: t.estimatedHours,
            }))
        )
        .slice(0, 20); // limit context

    return `Create a study schedule for:
Subject: ${input.roadmap.subject}
Start Date: ${input.startDate ?? todayISO()}
Daily Hours: ${input.dailyHours}
Time Preference: ${input.timePreference ?? "morning"}
Blocked Dates: ${(input.blockedDates ?? []).join(", ") || "none"}
Topics to schedule: ${JSON.stringify(topicsSummary)}

Return ONLY this JSON:
{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "topicId": "topic id",
      "sessionType": "Study|Review|Practice"
    }
  ]
}`;
}

// ─── Deterministic Scheduler ──────────────────────────────────────────────────

/**
 * Generates a full schedule from a roadmap without any LLM.
 * Implements:
 * - Spaced repetition (review every 3 study sessions)
 * - Difficulty-aware time placement (harder topics in peak hours)
 * - Blocked date skipping
 * - Study day filtering
 */
function generateDeterministicSchedule(
    input: ScheduleStrategistInput
): CalendarEvent[] {
    const {
        roadmap,
        startDate = todayISO(),
        timePreference = "morning",
        studyDays = [1, 2, 3, 4, 5], // Mon–Fri by default
        blockedDates = [],
        dailyHours,
    } = input;

    const slot = TIME_SLOTS[timePreference] ?? TIME_SLOTS["morning"];
    const events: CalendarEvent[] = [];

    // Flatten all topics from all phases
    const allTopics: Array<{
        topicId: string;
        topic: string;
        phase: string;
        phaseId: string;
        difficulty: number;
        estimatedHours: number;
        subject: string;
    }> = [];

    for (const phase of roadmap.phases ?? []) {
        for (const topic of phase.topics ?? []) {
            allTopics.push({
                topicId: topic.id,
                topic: topic.name,
                phase: phase.name,
                phaseId: phase.id,
                difficulty: topic.difficulty ?? 5,
                estimatedHours: topic.estimatedHours ?? 2,
                subject: roadmap.subject,
            });
        }
    }

    // Track how many sessions per topic for review scheduling
    const topicSessionCount: Record<string, number> = {};
    let currentDate = startDate;
    let topicIndex = 0;
    let reviewQueue: typeof allTopics = [];
    const maxDays = (roadmap.totalWeeks ?? 12) * 7 + 14; // safety limit
    let daysIterated = 0;

    while (
        (topicIndex < allTopics.length || reviewQueue.length > 0) &&
        daysIterated < maxDays
    ) {
        // Skip non-study days and blocked dates
        const dow = new Date(currentDate).getDay();
        const isBlocked = blockedDates.includes(currentDate);
        const isStudyDay = studyDays.includes(dow);

        if (!isBlocked && isStudyDay) {
            let hoursUsedToday = 0;

            // First: fill review sessions if queued (reviews are shorter, 1h each)
            while (reviewQueue.length > 0 && hoursUsedToday + 1 <= dailyHours) {
                const reviewTopic = reviewQueue.shift()!;
                const reviewStart = addHoursToTime(slot.start, hoursUsedToday);
                const reviewEnd = addHoursToTime(reviewStart, 1);
                events.push({
                    id: generateId("evt"),
                    date: currentDate,
                    startTime: reviewStart,
                    endTime: reviewEnd,
                    subject: reviewTopic.subject,
                    topic: `Review: ${reviewTopic.topic}`,
                    phase: reviewTopic.phase,
                    phaseId: reviewTopic.phaseId,
                    topicId: reviewTopic.topicId,
                    sessionType: "Review",
                    difficulty: Math.max(1, reviewTopic.difficulty - 1),
                    estimatedHours: 1,
                    completed: false,
                    xpReward: Math.round(calcXP(reviewTopic.difficulty) * 0.5),
                });
                hoursUsedToday += 1;
            }

            // Then: schedule study sessions for remaining time
            while (
                topicIndex < allTopics.length &&
                hoursUsedToday < dailyHours
            ) {
                const tp = allTopics[topicIndex];
                const availableHours = dailyHours - hoursUsedToday;

                // How many hours to put this topic today?
                const sessionHours = Math.min(tp.estimatedHours, availableHours, 3);

                if (sessionHours < 0.5) break;

                const studyStart = addHoursToTime(slot.start, hoursUsedToday);
                const studyEnd = addHoursToTime(studyStart, sessionHours);

                events.push({
                    id: generateId("evt"),
                    date: currentDate,
                    startTime: studyStart,
                    endTime: studyEnd,
                    subject: tp.subject,
                    topic: tp.topic,
                    phase: tp.phase,
                    phaseId: tp.phaseId,
                    topicId: tp.topicId,
                    sessionType: "Study",
                    difficulty: tp.difficulty,
                    estimatedHours: sessionHours,
                    completed: false,
                    xpReward: Math.round(calcXP(tp.difficulty)),
                });

                hoursUsedToday += sessionHours;

                // Count sessions for this topic
                topicSessionCount[tp.topicId] =
                    (topicSessionCount[tp.topicId] ?? 0) + 1;

                // Move to next topic if fully covered
                if (sessionHours >= tp.estimatedHours) {
                    // Queue a review after REVIEW_INTERVAL sessions
                    if (topicSessionCount[tp.topicId] % REVIEW_INTERVAL === 0) {
                        reviewQueue.push(tp);
                    }
                    topicIndex++;
                } else {
                    // Partially covered — reduce remaining hours
                    allTopics[topicIndex] = {
                        ...tp,
                        estimatedHours: tp.estimatedHours - sessionHours,
                    };
                    break;
                }
            }

            // Add a practice session on Saturdays (dow=6) if we have topics
            if (dow === 6 && topicIndex > 0 && hoursUsedToday < dailyHours) {
                const practiceTopic = allTopics[Math.max(0, topicIndex - 1)];
                const practiceStart = addHoursToTime(slot.start, hoursUsedToday);
                const practiceEnd = addHoursToTime(practiceStart, 1);
                events.push({
                    id: generateId("evt"),
                    date: currentDate,
                    startTime: practiceStart,
                    endTime: practiceEnd,
                    subject: practiceTopic.subject,
                    topic: `Practice: ${practiceTopic.topic}`,
                    phase: practiceTopic.phase,
                    phaseId: practiceTopic.phaseId,
                    topicId: practiceTopic.topicId,
                    sessionType: "Practice",
                    difficulty: practiceTopic.difficulty,
                    estimatedHours: 1,
                    completed: false,
                    xpReward: Math.round(calcXP(practiceTopic.difficulty) * 0.8),
                });
            }
        }

        currentDate = addDays(currentDate, 1);
        daysIterated++;
    }

    return events;
}

// ─── Stats Builder ────────────────────────────────────────────────────────────

function buildStats(events: CalendarEvent[], dailyHours: number): ScheduleStrategistOutput["stats"] {
    const studyEvents = events.filter((e) => e.sessionType === "Study");
    const reviewEvents = events.filter((e) => e.sessionType === "Review");
    const totalHours = events.reduce((s, e) => s + e.estimatedHours, 0);
    const avgDiff =
        events.length > 0
            ? events.reduce((s, e) => s + e.difficulty, 0) / events.length
            : 0;
    const lastDate =
        events.length > 0
            ? events[events.length - 1].date
            : addDays(todayISO(), 7);

    return {
        totalSessions: events.length,
        totalStudyHours: Math.round(totalHours),
        totalReviewSessions: reviewEvents.length,
        estimatedEndDate: lastDate,
        averageDifficulty: Math.round(avgDiff * 10) / 10,
    };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function runScheduleStrategist(
    input: ScheduleStrategistInput
): Promise<ScheduleStrategistOutput> {
    const startTime = Date.now();
    agentLog(AGENT_NAME, "Starting run", {
        subject: input.roadmap?.subject,
        startDate: input.startDate,
    });

    let events: CalendarEvent[] = [];
    let usedOllama = false;

    // ── Step 1: Call Ollama ────────────────────────────────────────────────────
    agentLog(AGENT_NAME, "Ollama online — calling LLM");
    const raw = await callOllama(
        buildScheduleSystemPrompt(),
        buildScheduleUserPrompt(input),
        0.5
    );
    if (!raw) {
        throw new Error("AI backend unavailable or failed to respond.");
    }
    const parsed = extractJSON<{ events: any[] }>(raw);
    if (!parsed || !parsed.events || parsed.events.length === 0) {
        throw new Error("Invalid AI response detected: invalid schedule format.");
    }

    const slot = TIME_SLOTS[input.timePreference ?? "morning"] ?? TIME_SLOTS["morning"];
    events = (parsed.events as any[]).map((e: any, idx: number) => {
        const matchedTopic = input.roadmap.phases
            ?.flatMap((p: any) => p.topics)
            ?.find((t: any) => t.id === e.topicId);
        const phase = input.roadmap.phases?.find((p: any) =>
            p.topics?.some((t: any) => t.id === e.topicId)
        );
        return {
            id: generateId("evt"),
            date: e.date ?? addDays(input.startDate ?? todayISO(), idx),
            startTime: e.startTime ?? slot.start,
            endTime:
                e.endTime ??
                addHoursToTime(e.startTime ?? slot.start, input.dailyHours),
            subject: input.roadmap.subject,
            topic: matchedTopic?.name ?? `Session ${idx + 1}`,
            phase: phase?.name ?? "Core",
            phaseId: phase?.id ?? generateId("phase"),
            topicId: e.topicId ?? generateId("topic"),
            sessionType: e.sessionType ?? "Study",
            difficulty: matchedTopic?.difficulty ?? 5,
            estimatedHours: input.dailyHours,
            completed: false,
            xpReward: calcXP(matchedTopic?.difficulty ?? 5),
        };
    });
    usedOllama = true;
    agentLog(AGENT_NAME, "Ollama schedule parsed", {
        events: events.length,
    });

    const stats = buildStats(events, input.dailyHours);
    const meta = buildMeta(AGENT_NAME, usedOllama, startTime);

    agentLog(AGENT_NAME, "Completed", {
        totalEvents: events.length,
        estimatedEndDate: stats.estimatedEndDate,
        durationMs: meta.durationMs,
    });

    return { success: true, events, stats, meta };
}
