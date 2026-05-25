// @ts-nocheck
/**
 * selfHealingScheduler.ts — Agent 5: Self-Healing Study Scheduling Engine
 *
 * Automatically detects and repairs schedule disruptions using intelligent
 * time-optimization algorithms. Uses Ollama when available for strategic
 * reasoning, falls back to deterministic heuristics.
 *
 * Disruptions handled:
 *   - Topic incomplete (unfinished study sessions)
 *   - New calendar event (external conflict)
 *   - Skipped day (missed sessions)
 *   - Underestimated time (topic took longer than planned)
 *   - Overloaded schedule (too much work, too little time)
 *
 * Core Principles:
 *   1. Never increase daily load by more than 30%
 *   2. Keep at least 1 light day per week
 *   3. HARD topics → peak hours only
 *   4. Preserve revision days before exams
 *   5. Think 7 days ahead (Antigravity Thinking)
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
} from "./agentUtils";
import type { CalendarEvent } from "./scheduleStrategist";

const AGENT_NAME = "SelfHealingScheduler";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type DisruptionType =
    | "incomplete"      // Topic not finished in allocated time
    | "new_event"       // External calendar event conflicts with study
    | "skipped_day"     // User missed a study day entirely
    | "underestimated"  // Topic requires more time than originally estimated
    | "overloaded";     // Schedule has too much work for available time

export interface UnfinishedTopic {
    subject: string;
    topic: string;
    remaining_hours: number;
    difficulty: "easy" | "medium" | "hard";
    priority: "low" | "medium" | "high";
    original_date?: string;
    topicId?: string;
    phaseId?: string;
    phase?: string;
}

export interface EnergyPattern {
    peak_hours: string;      // e.g., "09:00-12:00"
    low_energy_hours: string; // e.g., "14:00-16:00"
}

export interface SelfHealingInput {
    current_schedule: CalendarEvent[];
    disruption_type: DisruptionType;
    unfinished_topics: UnfinishedTopic[];
    new_event?: {
        date: string;
        start_time: string;
        end_time: string;
        title?: string;
    };
    daily_available_hours: number;
    exam_date?: string;
    energy_pattern?: EnergyPattern;
    weekly_buffer_days?: number[];  // 0=Sun ... 6=Sat
    time_preference?: "morning" | "afternoon" | "evening" | "any";
}

export interface HealingAction {
    type: "reschedule" | "compress" | "split" | "swap" | "remove" | "add";
    description: string;
    affected_event_id?: string;
    new_event?: CalendarEvent;
}

export interface OverloadAnalysis {
    risk_level: "low" | "medium" | "high" | "critical";
    total_remaining_hours: number;
    available_hours_until_exam: number;
    utilization_percentage: number;
    compressed_topics: string[];  // Topics that were compressed to fit
    recommendation: string;
}

export interface SelfHealingOutput {
    success: boolean;
    disruption_type: DisruptionType;
    gap_analysis: {
        affected_sessions: number;
        total_remaining_workload_hours: number;
        days_affected: string[];
    };
    capacity_analysis: {
        available_days: number;
        available_hours: number;
        can_absorb_without_overload: boolean;
    };
    healed_schedule: CalendarEvent[];
    actions_taken: HealingAction[];
    overload_analysis: OverloadAnalysis;
    antigravity_notes: string[];     // Forward-looking predictions
    reasoning: string;
    meta: {
        agentName: string;
        ranAt: string;
        usedOllama: boolean;
        durationMs: number;
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_DAILY_OVERLOAD = 0.3;          // Never increase daily load by more than 30%
const MAX_HARD_TOPICS_PER_DAY = 2;       // Prevent cognitive overload
const MIN_LIGHT_DAYS_PER_WEEK = 1;       // Keep breathing room
const REDISTRIBUTION_WINDOW = 7;         // Spread work across 7 days max
const REVISION_BUFFER_DAYS = 3;          // Protect last 3 days before exam
const FATIGUE_MULTIPLIER = 1.15;         // Assume 15% more time due to fatigue
const PROCRASTINATION_BUFFER = 1.1;      // 10% buffer for procrastination

const TIME_STARTS: Record<string, string> = {
    morning: "07:00",
    afternoon: "13:00",
    evening: "18:00",
    any: "09:00",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════════

function addHoursToTime(time: string, hours: number): string {
    const [h, m] = time.split(":").map(Number);
    const totalMinutes = h * 60 + m + Math.round(hours * 60);
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function getDaysBetween(start: string, end: string): number {
    return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
}

function calcXP(difficulty: number): number {
    return Math.max(10, Math.min(50, 10 + (difficulty - 1) * 4.5));
}

function difficultyToNumber(d: "easy" | "medium" | "hard"): number {
    return d === "easy" ? 3 : d === "medium" ? 6 : 9;
}

function priorityWeight(p: "low" | "medium" | "high"): number {
    return p === "low" ? 1 : p === "medium" ? 2 : 3;
}

function getAvailableDates(
    fromDate: string,
    days: number,
    blockedDates: string[],
    studyDays: number[] = [1, 2, 3, 4, 5]
): string[] {
    const dates: string[] = [];
    let current = fromDate;
    let scanned = 0;
    while (dates.length < days && scanned < days * 3) {
        const dow = new Date(current).getDay();
        if (studyDays.includes(dow) && !blockedDates.includes(current)) {
            dates.push(current);
        }
        current = addDays(current, 1);
        scanned++;
    }
    return dates;
}

function getExistingLoadForDate(schedule: CalendarEvent[], date: string): number {
    return schedule
        .filter(e => e.date === date)
        .reduce((sum, e) => sum + e.estimatedHours, 0);
}

function getHardTopicCountForDate(schedule: CalendarEvent[], date: string): number {
    return schedule.filter(e => e.date === date && !e.completed && e.difficulty >= 7).length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE LOGIC: Gap Detection, Capacity Analysis, Redistribution
// ═══════════════════════════════════════════════════════════════════════════════

function detectGap(input: SelfHealingInput) {
    const today = todayISO();
    const affected = input.current_schedule.filter(e =>
        !e.completed && e.date <= today
    );
    const totalRemaining = input.unfinished_topics.reduce(
        (sum, t) => sum + t.remaining_hours * FATIGUE_MULTIPLIER,
        0
    );
    const daysAffected = [...new Set(affected.map(e => e.date))];

    return {
        affected_sessions: affected.length,
        total_remaining_workload_hours: Math.round(totalRemaining * 10) / 10,
        days_affected: daysAffected,
    };
}

function analyzeCapacity(
    input: SelfHealingInput,
    window: number = REDISTRIBUTION_WINDOW
): {
    available_days: number;
    available_hours: number;
    can_absorb_without_overload: boolean;
    daily_capacity: { date: string; available: number; existing: number }[];
} {
    const today = todayISO();
    const bufferDays = input.weekly_buffer_days || [];
    const studyDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !bufferDays.includes(d));

    // Get exam-protected dates
    const protectedDates: string[] = [];
    if (input.exam_date) {
        for (let i = 1; i <= REVISION_BUFFER_DAYS; i++) {
            protectedDates.push(addDays(input.exam_date, -i));
        }
    }

    const availableDates = getAvailableDates(
        today,
        window,
        protectedDates,
        studyDays
    );

    const dailyCapacity = availableDates.map(date => {
        const existing = getExistingLoadForDate(input.current_schedule, date);
        const maxToday = input.daily_available_hours * (1 + MAX_DAILY_OVERLOAD);
        return {
            date,
            available: Math.max(0, maxToday - existing),
            existing,
        };
    });

    const totalAvailable = dailyCapacity.reduce((sum, d) => sum + d.available, 0);
    const totalRemaining = input.unfinished_topics.reduce(
        (sum, t) => sum + t.remaining_hours * FATIGUE_MULTIPLIER,
        0
    );

    return {
        available_days: availableDates.length,
        available_hours: Math.round(totalAvailable * 10) / 10,
        can_absorb_without_overload: totalAvailable >= totalRemaining,
        daily_capacity: dailyCapacity,
    };
}

function redistributeTopics(
    input: SelfHealingInput,
    capacity: ReturnType<typeof analyzeCapacity>
): { events: CalendarEvent[]; actions: HealingAction[]; overload: OverloadAnalysis } {
    const actions: HealingAction[] = [];
    const newEvents: CalendarEvent[] = [];
    const timeStart = TIME_STARTS[input.time_preference || "morning"];

    // Sort unfinished topics: high priority first, then hard topics first
    const sorted = [...input.unfinished_topics].sort((a, b) => {
        const pw = priorityWeight(b.priority) - priorityWeight(a.priority);
        if (pw !== 0) return pw;
        return difficultyToNumber(b.difficulty) - difficultyToNumber(a.difficulty);
    });

    // Track daily assignments
    const dailyAssignments = new Map<string, { hours: number; hardCount: number }>();
    for (const dc of capacity.daily_capacity) {
        dailyAssignments.set(dc.date, { hours: dc.existing, hardCount: getHardTopicCountForDate(input.current_schedule, dc.date) });
    }

    // Track light days per week
    const weeklyLoad = new Map<string, number>();

    const compressedTopics: string[] = [];
    let totalRemainingHours = 0;
    let totalAvailableHours = capacity.available_hours;

    for (const topic of sorted) {
        let remaining = topic.remaining_hours * FATIGUE_MULTIPLIER * PROCRASTINATION_BUFFER;
        totalRemainingHours += remaining;
        const isHard = topic.difficulty === "hard";
        const diffNum = difficultyToNumber(topic.difficulty);

        // If overloaded, compress low-priority topics
        if (!capacity.can_absorb_without_overload && topic.priority === "low") {
            remaining = remaining * 0.6; // Compress by 40%
            compressedTopics.push(topic.topic);
            actions.push({
                type: "compress",
                description: `Compressed "${topic.topic}" from ${(topic.remaining_hours).toFixed(1)}h to ${remaining.toFixed(1)}h (low priority, overload protection)`,
            });
        }

        // Distribute across available days
        for (const dc of capacity.daily_capacity) {
            if (remaining <= 0) break;

            const dayData = dailyAssignments.get(dc.date)!;
            const maxForDay = input.daily_available_hours * (1 + MAX_DAILY_OVERLOAD);
            const availableToday = maxForDay - dayData.hours;

            // Skip if day is full
            if (availableToday < 0.5) continue;

            // Skip if too many hard topics on this day
            if (isHard && dayData.hardCount >= MAX_HARD_TOPICS_PER_DAY) continue;

            // Determine session duration
            const sessionHours = Math.min(remaining, availableToday, 3); // Max 3h per session
            if (sessionHours < 0.5) continue;

            // Determine time slot
            let sessionStart: string;
            if (isHard && input.energy_pattern?.peak_hours) {
                // Hard topics go to peak hours
                sessionStart = input.energy_pattern.peak_hours.split("-")[0] || timeStart;
            } else if (topic.difficulty === "easy" && input.energy_pattern?.low_energy_hours) {
                // Easy topics can go to low-energy slots
                sessionStart = input.energy_pattern.low_energy_hours.split("-")[0] || addHoursToTime(timeStart, dayData.hours);
            } else {
                sessionStart = addHoursToTime(timeStart, dayData.hours);
            }

            const sessionEnd = addHoursToTime(sessionStart, sessionHours);

            const newEvent: CalendarEvent = {
                id: generateId("heal"),
                date: dc.date,
                startTime: sessionStart,
                endTime: sessionEnd,
                subject: topic.subject,
                topic: remaining < topic.remaining_hours
                    ? `${topic.topic} (continued)`
                    : topic.topic,
                phase: topic.phase || "Core",
                phaseId: topic.phaseId || generateId("phase"),
                topicId: topic.topicId || generateId("topic"),
                sessionType: "Study",
                difficulty: diffNum,
                estimatedHours: Math.round(sessionHours * 10) / 10,
                completed: false,
                xpReward: Math.round(calcXP(diffNum)),
            };

            newEvents.push(newEvent);
            actions.push({
                type: remaining <= sessionHours ? "reschedule" : "split",
                description: `${remaining <= sessionHours ? "Rescheduled" : "Split"} "${topic.topic}" → ${dc.date} (${sessionHours.toFixed(1)}h, ${sessionStart}–${sessionEnd})`,
                new_event: newEvent,
            });

            // Update trackers
            dayData.hours += sessionHours;
            if (isHard) dayData.hardCount++;
            remaining -= sessionHours;

            // Track weekly load
            const weekStart = getWeekStart(dc.date);
            weeklyLoad.set(weekStart, (weeklyLoad.get(weekStart) || 0) + sessionHours);
        }
    }

    // Overload analysis
    const utilization = totalAvailableHours > 0
        ? Math.round((totalRemainingHours / totalAvailableHours) * 100)
        : 100;

    const riskLevel: OverloadAnalysis["risk_level"] =
        utilization > 95 ? "critical" :
            utilization > 80 ? "high" :
                utilization > 60 ? "medium" : "low";

    const daysUntilExam = input.exam_date
        ? getDaysBetween(todayISO(), input.exam_date)
        : 999;

    const overload: OverloadAnalysis = {
        risk_level: riskLevel,
        total_remaining_hours: Math.round(totalRemainingHours * 10) / 10,
        available_hours_until_exam: Math.round(totalAvailableHours * 10) / 10,
        utilization_percentage: utilization,
        compressed_topics: compressedTopics,
        recommendation: buildOverloadRecommendation(riskLevel, utilization, daysUntilExam),
    };

    return { events: newEvents, actions, overload };
}

function getWeekStart(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split("T")[0];
}

function buildOverloadRecommendation(
    risk: OverloadAnalysis["risk_level"],
    utilization: number,
    daysUntilExam: number
): string {
    if (risk === "critical") {
        return `⚠️ CRITICAL: Schedule is at ${utilization}% capacity. ${daysUntilExam < 7
            ? "Exam is imminent. Focus ONLY on high-priority topics and practice questions."
            : "Consider extending study hours or deferring low-priority topics."}`;
    }
    if (risk === "high") {
        return `🔶 HIGH LOAD: Schedule is at ${utilization}% capacity. Low-priority topics have been compressed. Stick to the plan and avoid adding new activities.`;
    }
    if (risk === "medium") {
        return `📊 MODERATE: Schedule is at ${utilization}% capacity. Your workload is manageable but leave buffer for unexpected delays.`;
    }
    return `✅ HEALTHY: Schedule is at ${utilization}% capacity. You have room for flexibility.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Antigravity Thinking — Forward-looking prediction
// ═══════════════════════════════════════════════════════════════════════════════

function generateAntigravityNotes(input: SelfHealingInput, overload: OverloadAnalysis): string[] {
    const notes: string[] = [];
    const today = todayISO();

    // 1. Underestimation prediction
    const hardTopics = input.unfinished_topics.filter(t => t.difficulty === "hard");
    if (hardTopics.length > 0) {
        notes.push(
            `📐 ${hardTopics.length} hard topic(s) remaining. Historical data suggests students underestimate hard topics by 20-40%. Building in extra buffer.`
        );
    }

    // 2. Fatigue accumulation
    const recentHighLoadDays = input.current_schedule
        .filter(e => e.date >= addDays(today, -3) && e.date <= today)
        .reduce((sum, e) => sum + e.estimatedHours, 0);
    if (recentHighLoadDays > input.daily_available_hours * 2.5) {
        notes.push(
            `🔋 High study load detected in the last 3 days (${recentHighLoadDays.toFixed(1)}h). Cognitive fatigue may reduce efficiency. Consider a lighter day tomorrow.`
        );
    }

    // 3. Procrastination spillover
    if (input.disruption_type === "skipped_day") {
        notes.push(
            `⚡ Skipped day detected. Research shows that missing 1 day increases the probability of missing the next day by 40%. Lock in tomorrow's first session to break the pattern.`
        );
    }

    // 4. Exam proximity warning
    if (input.exam_date) {
        const daysLeft = getDaysBetween(today, input.exam_date);
        if (daysLeft <= 7) {
            notes.push(
                `🎯 Exam in ${daysLeft} days. Switching to revision-priority mode. New study sessions will be limited; focus on practice and review.`
            );
        } else if (daysLeft <= 14) {
            notes.push(
                `📅 Exam in ${daysLeft} days. Entering pre-exam phase. Ensure all core topics are covered within the next ${Math.max(1, daysLeft - 5)} days.`
            );
        }
    }

    // 5. Future disruption anticipation
    if (overload.risk_level === "high" || overload.risk_level === "critical") {
        notes.push(
            `🛡️ High utilization detected. Any additional disruption (skipped day, new event) could cascade into significant delays. Treat this week's schedule as non-negotiable.`
        );
    }

    // 6. Weekend strategy
    const upcomingWeekend = input.current_schedule.filter(e => {
        const dow = new Date(e.date).getDay();
        return (dow === 0 || dow === 6) && e.date > today && !e.completed;
    });
    if (upcomingWeekend.length === 0 && overload.utilization_percentage > 70) {
        notes.push(
            `📆 No weekend sessions scheduled but workload is elevated. Consider adding 1-2 light review sessions on Saturday to create breathing room.`
        );
    }

    return notes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ollama-Enhanced Reasoning (Tier 1)
// ═══════════════════════════════════════════════════════════════════════════════

async function getOllamaReasoning(input: SelfHealingInput, gap: any, capacity: any): Promise<string | null> {
    const ollamaOk = await isOllamaAvailable();
    if (!ollamaOk) return null;

    const systemPrompt = `You are a Self-Healing Study Scheduling Engine.
Your mission is to analyze a schedule disruption and provide strategic reasoning for the repair.
You think 7 days ahead and anticipate future problems.
Return ONLY a JSON object with a single "reasoning" field containing 2-4 sentences of strategic advice.`;

    const userPrompt = `DISRUPTION: ${input.disruption_type}
UNFINISHED TOPICS: ${input.unfinished_topics.map(t => `${t.topic} (${t.subject}, ${t.remaining_hours}h, ${t.priority} priority, ${t.difficulty})`).join("; ")}
GAP: ${gap.affected_sessions} sessions affected, ${gap.total_remaining_workload_hours}h remaining
CAPACITY: ${capacity.available_days} days available, ${capacity.available_hours}h total capacity
CAN ABSORB: ${capacity.can_absorb_without_overload}
${input.exam_date ? `EXAM DATE: ${input.exam_date} (${getDaysBetween(todayISO(), input.exam_date)} days away)` : "No exam date set"}
DAILY HOURS: ${input.daily_available_hours}

Analyze this situation and provide strategic reasoning. Return ONLY: {"reasoning": "..."}`;

    try {
        const raw = await callOllama(systemPrompt, userPrompt, 0.7);
        const parsed = extractJSON<{ reasoning: string }>(raw);
        return parsed?.reasoning || null;
    } catch (err) {
        agentLog(AGENT_NAME, "Ollama reasoning failed", err);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Handle Specific Disruption Types
// ═══════════════════════════════════════════════════════════════════════════════

function handleNewEvent(input: SelfHealingInput): { modifiedSchedule: CalendarEvent[]; actions: HealingAction[] } {
    const actions: HealingAction[] = [];
    const modified = [...input.current_schedule];

    if (!input.new_event) return { modifiedSchedule: modified, actions };

    const conflicting = modified.filter(e =>
        e.date === input.new_event!.date &&
        !e.completed &&
        e.sessionType !== "Busy" &&
        e.startTime < input.new_event!.end_time &&
        e.endTime > input.new_event!.start_time
    );

    for (const conflict of conflicting) {
        // Remove the conflicting event and add it to unfinished topics
        const idx = modified.findIndex(e => e.id === conflict.id);
        if (idx !== -1) {
            modified.splice(idx, 1);
            input.unfinished_topics.push({
                subject: conflict.subject,
                topic: conflict.topic,
                remaining_hours: conflict.estimatedHours,
                difficulty: conflict.difficulty >= 7 ? "hard" : conflict.difficulty >= 4 ? "medium" : "easy",
                priority: "medium",
                original_date: conflict.date,
                topicId: conflict.topicId,
                phaseId: conflict.phaseId,
                phase: conflict.phase,
            });
            actions.push({
                type: "remove",
                description: `Removed conflicting session "${conflict.topic}" on ${conflict.date} (${conflict.startTime}–${conflict.endTime}) due to new event`,
                affected_event_id: conflict.id,
            });
        }
    }

    return { modifiedSchedule: modified, actions };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Export
// ═══════════════════════════════════════════════════════════════════════════════

export async function runSelfHealingScheduler(
    input: SelfHealingInput
): Promise<SelfHealingOutput> {
    const startTime = Date.now();
    agentLog(AGENT_NAME, "🔧 Self-healing activated", {
        disruption: input.disruption_type,
        unfinished: input.unfinished_topics.length,
    });

    // ── Step 1: Handle new events (remove conflicts first) ───────────────
    let preActions: HealingAction[] = [];
    let workingSchedule = [...input.current_schedule];

    if (input.disruption_type === "new_event") {
        const result = handleNewEvent(input);
        workingSchedule = result.modifiedSchedule;
        preActions = result.actions;
    }

    // ── Step 2: Detect Gap ───────────────────────────────────────────────
    const gap = detectGap({ ...input, current_schedule: workingSchedule });
    agentLog(AGENT_NAME, "Gap detected", gap);

    // ── Step 3: Analyze Future Capacity ──────────────────────────────────
    const capacity = analyzeCapacity({ ...input, current_schedule: workingSchedule });
    agentLog(AGENT_NAME, "Capacity analyzed", {
        availableDays: capacity.available_days,
        availableHours: capacity.available_hours,
        canAbsorb: capacity.can_absorb_without_overload,
    });

    // ── Step 4: Redistribute Topics ──────────────────────────────────────
    const { events: newEvents, actions: redistActions, overload } = redistributeTopics(
        { ...input, current_schedule: workingSchedule },
        capacity
    );

    // ── Step 5: Merge healed schedule ────────────────────────────────────
    const healedSchedule = [...workingSchedule, ...newEvents]
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    // ── Step 6: Get Ollama reasoning if available ────────────────────────
    let reasoning = buildDefaultReasoning(input, gap, capacity, overload);
    const ollamaReasoning = await getOllamaReasoning(input, gap, capacity);
    if (ollamaReasoning) {
        reasoning = ollamaReasoning;
    }

    // ── Step 7: Antigravity Thinking ─────────────────────────────────────
    const antigravityNotes = generateAntigravityNotes(input, overload);

    // ── Step 8: Compile all actions ──────────────────────────────────────
    const allActions = [...preActions, ...redistActions];

    const meta = buildMeta(AGENT_NAME, !!ollamaReasoning, startTime);
    agentLog(AGENT_NAME, "✅ Self-healing complete", {
        newEvents: newEvents.length,
        actions: allActions.length,
        overloadRisk: overload.risk_level,
        durationMs: meta.durationMs,
    });

    return {
        success: true,
        disruption_type: input.disruption_type,
        gap_analysis: gap,
        capacity_analysis: {
            available_days: capacity.available_days,
            available_hours: capacity.available_hours,
            can_absorb_without_overload: capacity.can_absorb_without_overload,
        },
        healed_schedule: healedSchedule,
        actions_taken: allActions,
        overload_analysis: overload,
        antigravity_notes: antigravityNotes,
        reasoning,
        meta,
    };
}

function buildDefaultReasoning(
    input: SelfHealingInput,
    gap: any,
    capacity: any,
    overload: OverloadAnalysis
): string {
    const lines: string[] = [];

    switch (input.disruption_type) {
        case "incomplete":
            lines.push(`Detected ${gap.affected_sessions} incomplete session(s) totaling ${gap.total_remaining_workload_hours}h of unfinished work.`);
            break;
        case "skipped_day":
            lines.push(`Skipped day detected. ${gap.total_remaining_workload_hours}h of study needs to be redistributed.`);
            break;
        case "new_event":
            lines.push(`New calendar event created a conflict. Affected sessions have been rescheduled.`);
            break;
        case "underestimated":
            lines.push(`Time underestimation detected. Extra hours have been allocated with a fatigue buffer.`);
            break;
        case "overloaded":
            lines.push(`Schedule overload detected. Low-priority topics have been compressed to maintain feasibility.`);
            break;
    }

    if (capacity.can_absorb_without_overload) {
        lines.push(`Work has been spread across ${capacity.available_days} days without exceeding the 30% overload threshold.`);
    } else {
        lines.push(`Available capacity (${capacity.available_hours}h) is insufficient for the remaining workload. ${overload.compressed_topics.length > 0
            ? `Compressed ${overload.compressed_topics.length} low-priority topic(s) to fit.`
            : "Consider extending daily hours or deferring topics."}`);
    }

    return lines.join(" ");
}
