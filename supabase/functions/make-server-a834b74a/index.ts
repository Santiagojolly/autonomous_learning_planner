// @ts-nocheck
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import * as auth from "./auth.tsx";
import * as agentUtils from "./agents/agentUtils.ts";
import { runRoadmapArchitect } from "./agents/roadmapArchitect.ts";
import { runScheduleStrategist } from "./agents/scheduleStrategist.ts";
import { runProgressOracle } from "./agents/progressOracle.ts";
import { runARIA } from "./agents/academicResourceIntelligence.ts";
import { runHealthCheck } from "./healthCheck.ts";

const app = new Hono();
const FUNC_NAME = "/make-server-a834b74a";

// Run initial health check
runHealthCheck();

// Enable logger
app.use('*', logger((message) => {
  console.log(`[API LOG]: ${message}`);
}));

// Enable CORS
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "x-client-info"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 600,
  }),
);

// The anon key role — used to detect guest/unauthenticated requests
const ANON_ROLE = "anon";

// Protected endpoints middleware — accepts a valid user JWT OR the anon key (guest fallback)
const authMiddleware = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized - Missing token" }, 401);
  }
  const token = authHeader.split(" ")[1];

  // Detect anon key by decoding the JWT role claim (no network call needed)
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload?.role === ANON_ROLE) {
      // Guest mode — use a stable guest user ID so KV data persists across requests
      c.set("user", { id: "guest-user", email: "guest@local", role: "anon" });
      await next();
      return;
    }
  } catch { /* not a parseable JWT — fall through to verifyToken */ }

  // Normal path: verify as a real Supabase user JWT
  try {
    const user = await auth.verifyToken(token);
    c.set("user", user);
    await next();
  } catch (err) {
    console.error("[Auth] Token verification failed:", err);
    return c.json({ error: "Unauthorized - Invalid token", detail: err.message }, 401);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// API Router
// ─────────────────────────────────────────────────────────────────────────────
const api = new Hono();

// ── Health ────────────────────────────────────────────────────────────────────
api.get("/health", (c) => c.json({ status: "ok", time: new Date().toISOString() }));

// ── Auth ──────────────────────────────────────────────────────────────────────
api.post("/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    if (!email || !password || !name) return c.json({ error: "Missing required fields" }, 400);
    const result = await auth.signUp(email, password, name);
    const userId = result.user.id;
    await kv.set(`user:${userId}:subjects`, []);
    await kv.set(`user:${userId}:tasks`, []);
    await kv.set(`user:${userId}:profile`, {
      id: userId, name, email,
      joinDate: new Date().toISOString(),
      weeklyGoal: 30, dailyGoal: 5,
    });
    await kv.set(`user:${userId}:settings`, {
      timePreference: "morning",
      studyDays: [1, 2, 3, 4, 5],
      blockedDates: [],
      dailyHours: 2,
      notificationsEnabled: true,
    });
    await kv.set(`user:${userId}:xp`, { total: 0, level: 1, levelName: "Apprentice Scholar" });
    await kv.set(`user:${userId}:achievements`, []);
    await kv.set(`user:${userId}:notifications`, []);
    const signInResult = await auth.signIn(email, password);
    return c.json({ success: true, user: signInResult.user, session: signInResult.session });
  } catch (err) {
    return c.json({ error: err.message }, 400);
  }
});

api.post("/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();
    const result = await auth.signIn(email, password);
    return c.json({ success: true, session: result.session, user: result.user });
  } catch (err) {
    return c.json({ error: err.message }, 401);
  }
});

// ── User Data (existing) ──────────────────────────────────────────────────────
api.get("/user/subjects", authMiddleware, async (c) => {
  const user = c.get("user");
  const subjects = await kv.get(`user:${user.id}:subjects`) || [];
  return c.json({ subjects });
});

api.post("/user/subjects", authMiddleware, async (c) => {
  const user = c.get("user");
  const { subjects } = await c.req.json();
  await kv.set(`user:${user.id}:subjects`, subjects);
  return c.json({ success: true, subjects });
});

api.get("/user/tasks", authMiddleware, async (c) => {
  const user = c.get("user");
  const tasks = await kv.get(`user:${user.id}:tasks`) || [];
  return c.json({ tasks });
});

api.post("/user/tasks", authMiddleware, async (c) => {
  const user = c.get("user");
  const { tasks } = await c.req.json();
  await kv.set(`user:${user.id}:tasks`, tasks);
  return c.json({ success: true, tasks });
});

api.get("/user/profile", authMiddleware, async (c) => {
  const user = c.get("user");
  const profile = await kv.get(`user:${user.id}:profile`) || {
    id: user.id,
    name: user.user_metadata?.name || "User",
    email: user.email,
    joinDate: new Date().toISOString(),
    weeklyGoal: 30, dailyGoal: 5,
  };
  return c.json({ profile });
});

api.post("/user/profile", authMiddleware, async (c) => {
  const user = c.get("user");
  const { profile } = await c.req.json();
  const existing = await kv.get(`user:${user.id}:profile`) || { joinDate: new Date().toISOString() };
  const updated = { ...existing, ...profile, id: user.id, joinDate: existing.joinDate };
  await kv.set(`user:${user.id}:profile`, updated);
  return c.json({ success: true, profile: updated });
});

// ── Settings ──────────────────────────────────────────────────────────────────
api.get("/user/settings", authMiddleware, async (c) => {
  const user = c.get("user");
  const settings = await kv.get(`user:${user.id}:settings`) || {
    timePreference: "morning",
    studyDays: [1, 2, 3, 4, 5],
    blockedDates: [],
    dailyHours: 2,
    notificationsEnabled: true,
  };
  return c.json({ settings });
});

api.post("/user/settings", authMiddleware, async (c) => {
  const user = c.get("user");
  const { settings } = await c.req.json();
  const existing = await kv.get(`user:${user.id}:settings`) || {};
  const updated = { ...existing, ...settings };
  await kv.set(`user:${user.id}:settings`, updated);
  return c.json({ success: true, settings: updated });
});

// ── Calendar Events ───────────────────────────────────────────────────────────
api.get("/user/calendar-events", authMiddleware, async (c) => {
  const user = c.get("user");
  const events = await kv.get(`user:${user.id}:calendar_events`) || [];
  return c.json({ events });
});

api.post("/user/calendar-events", authMiddleware, async (c) => {
  const user = c.get("user");
  const { events } = await c.req.json();
  await kv.set(`user:${user.id}:calendar_events`, events);
  return c.json({ success: true, events });
});

// Patch a single event (e.g. mark completed)
api.post("/user/calendar-events/patch", authMiddleware, async (c) => {
  const user = c.get("user");
  const { eventId, patch } = await c.req.json();
  const events = await kv.get(`user:${user.id}:calendar_events`) || [];
  const updated = events.map((e: any) =>
    e.id === eventId ? { ...e, ...patch } : e
  );
  await kv.set(`user:${user.id}:calendar_events`, updated);
  return c.json({ success: true });
});

// ── Progress Reports ──────────────────────────────────────────────────────────
api.get("/user/progress-reports", authMiddleware, async (c) => {
  const user = c.get("user");
  const reports = await kv.get(`user:${user.id}:progress_reports`) || [];
  return c.json({ reports });
});

api.post("/user/progress-reports", authMiddleware, async (c) => {
  const user = c.get("user");
  const { report } = await c.req.json();
  const existing = await kv.get(`user:${user.id}:progress_reports`) || [];
  const updated = [...existing, report];
  await kv.set(`user:${user.id}:progress_reports`, updated);
  return c.json({ success: true, reports: updated });
});

// ── XP & Achievements ─────────────────────────────────────────────────────────
api.get("/user/xp", authMiddleware, async (c) => {
  const user = c.get("user");
  const xp = await kv.get(`user:${user.id}:xp`) || { total: 0, level: 1, levelName: "Apprentice Scholar" };
  return c.json({ xp });
});

api.post("/user/xp/add", authMiddleware, async (c) => {
  const user = c.get("user");
  const { amount } = await c.req.json();
  const current = await kv.get(`user:${user.id}:xp`) || { total: 0, level: 1, levelName: "Apprentice Scholar" };
  const newTotal = (current.total || 0) + (amount || 0);
  const { level, levelName } = calculateLevel(newTotal);
  const updated = { total: newTotal, level, levelName };
  await kv.set(`user:${user.id}:xp`, updated);
  return c.json({ success: true, xp: updated });
});

api.get("/user/achievements", authMiddleware, async (c) => {
  const user = c.get("user");
  const achievements = await kv.get(`user:${user.id}:achievements`) || [];
  return c.json({ achievements });
});

api.post("/user/achievements", authMiddleware, async (c) => {
  const user = c.get("user");
  const { achievements } = await c.req.json();
  const existing = await kv.get(`user:${user.id}:achievements`) || [];
  const existingIds = new Set(existing.map((a: any) => a.id));
  const newOnes = (achievements || []).filter((a: any) => !existingIds.has(a.id));
  const updated = [...existing, ...newOnes];
  await kv.set(`user:${user.id}:achievements`, updated);
  return c.json({ success: true, achievements: updated });
});

// ── Notifications ─────────────────────────────────────────────────────────────
api.get("/user/notifications", authMiddleware, async (c) => {
  const user = c.get("user");
  const notifications = await kv.get(`user:${user.id}:notifications`) || [];
  return c.json({ notifications });
});

api.post("/user/notifications/read", authMiddleware, async (c) => {
  const user = c.get("user");
  const { notificationId } = await c.req.json();
  const existing = await kv.get(`user:${user.id}:notifications`) || [];
  const updated = existing.map((n: any) =>
    n.id === notificationId ? { ...n, read: true } : n
  );
  await kv.set(`user:${user.id}:notifications`, updated);
  return c.json({ success: true });
});


api.get("/ai/agents/status", authMiddleware, async (c) => {
  const user = c.get("user");
  const [roadmap, events, reports, xp, achievements] = await Promise.all([
    kv.get(`user:${user.id}:roadmap`),
    kv.get(`user:${user.id}:calendar_events`),
    kv.get(`user:${user.id}:progress_reports`),
    kv.get(`user:${user.id}:xp`),
    kv.get(`user:${user.id}:achievements`),
  ]);
  return c.json({
    roadmap: roadmap || null,
    calendarEvents: events || [],
    latestReport: reports?.length > 0 ? reports[reports.length - 1] : null,
    xp: xp || { total: 0, level: 1, levelName: "Apprentice Scholar" },
    achievements: achievements || [],
  });
});

// ── Agent 1: Roadmap Architect ────────────────────────────────────────────────
api.post("/ai/agents/roadmap-architect", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { subject, level, dailyHours, timeframeWeeks, additionalContext } = body;

    if (!subject || !level) {
      return c.json({ error: "Missing required fields: subject, level" }, 400);
    }

    console.log(`[RoadmapArchitect] Running for user ${user.id}, subject: ${subject}`);

    const result = await runRoadmapArchitect(
      {
        subject,
        level: level || "beginner",
        dailyHours: Number(dailyHours) || 2,
        timeframeWeeks: Number(timeframeWeeks) || 8,
        additionalContext,
      },
      user.id
    );

    // Persist roadmap to KV
    await kv.set(`user:${user.id}:roadmap`, result.roadmap);

    return c.json({ success: true, agent: "RoadmapArchitect", ...result });
  } catch (err) {
    console.error("[RoadmapArchitect] Error:", err);
    return c.json({ error: err.message || "Agent error" }, 500);
  }
});

// ── Agent 2: Schedule Strategist ──────────────────────────────────────────────
api.post("/ai/agents/schedule-strategist", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { roadmapId, startDate, timePreference, studyDays, blockedDates } = body;

    // Load roadmap from KV (passed by pipeline or fetched)
    let roadmap = body.roadmap || await kv.get(`user:${user.id}:roadmap`);
    if (!roadmap) {
      return c.json({ error: "No roadmap found. Run the Roadmap Architect first." }, 400);
    }

    // Load user settings as defaults
    const settings = await kv.get(`user:${user.id}:settings`) || {};

    console.log(`[ScheduleStrategist] Running for user ${user.id}, subject: ${roadmap.subject}`);

    const result = await runScheduleStrategist({
      roadmap,
      startDate: startDate || new Date().toISOString().split("T")[0],
      timePreference: timePreference || settings.timePreference || "morning",
      studyDays: studyDays || settings.studyDays || [1, 2, 3, 4, 5],
      blockedDates: blockedDates || settings.blockedDates || [],
      dailyHours: Number(settings.dailyHours) || roadmap.dailyHours || 2,
    });

    // Persist calendar events to KV
    await kv.set(`user:${user.id}:calendar_events`, result.events);

    return c.json({ success: true, agent: "ScheduleStrategist", ...result });
  } catch (err) {
    console.error("[ScheduleStrategist] Error:", err);
    return c.json({ error: err.message || "Agent error" }, 500);
  }
});

// ── Agent 3: Progress Oracle ──────────────────────────────────────────────────
api.post("/ai/agents/progress-oracle", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { action, checkIn } = body;

    // Load data from KV
    const [roadmap, calendarEvents, previousReports] = await Promise.all([
      kv.get(`user:${user.id}:roadmap`),
      kv.get(`user:${user.id}:calendar_events`),
      kv.get(`user:${user.id}:progress_reports`),
    ]);

    console.log(`[ProgressOracle] Running action "${action}" for user ${user.id}`);

    const result = await runProgressOracle({
      action: action || "weekly-report",
      userId: user.id,
      roadmap: roadmap || { phases: [], subject: "General", totalWeeks: 8 },
      calendarEvents: calendarEvents || [],
      previousReports: previousReports || [],
      checkIn,
    });

    // Handle check-in: patch the event and award XP
    if (action === "check-in" && result.updatedEvent) {
      const { eventId, completed, xpAwarded } = result.updatedEvent;

      // Patch the event in calendar_events
      const events = calendarEvents || [];
      const patchedEvents = events.map((e: any) =>
        e.id === eventId
          ? { ...e, completed, completedAt: new Date().toISOString() }
          : e
      );
      await kv.set(`user:${user.id}:calendar_events`, patchedEvents);

      // Add XP
      const currentXP = await kv.get(`user:${user.id}:xp`) || { total: 0 };
      const newTotal = (currentXP.total || 0) + xpAwarded;
      const { level, levelName } = calculateLevel(newTotal);
      await kv.set(`user:${user.id}:xp`, { total: newTotal, level, levelName });

      // TRACK PROFICIENCY & SRS
      const subKey = `user:${user.id}:mastery:${roadmap.subject.toLowerCase()}`;
      const mastery = await kv.get(subKey) || { score: 50, sessions: 0, lastCheckIn: null };
      const confidence = checkIn?.confidence || 3;
      const newScore = Math.min(100, Math.max(0, mastery.score + (confidence - 3) * 5));
      await kv.set(subKey, {
        score: newScore,
        sessions: mastery.sessions + 1,
        lastCheckIn: new Date().toISOString(),
        confidence_trend: [...(mastery.confidence_trend || []), confidence].slice(-10)
      });
    }

    // Save report if generated
    if (result.report) {
      const existing = previousReports || [];
      await kv.set(`user:${user.id}:progress_reports`, [...existing, result.report]);
    }

    // Save achievements
    if (result.achievements && result.achievements.length > 0) {
      const existingAch = await kv.get(`user:${user.id}:achievements`) || [];
      const existingIds = new Set(existingAch.map((a: any) => a.id));
      const newAch = result.achievements.filter((a) => !existingIds.has(a.id));
      if (newAch.length > 0) {
        await kv.set(`user:${user.id}:achievements`, [...existingAch, ...newAch]);
      }
    }

    // Save alerts as notifications
    if (result.alerts && result.alerts.length > 0) {
      const existingNotif = await kv.get(`user:${user.id}:notifications`) || [];
      const updated = [...existingNotif, ...result.alerts].slice(-50); // keep last 50
      await kv.set(`user:${user.id}:notifications`, updated);
    }

    return c.json({ success: true, agent: "ProgressOracle", ...result });
  } catch (err) {
    console.error("[ProgressOracle] Error:", err);
    return c.json({ error: err.message || "Agent error" }, 500);
  }
});

// ── Agent 4: Academic Resource Intelligence ────────────────────────────────────
api.post("/ai/agents/academic-resource-intelligence", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { topic_request, exam_type, weak_areas, preferred_learning_style, time_available_minutes, past_performance, bypass_cache } = body;

    if (!topic_request?.length) {
      return c.json({ error: "Missing required fields: topic_request" }, 400);
    }

    const t = topic_request[0];
    const cacheKey = `user:${user.id}:recs:${t.subject.toLowerCase()}:${t.topic.toLowerCase()}`;

    if (!bypass_cache) {
      const cached = await kv.get(cacheKey);
      if (cached) {
        console.log(`[AcademicResourceIntelligence] Cache hit: ${cacheKey}`);
        return c.json({ success: true, agent: "AcademicResourceIntelligence", ...cached, from_cache: true });
      }
    }

    console.log(`[AcademicResourceIntelligence] Cache miss. Running for user ${user.id}`);

    // ── MISSION: Agentic RAG Context Retrieval ─────────────────────────────
    const xp = await kv.get(`user:${user.id}:xp`) || { level: 1 };
    const roadmap = await kv.get(`user:${user.id}:roadmap`);

    // Determine roadmap stage
    let roadmap_stage = "core";
    if (roadmap?.phases) {
      const activePhase = roadmap.phases.find(p => p.topics.some(t => t.id === t.id && t.status !== 'completed'));
      roadmap_stage = activePhase?.name.toLowerCase() || "revision";
    }

    const result = await runARIA(
      {
        subject: t.subject,
        topic: t.topic,
        difficulty: t.student_level || "intermediate",
        weak_topics: weak_areas || [],
        roadmap_stage: roadmap_stage as any,
        xp_level: xp.level || 1,
        available_daily_hours: Number(time_available_minutes) / 60 || 2,
      },
      user.id
    );

    // Persist to cache
    await kv.set(cacheKey, result);

    return c.json({ success: true, agent: "AcademicResourceIntelligence", ...result });
  } catch (err) {
    console.error("[AcademicResourceIntelligence] Error:", err);
    return c.json({ error: err.message || "Agent error" }, 500);
  }
});

// ── Agent 5: SYNAPSE (High-Intelligence Neuro-Core) ─────────────────────
api.post("/ai/agents/chat", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const { topic, subject, question, history = [] } = await c.req.json();

    // ── MISSION: LLM Integration (GPT-4o > Claude > Heuristic) ─────────────────
    const systemPrompt = `You are SYNAPSE, an advanced Analytical Neuro-Core with intelligence parity to GPT-4o.
Context: Student is exploring "${topic}" in the domain of "${subject}".
Expertise: You have deep knowledge in Engineering, Advanced Mathematics, and Modern AI.
Philosophy: Provide "First-Principles" explanations. Never be vague. Use Socratic reasoning.
Output Requirements:
- Use LaTeX ($...$) for every mathematical expression or variable.
- Use high-fidelity Markdown formatting.
- If code is required, provide production-ready C++ or Python examples.
- Correct user misconceptions with logical precision.`;

    const userPrompt = `Analyzing: "${topic}"\nStudent Query: "${question}"\n\nDialogue Stack:\n${history.map(h => `${h.role === 'user' ? 'STIMULUS' : 'SYNAPSE'}: ${h.content}`).join('\n')}\n\nExecute high-intelligence response synthesis.`;

    let answer = "";
    let usedRealAI = false;

    // 1. Try Premium OpenAI (GPT-4o)
    const openAIRes = await agentUtils.callOpenAI(systemPrompt, userPrompt, 0.5);
    if (openAIRes) {
      answer = openAIRes;
      usedRealAI = true;
    } else {
      // 2. Try High-Performance Local Model
      const ollamaRes = await agentUtils.callOllama(systemPrompt, userPrompt, 0.4);
      if (ollamaRes) {
        answer = ollamaRes;
        usedRealAI = true;
      }
    }

    // 3. Prevent silent fallback
    if (!usedRealAI) {
      throw new Error("AI backend unavailable or failed to respond.");
    }

    // Save chat history to KV
    const chatKey = `user:${user.id}:chat:${subject.toLowerCase()}:${topic.toLowerCase()}`;
    const existingHistory = await kv.get(chatKey) || [];
    const updatedHistory = [...existingHistory, { role: 'user', content: question }, { role: 'synapse', content: answer }];
    await kv.set(chatKey, updatedHistory.slice(-20));

    return c.json({ success: true, answer, history: updatedHistory, meta: { usedRealAI, agent: "SYNAPSE" } });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

api.get("/ai/agents/chat-history", authMiddleware, async (c) => {
  const user = c.get("user");
  const topic = c.req.query("topic");
  const subject = c.req.query("subject");
  if (!topic || !subject) return c.json({ history: [] });

  const history = await kv.get(`user:${user.id}:chat:${subject.toLowerCase()}:${topic.toLowerCase()}`) || [];
  return c.json({ history });
});

// ── Full Pipeline (Architect → Strategist → Oracle) ───────────────────────────
api.post("/ai/agents/run-pipeline", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { subject, level, dailyHours, timeframeWeeks, additionalContext } = body;

    if (!subject || !level) {
      return c.json({ error: "Missing required fields: subject, level" }, 400);
    }

    const settings = await kv.get(`user:${user.id}:settings`) || {
      timePreference: "morning",
      studyDays: [1, 2, 3, 4, 5],
      blockedDates: [],
      dailyHours: Number(dailyHours) || 2,
    };

    console.log(`[Pipeline] Starting full pipeline for user ${user.id}`);

    // Step 1: Roadmap Architect
    console.log("[Pipeline] Step 1: Roadmap Architect...");
    const roadmapResult = await runRoadmapArchitect(
      {
        subject,
        level,
        dailyHours: Number(dailyHours) || Number(settings.dailyHours) || 2,
        timeframeWeeks: Number(timeframeWeeks) || 8,
        additionalContext,
      },
      user.id
    );
    await kv.set(`user:${user.id}:roadmap`, roadmapResult.roadmap);

    // Step 2: Schedule Strategist
    console.log("[Pipeline] Step 2: Schedule Strategist...");
    const scheduleResult = await runScheduleStrategist({
      roadmap: roadmapResult.roadmap,
      startDate: new Date().toISOString().split("T")[0],
      timePreference: settings.timePreference || "morning",
      studyDays: settings.studyDays || [1, 2, 3, 4, 5],
      blockedDates: settings.blockedDates || [],
      dailyHours: Number(settings.dailyHours) || Number(dailyHours) || 2,
    });
    await kv.set(`user:${user.id}:calendar_events`, scheduleResult.events);

    // Step 3: Progress Oracle (initial report)
    console.log("[Pipeline] Step 3: Progress Oracle...");
    const previousReports = await kv.get(`user:${user.id}:progress_reports`) || [];
    const oracleResult = await runProgressOracle({
      action: "initial-report",
      userId: user.id,
      roadmap: roadmapResult.roadmap,
      calendarEvents: scheduleResult.events,
      previousReports,
    });
    if (oracleResult.report) {
      await kv.set(`user:${user.id}:progress_reports`, [
        ...previousReports,
        oracleResult.report,
      ]);
    }
    if (oracleResult.achievements?.length) {
      const existing = await kv.get(`user:${user.id}:achievements`) || [];
      const existingIds = new Set(existing.map((a: any) => a.id));
      const newAch = oracleResult.achievements.filter((a) => !existingIds.has(a.id));
      if (newAch.length > 0) {
        await kv.set(`user:${user.id}:achievements`, [...existing, ...newAch]);
      }
    }

    console.log("[Pipeline] Full pipeline completed successfully");

    return c.json({
      success: true,
      pipeline: {
        roadmap: { done: true, meta: roadmapResult.meta },
        schedule: { done: true, meta: scheduleResult.meta },
        oracle: { done: true, meta: oracleResult.meta },
      },
      roadmap: roadmapResult.roadmap,
      events: scheduleResult.events,
      stats: scheduleResult.stats,
      report: oracleResult.report,
      achievements: oracleResult.achievements,
    });
  } catch (err) {
    console.error("[Pipeline] Error:", err);
    return c.json({ error: err.message || "Pipeline error" }, 500);
  }
});

// ── Legacy: generate-roadmap (kept for backwards compat) ─────────────────────
api.post("/ai/generate-roadmap", authMiddleware, async (c) => {
  const { subject, goalHours, currentLevel, timeframe } = await c.req.json();
  const subjectList = subject.split(',').map((s) => s.trim()).filter((s) => s);
  const generatedData = await generateStudyRoadmapLegacy(subjectList, goalHours, currentLevel, timeframe);
  return c.json({ success: true, ...generatedData });
});

/**
 * 🧠 SYNAPSE: High-Performance Synthetic Reasoning Engine
 * Decomposes complex queries into logical axioms when LLM Kernels are offline.
 */
function synthesizeSynapseHeuristic(topic: string, subject: string, question: string): string {
  const q = question.toLowerCase();
  const s = subject.toLowerCase();
  const seed = (topic.length + question.length + subject.length) % 5;

  // 1. Specialized Domain Axioms
  const domainAxioms: Record<string, string[]> = {
    "dbms": [
      "BCNF/3NF Normalization", "B+ Tree Indexing Architecture", "ACID Atomicity Constraints",
      "Disk I/O Scheduling", "Query Execution Planning", "Relational Algebra Optimization",
      "Undo/Redo Log Durability", "Multiversion Concurrency Control (MVCC)"
    ],
    "machine learning": [
      "Stochastic Gradient Descent (SGD)", "Backpropagation Error Gradients", "Hebbian Learning Rules",
      "Bias-Variance Decomposition", "Cross-Entropy Loss Functions", "Kernel Transformation Tricks",
      "Overfitting Regularization ($L1/L2$)", "Neural Weight Convergence"
    ],
    "os": [
      "Critical Section Semaphores", "Virtual Address Paging", "Demand-Page Fault Handling",
      "MLFQ Process Scheduling", "Interrupt Vectoring Architecture", "User-Kernel Mode Privilege",
      "Deadlock Mutual Exclusion", "Context Switching Overhead"
    ],
    "networking": [
      "TCP Flow/Error Control", "OSI Layer Encapsulation", "Logical Subnet Allocation",
      "BGP Path Vector Routing", "CSMA/CD Collision Logic", "DNS Recursive Resolution",
      "NAT Ip Translation", "SSL/TLS Handshake Security"
    ],
    "discrete mathematics": [
      "Cardinality of Infinite Sets", "Pigeonhole Principle Logics", "Graph Coloring Chromatics",
      "Mathematical Induction Proofs", "Combinatorial Permanence", "Boolean Algebraic Simplification",
      "Isomorphic Graph Structure", "Finite State Automatics"
    ],
    "algorithms": [
      "Dynamic Programming Overlap", "Greedy Choice Properties", "Divide & Conquer Scaling",
      "Amortized Time Analysis", "Master Theorem Derivations", "Trie Data Structures",
      "NP-Complete Reduction Logic", "Spatial/Temporal Locality"
    ]
  };

  const axioms = domainAxioms[s] || domainAxioms[Object.keys(domainAxioms).find(k => s.includes(k))] || ["Syntactic Soundness", "Operational Efficiency", "Logical Verification"];

  // 2. Phrase Pools for Variety
  const analyticOpeners = [
    `Analyzing **${topic}** from a first-principles perspective:`,
    `To decompose the mechanism of **${topic}**, we must examine its atomic units:`,
    `A logical synthesis of **${topic}** in the context of ${subject} reveals several key constraints:`,
    `By applying the **SYNAPSE Synthesis Kernel** to your query on **${topic}**:`,
    `Exploring the underlying architecture of **${topic}** within the ${subject} domain:`
  ];

  const logicConnectors = [
    `Furthermore, the implementation relies heavily on **${axioms[0]}** to ensure state consistency.`,
    `A critical bottleneck avoided here is the mismatch between **${axioms[1]}** and real-world system limits.`,
    `The efficiency is primarily driven by the interaction of **${axioms[2] || axioms[0]}** and the system's memory model.`,
    `Unlike legacy approaches, this specific model leverages **${axioms[3] || axioms[1]}** for superior scaling.`,
    `From a computational standpoint, the pivot point remains the application of **${axioms[0]}**.`
  ];

  const syntheticResults = [
    `The resulting complexity is strictly bounded by $O(f(n))$, where $f$ represents the growth rate of **${axioms[0]}**.`,
    `This ensures that **${topic}** maintains stability even during massive data throughput cycles.`,
    `The convergence of this logic is guaranteed by the **${axioms[1]}** invariant.`,
    `Consequently, ${subject} remains one of the few fields where **${topic}** provides near-optimal results.`,
    `In summary, we see that **${topic}** is not merely a feature, but a core implementation of **${axioms[2] || axioms[0]}**.`
  ];

  // 3. Assembly (Seeded randomly to avoid repetition)
  const header = `### 🧠 SYNAPSE Analytical Synthesis [Autonomous Kernel]`;
  const p1 = analyticOpeners[seed % analyticOpeners.length];
  const p2 = logicConnectors[(seed + 1) % logicConnectors.length];
  const p3 = syntheticResults[(seed + 2) % syntheticResults.length];

  const formulas = [
    `$Efficiency \\propto \\frac{\\text{Correctness}}{\\log(\\text{State Space})}$`,
    `$T(n) = \\text{Work}(\\text{${axioms[0]}}) + \\text{Overhead}(\\text{${axioms[1]}})$`,
    `$\\Delta \\text{Entropy} \\approx 0 \\text{ as } t \\to \\infty \\text{ (Invariance condition)}$`,
    `$Complexity = O(\\text{Branching Factor} ^ {\\text{Depth}})$`
  ];

  const content = `
${p1}

1. **Constituent Logic:** All operations are bounded by **${axioms[0]}**.
2. **Execution Strategy:** **${topic}** utilizes a ${seed % 2 === 0 ? 'recursive' : 'iterative'} flow to maintain **${axioms[1]}**.
3. **Optimality Proof:** ${p2}

${p3}

**Mathematical Model:**
${formulas[seed % formulas.length]}
`;

  return `${header}\n\n${content}\n\n---\n*SYSTEM NOTE: Primaries offline. Synthesized from Logic Seed #${seed} in ${subject} kernel.*`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────


function calculateLevel(totalXP: number): { level: number; levelName: string } {
  const levels = [
    { min: 0, name: "Apprentice Scholar" },
    { min: 200, name: "Curious Learner" },
    { min: 600, name: "Dedicated Student" },
    { min: 1200, name: "Knowledge Seeker" },
    { min: 2500, name: "Academic Adept" },
    { min: 5000, name: "Master Learner" },
    { min: 10000, name: "Grand Scholar" },
  ];
  let level = 1;
  let levelName = levels[0].name;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalXP >= levels[i].min) {
      level = i + 1;
      levelName = levels[i].name;
      break;
    }
  }
  return { level, levelName };
}

async function generateStudyRoadmapLegacy(subjects, weeklyHours, currentLevel, timeframe) {
  const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-red-500", "bg-yellow-500", "bg-indigo-500", "bg-pink-500"];
  const icons = ["📐", "⚛️", "🧪", "💻", "📚", "🎯", "💡", "🔬"];
  const generatedSubjects = [];
  const generatedTasks = [];
  let taskIdCounter = 1;
  const hoursPerSubject = weeklyHours / subjects.length;
  const weeks = timeframe.includes('month') ? parseInt(timeframe) * 4 : parseInt(timeframe);
  subjects.forEach((subjectName, index) => {
    const totalHours = Math.round(hoursPerSubject * weeks);
    const topics = [];
    ["Basics", "Intermediate", "Advanced"].forEach((mod, modIdx) => {
      topics.push({ id: modIdx + 1, name: `${mod} Topic`, completed: false, hours: Math.round(totalHours / 3), dueDate: new Date().toISOString() });
      generatedTasks.push({ id: taskIdCounter++, title: `Study ${subjectName}: ${mod}`, subject: subjectName, priority: "medium", status: "pending", dueDate: new Date().toISOString(), completed: false });
    });
    generatedSubjects.push({ id: Date.now() + index, name: subjectName, color: colors[index % colors.length], icon: icons[index % icons.length], goalHours: totalHours, completedHours: 0, topics });
  });
  return { subjects: generatedSubjects, tasks: generatedTasks, roadmap: { totalHours: weeklyHours * weeks, weeklyHours, timeframe, currentLevel, subjects: subjects.length } };
}

// App routing
app.route("/", api);
app.route(FUNC_NAME, api);

// @ts-ignore
Deno.serve(app.fetch);