/**
 * academicResourceIntelligence.ts — Agent 4: The Academic Resource Intelligence (ARIA)
 * 
 * ARIA is now a fully agentic, RAG-based research system.
 * It uses real-time DuckDuckGo searches, Ollama embeddings (nomic-embed-text),
 * and cosine similarity ranking to curate the best academic resources.
 */

import {
    callOllama,
    isOllamaAvailable,
    extractJSON,
    agentLog,
    buildMeta,
} from "./agentUtils.ts";
import { searchAcademicResources, SearchResult } from "./searchService.ts";
import { generateEmbedding } from "./embeddingService.ts";
import { rankBySimilarity } from "./vectorUtils.ts";
import * as kv from "../kv_store.tsx";

const AGENT_NAME = "ARIA";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface ARIAInput {
    subject: string;
    topic: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    weak_topics: string[];
    roadmap_stage: "foundation" | "core" | "applied" | "mastery" | "revision";
    xp_level: number;
    available_daily_hours: number;
}

export interface ARIAOutput {
    success: boolean;
    youtube: SearchResult[];
    pdf: SearchResult[];
    practice: SearchResult[];
    guide: SearchResult[];
    resource_recommendations: any[]; // Compatibility
    learning_strategy_note: string;  // Compatibility
    reasoning: string;
    meta: any;
}

/**
 * Main execution loop for ARIA Agent.
 */
export async function runARIA(input: ARIAInput, userId: string): Promise<ARIAOutput> {
    const startTime = Date.now();
    agentLog(AGENT_NAME, "Agent activated", { subject: input.subject, topic: input.topic });

    // 1. Check Cache
    const cacheKey = `aria:cache:${input.subject}:${input.topic}:${input.difficulty}`;
    const cached = await kv.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        agentLog(AGENT_NAME, "Serving from cache");
        return {
            ...cached.data,
            meta: buildMeta(AGENT_NAME, false, startTime)
        };
    }

    // 2. Decision Layer - Adjust Strategy
    const strategy = determineStrategy(input);
    agentLog(AGENT_NAME, "Strategy determined", strategy);

    // 3. Search Layer - Dynamic Discovery
    let results = await searchAcademicResources(input.subject, [input.topic, ...input.weak_topics], input.difficulty);

    if (results.length === 0) {
        return {
            success: false,
            youtube: [], pdf: [], practice: [], guide: [],
            resource_recommendations: [],
            learning_strategy_note: "No high-quality academic resources found for this topic.",
            reasoning: "No high-quality academic resources found for this topic. Please try refining your subject name or focus areas.",
            meta: buildMeta(AGENT_NAME, false, startTime)
        };
    }

    // 4. RAG Layer - Embedding + Ranking
    const rankedResources = await rankResources(input, results, strategy);

    // 5. LLM Curation - Context-Aware Formatting
    const finalSelection = await curateWithLLM(input, rankedResources, strategy);

    // 6. Memory - Store and Return
    const output: ARIAOutput = {
        success: true,
        ...finalSelection,
        resource_recommendations: [
            {
                subject: input.subject,
                topic: input.topic,
                recommended_resources: {
                    youtube_lecture: finalSelection.youtube[0] ? { title: finalSelection.youtube[0].title, url: finalSelection.youtube[0].url, creator: "Academic Source", reason: "Top selection" } : null,
                    pdf_notes: finalSelection.pdf[0] ? { title: finalSelection.pdf[0].title, url: finalSelection.pdf[0].url, source: "University Library" } : null,
                    practice_questions: finalSelection.practice[0] ? { url: finalSelection.practice[0].url, reason: "Practice exercises" } : null,
                    cheat_sheet_markdown: finalSelection.reasoning
                }
            }
        ],
        learning_strategy_note: finalSelection.reasoning,
        meta: buildMeta(AGENT_NAME, true, startTime)
    };

    await kv.set(cacheKey, { data: output, timestamp: Date.now() });

    return output;
}

/**
 * Decision Layer logic (Step 3).
 */
function determineStrategy(input: ARIAInput) {
    const strategy = {
        focus: "general",
        boost_beginner: input.xp_level < 30,
        boost_weak: input.weak_topics.length > 0,
        boost_practice: input.roadmap_stage === "revision",
        include_papers: input.difficulty === "advanced",
        volume: input.available_daily_hours >= 2 ? "high" : "low"
    };

    if (input.roadmap_stage === "foundation") strategy.focus = "basics";
    if (input.roadmap_stage === "mastery") strategy.focus = "expert";

    return strategy;
}

/**
 * Semantic ranking using embeddings (Step 2).
 */
async function rankResources(input: ARIAInput, results: SearchResult[], strategy: any): Promise<SearchResult[]> {
    const query = `${input.subject} ${input.topic} ${input.weak_topics?.join(" ") || ""}`;
    const queryEmbedding = await generateEmbedding(query);

    if (!queryEmbedding) return results; // Fallback to raw results if Ollama is down

    const resultEmbeddings = await Promise.all(
        results.map(r => generateEmbedding(`${r.title || ""} ${r.snippet || ""}`))
    );

    return rankBySimilarity(queryEmbedding, results, resultEmbeddings, input.difficulty);
}

/**
 * Final curation via Ollama (Step 4).
 */
async function curateWithLLM(input: ARIAInput, ranked: SearchResult[], strategy: any) {
    const systemPrompt = `You are ARIA (Academic Resource Intelligence Agent).
You are given a list of real academic resources retrieved for a student.
Your task is to curate the top 5 resources and provide a reasoning for your selection.

STUDENT CONTEXT:
- Subject: ${input.subject}
- Topic: ${input.topic}
- Difficulty: ${input.difficulty}
- Roadmap Stage: ${input.roadmap_stage}
- Daily Study Time: ${input.available_daily_hours} hours

INSTRUCTIONS:
- Justify why each resource is chosen based on the student's level and available time.
- If time is < 1 hour, prioritize short videos/guides.
- If time is >= 2 hours, prioritize full lectures or deep PDFs.
- Ensure the reasoning is unique and avoids generic templates.
- Return ONLY strict JSON.`;

    const userPrompt = `Resources:
${ranked.map((r, i) => `${i + 1}. [${r.type}] ${r.title} - ${r.url}\n   Snippet: ${r.snippet}`).join("\n")}

Output JSON format:
{
  "youtube": [],
  "pdf": [],
  "practice": [],
  "guide": [],
  "reasoning": "Detailed Socratic reasoning for this curation."
}`;

    const raw = await callOllama(systemPrompt, userPrompt, 0.85);
    const parsed = extractJSON<{ youtube: any[], pdf: any[], practice: any[], guide: any[], reasoning: string }>(raw);

    if (!parsed) {
        throw new Error("Invalid AI response detected: failed to parse JSON from ARIA curation.");
    }

    const filterVetted = (type: string, list: any[]) => {
        return (list || []).map(item => {
            const url = typeof item === 'string' ? item : item.url;
            return ranked.find(r => r.url === url) || { title: item.title || "Resource", url, type: type as any, snippet: "" };
        }).slice(0, 3);
    };

    return {
        youtube: filterVetted("youtube", parsed.youtube),
        pdf: filterVetted("pdf", parsed.pdf),
        practice: filterVetted("practice", parsed.practice),
        guide: filterVetted("guide", parsed.guide),
        reasoning: parsed.reasoning || "Optimized for your current progress and time constraints."
    };
}
