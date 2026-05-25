// @ts-nocheck
/**
 * agentUtils.ts
 * Shared utilities for all AI agents.
 * - Calls local Ollama (http://localhost:11434) when available
 * - Falls back to deterministic mock generators when Ollama is offline
 * - No external API keys required
 */

const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = "llama3";
const OLLAMA_TIMEOUT_MS = 30000;

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini"; // Upgraded default model

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OllamaRequest {
    model: string;
    prompt: string;
    system?: string;
    stream: boolean;
    options?: {
        temperature?: number;
        top_p?: number;
        num_predict?: number;
    };
}

export interface AgentRunMeta {
    agentName: string;
    ranAt: string;
    usedOllama: boolean;
    durationMs: number;
}

// ─── Ollama Caller ────────────────────────────────────────────────────────────

/**
 * Attempts to call the locally-running Ollama instance.
 * Returns null if Ollama is offline or times out.
 */
export async function callOllama(
    systemPrompt: string,
    userPrompt: string,
    temperature = 0.7
): Promise<string> {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

        const body: OllamaRequest = {
            model: OLLAMA_MODEL,
            prompt: userPrompt,
            system: systemPrompt,
            stream: false,
            options: { temperature, top_p: 0.9, num_predict: 2048 },
        };

        console.log("Calling Ollama at http://localhost:11434");

        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
            console.error(`[AgentUtils] Ollama returned HTTP ${response.status}`);
            throw new Error(`Ollama returned HTTP ${response.status}`);
        }

        console.log("Ollama response received");

        const data = await response.json();
        const content = data?.response;

        if (!content || content.trim() === "" || content.includes("SYSTEM NOTE: Primaries offline")) {
            throw new Error("Invalid AI response detected");
        }

        return content;
    } catch (err: any) {
        console.error("Ollama failed:", err);
        throw new Error("AI backend unavailable.");
    }
}

/**
 * Calls OpenAI Chat Completions API.
 * Uses OPENAI_API_KEY from environment.
 */
export async function callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    temperature = 0.7
): Promise<string | null> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return null;

    try {
        const response = await fetch(OPENAI_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: Deno.env.get("OPENAI_MODEL") || OPENAI_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature,
            })
        });

        if (!response.ok) {
            console.warn(`[AgentUtils] OpenAI returned ${response.status}`);
            return null;
        }

        const data = await response.json();
        return data?.choices?.[0]?.message?.content ?? null;
    } catch (err) {
        console.warn("[AgentUtils] OpenAI error:", err.message);
        return null;
    }
}

/**
 * Check if Ollama is reachable (quick ping).
 */
export async function isOllamaAvailable(): Promise<boolean> {
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        const res = await fetch("http://localhost:11434/api/tags", {
            signal: controller.signal,
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ─── JSON Extractor ───────────────────────────────────────────────────────────

/**
 * Extracts the first valid JSON object or array from a raw LLM response string.
 * LLMs often wrap JSON in markdown code fences or add preamble text.
 */
export function extractJSON<T = any>(raw: string): T | null {
    // Try direct parse first
    try {
        return JSON.parse(raw.trim()) as T;
    } catch { }

    // Strip markdown code fences ```json ... ```
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        try {
            return JSON.parse(fenceMatch[1].trim()) as T;
        } catch { }
    }

    // Find the outermost { ... } block
    const objStart = raw.indexOf("{");
    const objEnd = raw.lastIndexOf("}");
    if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
        try {
            return JSON.parse(raw.slice(objStart, objEnd + 1)) as T;
        } catch { }
    }

    // Find the outermost [ ... ] block
    const arrStart = raw.indexOf("[");
    const arrEnd = raw.lastIndexOf("]");
    if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
        try {
            return JSON.parse(raw.slice(arrStart, arrEnd + 1)) as T;
        } catch { }
    }

    console.warn("[AgentUtils] Could not extract JSON from LLM response");
    return null;
}

// ─── ID Generator ─────────────────────────────────────────────────────────────

export function generateId(prefix = "id"): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
}

export function todayISO(): string {
    return new Date().toISOString().split("T")[0];
}

export function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// ─── Difficulty Helpers ───────────────────────────────────────────────────────

const LEVEL_BASE: Record<string, number> = {
    beginner: 2,
    intermediate: 5,
    advanced: 7,
};

export function getDifficultyBase(level: string): number {
    return LEVEL_BASE[level?.toLowerCase()] ?? 4;
}

/**
 * Clamp difficulty between 1 and 10.
 */
export function clampDifficulty(d: number): number {
    return Math.max(1, Math.min(10, Math.round(d)));
}

// ─── Agent Meta Helper ────────────────────────────────────────────────────────

export function buildMeta(
    agentName: string,
    usedOllama: boolean,
    startTime: number
): AgentRunMeta {
    return {
        agentName,
        ranAt: new Date().toISOString(),
        usedOllama,
        durationMs: Date.now() - startTime,
    };
}

// ─── Logging ──────────────────────────────────────────────────────────────────

export function agentLog(agentName: string, message: string, data?: any) {
    const prefix = `[${agentName}]`;
    if (data !== undefined) {
        console.log(prefix, message, JSON.stringify(data));
    } else {
        console.log(prefix, message);
    }
}
