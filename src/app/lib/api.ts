import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const FUNC_NAME = "server";
const API_BASE = import.meta.env.DEV
  ? `http://localhost:8000/${FUNC_NAME}`
  : `https://${projectId}.supabase.co/functions/v1/${FUNC_NAME}`;

// Supabase Auth REST base — used for token refresh without the SDK
const SUPABASE_AUTH_URL = `https://${projectId}.supabase.co/auth/v1`;

// ── Stub Mode Configuration ──────────────────────────────────────────────────
// Set this to true to force all AI agents to run locally in the browser.
// This allows the app to work even without a backend or Ollama connection.
// @ts-ignore
export const STUB_MODE = import.meta.env.VITE_STUB_MODE === "true";

import { 
    runRoadmapArchitect as localRunRoadmapArchitect 
} from "./agents/roadmapArchitect";
import { 
    runScheduleStrategist as localRunScheduleStrategist 
} from "./agents/scheduleStrategist";
import { 
    runProgressOracle as localRunProgressOracle 
} from "./agents/progressOracle";
import { 
    runARIA as localRunARIA 
} from "./agents/academicResourceIntelligence";
import { 
    runSelfHealingScheduler as localRunSelfHealingScheduler 
} from "./agents/selfHealingScheduler";
import type { 
    SelfHealingInput, 
    SelfHealingOutput 
} from "./agents/selfHealingScheduler";
import { 
    isOllamaAvailable as localIsOllamaAvailable,
    callOllama,
    getPersistentCache,
    setPersistentCache
} from "./agents/agentUtils";
// ─────────────────────────────────────────────────────────────────────────────
// Shared Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  success: boolean;
  user?: any;
  session?: any;
  error?: string;
}

// ── Roadmap Types ─────────────────────────────────────────────────────────────

export interface RoadmapTopic {
  id: string;
  name: string;
  difficulty: number;       // 1–10
  estimatedHours: number;
  resources: string[];
  status: "pending" | "in-progress" | "completed";
  notes: string;
}

export interface RoadmapPhase {
  id: string;
  name: string;
  weekRange: string;
  description: string;
  topics: RoadmapTopic[];
  totalHours: number;
}

export interface Roadmap {
  id: string;
  subject: string;
  level: string;
  dailyHours: number;
  totalWeeks: number;
  totalHours: number;
  phases: RoadmapPhase[];
  createdAt: string;
}

export interface RoadmapArchitectParams {
  subject: string;
  level: "beginner" | "intermediate" | "advanced";
  dailyHours: number;
  timeframeWeeks: number;
  additionalContext?: string;
}

export interface RoadmapArchitectResponse {
  success: boolean;
  agent: string;
  roadmap: Roadmap;
  meta: AgentMeta;
}

// ── Schedule Types ────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  date: string;           // YYYY-MM-DD
  startTime: string;      // HH:MM
  endTime: string;        // HH:MM
  subject: string;
  topic: string;
  phase: string;
  phaseId: string;
  topicId: string;
  sessionType: "Study" | "Review" | "Practice" | "Assessment" | "Busy";
  difficulty: number;
  estimatedHours: number;
  completed: boolean;
  completedAt?: string;
  xpReward: number;
}

export type TimePreference = "morning" | "afternoon" | "evening" | "any";

export interface ScheduleStrategistParams {
  startDate?: string;
  timePreference?: TimePreference;
  studyDays?: number[];
  blockedDates?: string[];
}

export interface ScheduleStats {
  totalSessions: number;
  totalStudyHours: number;
  totalReviewSessions: number;
  estimatedEndDate: string;
  averageDifficulty: number;
}

export interface LoadAnalysis {
  average_daily_hours: string;
  overload_risk: "low" | "medium" | "high";
  buffer_days_remaining: number;
  strategy_note: string;
}

export interface ScheduleStrategistResponse {
  success: boolean;
  agent: string;
  events: CalendarEvent[];
  stats: ScheduleStats;
  analysis?: LoadAnalysis;
  meta: AgentMeta;
}

// ── Progress / Oracle Types ───────────────────────────────────────────────────

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
  confidenceRating?: number;  // 1–5
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

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpBonus: number;
  unlockedAt: string;
  rarity: "bronze" | "silver" | "gold" | "platinum";
}

export interface ProgressOracleParams {
  action: OracleAction;
  checkIn?: CheckInData;
}

export interface ProgressOracleResponse {
  success: boolean;
  agent: string;
  report?: ProgressReport;
  alerts?: ProgressAlert[];
  updatedEvent?: { eventId: string; completed: boolean; xpAwarded: number };
  achievements?: Achievement[];
  meta: AgentMeta;
}

// ── Academic Resource Intelligence Types ──────────────────────────────────────

export interface ResourceTopicRequest {
  subject: string;
  topic: string;
  difficulty_level: "easy" | "medium" | "hard";
  student_level: "beginner" | "intermediate" | "advanced";
}

export interface AcademicResourceIntelligenceParams {
  topic_request: ResourceTopicRequest[];
  exam_type: string;
  weak_areas: string[];
  preferred_learning_style: "video" | "reading" | "practice" | "mixed";
  time_available_minutes: number;
  past_performance: {
    topic: string;
    score: number;
    confidence_rating: number;
  };
}

export interface RecommendedResource {
  youtube_lecture: {
    title: string;
    creator: string;
    duration_minutes: number;
    reason: string;
    url: string;          // English (default)
    url_hindi?: string;   // Hindi version
    url_malayalam?: string; // Malayalam version
  };
  pdf_notes: {
    title: string;
    source: string;
    pages: number;
    reason: string;
    url: string;
  };
  practice_questions: {
    type: "basic" | "moderate" | "advanced";
    estimated_questions: number;
    reason: string;
    url: string;
    questions?: string[]; // AI-generated questions list
  };
  previous_year_questions: {
    availability: "yes" | "no";
    focus_area: string;
    reason: string;
    url: string;
    pyq_questions?: { exam: "GATE" | "B.Tech"; year: number; question: string; url?: string }[];
  };
  cheat_sheet_markdown?: string;
}

export interface TopicRecommendation {
  subject: string;
  topic: string;
  recommended_resources: RecommendedResource;
}

export interface AcademicResourceIntelligenceResponse {
  success: boolean;
  agent: string;
  resource_recommendations: TopicRecommendation[];
  learning_strategy_note: string;
  estimated_total_time_minutes: number;
  meta: AgentMeta;
}

// ── Agent Meta / Status ───────────────────────────────────────────────────────

export interface AgentMeta {
  agentName: string;
  ranAt: string;
  usedOllama: boolean;
  durationMs: number;
}

export interface AgentStatus {
  roadmap: Roadmap | null;
  calendarEvents: CalendarEvent[];
  latestReport: ProgressReport | null;
  xp: XPData;
  achievements: Achievement[];
}

// ── Pipeline Types ────────────────────────────────────────────────────────────

export interface PipelineParams {
  subject: string;
  level: "beginner" | "intermediate" | "advanced";
  dailyHours: number;
  timeframeWeeks: number;
  additionalContext?: string;
}

export interface PipelineStepStatus {
  done: boolean;
  meta?: AgentMeta;
}

export interface PipelineResponse {
  success: boolean;
  pipeline: {
    roadmap: PipelineStepStatus;
    schedule: PipelineStepStatus;
    oracle: PipelineStepStatus;
  };
  roadmap: Roadmap;
  events: CalendarEvent[];
  stats: ScheduleStats;
  report?: ProgressReport;
  achievements?: Achievement[];
}

// ── Settings Types ────────────────────────────────────────────────────────────

export interface UserSettings {
  timePreference: TimePreference;
  studyDays: number[];        // 0=Sun … 6=Sat
  blockedDates: string[];     // YYYY-MM-DD
  dailyHours: number;
  notificationsEnabled: boolean;
}

// ── XP Types ─────────────────────────────────────────────────────────────────

export interface XPData {
  total: number;
  level: number;
  levelName: string;
}

// ── Pipeline Progress Callback (for animated UI) ──────────────────────────────

export type PipelineStep = "roadmap" | "schedule" | "oracle" | "done" | "error";

export interface PipelineProgressEvent {
  step: PipelineStep;
  message: string;
  data?: any;
}

export type PipelineProgressCallback = (event: PipelineProgressEvent) => void;

// ─────────────────────────────────────────────────────────────────────────────
// API Class
// ─────────────────────────────────────────────────────────────────────────────

export class API {
  static BASE_URL = API_BASE;
  private static token: string | null = null;
  private static refreshing: Promise<string | null> | null = null;

  /** Called when the session is fully expired and cannot be refreshed.
   *  Register this in AuthContext to auto-signout + redirect to login. */
  static onSessionExpired: (() => void) | null = null;

  // ── Token Management ────────────────────────────────────────────────────────

  static setToken(token: string | null, refreshToken?: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("refresh_token");
      this.token = null;
    }
    if (refreshToken !== undefined) {
      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
      } else {
        localStorage.removeItem("refresh_token");
      }
    }
  }

  static getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem("auth_token");
    }
    return this.token;
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem("refresh_token");
  }

  /** Attempt a silent token refresh using the stored refresh token.
   *  Calls Supabase Auth REST directly — no SDK needed. */
  static async refreshAccessToken(): Promise<string | null> {
    // Deduplicate concurrent refresh calls
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async () => {
      try {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
          console.warn("[API] No refresh token stored — cannot refresh");
          return null;
        }

        const res = await fetch(
          `${SUPABASE_AUTH_URL}/token?grant_type=refresh_token`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": publicAnonKey,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.warn("[API] Token refresh failed:", err?.error_description ?? res.status);
          this.setToken(null); // clear stale tokens → force re-login
          return null;
        }

        const session = await res.json();
        const newToken: string = session.access_token;
        const newRefresh: string = session.refresh_token;
        this.setToken(newToken, newRefresh);
        console.log("[API] Token refreshed silently ✅");
        return newToken;
      } catch (err) {
        console.error("[API] refreshAccessToken error:", err);
        return null;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }

  static getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : `Bearer ${publicAnonKey}`,
    };
  }

  // ── Core Request ──────────────────────────────────────────────────────────

  /** Decode a JWT and return its exp epoch (seconds), or 0 if unparseable. */
  static jwtExp(token: string): number {
    try {
      const payload = token.split(".")[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      return decoded.exp ?? 0;
    } catch {
      return 0;
    }
  }

  /** Returns true when the stored access token is expired (or will expire in <60 s). */
  static isTokenExpired(): boolean {
    if (STUB_MODE) return false; // NEVER expire in stub mode
    const token = this.getToken();
    if (!token) return false; // No token means guest mode. Do not trigger refresh.
    const exp = this.jwtExp(token);
    if (!exp) return false; // Not a real JWT, don't proactively fail. Let the server 401.
    return Date.now() / 1000 >= exp - 60; // 60-second buffer
  }

  private static async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const isAuthEndpoint = endpoint.startsWith("/auth/");

    // ── Proactive refresh: if token is expired/near-expiry, refresh before sending ──
    if (!isAuthEndpoint && !isRetry && this.isTokenExpired()) {
      console.warn("[API] Token expired locally — refreshing before request…");
      const newToken = await this.refreshAccessToken();
      if (!newToken) {
        console.error("[API] Pre-request refresh failed — session expired");
        this.onSessionExpired?.();
        throw new Error("Session expired. Please sign in again.");
      }
    }

    const token = isAuthEndpoint ? null : this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (isAuthEndpoint) {
      headers["Authorization"] = `Bearer ${publicAnonKey}`;
    } else {
      // Use user JWT if available, fall back to anon key so agents still work
      headers["Authorization"] = `Bearer ${token ?? publicAnonKey}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // ── 401 catch-all: refresh + retry once, then force re-login ──────────
    if (response.status === 401 && !isAuthEndpoint && !STUB_MODE) {
      if (!isRetry) {
        console.warn("[API] 401 received — attempting token refresh…");
        const newToken = await this.refreshAccessToken();
        if (newToken) {
          console.log("[API] Retrying request with refreshed token…");
          return this.request<T>(endpoint, options, true);
        }
      }
      // Refresh failed (or already retried) — end the session
      console.error("[API] Unrecoverable 401 — signing out");
      this.onSessionExpired?.();
      throw new Error("Session expired. Please sign in again.");
    }

    const data = await response
      .json()
      .catch(() => ({ error: "Invalid JSON response" }));

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data as T;
  }


  // ─────────────────────────────────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────────────────────────────────

  static async signUp(
    email: string,
    password: string,
    name: string
  ): Promise<AuthResponse> {
    if (STUB_MODE) {
      // Basic validation
      if (!email.includes("@") || !email.includes(".")) {
        return { success: false, error: "Please enter a valid email address (e.g. user@example.com)" } as any;
      }
      if (password.length < 6) {
        return { success: false, error: "Password must be at least 6 characters" } as any;
      }

      const users = JSON.parse(localStorage.getItem("stub_users") || "[]");
      if (users.find((u: any) => u.email === email)) {
        return { success: false, error: "User already exists" } as any;
      }

      const newUser = { id: `user_${Math.random().toString(36).substr(2, 9)}`, email, password, name };
      users.push(newUser);
      localStorage.setItem("stub_users", JSON.stringify(users));

      return {
        success: true,
        user: { id: newUser.id, email, user_metadata: { name } },
        session: { access_token: "stub_token", refresh_token: "stub_refresh" }
      } as any;
    }
    return this.request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  }

  static async signIn(
    email: string,
    password: string
  ): Promise<AuthResponse> {
    if (STUB_MODE) {
      const users = JSON.parse(localStorage.getItem("stub_users") || "[]");
      const user = users.find((u: any) => u.email === email);

      if (!user) {
        return { success: false, error: "No account found with this email. Please sign up first." } as any;
      }
      if (user.password !== password) {
        return { success: false, error: "Invalid password" } as any;
      }

      // Store current user for profile retrieval
      localStorage.setItem("stub_current_user", JSON.stringify(user));

      return {
        success: true,
        user: { id: user.id, email, user_metadata: { name: user.name } },
        session: { access_token: "stub_token", refresh_token: "stub_refresh" }
      } as any;
    }
    return this.request<AuthResponse>("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  static signOut() {
    this.setToken(null);
    if (STUB_MODE) {
      localStorage.removeItem("stub_current_user");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // User Data — Hybrid: Backend-first + localStorage fallback
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Helper: Try backend first, fall back to localStorage.
   * Also saves backend responses to localStorage as cache.
   */
  private static async hybridGet<T>(endpoint: string, storageKey: string, defaultValue: T): Promise<T> {
    // Always check localStorage first as a minimum
    const cached = localStorage.getItem(storageKey);
    const fallback = cached ? JSON.parse(cached) : defaultValue;

    if (STUB_MODE) return fallback;

    try {
      const result = await this.request<T>(endpoint);
      // Cache the backend response locally
      localStorage.setItem(storageKey, JSON.stringify(result));
      return result;
    } catch (err) {
      console.warn(`[API] Backend unavailable for ${endpoint}, using local data`);
      return fallback;
    }
  }

  private static async hybridSave<T>(
    endpoint: string,
    storageKey: string,
    data: any,
    localResponse: T
  ): Promise<T> {
    // Always save to localStorage
    localStorage.setItem(storageKey, JSON.stringify(localResponse));

    if (STUB_MODE) return localResponse;

    try {
      const result = await this.request<T>(endpoint, {
        method: "POST",
        body: JSON.stringify(data),
      });
      // Update cache with backend response
      localStorage.setItem(storageKey, JSON.stringify(result));
      return result;
    } catch (err) {
      console.warn(`[API] Backend unavailable for ${endpoint}, saved locally`);
      return localResponse;
    }
  }

  static async getSubjects() {
    return this.hybridGet("/user/subjects", "stub_subjects", { subjects: [] });
  }

  static async saveSubjects(subjects: any[]) {
    return this.hybridSave(
      "/user/subjects", "stub_subjects",
      { subjects },
      { success: true, subjects }
    );
  }

  static async getTasks() {
    return this.getCalendarEvents();
  }

  static async saveTasks(tasks: any[]) {
    return this.saveCalendarEvents(tasks);
  }

  static async getProfile() {
    const cached = localStorage.getItem("stub_current_user");
    const defaultProfile = cached ? {
      profile: (() => {
        const user = JSON.parse(cached);
        return user ? { id: user.id, name: user.name, email: user.email, joinDate: new Date().toISOString() } : null;
      })()
    } : { profile: null };

    if (STUB_MODE) return defaultProfile;

    try {
      return await this.request<{ profile: any }>("/user/profile");
    } catch (err) {
      console.warn("[API] Backend unavailable for profile, using local data");
      return defaultProfile;
    }
  }

  static async saveProfile(profile: any) {
    return this.hybridSave(
      "/user/profile", "stub_profile",
      { profile },
      { success: true, profile }
    );
  }

  // Legacy roadmap (kept for backwards compat with StudyPlanner page)
  static async generateRoadmap(params: {
    subject: string;
    goalHours: number;
    currentLevel: string;
    timeframe: string;
    additionalInfo?: string;
  }) {
    return this.request("/ai/generate-roadmap", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────────────────────

  static async getSettings(): Promise<{ settings: UserSettings }> {
    const defaultSettings: UserSettings = {
      timePreference: "morning" as TimePreference,
      studyDays: [1, 2, 3, 4, 5],
      blockedDates: [],
      dailyHours: 2,
      notificationsEnabled: true,
    };
    return this.hybridGet("/user/settings", "stub_settings", { settings: defaultSettings });
  }

  static async saveSettings(
    settings: Partial<UserSettings>
  ): Promise<{ success: boolean; settings: UserSettings }> {
    // Merge with existing settings
    const existing = JSON.parse(localStorage.getItem("stub_settings") || "{}");
    const merged = { ...(existing.settings || {}), ...settings } as UserSettings;
    return this.hybridSave(
      "/user/settings", "stub_settings",
      { settings },
      { success: true, settings: merged }
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calendar Events
  // ─────────────────────────────────────────────────────────────────────────

  static async getCalendarEvents(): Promise<{ events: CalendarEvent[] }> {
    return this.hybridGet("/user/calendar-events", "stub_calendar_events", { events: [] });
  }

  static async saveCalendarEvents(
    events: CalendarEvent[]
  ): Promise<{ success: boolean; events: CalendarEvent[] }> {
    return this.hybridSave(
      "/user/calendar-events", "stub_calendar_events",
      { events },
      { success: true, events }
    );
  }

  /**
   * Patch a single calendar event (e.g. mark it complete).
   */
  static async patchCalendarEvent(
    eventId: string,
    patch: Partial<CalendarEvent>
  ): Promise<{ success: boolean }> {
    // Always update localStorage
    try {
      const cached = JSON.parse(localStorage.getItem("stub_calendar_events") || "{\"events\":[]}");
      const events: CalendarEvent[] = cached.events || [];
      const updated = events.map(e => e.id === eventId ? { ...e, ...patch } : e);
      localStorage.setItem("stub_calendar_events", JSON.stringify({ events: updated }));
    } catch { /* ignore localStorage errors */ }

    if (STUB_MODE) return { success: true };

    try {
      return await this.request("/user/calendar-events/patch", {
        method: "POST",
        body: JSON.stringify({ eventId, patch }),
      });
    } catch (err) {
      console.warn("[API] Backend unavailable for patch, saved locally");
      return { success: true };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Progress Reports
  // ─────────────────────────────────────────────────────────────────────────

  static async getProgressReports(): Promise<{ reports: ProgressReport[] }> {
    return this.hybridGet("/user/progress-reports", "stub_reports", { reports: [] });
  }

  static async saveProgressReport(
    report: ProgressReport
  ): Promise<{ success: boolean; reports: ProgressReport[] }> {
    const existing = JSON.parse(localStorage.getItem("stub_reports") || "{\"reports\":[]}");
    const reports = [...(existing.reports || []), report];
    return this.hybridSave(
      "/user/progress-reports", "stub_reports",
      { report },
      { success: true, reports }
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // XP & Gamification
  // ─────────────────────────────────────────────────────────────────────────

  static async getXP(): Promise<{ xp: XPData }> {
    const defaultXP: XPData = { total: 0, level: 1, levelName: "Beginner" };
    return this.hybridGet("/user/xp", "stub_xp", { xp: defaultXP });
  }

  static async addXP(
    amount: number
  ): Promise<{ success: boolean; xp: XPData }> {
    const existing = JSON.parse(localStorage.getItem("stub_xp") || "{\"xp\":{\"total\":0,\"level\":1,\"levelName\":\"Beginner\"}}");
    const xp: XPData = existing.xp || { total: 0, level: 1, levelName: "Beginner" };
    xp.total += amount;
    xp.level = Math.floor(xp.total / 100) + 1;
    const LEVEL_NAMES = ["Beginner", "Learner", "Scholar", "Expert", "Master", "Grandmaster"];
    xp.levelName = LEVEL_NAMES[Math.min(xp.level - 1, LEVEL_NAMES.length - 1)];

    return this.hybridSave(
      "/user/xp/add", "stub_xp",
      { amount },
      { success: true, xp }
    );
  }

  static async getAchievements(): Promise<{ achievements: Achievement[] }> {
    return this.hybridGet("/user/achievements", "stub_achievements", { achievements: [] });
  }

  static async saveAchievements(
    achievements: Achievement[]
  ): Promise<{ success: boolean; achievements: Achievement[] }> {
    return this.hybridSave(
      "/user/achievements", "stub_achievements",
      { achievements },
      { success: true, achievements }
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────────────────────────────────

  static async getNotifications(): Promise<{ notifications: ProgressAlert[] }> {
    return this.hybridGet("/user/notifications", "stub_notifications", { notifications: [] });
  }

  static async markNotificationRead(
    notificationId: string
  ): Promise<{ success: boolean }> {
    try {
      const cached = JSON.parse(localStorage.getItem("stub_notifications") || "{\"notifications\":[]}");
      const notifications = (cached.notifications || []).map((n: any) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      localStorage.setItem("stub_notifications", JSON.stringify({ notifications }));
    } catch { /* ignore */ }

    if (STUB_MODE) return { success: true };

    try {
      return await this.request("/user/notifications/read", {
        method: "POST",
        body: JSON.stringify({ notificationId }),
      });
    } catch (err) {
      console.warn("[API] Backend unavailable for notification read, saved locally");
      return { success: true };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AI Agents — Individual
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Agent 1 — Roadmap Architect
   */
  static async runRoadmapArchitect(
    params: RoadmapArchitectParams
  ): Promise<RoadmapArchitectResponse> {
    const user = await this.getProfile();
    const result = await localRunRoadmapArchitect(params, user.profile?.id || "guest");

    // Save to backend after generating locally
    await this.saveSubjects([result.roadmap]);

    return { ...result, agent: "RoadmapArchitect" };
  }

  /**
   * Agent 2 — Schedule Strategist
   */
  static async runScheduleStrategist(
    params?: ScheduleStrategistParams
  ): Promise<ScheduleStrategistResponse> {
    const roadmapRes = await this.getSubjects();
    const roadmap: any = Array.isArray(roadmapRes.subjects) ? roadmapRes.subjects[0] : roadmapRes.subjects;

    if (!roadmap || !roadmap.subject) {
      throw new Error("No roadmap found. Please run Roadmap Architect first.");
    }

    const settings = await this.getSettings();

    const result = await localRunScheduleStrategist({
      roadmap,
      startDate: params?.startDate,
      timePreference: settings.settings.timePreference,
      studyDays: settings.settings.studyDays,
      blockedDates: settings.settings.blockedDates,
      dailyHours: settings.settings.dailyHours || 2
    });

    // Save to backend after generating locally
    await this.saveCalendarEvents(result.events);

    return { ...result, agent: "ScheduleStrategist" };
  }

  /**
   * Agent 3 — Progress Oracle
   */
  static async runProgressOracle(
    params: ProgressOracleParams
  ): Promise<ProgressOracleResponse> {
    const user = await this.getProfile();
    const eventsRes = await this.getCalendarEvents();
    
    const result = await localRunProgressOracle({
      action: params.action as any,
      userId: user.profile?.id || "guest",
      checkIn: params.checkIn,
      calendarEvents: eventsRes.events || [],
      previousReports: []
    });

    // Save back to backend updates if any
    if (result.report) await this.saveProgressReport(result.report);
    if (result.achievements) await this.saveAchievements(result.achievements);

    return { ...result, agent: "ProgressOracle" } as any;
  }

  /**
   * Agent 4 — Academic Resource Intelligence
   */
  static async runAcademicResourceIntelligence(
    params: AcademicResourceIntelligenceParams
  ): Promise<AcademicResourceIntelligenceResponse> {
    const subject = params.topic_request?.[0]?.subject || "Unknown";
    const topic = params.topic_request?.[0]?.topic || "Unknown";

    // Get user ID, but don't let profile fetch failures break curation
    let userId = "guest";
    try {
      const user = await this.getProfile();
      userId = user.profile?.id || "guest";
    } catch (err) {
      console.warn("[API] getProfile failed, using guest userId for ARIA:", err);
    }

    const result = await localRunARIA({
      subject,
      topic,
      difficulty: params.topic_request?.[0]?.student_level as any || "intermediate",
      weak_topics: params.weak_areas || [],
      roadmap_stage: "core",
      xp_level: 10,
      available_daily_hours: (params.time_available_minutes || 120) / 60
    }, userId);

    // ARIA now always returns properly-shaped resource_recommendations
    return {
      success: result.success,
      agent: "ARIA",
      resource_recommendations: result.resource_recommendations || [],
      learning_strategy_note: result.learning_strategy_note || "Resources curated based on your learning profile.",
      estimated_total_time_minutes: (result.youtube?.length || 1) * 30 + 30,
      meta: result.meta,
    };
  }

  /**
   * Combined status
   */
  static async getAgentStatus(): Promise<AgentStatus> {
    const ollamaOk = await localIsOllamaAvailable();

    if (STUB_MODE) {
      const roadmapData = JSON.parse(localStorage.getItem("stub_subjects") || "{\"subjects\":[]}");
      const roadmap = roadmapData.subjects?.[0] || null;
      const calendarData = JSON.parse(localStorage.getItem("stub_calendar_events") || "{\"events\":[]}");
      const calendarEvents = calendarData.events || [];
      const reportsData = JSON.parse(localStorage.getItem("stub_reports") || "{\"reports\":[]}");
      const latestReport = reportsData.reports?.[reportsData.reports.length - 1] || null;
      const xpData = JSON.parse(localStorage.getItem("stub_xp") || "{\"xp\":{\"total\":0,\"level\":1,\"levelName\":\"Scholar\"}}");
      const achievementsData = JSON.parse(localStorage.getItem("stub_achievements") || "{\"achievements\":[]}");

      return {
        status: ollamaOk ? "online" : "offline",
        model: "llama3",
        stubModeEnabled: true,
        roadmap,
        calendarEvents,
        latestReport,
        xp: xpData.xp || xpData,
        achievements: achievementsData.achievements || [],
      } as any;
    }

    try {
      const res = await this.request<any>("/ai/agents/status");
      return {
        ...res,
        status: ollamaOk ? "online" : "offline",
        model: "llama3",
        stubModeEnabled: false,
      };
    } catch {
      return {
        status: ollamaOk ? "online" : "offline",
        model: "llama3",
        stubModeEnabled: false,
      } as any;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AI Agents — Full Pipeline
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Runs all 3 agents in sequence on the server (single HTTP call).
   * Use this when you want the fastest pipeline without UI step-by-step feedback.
   */
  static async runFullPipeline(
    params: PipelineParams
  ): Promise<PipelineResponse> {
    const roadmapRes = await this.runRoadmapArchitect({
      subject: params.subject,
      level: params.level,
      dailyHours: params.dailyHours,
      timeframeWeeks: params.timeframeWeeks,
      additionalContext: params.additionalContext,
    });

    const scheduleRes = await this.runScheduleStrategist();

    const oracleRes = await this.runProgressOracle({
      action: "initial-report",
    });

    return {
      success: true,
      pipeline: {
        roadmap: { done: true, meta: roadmapRes.meta },
        schedule: { done: true, meta: scheduleRes.meta },
        oracle: { done: true, meta: oracleRes.meta },
      },
      roadmap: roadmapRes.roadmap,
      events: scheduleRes.events,
      stats: scheduleRes.stats,
      report: oracleRes.report,
      achievements: oracleRes.achievements,
    };
  }

  /**
   * Runs all 3 agents step-by-step from the FRONTEND, calling each agent
   * endpoint individually. This allows the UI to show animated step progress.
   *
   * @param params       Pipeline inputs
   * @param onProgress   Callback fired at each pipeline step with status + data
   */
  static async runPipelineWithProgress(
    params: PipelineParams,
    onProgress: PipelineProgressCallback
  ): Promise<PipelineResponse | null> {
    try {
      // ── Step 1: Roadmap Architect ────────────────────────────────────────
      onProgress({
        step: "roadmap",
        message: "🗺️ Roadmap Architect is analyzing your learning goals...",
      });

      const roadmapRes = await this.runRoadmapArchitect({
        subject: params.subject,
        level: params.level,
        dailyHours: params.dailyHours,
        timeframeWeeks: params.timeframeWeeks,
        additionalContext: params.additionalContext,
      });

      onProgress({
        step: "roadmap",
        message: `✅ Roadmap created: ${roadmapRes.roadmap.phases.length} phases, ${roadmapRes.roadmap.totalHours}h total${roadmapRes.meta.usedOllama ? " (Ollama)" : " (Smart Mock)"}`,
        data: roadmapRes.roadmap,
      });

      // ── Step 2: Schedule Strategist ──────────────────────────────────────
      onProgress({
        step: "schedule",
        message: "📅 Schedule Strategist is building your calendar...",
      });

      const scheduleRes = await this.runScheduleStrategist();

      onProgress({
        step: "schedule",
        message: `✅ Schedule ready: ${scheduleRes.events.length} sessions planned until ${scheduleRes.stats.estimatedEndDate}${scheduleRes.meta.usedOllama ? " (Ollama)" : " (Smart Scheduler)"}`,
        data: scheduleRes.events,
      });

      // ── Step 3: Progress Oracle ──────────────────────────────────────────
      onProgress({
        step: "oracle",
        message: "🔮 Progress Oracle is generating your initial report...",
      });

      const oracleRes = await this.runProgressOracle({
        action: "initial-report",
      });

      onProgress({
        step: "oracle",
        message: `✅ Progress report ready. Streak: ${oracleRes.report?.streakDays ?? 0} days${oracleRes.achievements?.length ? ` · 🏆 ${oracleRes.achievements.length} new achievement(s)!` : ""}${oracleRes.meta.usedOllama ? " (Ollama)" : " (Oracle)"}`,
        data: oracleRes.report,
      });

      onProgress({
        step: "done",
        message: "🚀 Pipeline complete! Your study plan is ready.",
      });

      return {
        success: true,
        pipeline: {
          roadmap: { done: true, meta: roadmapRes.meta },
          schedule: { done: true, meta: scheduleRes.meta },
          oracle: { done: true, meta: oracleRes.meta },
        },
        roadmap: roadmapRes.roadmap,
        events: scheduleRes.events,
        stats: scheduleRes.stats,
        report: oracleRes.report,
        achievements: oracleRes.achievements,
      };
    } catch (err: any) {
      onProgress({
        step: "error",
        message: `❌ Pipeline failed: ${err?.message ?? "Unknown error"}`,
      });
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Convenience Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Mark a calendar event as complete and process the check-in through
   * the Progress Oracle (awards XP, updates mastery, checks achievements).
   */
  static async completeSession(
    event: CalendarEvent,
    checkInData?: Partial<CheckInData>
  ): Promise<ProgressOracleResponse> {
    // MISSION: Permanent Roadmap Update
    // When a session is completed locally, we also update the Roadmap topic status
    // so the Schedule Strategist knows NOT to reschedule it.
    try {
      const roadmapRes = await this.getSubjects();
      const roadmap: Roadmap = Array.isArray(roadmapRes.subjects) ? roadmapRes.subjects[0] : roadmapRes.subjects;
      if (roadmap && event.topicId) {
        let changed = false;
        roadmap.phases.forEach(p => {
          p.topics.forEach(t => {
            if (t.id === event.topicId) {
              t.status = "completed";
              changed = true;
            }
          });
        });
        if (changed) {
          await this.saveSubjects([roadmap]);
        }
      }
    } catch (e) {
      console.warn("[API] Failed to update roadmap status automatically", e);
    }

    const res = await this.runProgressOracle({
      action: "check-in",
      checkIn: {
        eventId: event.id,
        topicId: event.topicId,
        subjectName: event.subject,
        completed: true,
        confidenceRating: checkInData?.confidenceRating ?? 3,
        completedResources: checkInData?.completedResources ?? "yes",
        needsMoreTime: checkInData?.needsMoreTime ?? false,
        timeSpentHours: checkInData?.timeSpentHours ?? event.estimatedHours,
      },
    });

    // Notify Guardian Agent to re-sync
    window.dispatchEvent(new CustomEvent("guardian-reset"));

    return res;
  }

  /**
   * Trigger an adaptive re-schedule (Agent 2) and then refresh the Oracle report.
   * Call this when the user is behind schedule.
   */
  static async adaptiveReschedule(
    params?: ScheduleStrategistParams
  ): Promise<{ schedule: ScheduleStrategistResponse; oracle: ProgressOracleResponse }> {
    // 1. Extract history we want to keep
    const { events: oldEvents } = await this.getCalendarEvents();
    const today = new Date().toISOString().split('T')[0];
    
    // We keep all completed events and all "Busy" events (even in the future)
    const preservedHistory = (oldEvents ?? []).filter(e => e.completed || e.sessionType === "Busy");
    
    // 2. Build new forward-looking schedule starting from today
    // This will only include PENDING topics because runScheduleStrategist pulls from roadmap
    // and we now update roadmap status in completeSession.
    const schedule = await this.runScheduleStrategist({ 
      ...params, 
      startDate: today,
      isAdaptive: true 
    } as any);

    // 3. Merge and Save
    const mergedEvents = [...preservedHistory, ...schedule.events];
    await this.saveCalendarEvents(mergedEvents);

    const oracle = await this.runProgressOracle({
      action: "adaptive-reschedule",
    });

    // Notify Guardian Agent to re-sync and dismiss toasts
    window.dispatchEvent(new CustomEvent("guardian-reset"));

    return { schedule, oracle };
  }

  /**
   * Agent 5 — Self-Healing Study Scheduler
   * Automatically detects and repairs schedule disruptions.
   */
  static async runSelfHealingScheduler(
    input: SelfHealingInput
  ): Promise<SelfHealingOutput> {
    return localRunSelfHealingScheduler(input);
  }

  /**
   * Get all data needed for the dashboard home in one call.
   */
  static async getDashboardData() {
    const [agentStatus, settings, notifications] = await Promise.all([
      this.getAgentStatus(),
      this.getSettings().catch(() => ({
        settings: {
          timePreference: "morning" as TimePreference,
          studyDays: [1, 2, 3, 4, 5],
          blockedDates: [],
          dailyHours: 2,
          notificationsEnabled: true,
        },
      })),
      this.getNotifications().catch(() => ({ notifications: [] })),
    ]);

    const unreadCount = notifications.notifications.filter((n) => !n.read).length;

    return {
      roadmap: agentStatus.roadmap,
      events: agentStatus.calendarEvents,
      latestReport: agentStatus.latestReport,
      xp: agentStatus.xp,
      achievements: agentStatus.achievements,
      settings: settings.settings,
      notifications: notifications.notifications,
      unreadNotifications: unreadCount,
    };
  }

  /**
   * Get today's scheduled study sessions.
   */
  static async getTodaysSessions(): Promise<CalendarEvent[]> {
    const today = new Date().toISOString().split("T")[0];
    const { events } = await this.getCalendarEvents();
    return (events ?? []).filter((e) => e.date === today);
  }

  /**
   * Get upcoming sessions from today onwards, sorted by date.
   */
  static async getUpcomingSessions(limit = 10): Promise<CalendarEvent[]> {
    const today = new Date().toISOString().split("T")[0];
    const { events } = await this.getCalendarEvents();
    return (events ?? [])
      .filter((e) => e.date >= today && !e.completed)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
      })
      .slice(0, limit);
  }

  /**
   * Calculate overall study statistics from calendar events.
   */
  static computeStatistics(events: CalendarEvent[]) {
    const studyEvents = events.filter(e => e.sessionType !== "Busy");
    const completed = studyEvents.filter((e) => e.completed);
    const pending = studyEvents.filter((e) => !e.completed);
    const totalXP = completed.reduce((s, e) => s + (e.xpReward ?? 0), 0);
    const totalHoursStudied = completed.reduce(
      (s, e) => s + (e.estimatedHours ?? 0),
      0
    );
    const totalHoursPlanned = studyEvents.reduce(
      (s, e) => s + (e.estimatedHours ?? 0),
      0
    );

    // Streak: consecutive days with at least one completed session ending today
    const completedDates = [
      ...new Set(completed.map((e) => e.date)),
    ].sort();

    let streak = 0;
    let checkDate = new Date().toISOString().split("T")[0];
    for (let i = completedDates.length - 1; i >= 0; i--) {
      const d = completedDates[i];
      const diffDays = Math.round(
        (new Date(checkDate).getTime() - new Date(d).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      if (diffDays <= 1) {
        streak++;
        checkDate = d;
      } else {
        break;
      }
    }

    // Subjects breakdown
    const subjectMap: Record<string, { planned: number; completed: number }> =
      {};
    for (const evt of studyEvents) {
      if (!subjectMap[evt.subject]) {
        subjectMap[evt.subject] = { planned: 0, completed: 0 };
      }
      subjectMap[evt.subject].planned++;
      if (evt.completed) subjectMap[evt.subject].completed++;
    }

    const subjects = Object.entries(subjectMap).map(([name, data]) => ({
      name,
      planned: data.planned,
      completed: data.completed,
      percentage:
        data.planned > 0
          ? Math.round((data.completed / data.planned) * 100)
          : 0,
    }));

    return {
      totalSessions: studyEvents.length,
      completedSessions: completed.length,
      pendingSessions: pending.length,
      completionRate:
        studyEvents.length > 0
          ? Math.round((completed.length / studyEvents.length) * 100)
          : 0,
      totalXP,
      totalHoursStudied: Math.round(totalHoursStudied * 10) / 10,
      totalHoursPlanned: Math.round(totalHoursPlanned * 10) / 10,
      streak,
      subjects,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Named convenience re-exports for common use
// ─────────────────────────────────────────────────────────────────────────────

export const {
  signUp,
  signIn,
  signOut,
  getSubjects,
  saveSubjects,
  getTasks,
  saveTasks,
  getProfile,
  saveProfile,
  getSettings,
  saveSettings,
  getCalendarEvents,
  saveCalendarEvents,
  patchCalendarEvent,
  getProgressReports,
  saveProgressReport,
  getXP,
  addXP,
  getAchievements,
  saveAchievements,
  getNotifications,
  markNotificationRead,
  runRoadmapArchitect,
  runScheduleStrategist,
  runProgressOracle,
  getAgentStatus,
  runFullPipeline,
  runPipelineWithProgress,
  completeSession,
  adaptiveReschedule,
  getDashboardData,
  getTodaysSessions,
  getUpcomingSessions,
  computeStatistics,
  generateRoadmap,
  runSelfHealingScheduler,
} = {
  signUp: API.signUp.bind(API),
  signIn: API.signIn.bind(API),
  signOut: API.signOut.bind(API),
  getSubjects: API.getSubjects.bind(API),
  saveSubjects: API.saveSubjects.bind(API),
  getTasks: API.getTasks.bind(API),
  saveTasks: API.saveTasks.bind(API),
  getProfile: API.getProfile.bind(API),
  saveProfile: API.saveProfile.bind(API),
  getSettings: API.getSettings.bind(API),
  saveSettings: API.saveSettings.bind(API),
  getCalendarEvents: API.getCalendarEvents.bind(API),
  saveCalendarEvents: API.saveCalendarEvents.bind(API),
  patchCalendarEvent: API.patchCalendarEvent.bind(API),
  getProgressReports: API.getProgressReports.bind(API),
  saveProgressReport: API.saveProgressReport.bind(API),
  getXP: API.getXP.bind(API),
  addXP: API.addXP.bind(API),
  getAchievements: API.getAchievements.bind(API),
  saveAchievements: API.saveAchievements.bind(API),
  getNotifications: API.getNotifications.bind(API),
  markNotificationRead: API.markNotificationRead.bind(API),
  runRoadmapArchitect: API.runRoadmapArchitect.bind(API),
  runScheduleStrategist: API.runScheduleStrategist.bind(API),
  runProgressOracle: API.runProgressOracle.bind(API),
  getAgentStatus: API.getAgentStatus.bind(API),
  runFullPipeline: API.runFullPipeline.bind(API),
  runPipelineWithProgress: API.runPipelineWithProgress.bind(API),
  completeSession: API.completeSession.bind(API),
  adaptiveReschedule: API.adaptiveReschedule.bind(API),
  getDashboardData: API.getDashboardData.bind(API),
  getTodaysSessions: API.getTodaysSessions.bind(API),
  getUpcomingSessions: API.getUpcomingSessions.bind(API),
  computeStatistics: API.computeStatistics.bind(API),
  generateRoadmap: API.generateRoadmap.bind(API),
  runSelfHealingScheduler: API.runSelfHealingScheduler.bind(API),
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock Generator (Frontend Stub Implementation)
// ─────────────────────────────────────────────────────────────────────────────

class MockGenerator {
  static generateId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static buildMeta(agent: string, ollama: boolean, duration: number): AgentMeta {
    return {
      agentName: agent,
      ranAt: new Date().toISOString(),
      usedOllama: ollama,
      durationMs: duration,
    };
  }

  static generateRoadmap(params: RoadmapArchitectParams): Roadmap {
    const totalWeeks = params.timeframeWeeks;
    const totalHours = params.dailyHours * 7 * totalWeeks;
    const roadmapId = this.generateId("rdmp");
    const sub = params.subject.toLowerCase();

    const phaseNames = [
      "Foundations & Fundamentals",
      "Core Concepts & Deep Dive",
      "Practical Application & Projects",
      "Mastery & Advanced Techniques"
    ];

    // Library of realistic topics for common subjects
    const subjectTopics: Record<string, string[][]> = {
      "machine learning": [
        ["Linear Algebra for ML", "Probability & Statistics", "Calculus Essentials", "Introduction to ML"],
        ["Supervised Learning", "Unsupervised Learning", "Neural Networks", "Gradient Descent"],
        ["Scikit-Learn Projects", "Feature Engineering", "Model Evaluation", "Hyperparameter Tuning"],
        ["Deep Learning with PyTorch", "Natural Language Processing", "Computer Vision", "Deployment Strategies"]
      ],
      "ml": [
        ["Linear Algebra for ML", "Probability & Statistics", "Calculus Essentials", "Introduction to ML"],
        ["Supervised Learning", "Unsupervised Learning", "Neural Networks", "Gradient Descent"],
        ["Scikit-Learn Projects", "Feature Engineering", "Model Evaluation", "Hyperparameter Tuning"],
        ["Deep Learning with PyTorch", "Natural Language Processing", "Computer Vision", "Deployment Strategies"]
      ],
      "database": [
        ["ER Modeling & Relational Algebra", "SQL Fundamentals", "Normal Forms (1NF, 2NF, 3NF)", "Functional Dependencies"],
        ["Indexing & Hashing", "B-Trees / B+ Trees", "Query Optimization", "Storage Structures"],
        ["Transaction Management (ACID)", "Concurrency Control (Locking)", "Deadlock Handling", "Recovery Techniques"],
        ["NoSQL Databases", "Distributed Databases", "Database Security", "Capstone project: DB Design"]
      ],
      "dbms": [
        ["ER Modeling & Relational Algebra", "SQL Fundamentals", "Normal Forms (1NF, 2NF, 3NF)", "Functional Dependencies"],
        ["Indexing & Hashing", "B-Trees / B+ Trees", "Query Optimization", "Storage Structures"],
        ["Transaction Management (ACID)", "Concurrency Control (Locking)", "Deadlock Handling", "Recovery Techniques"],
        ["NoSQL Databases", "Distributed Databases", "Database Security", "Capstone project: DB Design"]
      ],
      "data structures": [
        ["Array, Stack & Queue Foundations", "Linked List Implementations", "Binary Trees & BSTs", "Heap Data Structure"],
        ["AVL Trees & Red-Black Trees", "Hashing & Hash Tables", "Graph Representations", "BFS & DFS Traversal"],
        ["Minimum Spanning Trees", "Shortest Path (Dijkstra)", "Disjoint Set Union", "Tries & Segment Trees"],
        ["Dynamic Programming Basics", "Greedy Algorithms", "Bit Manipulation", "Mock Technical Interviews"]
      ],
      "ds": [
        ["Array, Stack & Queue Foundations", "Linked List Implementations", "Binary Trees & BSTs", "Heap Data Structure"],
        ["AVL Trees & Red-Black Trees", "Hashing & Hash Tables", "Graph Representations", "BFS & DFS Traversal"],
        ["Minimum Spanning Trees", "Shortest Path (Dijkstra)", "Disjoint Set Union", "Tries & Segment Trees"],
        ["Dynamic Programming Basics", "Greedy Algorithms", "Bit Manipulation", "Mock Technical Interviews"]
      ],
      "operating systems": [
        ["Process & Thread Management", "CPU Scheduling (Round Robin/SJF)", "Inter-Process Communication", "Critical Section Problem"],
        ["Semaphores & Mutex Locks", "Deadlock Prevention & Detection", "Memory Segmentation", "Paging Architecture"],
        ["Virtual Memory & Page Replacement", "File Systems & Disk Scheduling", "I/O Management", "System Calls & Kernels"],
        ["Linux Commands & Shell Scripting", "Real-Time OS Concepts", "Distributed OS Overview", "Virtualization & Containers"]
      ],
      "os": [
        ["Process & Thread Management", "CPU Scheduling (Round Robin/SJF)", "Inter-Process Communication", "Critical Section Problem"],
        ["Semaphores & Mutex Locks", "Deadlock Prevention & Detection", "Memory Segmentation", "Paging Architecture"],
        ["Virtual Memory & Page Replacement", "File Systems & Disk Scheduling", "I/O Management", "System Calls & Kernels"],
        ["Linux Commands & Shell Scripting", "Real-Time OS Concepts", "Distributed OS Overview", "Virtualization & Containers"]
      ],
      "networking": [
        ["OSI & TCP/IP Reference Models", "Physical Layer & Transmission", "Data Link Layer (MAC)", "Error Detection & Flow Control"],
        ["IPv4 & IPv6 Addressing", "Routing Algorithms (RIP/OSPF)", "BGP & Inter-domain Routing", "ICMP & Subnetting"],
        ["TCP & UDP Transport Protocols", "Congestion Control Mechanisms", "DNS, HTTP & SMTP Fundamentals", "Socket Programming Basics"],
        ["Network Security & Firewalls", "Cryptography (SSL/TLS)", "SDN & Cloud Networking", "Network Troubleshooting Tools"]
      ],
      "cn": [
        ["OSI & TCP/IP Reference Models", "Physical Layer & Transmission", "Data Link Layer (MAC)", "Error Detection & Flow Control"],
        ["IPv4 & IPv6 Addressing", "Routing Algorithms (RIP/OSPF)", "BGP & Inter-domain Routing", "ICMP & Subnetting"],
        ["TCP & UDP Transport Protocols", "Congestion Control Mechanisms", "DNS, HTTP & SMTP Fundamentals", "Socket Programming Basics"],
        ["Network Security & Firewalls", "Cryptography (SSL/TLS)", "SDN & Cloud Networking", "Network Troubleshooting Tools"]
      ],
      "python": [
        ["Syntax & Variables", "Control Flow", "Functions & Scoping", "Data Structures"],
        ["Object Oriented Programming", "File I/O", "Modules & Packages", "Error Handling"],
        ["NumPy & Pandas", "Web Scraping with BS4", "API Integration", "Flask Basics"],
        ["Django Framework", "Asynchronous Python", "Algorithmic Efficiency", "Packaging & PyPI"]
      ],
      "math": [
        ["Basic Algebra", "Trigonometry", "Coordinate Geometry", "Calculus I"],
        ["Linear Algebra", "Vector Calculus", "Probability Theory", "Statistics"],
        ["Differential Equations", "Numerical Methods", "Abstract Algebra", "Complex Analysis"],
        ["Optimization", "Game Theory", "Cryptography", "Topology"]
      ]
    };

    const phases: RoadmapPhase[] = phaseNames.map((name, i) => {
      const phaseId = this.generateId("phse");
      const topics: RoadmapTopic[] = Array.from({ length: 4 }).map((_, j) => {
        let topicName = `${params.subject} Concept ${i + 1}.${j + 1}`;

        // Use realistic topics if we have them
        for (const [key, list] of Object.entries(subjectTopics)) {
          if (sub.includes(key)) {
            topicName = list[i][j];
            break;
          }
        }

        const searchQuery = encodeURIComponent(`${params.subject} ${topicName} tutorial`);
        return {
          id: this.generateId("topic"),
          name: topicName,
          difficulty: Math.min(10, (i + 1) * 2 + j),
          estimatedHours: Math.round(totalHours / 16),
          resources: [
            `https://www.google.com/search?q=${searchQuery}`,
            `https://www.youtube.com/results?search_query=${searchQuery}`
          ],
          status: "pending",
          notes: `Automated resource discovery complete for ${topicName}.`
        };
      });

      return {
        id: phaseId,
        name,
        weekRange: `Week ${i * (totalWeeks / 4) + 1} - ${(i + 1) * (totalWeeks / 4)}`,
        description: `This phase focuses on ${name.toLowerCase()} to build your expertise.`,
        topics,
        totalHours: topics.reduce((s, t) => s + t.estimatedHours, 0)
      };
    });

    const roadmap = {
      id: roadmapId,
      subject: params.subject,
      level: params.level,
      dailyHours: params.dailyHours,
      totalWeeks,
      totalHours,
      phases,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem("stub_roadmap", JSON.stringify(roadmap));
    return roadmap as Roadmap;
  }

  static generateSchedule(roadmap: Roadmap, params?: ScheduleStrategistParams): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const startDate = params?.startDate || new Date().toISOString().split("T")[0];
    let currentDate = new Date(startDate);

    const cached = JSON.parse(localStorage.getItem("stub_calendar_events") || "{\"events\":[]}");
    const existing = cached.events || [];
    const isBusy = (d: string, start: string) => {
      return existing.some((ov: any) => ov.sessionType === "Busy" && ov.date === d && ov.startTime === start);
    };

    roadmap.phases.forEach((phase) => {
      phase.topics.forEach((topic) => {
        for (let s = 0; s < 2; s++) {
          const type = s === 0 ? "Study" : "Practice";
          let startTime = "13:00";
          let endTime = "15:00";

          if (topic.difficulty >= 7) {
            startTime = "09:00"; endTime = "11:00"; // Peak energy
          } else if (topic.difficulty <= 3) {
            startTime = "19:00"; endTime = "21:00"; // Low energy
          }

          // MISSION: Time Slot Discovery - Avoid overlaps with personal Busy events
          let targetDateStr = currentDate.toISOString().split("T")[0];
          while (isBusy(targetDateStr, startTime)) {
            currentDate.setDate(currentDate.getDate() + 1);
            targetDateStr = currentDate.toISOString().split("T")[0];
          }

          events.push({
            id: this.generateId("evt"),
            date: targetDateStr,
            startTime,
            endTime,
            subject: roadmap.subject,
            topic: topic.name,
            phase: phase.name,
            phaseId: phase.id,
            topicId: topic.id,
            sessionType: type as any,
            difficulty: topic.difficulty,
            estimatedHours: 2,
            completed: false,
            xpReward: 20 + topic.difficulty * 2
          });

          // MISSION: Buffer Strategy - Keep 1 light day per week
          currentDate.setDate(currentDate.getDate() + 1);
          if (currentDate.getDay() === 0) currentDate.setDate(currentDate.getDate() + 1); // Sunday = Buffer
        }
      });
    });

    localStorage.setItem("stub_calendar_events", JSON.stringify({ events }));
    return events;
  }

  static calculateScheduleStats(events: CalendarEvent[]) {
    return {
      totalSessions: events.length,
      totalStudyHours: events.reduce((s, e) => s + e.estimatedHours, 0),
      totalReviewSessions: events.filter(e => e.sessionType === "Review").length,
      estimatedEndDate: events[events.length - 1]?.date || "",
      averageDifficulty: 5.5
    };
  }

  static generateOracleReport(roadmap: Roadmap | null, events: CalendarEvent[], params: ProgressOracleParams) {
    const reportId = this.generateId("reprt");
    const masteryScores: MasteryScore[] = roadmap ? [{
      subject: roadmap.subject,
      score: 15,
      topicsCompleted: 2,
      topicsTotal: 16,
      hoursInvested: 4,
      hoursPlanned: roadmap.totalHours,
      streak: 3,
      trend: "improving"
    }] : [];

    const report: ProgressReport = {
      id: reportId,
      weekNumber: 1,
      generatedAt: new Date().toISOString(),
      overallXP: 450,
      streakDays: 3,
      masteryScores,
      onTrack: roadmap ? [roadmap.subject] : [],
      behind: events.filter(e => !e.completed && e.date < new Date().toISOString().split("T")[0]).map(m => m.topic),
      alerts: [],
      recommendation: "Focus on foundations this week to build momentum.",
      aiSummary: "You're off to a great start! Consistency is exactly what's needed.",
      needsAdaptiveReschedule: false
    };

    // ── AUTOMATION: Detect Missed Sessions ───────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const missed = events.filter(e => e.date < today && !e.completed);

    if (missed.length > 0) {
      report.needsAdaptiveReschedule = true;
      report.alerts = [{
        id: this.generateId("alrt"),
        type: "behind-schedule" as any,
        severity: "warning" as any,
        title: "Autonomous Detection: Behind Schedule",
        message: `I've detected ${missed.length} missed sessions. Shall I reschedule them for you?`,
        createdAt: new Date().toISOString(),
        read: false
      }];
      report.recommendation = "I recommend an adaptive reschedule to move your missed topics forward.";
      report.aiSummary = `You missed some sessions on ${missed[0]?.topic}. Don't worry, my autonomous engine can move these forward to today.`;
    } else {
      report.alerts = [{
        id: this.generateId("alrt"),
        type: "milestone" as any,
        severity: "info" as any,
        title: "Looking Good!",
        message: "You've successfully started your roadmap. Keep it up!",
        createdAt: new Date().toISOString(),
        read: false
      }];
    }

    localStorage.setItem("stub_report", JSON.stringify(report));
    return { report, alerts: report.alerts };
  }

  static performAdaptiveReschedule(events: CalendarEvent[]): CalendarEvent[] {
    const today = new Date().toISOString().split("T")[0];
    const completed = events.filter(e => e.completed);
    const unfinished = events.filter(e => !e.completed);

    // MISSION: Distribute remaining load across next 3–5 days
    // Never overload a single day.
    let currentDate = new Date(today);
    let sessionsToday = 0;

    const updated = unfinished.map(e => {
      // MISSION: Time Slot Discovery - Skip busy blocks
      const isBusy = (d: string, start: string) => {
        return events.some(ov => ov.sessionType === "Busy" && ov.date === d && ov.startTime === start);
      };

      // Logic: Max 2 intense sessions per day to prevent burnout
      if (sessionsToday >= 2) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (currentDate.getDay() === 0) currentDate.setDate(currentDate.getDate() + 1); // Sunday Protection
        sessionsToday = 0;
      }

      let targetDate = currentDate.toISOString().split("T")[0];
      let targetStart = e.difficulty >= 7 ? "09:00" : e.difficulty <= 3 ? "20:00" : "14:00";

      // Self-correction: If blocked, move to next day
      if (isBusy(targetDate, targetStart)) {
        currentDate.setDate(currentDate.getDate() + 1);
        targetDate = currentDate.toISOString().split("T")[0];
      }

      const newEvent = {
        ...e,
        date: targetDate,
        startTime: targetStart,
      };

      sessionsToday++;
      return newEvent;
    });

    const finalEvents = [...completed, ...updated];
    localStorage.setItem("stub_calendar_events", JSON.stringify({ events: finalEvents }));

    return finalEvents;
  }

  static buildLoadAnalysis(events: CalendarEvent[]) {
    const pending = events.filter(e => !e.completed);
    const uniqueDays = new Set(pending.map(e => e.date)).size;
    const avgHours = uniqueDays > 0 ? (pending.length * 2) / uniqueDays : 0;

    return {
      average_daily_hours: avgHours.toFixed(1),
      overload_risk: (avgHours > 4 ? "high" : avgHours > 2.5 ? "medium" : "low") as "high" | "medium" | "low",
      buffer_days_remaining: Math.floor(events.length / 5),
      strategy_note: avgHours > 4
        ? "I have detected a high workload. I'm prioritizing hard topics in your morning peak while preserving evening recovery slots."
        : "Load is optimal. Your current pace ensures long-term retention without cognitive fatigue."
    };
  }

  static generateResourceRecommendations(params: AcademicResourceIntelligenceParams) {
    const recommendations = params.topic_request.map(topic => {
      const isBeginner = topic.student_level === "beginner";
      const isAdvanced = topic.student_level === "advanced";
      const isHard = topic.difficulty_level === "hard";
      const lowTime = params.time_available_minutes < 60;
      const struggling = params.past_performance.score < 60;

      const fullQuery = topic.topic.toLowerCase().includes(topic.subject.toLowerCase())
        ? topic.topic
        : `${topic.subject} ${topic.topic}`;
      const query = encodeURIComponent(fullQuery);
      const subjectHint = topic.subject.toLowerCase();
      const topicEnc = encodeURIComponent(topic.topic);

      // ── Detect branch from subject name ────────────────────────────────────────
      const isCS = subjectHint.includes("computer") || subjectHint.includes("cs") || subjectHint.includes("cse") || subjectHint.includes("software") || subjectHint.includes("programming") || subjectHint.includes("dbms") || subjectHint.includes("algorithms");
      const isMath = subjectHint.includes("math");
      const isECE = subjectHint.includes("electronics") || subjectHint.includes("ece") || subjectHint.includes("ec") || subjectHint.includes("signal");
      const isMech = subjectHint.includes("mechanical") || subjectHint.includes("mech") || subjectHint.includes("me") || subjectHint.includes("thermodynamics") || subjectHint.includes("fluid");
      const isCivil = subjectHint.includes("civil") || subjectHint.includes("structural") || subjectHint.includes("geotechnical");
      const isEEE = subjectHint.includes("electrical") || subjectHint.includes("eee") || subjectHint.includes("power systems");
      const isChem = subjectHint.includes("chemistry") || subjectHint.includes("chemical");
      const isPhys = subjectHint.includes("physics");

      // ── PDF / Study Notes ──────────────────────────────────────────────────────
      let pdfUrl = `https://www.khanacademy.org/search?page_search_query=${query}`;
      if (isCS) pdfUrl = `https://www.geeksforgeeks.org/search/?q=${topicEnc}`;
      else if (isMath) pdfUrl = `https://ocw.mit.edu/search/?q=${query}`;
      else if (isECE) pdfUrl = `https://www.electronics-tutorials.ws/search?q=${topicEnc}`;
      else if (isMech) pdfUrl = `https://ocw.mit.edu/search/?q=${query}+mechanical`;
      else if (isCivil) pdfUrl = `https://nptel.ac.in/search?q=${query}`;
      else if (isEEE) pdfUrl = `https://nptel.ac.in/search?q=${query}+electrical`;
      else if (isChem) pdfUrl = `https://nptel.ac.in/search?q=${query}+chemistry`;
      else if (isPhys) pdfUrl = `https://ocw.mit.edu/search/?q=${query}+physics`;

      // ── Practice Questions ─────────────────────────────────────────────────────
      let practiceUrl = `https://www.geeksforgeeks.org/search/?q=${topicEnc}+questions`;
      if (isCS) practiceUrl = `https://practice.geeksforgeeks.org/explore?category=${topicEnc}`;
      else if (isMath) practiceUrl = `https://www.khanacademy.org/search?page_search_query=${query}`;
      else if (isECE) practiceUrl = `https://gateece.org/previous-year-solved-papers/`;
      else if (isMech) practiceUrl = `https://gateme.org.in/previous-year-solved-papers/`;
      else if (isCivil) practiceUrl = `https://nptel.ac.in/search?q=${query}+civil+quiz`;
      else if (isEEE) practiceUrl = `https://nptel.ac.in/search?q=${query}+electrical+quiz`;

      // ── PYQ — Direct portals per branch ───────────────────────────────────────
      let pyqUrl = `https://www.ktunotes.in/ktu-2019-scheme-question-papers/`;
      if (isCS) pyqUrl = `https://gateoverflow.in/?_search=${topicEnc}`;
      else if (isMath) pyqUrl = `https://gateoverflow.in/questions?sort=recent&_search=${topicEnc}`;
      else if (isECE) pyqUrl = `https://gateece.org/previous-year-solved-papers/`;
      else if (isMech) pyqUrl = `https://www.ktunotes.in/ktu-s5-mech-question-papers-2019-scheme/`;
      else if (isCivil) pyqUrl = `https://www.ktunotes.in/ktu-s5-civil-question-papers-2019-scheme/`;
      else if (isEEE) pyqUrl = `https://www.ktunotes.in/ktu-s5-eee-question-papers-2019-scheme/`;
      else if (isChem) pyqUrl = `https://nptel.ac.in/search?q=${query}+previous+year`;
      else if (isPhys) pyqUrl = `https://nptel.ac.in/search?q=${query}+physics+previous+year`;


      return {
        subject: topic.subject,
        topic: topic.topic,
        recommended_resources: {
          youtube_lecture: (() => {
            // Curated most-viewed lecture map per topic (sorted by views on YouTube)
            // Format: [english_url, hindi_url, malayalam_url, title, creator]
            type YTEntry = { en: string; hi: string; ml: string; title: string; creator: string };
            const YT_MAP: Record<string, YTEntry> = {
              "data structures": {
                en: "https://www.youtube.com/results?search_query=data+structures+complete+course+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=data+structures+gate+smashers+hindi&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=data+structures+malayalam+lecture&sp=CAM%3D",
                title: "Data Structures — Complete Course", creator: "Gate Smashers / Jenny's Lectures"
              },
              "database management systems": {
                en: "https://www.youtube.com/results?search_query=DBMS+complete+course+neso+academy+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=DBMS+gate+smashers+hindi&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=dbms+malayalam+ktu+lecture&sp=CAM%3D",
                title: "DBMS Complete Course", creator: "Neso Academy / Gate Smashers"
              },
              "operating systems": {
                en: "https://www.youtube.com/results?search_query=operating+systems+full+course+neso+academy+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=operating+systems+gate+smashers+hindi&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=operating+systems+malayalam+ktu&sp=CAM%3D",
                title: "Operating Systems — Full Course", creator: "Neso Academy / Gate Smashers"
              },
              "computer networks": {
                en: "https://www.youtube.com/results?search_query=computer+networks+full+course+neso+academy+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=computer+networks+gate+smashers+hindi&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=computer+networks+malayalam+lecture+ktu&sp=CAM%3D",
                title: "Computer Networks — Complete Course", creator: "Neso Academy / Gate Smashers"
              },
              "algorithms": {
                en: "https://www.youtube.com/results?search_query=algorithms+design+analysis+abdul+bari+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=algorithm+design+analysis+hindi+gate+smashers&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=algorithms+daa+malayalam+ktu&sp=CAM%3D",
                title: "Design & Analysis of Algorithms", creator: "Abdul Bari"
              },
              "discrete mathematics": {
                en: "https://www.youtube.com/results?search_query=discrete+mathematics+full+course+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=discrete+mathematics+gate+smashers+hindi&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=discrete+mathematics+malayalam+ktu&sp=CAM%3D",
                title: "Discrete Mathematical Structures", creator: "Gate Smashers"
              },
              "computer organisation": {
                en: "https://www.youtube.com/results?search_query=computer+organization+architecture+full+course&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=COA+computer+organisation+hindi+gate+smashers&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=computer+organization+architecture+malayalam+ktu&sp=CAM%3D",
                title: "Computer Organisation & Architecture", creator: "Gate Smashers"
              },
              "formal languages": {
                en: "https://www.youtube.com/results?search_query=theory+of+computation+automata+full+course+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=theory+of+computation+FLAT+hindi+gate&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=formal+languages+automata+theory+malayalam+ktu&sp=CAM%3D",
                title: "Formal Languages & Automata Theory", creator: "Neso Academy"
              },
              "compiler design": {
                en: "https://www.youtube.com/results?search_query=compiler+design+full+course+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=compiler+design+hindi+gate+smashers&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=compiler+design+malayalam+ktu&sp=CAM%3D",
                title: "Compiler Design Complete Course", creator: "Easy Engineering"
              },
              "python": {
                en: "https://www.youtube.com/watch?v=_uQrJ0TkZlc",
                hi: "https://www.youtube.com/watch?v=gfDE2a7MKjA",
                ml: "https://www.youtube.com/results?search_query=python+programming+malayalam+tutorial&sp=CAM%3D",
                title: "Python Programming — Complete Course", creator: "Mosh Hamedani / Code With Harry"
              },
              "calculus": {
                en: "https://www.youtube.com/results?search_query=calculus+full+course+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=calculus+integral+differential+hindi&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=calculus+malayalam+ktu&sp=CAM%3D",
                title: "Calculus & Linear Algebra", creator: "Professor Leonard"
              },
              "thermodynamics": {
                en: "https://www.youtube.com/results?search_query=thermodynamics+complete+course+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=thermodynamics+hindi+lecture+gate+smashers&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=thermodynamics+malayalam+ktu&sp=CAM%3D",
                title: "Thermodynamics Masters", creator: "Engineering Mindset"
              },
              "circuit theory": {
                en: "https://www.youtube.com/results?search_query=circuit+theory+complete+course+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=circuit+theory+hindi+lecture&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=network+theory+malayalam+ktu&sp=CAM%3D",
                title: "Network & Circuit Theory", creator: "Neso Academy"
              },
              "physics": {
                en: "https://www.youtube.com/results?search_query=engineering+physics+complete+course&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=engineering+physics+hindi+lecture&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=engineering+physics+malayalam+ktu&sp=CAM%3D",
                title: "Engineering Physics — Core Concepts", creator: "Gate Smashers"
              },
              "machine learning": {
                en: "https://www.youtube.com/results?search_query=machine+learning+complete+course+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=machine+learning+hindi+lecture&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=machine+learning+malayalam+tutorial&sp=CAM%3D",
                title: "Machine Learning Masterclass", creator: "Andrew Ng / Code With Harry"
              },
              "artificial intelligence": {
                en: "https://www.youtube.com/results?search_query=artificial+intelligence+full+course+english&sp=CAM%3D",
                hi: "https://www.youtube.com/results?search_query=artificial+intelligence+hindi+lecture&sp=CAM%3D",
                ml: "https://www.youtube.com/results?search_query=ai+malayalam+tutorial&sp=CAM%3D",
                title: "AI & Neural Networks", creator: "Edureka / Gate Smashers"
              }
            };

            const KTU_VIDEO_ALIASES: Record<string, string> = {
              dsa: "data structures", ds: "data structures",
              dbms: "database management systems", database: "database management systems",
              os: "operating systems", cn: "computer networks",
              networking: "computer networks", daa: "algorithms",
              "algorithm analysis": "algorithms", "algorithm design": "algorithms",
              coa: "computer organisation", "computer organization": "computer organisation",
              flat: "formal languages", "automata theory": "formal languages",
              calc: "calculus", "linear algebra": "calculus",
              ct: "circuit theory", "network theory": "circuit theory",
              thermo: "thermodynamics", "heat transfer": "thermodynamics",
              phy: "physics", "applied physics": "physics",
              ml: "machine learning", ai: "artificial intelligence"
            };

            const needle = `${topic.topic} ${topic.subject}`.toLowerCase();
            let ytEntry: YTEntry | null = null;
            for (const [key, entry] of Object.entries(YT_MAP)) {
              if (needle.includes(key)) { ytEntry = entry; break; }
            }
            if (!ytEntry) {
              for (const [alias, canonical] of Object.entries(KTU_VIDEO_ALIASES)) {
                if (needle.includes(alias) && YT_MAP[canonical]) { ytEntry = YT_MAP[canonical]; break; }
              }
            }

            // ── Dynamic fallback: works for ANY subject ─────────────────────────
            const topicQ = encodeURIComponent(topic.topic);
            const branchQ = encodeURIComponent(topic.subject);

            const fallback: YTEntry = {
              en: `https://www.youtube.com/results?search_query=${topicQ}+${branchQ}+lecture+english&sp=CAM%3D`,
              hi: `https://www.youtube.com/results?search_query=${topicQ}+${branchQ}+lecture+hindi&sp=CAM%3D`,
              ml: `https://www.youtube.com/results?search_query=${topicQ}+${branchQ}+lecture+malayalam&sp=CAM%3D`,
              title: `${topic.topic} — Most Viewed Lectures`,
              creator: "Top Educators (Sorted by Views)"
            };
            const entry = ytEntry || fallback;

            return {
              title: entry.title,
              creator: entry.creator,
              duration_minutes: lowTime ? 20 : 45,
              reason: "Curated most-viewed lecture in your preferred language.",
              url: entry.en,
              url_hindi: entry.hi,
              url_malayalam: entry.ml
            };
          })(),
          pdf_notes: {
            title: struggling ? "Foundational Study Guide" : "Exam Performance Hack Sheet",
            source: struggling ? "Academic Remediation Core" : "Academic Intelligence Core",
            pages: lowTime ? 5 : 20,
            reason: struggling ? "Reinforces basics to build confidence." : "Optimized for scoring potential.",
            url: pdfUrl
          },
          practice_questions: {
            type: struggling ? "basic" : isAdvanced ? "advanced" : ("moderate" as any),
            estimated_questions: struggling ? 10 : 25,
            reason: struggling ? "Foundational reinforcement." : "Stress-testing conceptual mastery.",
            url: practiceUrl,
            questions: Array.from({ length: 25 }).map((_, i) => {
              const templates = [
                `Define the fundamental principles of ${topic.topic} and their significance in ${topic.subject}.`,
                `How would you implement a robust solution for ${topic.topic} in a production environment?`,
                `What are the most common edge cases to consider when dealing with ${topic.topic}?`,
                `Analyze the performance trade-offs of using ${topic.topic} versus traditional methods.`,
                `Describe a scenario where ${topic.topic} might fail and how to mitigate those risks.`,
                `Explain the mathematical derivation behind the core algorithm of ${topic.topic}.`,
                `Compare the industry-best practices for ${topic.topic} between startups and enterprise systems.`,
                `How has the recent advancement in AI impacted the way we approach ${topic.topic}?`
              ];
              return `Q${i + 1}: ${templates[i % templates.length]}`;
            })
          },
          previous_year_questions: {
            availability: isBeginner ? "no" : ("yes" as any),
            focus_area: struggling ? "Recall" : "Synthesis",
            reason: "Real GATE + B.Tech exam questions for this topic.",
            url: pyqUrl,
            pyq_questions: (() => {
              // KTU subject → real PDF links (scraped from ktunotes.in)
              const KTU_PAPERS: Record<string, { year: string; url: string }[]> = {
                "data structures": [{ year: "2023", url: "https://drive.google.com/file/d/1d6ueabUd2Ct8Wg18LRdim8hDH2H2H5V_/view" }, { year: "2022", url: "https://drive.google.com/file/d/1cNA2yf8SIFKssCEUqA3ZXA1yLc36F4cX/view" }, { year: "2021", url: "https://drive.google.com/file/d/14y3t71UfC5KUraky1n8kTAR8Iv2O3XyI/view" }, { year: "2020", url: "https://drive.google.com/file/d/12Y1I6nz-WdTr7SkbbwTFUKiGmyb2VVcS/view" }],
                "discrete mathematics": [{ year: "2023", url: "https://drive.google.com/file/d/1TRdMpVkf2NpOhz4nBqx7q5hQ2f9uE73P/view" }, { year: "2022", url: "https://drive.google.com/file/d/19B7cyNrS_f3c4gFynVxfqKlHjK5AubTV/view" }, { year: "2021", url: "https://drive.google.com/file/d/1EtsdCKhKphH6fO43ej0ubV9ZBDbTsQca/view" }],
                "database management systems": [{ year: "2022", url: "https://drive.google.com/file/d/192j2jRwQxX9_BE1WFsLcPDla2I3GebYO/view" }, { year: "2021", url: "https://drive.google.com/file/d/1FMCIo6GYxeC94R9Qp6d7OeK4ianZQbRC/view" }],
                "operating systems": [{ year: "2022", url: "https://drive.google.com/file/d/1mHdIgVrKn7aVF2iA2F6lI2W1c45d1Lk-/view" }, { year: "2021", url: "https://drive.google.com/file/d/1J34ceNWpTD_ZOHdvtKn1_5ZNaZFOu3_x/view" }],
                "computer organisation": [{ year: "2022", url: "https://upload.ktunotes.in/wp/wp-content/uploads/2023/03/CST202-COMPUTER-ORGANIZATION-AND-ARCHITECTURE-JUNE-2022.pdf" }, { year: "2021", url: "https://upload.ktunotes.in/wp/wp-content/uploads/2023/03/CST202-COMPUTER-ORGANIZATION-AND-ARCHITECTURE-JULY-2021.pdf" }],
                "formal languages": [{ year: "2023", url: "https://drive.google.com/file/d/19EMYhtBD3CqHWTt89zZA7zMA_SbguCAp/view" }, { year: "2022", url: "https://drive.google.com/file/d/182T3Ib0auOz20zXVeiadnpVqOmiaVPvm/view" }, { year: "2021", url: "https://drive.google.com/file/d/14nXZNREqTlieaJe3WijEU-rdKX6FML3e/view" }],
                "computer networks": [{ year: "2023", url: "https://drive.google.com/file/d/1JNO8hErA0r3Vw7J21OCnw592ap9kj9AG/view" }, { year: "2022", url: "https://drive.google.com/file/d/1tyOGND_iFvV_N3tnmpe0Wo-NtiZESRjF/view" }, { year: "2021", url: "https://drive.google.com/file/d/1YrSmzMpBMmkZxTxpxXLN3-AKgQ7RpmUR/view" }],
                "compiler design": [{ year: "2022", url: "https://drive.google.com/file/d/1tCrCEsBwQLa4Z-Af09Ta5nC-KjfHpnIW/view" }],
                "algorithms": [{ year: "2022", url: "https://drive.google.com/file/d/1KONZo7beERDJ4kK1IYgxcPjr3PLhMjbu/view" }],
                "python": [{ year: "2022", url: "https://drive.google.com/file/d/1Sj5kVdZT5ovzUtS5ZoKlxEac9hSO4FoA/view" }],
              };
              const KTU_ALIASES: Record<string, string> = { dsa: "data structures", ds: "data structures", dbms: "database management systems", database: "database management systems", os: "operating systems", coa: "computer organisation", "computer organization": "computer organisation", "computer architecture": "computer organisation", "automata theory": "formal languages", flat: "formal languages", cn: "computer networks", networking: "computer networks", dms: "discrete mathematics", daa: "algorithms", "algorithm analysis": "algorithms" };

              const sub = topic.subject.toLowerCase();
              const top = topic.topic.toLowerCase();
              const isML = sub.includes("ml") || sub.includes("machine") || sub.includes("ai") || sub.includes("neural") || sub.includes("gradient");
              const isMath = sub.includes("math") || sub.includes("calculus") || sub.includes("algebra");
              const isCS = sub.includes("cs") || sub.includes("computer") || sub.includes("dbms") || sub.includes("os") || sub.includes("networking") || sub.includes("algorithm") || sub.includes("logic");
              const isScience = sub.includes("phys") || sub.includes("chem") || sub.includes("science");

              const needle = `${topic.topic} ${topic.subject}`.toLowerCase();
              let ktuPapers: { year: string; url: string }[] = [];
              for (const [key, papers] of Object.entries(KTU_PAPERS)) {
                if (needle.includes(key)) { ktuPapers = papers; break; }
              }
              if (!ktuPapers.length) {
                for (const [alias, canonical] of Object.entries(KTU_ALIASES)) {
                  if (needle.includes(alias) && KTU_PAPERS[canonical]) { ktuPapers = KTU_PAPERS[canonical]; break; }
                }
              }

              const btechQs = isML ? [
                `Explain the mathematical derivation of **Loss Function** in ${topic.topic}. (10 marks)`,
                `How do you handle **overfitting** in a model using ${topic.topic}? (8 marks)`,
                `With a diagram, illustrate the **Neural Architecture** / flow for ${topic.topic}. (12 marks)`,
                `Discuss the impact of **Hyperparameter Tuning** on the convergence of ${topic.topic}. (10 marks)`,
                `Compare ${topic.topic} with its deep learning counterpart. (8 marks)`,
              ] : isMath ? [
                `State and prove the **Fundamental Theorem** related to ${topic.topic}. (12 marks)`,
                `Solve the following numerical problem on ${topic.topic} using first principles. (10 marks)`,
                `Explain the **Convergence Properties** of ${topic.topic}. (8 marks)`,
                `Discuss the **Geometric Interpretation** of ${topic.topic}. (10 marks)`,
                `How is ${topic.topic} applied in modern structural engineering? (6 marks)`,
              ] : isCS ? [
                `Define ${topic.topic} and explain its significance in ${topic.subject}. (10 marks)`,
                `Compare ${topic.topic} with its closest alternative. (8 marks)`,
                `With diagram, explain working of ${topic.topic} and trace on sample input. (12 marks)`,
                `Analyze the **Time & Space Complexity** of ${topic.topic}. (10 marks)`,
                `How would you optimize ${topic.topic} for 10,000 concurrent users? (10 marks)`,
              ] : [
                `Explain the core principles of ${topic.topic} and its real-world utility. (10 marks)`,
                `What are the historical developments that led to the modern view of ${topic.topic}? (8 marks)`,
                `Design a system / process that effectively utilizes ${topic.topic}. (12 marks)`,
                `Analyze the ethical or performance implications of ${topic.topic} in society. (10 marks)`,
                `Compare and contrast ${topic.topic} with traditional methodologies. (10 marks)`,
              ];

              const gateQs = isML ? [
                `In context of ${topic.topic}, which regularizer prevents overfitting? (A) L1 (B) L2 (C) Both (D) None`,
                `What is the best-case time complexity of training ${topic.topic}? (A) O(n) (B) O(n²) (C) O(1) (D) Data-dependent`,
                `Which activation function is preferred for ${topic.topic}? (A) ReLU (B) Sigmoid (C) Tanh (D) Softmax`,
              ] : isMath ? [
                `The value of ${topic.topic} at the origin is: (A) 0 (B) 1 (C) Undefined (D) Pi`,
                `Which property is NOT satisfied by ${topic.topic}? (A) Linearity (B) Homogeneity (C) Non-negativity (D) Divergence`,
              ] : [
                `Which of the following best describes the complexity of ${topic.topic}? (A) O(n) (B) O(n log n) (C) O(n²) (D) O(log n)`,
                `In context of ${topic.topic}, which is CORRECT? (A) Always deterministic (B) Non-deterministic (C) Constant space (D) None`,
              ];

              const gateYears = [2024, 2023, 2022, 2021, 2020, 2019];

              // B.Tech entries with REAL per-year PDF URLs from KTU
              const result: { exam: "GATE" | "B.Tech"; year: number; question: string; url?: string }[] = ktuPapers.map((p, i) => ({
                exam: "B.Tech" as const,
                year: parseInt(p.year),
                question: btechQs[i % btechQs.length],
                url: p.url  // ← real KTU Google Drive PDF!
              }));

              // Add GATE MCQs
              gateQs.forEach((q, i) => result.push({ exam: "GATE" as const, year: gateYears[i % gateYears.length], question: q }));
              return result;
            })()
          },
          cheat_sheet_markdown: (() => {
            const T = topic.topic;
            const S = topic.subject;
            const lvl = topic.student_level;
            const diff = topic.difficulty_level;
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
            const dayOfWeek = now.getDay();
            const initials = T.split(' ').map((w: string) => w[0]?.toUpperCase() ?? '').join('');

            // Domain identification for logical notes
            const sub = S.toLowerCase();
            const top = T.toLowerCase();
            const isML = sub.includes("ml") || sub.includes("machine") || sub.includes("ai") || sub.includes("neural") || sub.includes("deep") || top.includes("tensor") || top.includes("layer");
            const isMath = sub.includes("math") || sub.includes("calculus") || sub.includes("algebra") || sub.includes("probability");
            const isDBMS = sub.includes("dbms") || sub.includes("database") || sub.includes("sql") || top.includes("sql") || top.includes("normalization") || top.includes("schema");
            const isCS = (sub.includes("cs") || sub.includes("computer") || sub.includes("os") || sub.includes("networking") || sub.includes("algorithm")) && !isDBMS && !isML;

            // Generic placeholders that adapt to domain
            const coreMechanism = isML ? "Gradient / Optimization" : isMath ? "Theorem / Proof" : isDBMS ? "Normalization / Logic" : "Algorithm / Logic";
            const complexityLabel = isML ? "Training Load" : isMath ? "Computational Cost" : isDBMS ? "Disk I/O Complexity" : "Time Complexity";
            const primaryInvariant = isML ? "Loss Minimization" : isMath ? "Axiomatic Consistency" : isDBMS ? "Atomic Isolation" : "Loop Invariant";
            const traceLabel = isML ? "Epoch / Iteration" : isMath ? "Step / Derivation" : isDBMS ? "Stage / Form" : "Pass / Step";
            const defaultComplexity = isML ? "O(epoch × n × d)" : isMath ? "O(1/ε) convergence" : isDBMS ? "O(log_f n) tree depth" : "O(n log n)";

            // ── Style 0: Sunday — Feynman Teach-Back Method ────────────────────
            const style0 = [
              `# 🧑‍🏫 Feynman Study Session: ${T}`,
              `**Method:** Feynman Technique  |  **Subject:** ${S}  |  **Date:** ${dateStr}`,
              ``,
              `> 📖 *"If you can't explain it simply, you don't understand it well enough." — Richard Feynman*`,
              ``,
              `---`,
              `## 🎯 Step 1: Explain It Like I'm 5`,
              `Imagine explaining **${T}** to a 10-year-old with zero background in ${S}:`,
              ``,
              isML ?
                `"${T} is like teaching a robot to recognize patterns. Imagine you show a robot 1,000 pictures of apples. At first, it's guessing. But every time it's wrong, it learns from its mistake. Eventually, it becomes an expert at spotting apples. ${T} is the set of rules the robot uses to learn from those mistakes!"` :
                isMath ?
                  `"${T} is like a secret rule that always stays true. It's like saying if you have two piles of 2 bricks, you'll always have 4 bricks total. No matter how big the piles get, the rule of ${T} helps us predict the answer before we even count!"` :
                  `"${T} is like a really smart way of solving a specific type of problem. Imagine you have a big pile of messy things, and you need to make sense of them quickly. ${T} gives you a set of rules — like a recipe — that you follow step by step. At the end, you get a neat, organized answer!"`,
              ``,
              `---`,
              `## 🔍 Step 2: Identify Gaps — Test Yourself NOW`,
              `Answer these without looking at notes:`,
              ``,
              `1. What exactly does ${T} do? (Write in one sentence)`,
              `2. What problem would occur if ${T} didn't exist?`,
              `3. Give me ONE real-world example of ${T} in everyday life.`,
              `4. What is the ${complexityLabel} and why?`,
              `5. What are the 3 most common errors students make with ${T}?`,
              ``,
              `---`,
              `## 📚 Step 3: Deep Conceptual Breakdown`,
              ``,
              `**The core idea of ${T}:**`,
              `${T} operates by ${isML ? 'minimizing a specific error or loss' : isMath ? 'applying a proven logical truth' : 'breaking down a complex task'} into manageable operations.`,
              ``,
              `**Why it works mathematically:**`,
              `The correctness relies on:`,
              isML ? `- Convergence: The error gradually reaches zero` : `- Invariant: The core property that remains true`,
              `- Termination: The process always ends for valid inputs`,
              `- Soundness: Every output satisfies the constraints`,
              ``,
              `---`,
              `## 🧪 Exam Simulation: Self-Test`,
              ``,
              `**5-mark question:** Explain ${T} with an example. → Definition + ${isML ? 'Architecture' : 'Algorithm'} + ${traceLabel}`,
              `**10-mark question:** Analyze ${T} with complexity. → Full derivation + comparison`,
              ``,
              `---`,
              `## 📝 Quick Revision Card`,
              ``,
              `✦ **What:** ${T} = ${coreMechanism} in ${S}`,
              `✦ **When:** Use when consistency + speed are both required`,
              `✦ **Complexity:** ${defaultComplexity}`,
              ``,
              `---`,
              `*🤖 SYNAPSE Feynman Engine · ${dateStr} · Sunday Deep Revision Mode*`
            ].join('\n');

            // ── Style 1: Monday — Deep Structured Academic Notes ───────────────
            const style1 = [
              `# 🧠 SYNAPSE Academic Notes: ${T}`,
              `**Format:** Structured Study Notes  |  **Subject:** ${S}  |  **Level:** ${lvl}  |  **${dateStr}**`,
              ``,
              `---`,
              ``,
              `## 📌 1. Definition & Introduction`,
              `**${T}** is a core concept in **${S}** that addresses ${isML ? 'predictive modeling and pattern recognition' : isMath ? 'formal logical derivation' : 'efficient data processing'} through a formal approach.`,
              ``,
              `**Formal Definition:**`,
              `> ${T} is defined as a systematic method in ${S} that transforms a given input by applying ${isML ? 'minimization of the objective function' : isMath ? 'logical axioms' : 'formal rules'}, producing a correct, optimal output.`,
              ``,
              `---`,
              ``,
              `## 🏗️ 2. Classification & Taxonomy`,
              ``,
              `${T} falls under the following category structure:`,
              ``,
              `| Level | Category | Subcategory |`,
              `|-------|----------|-------------|`,
              `| Domain | ${S} | ${isML ? 'ML Architecture' : isMath ? 'Math Core' : 'Engineering'} |`,
              `| Type | Deterministic | ${isML ? 'Stochastic' : 'Exact'} |`,
              `| Paradigm | ${isML ? 'Gradient-based' : 'Iterative'} | ${isML ? 'Deep Learning' : 'Core Method'} |`,
              `| ${complexityLabel} | ${defaultComplexity} | Typical |`,
              ``,
              `---`,
              ``,
              `## ⚙️ 3. ${isML ? 'Flow & Optimization' : 'Algorithm & Mechanism'}`,
              ``,
              `\`\`\``,
              `INPUT:  Instance of ${T}`,
              `PROCESS:`,
              `  1. INITIALIZE:  Setup ${isML ? 'weights and learning rate' : 'state and boundaries'}`,
              `  2. ${isML ? 'FORWARD PASS' : 'EXECUTE'}: Compute ${isML ? 'prediction' : 'transformation'}`,
              `  3. ${isML ? 'COMPUTE LOSS' : 'VERIFY'}: Compare ${isML ? 'output with target' : 'state with invariant'}`,
              `  4. ${isML ? 'BACKPROPAGATE' : 'UPDATE'}: Update ${isML ? 'parameters using gradients' : 'system state'}`,
              `  5. REPEAT: Until ${isML ? 'convergence' : 'termination'}`,
              ``,
              `COST: ${defaultComplexity}`,
              `\`\`\``,
              ``,
              `---`,
              ``,
              `## 📐 4. Mathematical Analysis`,
              ``,
              isML ?
                `**Optimization Logic:**
- Objective: Minimize $J(\theta)$
- Gradient: $\nabla J(\theta)$
- Update: $\theta = \theta - \alpha \nabla J(\theta)$` :
                isMath ?
                  `**Axiomatic Basis:**
- Property 1: Linearity
- Property 2: Convergence
- Property 3: Uniqueness` :
                  `**Recurrence Relation:**
\`T(n) = 2T(n/2) + O(n)\` (if applicable)
**Loop Invariant Proof:**
- Initialization → Maintenance → Termination`,
              ``,
              `---`,
              ``,
              `## 🆚 5. Comparison with Alternatives`,
              ``,
              `| Metric | ${T} | Alternative A | Alternative B |`,
              `|--------|------|---------------|---------------|`,
              `| ${complexityLabel} | ${defaultComplexity} | Variable | Fixed |`,
              `| Output | ✅ Optimal | ⚠️ Approx | ❌ Manual |`,
              `| Scalability | ✅ High | ❌ Low | ⚠️ Medium |`,
              ``,
              `---`,
              ``,
              `## 🎯 6. GATE + B.Tech Exam Strategy`,
              ``,
              `### What 2-mark questions test:`,
              `- Time/space complexity identification`,
              `- True/false about properties`,
              `- Correct output for small input`,
              ``,
              `### What 10-mark questions test:`,
              `- Full algorithm + trace on given input`,
              `- Complexity derivation with proof`,
              `- Comparison with at least one alternative`,
              ``,
              `### What 12-mark questions test:`,
              `- Real-world application design`,
              `- Modification of algorithm for constraints`,
              `- Handling edge cases explicitly`,
              ``,
              `**The perfect 12-mark answer structure:**`,
              `\`(1) Define [2 lines] → (2) Example [1 line] → (3) Algorithm [pseudocode] → (4) Trace [on given input] → (5) Complexity [derive] → (6) Application [1 paragraph]\``,
              ``,
              `---`,
              ``,
              `## ⚠️ 7. Common Errors & Trap Questions`,
              ``,
              `- ❌ Stating O(n log n) without deriving — always derive or reference recurrence`,
              `- ❌ Missing base case in recursive version — always state T(1) = O(1)`,
              `- ❌ Confusing ${T} with similar algorithms — know the 3 key differences`,
              `- ❌ Not labeling diagram axes or states — costs 2 marks in B.Tech`,
              `- ❌ Forgetting to state termination proof — required for correctness proof`,
              ``,
              `**GATE Trap:** "Which of the following is NOT a property of ${T}?"`,
              `→ Correct answer almost always targets: commutativity, optimality, or space bounds`,
              ``,
              `---`,
              ``,
              `## 💡 8. Memory Tricks`,
              ``,
              `**Mnemonic "${initials}":**`,
              `- Each letter = one property or step of ${T}`,
              ``,
              `**Analogy:** ${T} works like an airport security system — every passenger (input) goes through the same sequence of checks (algorithm steps) without shortcuts.`,
              ``,
              `**Flashcard (front):** What is the worst-case time complexity of ${T}?`,
              `**Flashcard (back):** O(n²) — occurs when [specific input pattern, e.g., reverse-sorted]`,
              ``,
              `---`,
              ``,
              `## ✅ 9. Last-Minute Revision`,
              ``,
              `✦ **One liner:** ${T} solves [type] problems in ${S} in O(n log n) avg via [key mechanism]`,
              `✦ **3 properties:** Correctness · Efficiency · Finiteness`,
              `✦ **GATE tip:** Recurrence + Master Theorem for complexity`,
              `✦ **B.Tech tip:** Define → Algorithm → Diagram → Trace → Proof → Application`,
              `✦ **Edge cases:** Empty input, single element, duplicates, max N`,
              ``,
              `---`,
              `*🤖 SYNAPSE Deep Academic Notes · ${dateStr} · Monday Full-Depth Mode*`
            ].join('\n');

            // ── Style 2: Tuesday — Socratic Q&A Dialogue ───────────────────────
            const style2 = [
              `# 💬 Socratic Learning Session: ${T}`,
              `**Format:** Q&A Dialogue  |  **Subject:** ${S}  |  **Date:** ${dateStr}`,
              ``,
              `> 🗣️ *The Socratic method: learn through questions, not answers.*`,
              ``,
              `---`,
              ``,
              `## 🤔 Round 1: The Basics`,
              ``,
              `**SYNAPSE asks:** What is ${T}?`,
              `**You should answer:** ${T} is [formal definition in ${S}] that achieves [goal] by [mechanism].`,
              `**SYNAPSE evaluates:** ✅ Include: definition, mechanism, goal. ❌ Don't just say "it's an algorithm."`,
              ``,
              `**SYNAPSE asks:** Why do we need ${T} specifically?`,
              `**You should answer:** Without ${T}, we'd have to use [alternative] which is [limitation]. ${T} solves this by [key improvement].`,
              `**Trap:** Don't say "because it's fast" — be specific about WHAT is faster and WHY.`,
              ``,
              `**SYNAPSE asks:** Can you give a real example of ${T} being used?`,
              `**You should answer:** Yes — [specific real-world system] uses ${T} to [specific function]. For example, [database/OS/network] applies this when [scenario].`,
              ``,
              `---`,
              ``,
              `## 🔍 Round 2: Going Deeper`,
              ``,
              `**SYNAPSE asks:** What happens step by step when ${T} runs?`,
              `**You should answer (trace this):**`,
              `\`\`\``,
              `Input: [example input]`,
              `Step 1: Initialize → State = [start]`,
              `Step 2: Apply core op → State changes to [intermediate]`,
              `Step 3: Check condition → [True/False]?`,
              `Step 4: Update → State = [new state]`,
              `Step 5: Terminate → Output = [result]`,
              `\`\`\``,
              ``,
              `**SYNAPSE asks:** How do you prove ${T} is correct?`,
              `**You should answer:** By proving three things:`,
              `1. **Invariant holds initially** — Before first iteration, [invariant] is true`,
              `2. **Invariant maintained** — If it holds at step k, it holds at step k+1`,
              `3. **Termination gives answer** — When loop exits, invariant implies correctness`,
              ``,
              `**SYNAPSE asks:** What is the time complexity and can you DERIVE it?`,
              `**You should answer:**`,
              isML ? `- Focus on Epochs: O(epochs × samples × dimensions)` :
                isMath ? `- Focus on Convergence: O(1/ε) or O(n)` :
                  isDBMS ? `- Focus on I/O: O(log_f n) where f is the fan-out of the B+ Tree` :
                    `- If recursive: T(n) = 2T(n/2) + O(n) → By Master Theorem Case 2 → **O(n log n)**`,
              isCS ? `- If iterative: Count iterations × work per iteration → O(n) × O(log n) = **O(n log n)**` : `- Derived from the logic of ${coreMechanism}.`,
              ``,
              `---`,
              ``,
              `## ⚔️ Round 3: Hard GATE-Level Questions`,
              ``,
              `**SYNAPSE asks:** What is the best-case scenario for ${T}? When does it occur?`,
              `**Expected answer:** Best case O(?) occurs when [specific input condition]. This is because [mechanism avoids which step].`,
              ``,
              `**SYNAPSE asks:** How does ${T} behave on already-sorted input?`,
              `**Expected answer:** [Explain specifically — some algorithms degrade on sorted input, others improve].`,
              ``,
              `**SYNAPSE asks:** If we modify ${T} to handle [constraint], what changes?`,
              `**Expected answer:** The [phase/step] must be modified to [handle constraint]. Time complexity becomes [new complexity] because [reason].`,
              ``,
              `**SYNAPSE asks:** True or False: ${T} always produces an optimal output.`,
              `**Expected answer:** [True/False depending on topic] — The correct answer is [X] because [formal reason]. A counterexample would be [specific case].`,
              ``,
              `---`,
              ``,
              `## 📋 Round 4: Application Design`,
              ``,
              `**SYNAPSE asks:** Design a system that uses ${T} to solve [real-world problem].`,
              `**You should include:**`,
              `1. Problem statement: [clearly define what needs solving]`,
              `2. How ${T} applies: [map problem components to algorithm components]`,
              `3. Time/space analysis: [analyze your specific design]`,
              `4. Edge cases: [list what breaks and how you handle it]`,
              `5. Optimization opportunities: [where can you improve further]`,
              ``,
              `---`,
              ``,
              `## 🏆 SYNAPSE Scoring Rubric`,
              ``,
              `| Skill | Beginner | Intermediate | Expert |`,
              `|-------|---------|-------------|--------|`,
              `| Definition | Can recite | Can explain | Can derive from first principles |`,
              `| Algorithm | Knows steps | Can trace | Can prove correctness |`,
              `| Complexity | Knows answer | Can calculate | Can derive + tighten bounds |`,
              `| Application | Generic examples | Domain-specific | Novel design |`,
              `| Comparison | Lists options | Explains tradeoffs | Quantifies with proof |`,
              ``,
              `**Your current target level: ${lvl === 'beginner' ? 'Beginner → Intermediate' : lvl === 'intermediate' ? 'Intermediate → Expert' : 'Expert: Validation Mode'}**`,
              ``,
              `---`,
              `*🤖 SYNAPSE Socratic Engine · ${dateStr} · Tuesday Q&A Mode*`
            ].join('\n');

            // ── Style 3: Wednesday — Cornell Notes Format ───────────────────────
            const style3 = [
              `# 📓 Cornell Notes: ${T}`,
              `**Format:** Cornell Note-Taking System  |  **Subject:** ${S}  |  **Date:** ${dateStr}`,
              ``,
              `---`,
              ``,
              `┌─────────────────────────────────────────────────────────┐`,
              `│  TOPIC: ${T} · ${S} · ${dateStr}                        │`,
              `└─────────────────────────────────────────────────────────┘`,
              ``,
              `## 📝 Notes Column (Main Content)`,
              ``,
              `**Core definition:**`,
              `${T} is the [type] method in ${S} for [operation]. Key invariant: [core property maintained throughout].`,
              ``,
              `**Algorithm steps:**`,
              `- Step 1: Initialize data structures and set boundaries`,
              `- Step 2: Apply primary comparison/selection criterion`,
              `- Step 3: Execute core operation (swap/merge/recurse/update)`,
              `- Step 4: Update pointers/indices/state`,
              `- Step 5: Check termination → If not done, goto Step 2`,
              `- Step 6: Post-process and return validated output`,
              ``,
              `**Worked example:**`,
              `\`\`\``,
              isML ?
                `State: w=[1.0, 0.5], η=0.1, x=[2.0, 1.0], y=1.0\nPred:  z = (1*2 + 0.5*1) = 2.5\nError: (2.5 - 1.0) = 1.5\nUpdate: w_new = w - (η * error * x)\n      = [1.0, 0.5] - (0.1 * 1.5 * [2, 1])\nFinal: w=[0.7, 0.35] (Loss reduced)` :
                isMath ?
                  `Function: f(x) = x², Range [0,2], n=2\nΔx = (2-0)/2 = 1.0\nStep 1: x=0, f(x)=0\nStep 2: x=1, f(x)=1\nStep 3: Sum = (0*1) + (1*1) = 1.0\nFinal:  Result ≈ 1.0 (Riemann Approximation)` :
                  isDBMS ?
                    `Input: Table R(Student, Course, Instructor, Phone)\nStep 1: FD Student→Course detected.\nStep 2: FD Instructor→Phone (Transitive) detected.\nStep 3: Split into R1(Stud, Course) and R2(Inst, Phone).\nFinal:  BCNF Form achieved (No redundancies).` :
                    `Input:  [5, 3, 8, 1, 9, 2]     ← sample input\nPass 1: [3, 5, 8, 1, 9, 2]     ← first operation\nPass 2: [3, 5, 1, 8, 9, 2]     ← second operation\nPass 3: [1, 3, 5, 8, 2, 9]     ← third operation  \nFinal:  [1, 2, 3, 5, 8, 9]     ← output (correct)`,
              `\`\`\``,
              ``,
              `**Complexity analysis:**`,
              `- Best:    ${isML ? 'O(n' : isMath ? 'O(1' : isDBMS ? 'O(1' : 'O(n'} log n) — when ${isML ? 'loss is zero' : isMath ? 'base case reached' : isDBMS ? 'indexed' : 'ideal input'}`,
              `- Average: ${defaultComplexity} — derived from ${isCS ? 'T(n) = 2T(n/2) + O(n)' : isML ? 'stochastic passes' : isDBMS ? 'height of tree' : 'limit theory'}`,
              `- Worst:   ${isML ? 'O(epochs × n × d)' : isCS ? 'O(n²)' : isDBMS ? 'O(n)' : 'O(n²)'} — when ${isCS ? 'input is reverse-sorted' : isDBMS ? 'scanned sequentially' : 'convergence fails'}`,
              `- Space:   ${isML ? 'O(parameters)' : 'O(n)'} auxiliary space requirements`,
              ``,
              `**Important properties (for MCQs):**`,
              `- Stability: [Yes/No] — [what this means for equal elements]`,
              `- In-place: [Yes/No] — [what this means for memory]`,
              `- Adaptive: [Yes/No] — [whether it speeds up on sorted input]`,
              `- Online: [Yes/No] — [whether it can process streaming input]`,
              ``,
              `---`,
              `## 🔑 Cue Column (Key Questions for Recall)`,
              ``,
              `Q: Define ${T} formally.`,
              `Q: What is the recurrence relation?`,
              `Q: Best/avg/worst case complexity?`,
              `Q: When does worst case occur?`,
              `Q: Is it stable? In-place? Adaptive?`,
              `Q: How does it differ from [closest alternative]?`,
              `Q: Prove correctness using loop invariant.`,
              `Q: How to handle duplicate elements?`,
              `Q: What breaks when input is empty?`,
              `Q: Real-world application in ${S}?`,
              ``,
              `---`,
              `## 📋 Summary Box (Bottom of Page)`,
              ``,
              `> ${T} is the [adjective] method in ${S} that achieves [output] in O(n log n) average time by [mechanism]. Its key advantage over alternatives is [specific benefit]. Critical exam points: [3 things to always state] — definition, complexity derivation, edge case handling.`,
              ``,
              `---`,
              `## ✅ Self-Test Before Closing`,
              ``,
              `Cover notes column. Only look at cue column. Answer each question aloud or in writing.`,
              `Score yourself: ≥8/10 = Ready | 6-7/10 = Review complexity | <6 = Re-read from scratch`,
              ``,
              `---`,
              `*🤖 SYNAPSE Cornell Notes Engine · ${dateStr} · Wednesday Deep Format*`
            ].join('\n');

            // ── Style 4: Thursday — Narrative Story Format ──────────────────────
            const style4 = [
              `# 📖 The Story of ${T}`,
              `**Format:** Narrative Learning  |  **Subject:** ${S}  |  **Date:** ${dateStr}`,
              ``,
              `> *"The best way to understand a problem is to live through its solution."*`,
              ``,
              `---`,
              ``,
              `## 🌍 Chapter 1: The Problem That Started It All`,
              ``,
              `Imagine you're a computer scientist in the early days of ${S}. Computers are just becoming powerful enough to handle real problems — but there's a catch. Nobody knows the *right* way to solve [the class of problems ${T} addresses].`,
              ``,
              `The naive approach works for tiny inputs of size 5 or 10. But the moment your input grows to 1,000 or 1,000,000 items, the brute-force method takes hours. Days. Weeks. This is unacceptable.`,
              ``,
              `Someone needs to find a smarter way. That's where **${T}** enters the story.`,
              ``,
              `---`,
              ``,
              `## 💡 Chapter 2: The Insight That Changed Everything`,
              ``,
              `The key insight behind ${T} is both simple and profound:`,
              ``,
              `*"Instead of trying to solve the whole problem at once, what if we [core insight — e.g., divide it in half, process greedily, build from sub-solutions]?"*`,
              ``,
              `This realization unlocks everything. Instead of O(n²) steps, we suddenly need only O(n log n). For a million items, that's the difference between a 1-trillion-step computation and a 20-million-step one. That's **50,000× faster**.`,
              ``,
              `The algorithm that embodies this insight is ${T}.`,
              ``,
              `---`,
              ``,
              `## ⚙️ Chapter 3: The Step-by-Step Journey`,
              ``,
              `Let's trace what actually happens when **${T}** runs on sample input:`,
              ``,
              isML ?
                `**The journey begins:** "I see these feature vectors. Let me start by initializing the weight matrix."\n\`State: w=[1.0, 0.5] → after forward pass: z=2.5\`\n\n**It continues:** "Loss detected. Backpropagating the error to update gradients."\n\`State: grad=-0.15 → after update: w=[1.015, 0.515]\`` :
                isMath ?
                  `**The journey begins:** "We define the function $f(x)$ over the range. Let's start the first derivation."\n\`State: Stage 1 → Derivative found: f'(x)\`\n\n**It continues:** "Applying the core theorem to find the critical points."\n\`State: Stage 2 → Roots identified: x=0, x=1\`` :
                  isDBMS ?
                    `**The journey begins:** "The table has redundant data. Let's find the functional dependencies."\n\`State: R(A,B,C,D) → FD: A→B detected\`\n\n**It continues:** "Decomposing to reach 3NF or BCNF compliance."\n\`State: Split → R1(A,B), R2(A,C,D)\`` :
                    `**The journey begins:** "I see 4 items. Let me start by [first operation]."\n\`State: [5, 3, 8, 1] → after step 1: [3, 5, 8, 1]\`\n\n**It continues:** "Good. Now I've handled [sub-problem]. Next: [next operation]."\n\`State: [3, 5, 8, 1] → after step 2: [3, 5, 1, 8]\``,
              ``,
              `**Near the end:** "I can see the structure forming. The invariant holds: ${primaryInvariant}. One more pass..."`,
              `**Done:** "Convergence achieved. The logic guarantees correctness. Final result returned."`,
              ``,
              `---`,
              ``,
              `## 🧠 Chapter 4: Why It Works — The Mathematical Truth`,
              ``,
              `The reason ${T} can guarantee correctness isn't magic — it's mathematics.`,
              ``,
              `At every step, the algorithm maintains a **loop invariant** — a property that is always true. Before step 1, it's trivially true. After each step, if it was true before, it remains true. When the loop ends, the invariant *directly tells us* the output is correct.`,
              ``,
              `And the complexity? Think of it this way:`,
              `- If ${T} divides the problem in half each time → T(n) = 2T(n/2) + O(n)`,
              `- If it processes one element per step → T(n) = T(n-1) + O(1)`,
              `- **Master Theorem resolves both** → O(n log n) or O(n²) respectively`,
              ``,
              `---`,
              ``,
              `## 🌐 Chapter 5: ${T} in the Real World`,
              ``,
              `Today, ${T} is used everywhere:`,
              `- **Search engines** use variants of ${T} to rank millions of results in milliseconds`,
              `- **Databases** apply ${T} internally whenever you run ORDER BY on millions of rows`,
              `- **Operating systems** use ${T} in their scheduler to manage process priorities`,
              `- **Compilers** use ${T} when building symbol tables and resolving dependencies`,
              ``,
              `Every time you use a smartphone, open a file, or run a website query — somewhere in the system, something like ${T} is running.`,
              ``,
              `---`,
              ``,
              `## 📝 The Exam Chapter (Don't Skip This)`,
              ``,
              `When GATE or your university examiner asks about ${T}, they want:`,
              ``,
              `1. **The story in one line:** "${T} is [definition]."`,
              `2. **The algorithm:**`,
              `\`\`\``,
              `ALGORITHM ${initials}(input):`,
              `  Initialize → Apply → Check → Update → Return`,
              `\`\`\``,
              `3. **The proof:** Loop invariant holds initially, maintained iteratively, termination gives result`,
              `4. **The complexity:** Derive using recurrence or counting argument — never just state`,
              `5. **The comparison:** ${T} vs alternative — 3 key differences with complexity numbers`,
              ``,
              `---`,
              `*🤖 SYNAPSE Narrative Engine · ${dateStr} · Thursday Story Mode*`
            ].join('\n');

            // ── Style 5: Friday — Visual Mind Map Text Format ───────────────────
            const style5 = [
              `# 🗺️ Mind Map: ${T}`,
              `**Format:** Visual Mind Map  |  **Subject:** ${S}  |  **Date:** ${dateStr}`,
              ``,
              `---`,
              ``,
              `## 🌟 Central Node: ${T}`,
              ``,
              `\`\`\``,
              `                    ┌─────────────────────────┐`,
              `                    │        ${T.substring(0, 20).padEnd(20)}   │`,
              `                    │   Core concept in ${S.substring(0, 8)}   │`,
              `                    └────────────┬────────────┘`,
              `                                 │`,
              `       ┌─────────────────────────┼─────────────────────────┐`,
              `       │                         │                         │`,
              `  ┌────▼────┐            ┌───────▼──────┐           ┌──────▼──────┐`,
              `  │DEFINITION│            │  ${isML ? 'PROCESS' : 'ALGORITHM'}   │           │ COMPLEXITY  │`,
              `  └────┬────┘            └───────┬──────┘           └──────┬──────┘`,
              `       │                         │                         │`,
              `  ┌────▼────────┐        ┌───────▼──────┐           ┌──────▼──────┐`,
              `  │Formal defn  │        │Init→Process  │           │${isML ? 'O(epochs)' : isDBMS ? 'O(log_f n)' : 'Best:O(log n)'} │`,
              `  │Properties   │        │Check→Converge│           │${defaultComplexity.padEnd(12)} │`,
              `  │Examples     │        │Return output │           │${isCS ? 'Worst:O(n²)' : '            '} │`,
              `  └─────────────┘        └──────────────┘           └─────────────┘`,
              `\`\`\``,
              ``,
              `---`,
              ``,
              `## 🔵 Branch 1: DEFINITION`,
              ``,
              `- **Core meaning:** Systematic method for [operation] in ${S}`,
              `- **Formal:** ${T} = procedure satisfying [correctness + efficiency + finiteness]`,
              `- **Key terms to know:**`,
              `  - *Invariant* → property maintained throughout execution`,
              `  - *Termination* → guaranteed halt in finite steps`,
              `  - *Optimality* → output cannot be improved without violating constraints`,
              ``,
              `- **One-sentence definition for exams:**`,
              `  "${T} is a [type] algorithm in ${S} that achieves [goal] through [mechanism] with ${defaultComplexity} average-case complexity."`,
              ``,
              `---`,
              ``,
              `## 🟢 Branch 2: ${isML ? 'SYSTEM FLOW' : 'ALGORITHM FLOW'}`,
              ``,
              `\`\`\``,
              `[INPUT] ──→ [INITIALIZE] ──→ [${isML ? 'FORWARD PASS' : 'APPLY CORE OP'}] ──→ [${isML ? 'CHECK LOSS' : 'CHECK CONDITION'}]`,
              `                                     ↑                    │`,
              `                                     │              [Continue?]`,
              `                                     │              /        \\`,
              `                                [${isML ? 'BACKPROP' : 'UPDATE'}] ←── [YES]       [NO] ──→ [OUTPUT]`,
              `\`\`\``,
              ``,
              `**Step-by-step:**`,
              `- **INITIALIZE:** Set pointers, allocate memory, or initialize weights/parameters.`,
              `- **EXECUTE:** ${isML ? 'Propagate input through the network to compute error.' : 'Apply the core transformation property of ' + T + '.'}`,
              `- **VERIFY:** Termination test or Convergence check — is the target state reached?`,
              `- **UPDATE:** Prepare state or update parameters for the next iteration.`,
              `- **OUTPUT:** Return guaranteed-correct result / optimized model.`,
              ``,
              `---`,
              ``,
              `## 🔴 Branch 3: COMPLEXITY MAP`,
              ``,
              `\`\`\``,
              `COMPLEXITY TREE:`,
              `│`,
              `├─ ${isML ? 'TRAINING' : 'TIME'}`,
              `│   ├─ Best:    ${isML ? 'O(n)' : isMath ? 'O(1)' : 'O(log n)'}  → typical ideal case`,
              `│   ├─ Average: ${defaultComplexity} → expected workload`,
              `│   └─ Worst:   ${isCS ? 'O(n²)' : isDBMS ? 'O(n)' : isML ? 'O(e × n)' : 'Divergent'} → failure/unbound case`,
              `│`,
              `└─ SPACE`,
              `    ├─ Memory:  ${isML ? 'O(weights)' : 'O(log n)'}  → footprint`,
              `    ├─ Aux:     ${isML ? 'O(gradients)' : 'O(n)'}  → temporary storage`,
              `    └─ In-place: ${isCS ? 'O(1)' : 'N/A'}`,
              `\`\`\``,
              ``,
              `**Derivation method:** ${isCS ? 'T(n) = 2T(n/2) + O(n) via Master Theorem' : isML ? 'Summation over epochs and datasets' : isDBMS ? 'Tree depth h = log_f(n)' : 'Formal limit proof'}.`,
              ``,
              `---`,
              ``,
              `## 🟡 Branch 4: CONNECTIONS & RELATIONSHIPS`,
              ``,
              `\`\`\``,
              `${T}`,
              `    │`,
              `    ├── BUILDS ON ──────→ [prerequisite core concept]`,
              `    ├── SIMILAR TO ──────→ [closest sibling method]`,
              `    ├── BETTER THAN ─────→ Brute Force by ${isCS ? 'n/log n' : 'significant orders'}`,
              `    ├── WORSE THAN ──────→ [specific scenario where alternative wins]`,
              `    ├── USED IN ─────────→ ${isDBMS ? 'B-Trees, SQL' : isML ? 'Neural Nets, AI' : 'Operating Systems'}`,
              `    └── APPLIED WITH ────→ [commonly paired techniques]`,
              `\`\`\``,
              ``,
              `---`,
              ``,
              `## 🟣 Branch 5: EXAM HOT SPOTS`,
              ``,
              `- ⚡ **Most tested:** Complexity derivation + trace on domain input`,
              `- ⚡ **Trick questions:** ${isML ? 'Overfitting vs Convergence' : isDBMS ? 'Consistency vs Latency' : 'Stability and In-place status'}`,
              `- ⚡ **Application:** Design a system using ${T} — always include targeted diagram`,
              `- ⚡ **Proof:** First-principles logic is required for analytical questions`,
              ``,
              `**Quick formula sheet:**`,
              `\`\`\``,
              isML ? `Loss Function: J(θ) = (1/2m) Σ(h(x) - y)²\nGradient: ∂J/∂θ = (1/m) Σ(h(x) - y)x\nUpdate: θ = θ - α(∂J/∂θ)` :
                isDBMS ? `B+ Tree Height: h ≤ log_f((n+1)/2)\nFan-out (f): block_size / (key_size + ptr_size)\nI/O Cost: h * Disk Latency` :
                  `Master Theorem: T(n) = aT(n/b) + f(n)
  Case 1: f(n) = O(n^log_b(a) / n^ε) → T(n) = Θ(n^log_b(a))
  Case 2: f(n) = Θ(n^log_b(a))        → T(n) = Θ(n^log_b(a) · log n)
  Case 3: f(n) = Ω(n^log_b(a) · n^ε)  → T(n) = Θ(f(n))`,
              `\`\`\``,
              ``,
              `---`,
              `*🤖 SYNAPSE Mind Map Engine · ${dateStr} · Friday Visual Mode*`
            ].join('\n');

            // ── Style 6: Saturday — Exam Attack Sheet ───────────────────────────
            const style6 = [
              `# ⚔️ EXAM ATTACK SHEET: ${T}`,
              `**Format:** Rapid Exam Preparation  |  **Subject:** ${S}  |  **Date:** ${dateStr}`,
              ``,
              `> 🎯 *This sheet is designed for maximum exam impact in minimum time.*`,
              ``,
              `---`,
              ``,
              `## 🚀 THE 60-SECOND BRIEF`,
              ``,
              `| | |`,
              `|--|--|`,
              `| **What** | ${T} = [type] method for [operation] in ${S} |`,
              `| **Why** | Needed because [naive approach fails at scale] |`,
              `| **How** | Init → Apply → Check → Update → Return |`,
              `| **Result** | O(n log n) average · O(n²) worst case |`,
              `| **Magic** | Maintains [invariant] at every step |`,
              ``,
              `---`,
              ``,
              `## 🎯 GUARANTEED EXAM QUESTIONS (with ideal answers)`,
              ``,
              `**Q1 [2 marks] Define ${T}.**`,
              `→ "${T} is a [type] procedure in ${S} that [operation] by [mechanism], achieving [property] in O(n log n) average time."`,
              ``,
              `**Q2 [2 marks] State the time complexity of ${T} in all cases.**`,
              `→ Best: O(n log n) | Average: O(n log n) | Worst: O(n²)`,
              `→ Space: O(n) auxiliary, O(log n) stack`,
              ``,
              `**Q3 [4 marks] ${isML ? 'State the update rule and derive its impact.' : isMath ? 'State the core theorem and its proof logic.' : isDBMS ? 'Explain the normalization dependency and its solution.' : 'Give the recurrence relation and solve it.'}**`,
              isML ? `→ θ = θ - η * ∇J(θ) (Gradient Descent Update)\n→ Impact: Moves parameter vector towards global minimum by following steepest descent.` :
                isMath ? `→ If f is continuous on [a,b], then [Theorem State].\n→ Proof: By induction / contradiction in the domain of Real Analysis.` :
                  isDBMS ? `→ Dependency: Transitive functional dependency (A→B, B→C).\n→ Solution: Decompose into R1(A,B) and R2(B,C) to maintain 3NF.` :
                    `→ T(n) = 2T(n/2) + O(n)\n→ By Master Theorem (Case 2): a=2, b=2, f(n)=O(n)=O(n^log₂2)\n→ Since f(n) = Θ(n^log₂2), we apply Case 2 → **T(n) = O(n log n)**`,
              ``,
              `**Q4 [6 marks] Trace ${T} on sample input.**`,
              isML ? `→ Input: [θ=10, η=0.1, grad=0.5]. Trace: [θ_1=9.95, θ_2=9.90...]\n→ Goal: Identify weight stability / convergence point.` :
                isMath ? `→ Input: Range [0, π], n=3 divisions. Trace: [x_1=π/3, x_2=2π/3...]\n→ Goal: Calculate the definite value / proof step.` :
                  isDBMS ? `→ Input: Relation R with attributes {${initials}}. Trace: [1NF → 2NF → 3NF].\n→ Goal: Eliminate redundant anomalies and ensure data integrity.` :
                    `→ Input: [8, 3, 1, 5, 2, 7, 4, 6]. Trace: [Swap(8,3) → Merge([3,8], [1,5])...]\n→ Goal: Achieve sorted state in O(n log n) time.`,
              ``,
              `**Q5 [10 marks] Compare ${T} with its alternatives.**`,
              `→ Use a structured comparison table (see Section 5 of structured notes)`,
              `→ Cover: time, space, stability, in-place property, use case`,
              `→ Conclude: "For [scenario], ${T} is preferred because [specific reason]."`,
              ``,
              `**Q6 [12 marks] Design a real-world application using ${T}.**`,
              `→ Use answer structure: Problem → Model → Algorithm → Analysis → Optimization`,
              `→ Include a diagram if the question allows (it does — always assume it does)`,
              `→ Explicitly handle edge cases: empty input, duplicates, overflow, large n`,
              ``,
              `---`,
              ``,
              `## 🔴 THE DO-NOT-FORGET LIST`,
              ``,
              `- ❌ Never say "it's O(n log n)" without deriving or citing recurrence`,
              `- ❌ Never skip base case in recursive complexity analysis`,
              `- ❌ Never forget loop invariant when proving correctness`,
              `- ❌ Never draw a diagram without labeling all states and transitions`,
              `- ❌ Never compare without covering: time + space + correctness + use case`,
              ``,
              `---`,
              ``,
              `## 🟢 THE DO-NOT-MISS LIST`,
              ``,
              `- ✅ State preconditions (valid input) and postconditions (correct output)`,
              `- ✅ Mention stability and in-place status in every comparison`,
              `- ✅ Include at least ONE real-world example in any 5+ mark answer`,
              `- ✅ When asked "which is better" → always give conditions, never absolute`,
              `- ✅ End 12-mark answers with a complexity-time tradeoff statement`,
              ``,
              `---`,
              ``,
              `## 🧠 LAST 5 MINUTES BEFORE EXAM`,
              ``,
              `✦ **Say this aloud:** "${T} is [definition]. It runs in [complexity]. It works by [key mechanism]."`,
              `✦ **Recall:** What makes ${T} different from [alternative]? → [3 differences]`,
              `✦ **Invariant:** The loop invariant of ${T} is: "[specific invariant statement]"`,
              `✦ **Mnemonic:** "${initials}" = [one word per letter that triggers each concept]`,
              `✦ **Mental image:** ${T} looks like [analogy] — a [system] that [what it does] step by step`,
              ``,
              `---`,
              `## 📊 MARK DISTRIBUTION PREDICTION`,
              ``,
              `| Question Type | Expected Marks | Prep Priority |`,
              `|--------------|----------------|--------------|`,
              `| Definition + property | 2-3 | 🟡 Medium |`,
              `| Algorithm trace | 4-6 | 🔴 HIGH |`,
              `| Complexity derivation | 4-6 | 🔴 HIGH |`,
              `| Comparison table | 6-8 | 🔴 HIGH |`,
              `| Application design | 10-12 | 🔴 CRITICAL |`,
              `| Correctness proof | 6-8 | 🟡 Medium |`,
              ``,
              `---`,
              `*🤖 SYNAPSE Exam Attack Engine · ${dateStr} · Saturday Sprint Mode*`
            ].join('\n');

            const styles = [style0, style1, style2, style3, style4, style5, style6];
            return styles[dayOfWeek];
          })(),
          flashcards: (() => {
            const T = topic.topic;
            const S = topic.subject;
            return [
              { question: `What is the core definition of ${T}?`, answer: `${T} is a systematic method in ${S} that transforms input via formal rules to produce an optimal output.` },
              { question: `What is the average case time complexity?`, answer: `O(n log n) — typically derived using Master Theorem Case 2 from the recurrence T(n) = 2T(n/2) + O(n).` },
              { question: `Name one key advantage of ${T} over brute force.`, answer: `Scalability. For large datasets, ${T} reduces steps by a factor of n/log n (e.g., 50,000x faster for 1M items).` },
              { question: `What is a loop invariant in context of ${T}?`, answer: `A property that holds true before, during, and after each iteration, ensuring mathematical correctness upon termination.` },
              { question: `Where is ${T} applied in real-world systems?`, answer: `Search engines (ranking), Databases (indexing/sorting), OS (scheduling), and Network Routing.` }
            ];
          })()
        }
      };
    });

    return {
      resource_recommendations: recommendations,
      learning_strategy_note: params.past_performance.score < 60
        ? "Performance trend indicates foundational gaps. I've prioritized concept clarity over volume."
        : "Strong performance detected. Recommendation focuses on high-difficulty synthesis and exam scoring efficiency.",
      estimated_total_time_minutes: params.time_available_minutes
    };
  }
}

/**
 * Agent 1: Ask SYNAPSE (High-Intelligence Neuro-Core)
 * Uses local Ollama/Llama3 to answer follow-up questions about study topics.
 * Falls back to template responses only if Ollama is completely unreachable.
 */
export async function askSynapse(topic: string, subject: string, question: string, persona: string = "tutor"): Promise<{ answer: string; history?: any[] }> {
  const cacheKey = `synapse:chat:${topic}:${question}:${persona}`.toLowerCase().replace(/\s+/g, '_');
  const cached = getPersistentCache<{ answer: string; history: any[] }>(cacheKey);
  if (cached) return cached;

  try {
    const systemPrompt = buildSynapseSystem(topic, subject, persona);
    const answer = await callOllama(systemPrompt, question, 0.75);

    if (answer && answer.length > 10) {
      const result = {
        answer: `### 🧠 SYNAPSE: ${topic}\n\n${answer}\n\n---\n*Powered by Llama3 (Optimized Local AI)*`,
        history: [{ role: 'user', content: question }, { role: 'assistant', content: answer }]
      };
      setPersistentCache(cacheKey, result, 12);
      return result;
    }
  } catch (err: any) {
    console.warn("[SYNAPSE] Local core failed, trying backend...", err?.message);
  }


  // ── TIER 2: Try Supabase backend ────────────────────────────────────────
  try {
    const res = await fetch(`${API_BASE}/ai/agents/chat?persona=${persona}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ topic, subject, question })
    });
    if (res.ok) return res.json();
  } catch (err) {
    console.warn("[SYNAPSE] Backend also offline");
  }

  // ── TIER 3: Smart template fallback ─────────────────────────────────────
  console.warn("[SYNAPSE] All AI backends offline, using template fallback");
  const answer = buildTemplateFallback(topic, subject, question);
  return {
    answer,
    history: [{ role: 'user', content: question }, { role: 'assistant', content: answer }]
  };
}

/** Build the SYNAPSE system prompt based on persona */
function buildSynapseSystem(topic: string, subject: string, persona: string): string {
  const baseContext = `You are SYNAPSE, an elite academic AI tutor specialized in "${subject}".
The student is currently studying "${topic}" and asking you a follow-up question.

CRITICAL RULES:
- Give DETAILED, ACCURATE, and SPECIFIC answers about "${topic}" in "${subject}".
- Use proper academic terminology and include relevant formulas when applicable.
- Format your response in clean Markdown with headers, bold text, and bullet points.
- If the question involves math, include LaTeX-style notation using $ symbols.
- Include practical examples and exam tips when relevant.
- Be encouraging but intellectually rigorous.
- Keep responses CONCISE and well-structured (maximum 150-250 words) so they load instantly. Do not overwrite.`;

  const personaInstructions: Record<string, string> = {
    tutor: `\n\nPERSONA: Academic Tutor
- Explain concepts step-by-step as if teaching
- Use analogies and real-world examples
- Anticipate common misconceptions
- End with a "Key Takeaway" point`,

    examiner: `\n\nPERSONA: Exam Coach
- Focus on exam-relevant aspects
- Mention mark distribution and scoring tips
- Highlight what examiners look for
- Include model answer structure`,

    researcher: `\n\nPERSONA: Research Advisor
- Provide deep technical depth
- Reference key papers and theorems
- Discuss cutting-edge applications
- Connect to broader research areas`,

    socratic: `\n\nPERSONA: Socratic Guide
- Answer with guiding questions first
- Lead the student to discover the answer
- Build understanding layer by layer
- Challenge assumptions constructively`,
  };

  return baseContext + (personaInstructions[persona] || personaInstructions.tutor);
}

/** Template fallback when both Ollama and backend are offline */
function buildTemplateFallback(topic: string, subject: string, question: string): string {
  const q = question.toLowerCase();

  if (q.includes("what is") || q.includes("define") || q.includes("explain")) {
    return `### 📚 SYNAPSE: ${topic}\n\n**${topic}** is a fundamental concept in **${subject}**. It forms the basis for understanding more advanced topics in this field.\n\n**Key aspects:**\n- Core definition and theoretical foundation\n- Practical applications in real-world scenarios\n- Relationship with other concepts in ${subject}\n\n> 💡 **Tip:** Start by understanding the basic definition, then work through examples to build intuition.\n\n---\n*SYNAPSE is offline. Start Ollama for AI-powered answers: \`ollama serve\`*`;
  }

  if (q.includes("how") || q.includes("steps") || q.includes("process")) {
    return `### 🔧 SYNAPSE: How ${topic} Works\n\n**Step-by-step approach:**\n\n1. **Foundation** — Understand the prerequisites\n2. **Core Mechanism** — Learn the primary algorithm/process\n3. **Application** — Practice with worked examples\n4. **Mastery** — Solve problems independently\n\n> 📝 **Exam tip:** Always show your working and state any assumptions.\n\n---\n*SYNAPSE is offline. Start Ollama for AI-powered answers: \`ollama serve\`*`;
  }

  if (q.includes("proof") || q.includes("derive") || q.includes("prove")) {
    return `### 🧮 SYNAPSE: Derivation for ${topic}\n\nTo derive/prove properties of **${topic}**:\n\n1. **State the theorem** clearly\n2. **Identify given conditions** and constraints\n3. **Apply foundational axioms** step by step\n4. **Conclude** with QED or the final result\n\n> 🎯 **Mark scheme:** Full marks require clear logical flow and proper notation.\n\n---\n*SYNAPSE is offline. Start Ollama for AI-powered answers: \`ollama serve\`*`;
  }

  return `### 🧠 SYNAPSE: ${topic}\n\nThat's a great question about **${topic}** in **${subject}**!\n\nI can help you with:\n- 📐 **Definitions & Explanations**\n- 🧮 **Proofs & Derivations**\n- 💻 **Code & Implementations**\n- 🎯 **Exam Strategy & Tips**\n- 🔬 **Deep Dives & Research**\n\nPlease start Ollama for full AI-powered answers.\n\n---\n*SYNAPSE is offline. Run \`ollama serve\` to activate Llama3.*`;
}

/**
 * Retrieves past chat history for a specific topic.
 */
export async function getChatHistory(topic: string, subject: string): Promise<{ history: any[] }> {
  try {
    const res = await fetch(`${API_BASE}/ai/agents/chat-history?topic=${encodeURIComponent(topic)}&subject=${encodeURIComponent(subject)}`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    });
    if (res.ok) return res.json();
    return { history: [] };
  } catch (err) {
    return { history: [] };
  }
}
