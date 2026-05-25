/**
 * academicResourceIntelligence.ts — Agent 4: The Academic Resource Intelligence (ARIA)
 * 
 * ARIA is a fully agentic, RAG-based research system.
 * 
 * Pipeline:
 *   Tier 1: Search + Ollama RAG (full pipeline)
 *   Tier 2: Ollama-only generation (no search, but LLM creates smart content)
 *   Tier 3: Template fallback (no external services at all)
 */

import {
    callOllama,
    isOllamaAvailable,
    extractJSON,
    agentLog,
    buildMeta,
    getPersistentCache,
    setPersistentCache,
} from "./agentUtils";
import { searchAcademicResources, SearchResult } from "./searchService";
import { generateEmbedding } from "./embeddingService";
import { rankBySimilarity } from "./vectorUtils";

const localMemoryCache = new Map<string, any>();

// ─── Constants ─────────────────────────────────────────────────────────────

const AGENT_NAME = "ARIA";
const CACHE_TTL_HOURS = 48; // 2 days of persistent cache

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
    resource_recommendations: any[];
    learning_strategy_note: string;
    reasoning: string;
    meta: any;
}

/**
 * Main execution loop for ARIA Agent.
 */
export async function runARIA(input: ARIAInput, userId: string): Promise<ARIAOutput> {
    const startTime = Date.now();
    agentLog(AGENT_NAME, "Agent activated", { subject: input.subject, topic: input.topic });

    // 1. Check Persistent Cache
    const cacheKey = `aria:${input.subject}:${input.topic}:${input.difficulty}`.toLowerCase();
    try {
        const cached = getPersistentCache<any>(cacheKey);
        if (cached) {
            agentLog(AGENT_NAME, "Serving from persistent cache");
            return {
                ...cached,
                meta: buildMeta(AGENT_NAME, false, startTime)
            };
        }
    } catch (err) {
        agentLog(AGENT_NAME, "Cache retrieval error", err);
    }

    // 2. Decision Layer
    const strategy = determineStrategy(input);
    agentLog(AGENT_NAME, "Strategy determined", strategy);

    // 3. Try Search Layer (graceful failure)
    let results: SearchResult[] = [];
    try {
        results = await searchAcademicResources(input.subject, [input.topic, ...input.weak_topics], input.difficulty);
    } catch (err: any) {
        agentLog(AGENT_NAME, "Search failed (CORS/network), will try Ollama-only generation", err?.message);
    }

    // ── TIER 1: Full RAG Pipeline (search + Ollama) ──────────────────────
    if (results.length > 0) {
        try {
            const rankedResources = await rankResources(input, results, strategy);
            const finalSelection = await curateWithLLM(input, rankedResources, strategy);
            const output = buildOutput(input, finalSelection, true, startTime);
            localMemoryCache.set(cacheKey, { data: output, timestamp: Date.now() });
            setPersistentCache(cacheKey, output, CACHE_TTL_HOURS);
            return output;
        } catch (err: any) {
            agentLog(AGENT_NAME, "RAG pipeline failed, trying search-only fallback", err?.message);
            const fallback = buildFallbackFromSearch(results);
            const output = buildOutput(input, fallback, false, startTime);
            localMemoryCache.set(cacheKey, { data: output, timestamp: Date.now() });
            setPersistentCache(cacheKey, output, CACHE_TTL_HOURS);
            return output;
        }
    }

    // ── TIER 2: Ollama-Only Generation (no search needed) ────────────────
    try {
        const ollamaAvailable = await isOllamaAvailable();
        if (ollamaAvailable) {
            agentLog(AGENT_NAME, "Using Ollama-only generation (Tier 2)");
            const ollamaContent = await generateWithOllama(input);
            const output = buildOutput(input, ollamaContent.selection, true, startTime, ollamaContent.extras);
            setPersistentCache(cacheKey, output, CACHE_TTL_HOURS);
            return output;
        }
    } catch (err: any) {
        agentLog(AGENT_NAME, "Ollama generation failed, falling back to templates", err?.message);
    }

    // ── TIER 3: Template Fallback (fully offline) ────────────────────────
    agentLog(AGENT_NAME, "Using template fallback (Tier 3)");
    const localSelection = buildLocalFallback(input);
    const output = buildOutput(input, localSelection, false, startTime);
    localMemoryCache.set(cacheKey, { data: output, timestamp: Date.now() });
    return output;
}

// ═════════════════════════════════════════════════════════════════════════════
// TIER 2: Ollama-Only Generation
// ═════════════════════════════════════════════════════════════════════════════

interface OllamaGeneratedExtras {
    practiceQuestions: string[];
    pyqQuestions: { exam: string; year: number; question: string }[];
    flashcards: { question: string; answer: string }[];
    cheatSheet: string;
}

async function generateWithOllama(input: ARIAInput): Promise<{ selection: FinalSelection; extras: OllamaGeneratedExtras }> {
    const systemPrompt = `You are ARIA (Academic Resource Intelligence Agent), an expert academic tutor.
You are helping a student study "${input.topic}" in "${input.subject}".

STUDENT PROFILE:
- Difficulty level: ${input.difficulty}
- Study stage: ${input.roadmap_stage}
- Daily study time: ${input.available_daily_hours} hours
- Weak areas: ${input.weak_topics.length > 0 ? input.weak_topics.join(", ") : "none identified"}

Generate comprehensive study material for this topic. Return ONLY valid JSON with this exact structure:
{
  "reasoning": "A 2-3 sentence personalized study strategy for this specific topic.",
  "practice_questions": [
    "Question 1 text",
    "Question 2 text"
  ],
  "pyq_questions": [
    { "exam": "GATE", "year": 2025, "question": "Question text [marks]" },
    { "exam": "B.Tech", "year": 2024, "question": "Question text [marks]" }
  ],
  "flashcards": [
    { "question": "Front of card", "answer": "Back of card with detailed explanation" }
  ],
  "cheat_sheet": "# Topic Quick Reference\\n## Key Concepts\\n- Point 1\\n- Point 2\\n## Formulas\\n..."
}

RULES:
- Generate exactly 3 practice questions specific to ${input.topic}, from basic to ${input.difficulty}.
- Generate 2 PYQ-style questions (1 GATE, 1 B.Tech) with realistic mark allocations.
- Generate 3 flashcards covering the most important concepts of ${input.topic}.
- The cheat sheet should be a brief markdown summary with formulas, key theorems, and exam tips (keep it under 100 words).
- All content MUST be specific to "${input.topic}" in "${input.subject}" — NO generic templates.
- Return ONLY the JSON, no extra text.`;

    const userPrompt = `Generate study material for: "${input.topic}" in "${input.subject}" at ${input.difficulty} level.`;

    agentLog(AGENT_NAME, "Calling Ollama for content generation...");
    const raw = await callOllama(systemPrompt, userPrompt, 0.8, "json");
    const parsed = extractJSON<{
        reasoning: string;
        practice_questions: string[];
        pyq_questions: { exam: string; year: number; question: string }[];
        flashcards: { question: string; answer: string }[];
        cheat_sheet: string;
    }>(raw);

    if (!parsed) {
        throw new Error("Failed to parse Ollama JSON response for ARIA content generation");
    }

    agentLog(AGENT_NAME, "Ollama content generated successfully", {
        questions: parsed.practice_questions?.length || 0,
        pyqs: parsed.pyq_questions?.length || 0,
        flashcards: parsed.flashcards?.length || 0,
    });

    const searchQ = encodeURIComponent(`${input.subject} ${input.topic}`);

    const selection: FinalSelection = {
        youtube: [{
            title: `${input.topic} — Complete Lecture (${input.subject})`,
            url: `https://www.youtube.com/results?search_query=${searchQ}+lecture`,
            snippet: `Search YouTube for the best ${input.topic} lectures`,
            type: "youtube",
        }],
        pdf: [{
            title: `${input.topic} — Study Notes PDF`,
            url: `https://www.google.com/search?q=${searchQ}+notes+filetype%3Apdf`,
            snippet: `Find PDF study materials for ${input.topic}`,
            type: "pdf",
        }],
        practice: [{
            title: `${input.topic} — Practice Problems`,
            url: `https://www.google.com/search?q=${searchQ}+practice+questions`,
            snippet: `Practice questions for ${input.topic}`,
            type: "practice",
        }],
        guide: [{
            title: `${input.topic} — Study Guide`,
            url: `https://www.google.com/search?q=${searchQ}+study+guide`,
            snippet: `Comprehensive study guide for ${input.topic}`,
            type: "guide",
        }],
        reasoning: parsed.reasoning || `Focus on mastering ${input.topic} through structured practice and concept review.`,
    };

    // Inject proper URLs into Ollama-generated PYQ items
    const subjectEnc = encodeURIComponent(input.subject);
    const topicEnc = encodeURIComponent(input.topic);
    const enrichedPYQs = (parsed.pyq_questions || []).map(q => ({
        ...q,
        url: q.exam === "B.Tech"
            ? `https://www.ktunotes.in/ktu-2019-scheme-question-papers/?s=${subjectEnc}+${q.year}`
            : `https://www.google.com/search?q=GATE+${q.year}+${subjectEnc}+${topicEnc}+question+paper+pdf`
    }));

    return {
        selection,
        extras: {
            practiceQuestions: parsed.practice_questions || [],
            pyqQuestions: enrichedPYQs,
            flashcards: parsed.flashcards || [],
            cheatSheet: parsed.cheat_sheet || "",
        }
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// Output Builder
// ═════════════════════════════════════════════════════════════════════════════

interface FinalSelection {
    youtube: SearchResult[];
    pdf: SearchResult[];
    practice: SearchResult[];
    guide: SearchResult[];
    reasoning: string;
}

function buildOutput(
    input: ARIAInput,
    selection: FinalSelection,
    usedOllama: boolean,
    startTime: number,
    ollamaExtras?: OllamaGeneratedExtras
): ARIAOutput {
    const searchQ = encodeURIComponent(`${input.subject} ${input.topic}`);

    // Use Ollama-generated content if available, otherwise fallback to templates
    const practiceQuestions = ollamaExtras?.practiceQuestions?.length
        ? ollamaExtras.practiceQuestions
        : templatePracticeQuestions(input.topic, input.subject, input.difficulty);

    const pyqQuestions = ollamaExtras?.pyqQuestions?.length
        ? ollamaExtras.pyqQuestions
        : templatePYQs(input.topic, input.subject);

    const flashcards = ollamaExtras?.flashcards?.length
        ? ollamaExtras.flashcards
        : templateFlashcards(input.topic, input.subject);

    const cheatSheet = ollamaExtras?.cheatSheet || selection.reasoning || templateCheatSheet(input.topic, input.subject);

    return {
        success: true,
        ...selection,
        resource_recommendations: [
            {
                subject: input.subject,
                topic: input.topic,
                recommended_resources: {
                    youtube_lecture: {
                        title: selection.youtube[0]?.title || `${input.topic} — Full Lecture`,
                        url: selection.youtube[0]?.url || `https://www.youtube.com/results?search_query=${searchQ}+lecture`,
                        creator: "Academic Source",
                        duration_minutes: 45,
                        reason: "Curated most-viewed lecture for your topic.",
                    },
                    pdf_notes: {
                        title: selection.pdf[0]?.title || `${input.topic} Study Notes`,
                        url: selection.pdf[0]?.url || `https://www.google.com/search?q=${searchQ}+notes+filetype%3Apdf`,
                        source: "University Library",
                        pages: 15,
                        reason: "Comprehensive study material.",
                    },
                    practice_questions: {
                        type: input.difficulty === "advanced" ? "advanced" : input.difficulty === "beginner" ? "basic" : "moderate",
                        estimated_questions: practiceQuestions.length,
                        url: selection.practice[0]?.url || `https://www.google.com/search?q=${searchQ}+practice+questions`,
                        reason: usedOllama ? "AI-generated questions tailored to your level." : "Practice exercises matched to your level.",
                        questions: practiceQuestions,
                    },
                    previous_year_questions: {
                        availability: "yes",
                        focus_area: input.topic,
                        reason: usedOllama ? "AI-generated exam-style questions." : "Previous exam questions for focused revision.",
                        url: `https://www.ktunotes.in/ktu-2019-scheme-question-papers/?s=${encodeURIComponent(input.subject)}`,
                        pyq_questions: pyqQuestions,
                    },
                    cheat_sheet_markdown: cheatSheet,
                    flashcards,
                }
            }
        ],
        learning_strategy_note: selection.reasoning || `Focus on ${input.topic} fundamentals, then drill practice questions to build exam confidence.`,
        meta: buildMeta(AGENT_NAME, usedOllama, startTime)
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// Fallback Strategies
// ═════════════════════════════════════════════════════════════════════════════

function buildFallbackFromSearch(results: SearchResult[]): FinalSelection {
    return {
        youtube: results.filter(r => r.type === "youtube").slice(0, 3),
        pdf: results.filter(r => r.type === "pdf").slice(0, 3),
        practice: results.filter(r => r.type === "practice").slice(0, 3),
        guide: results.filter(r => r.type === "guide").slice(0, 3),
        reasoning: "Resources discovered via academic search. Ranked by domain authority and relevance.",
    };
}

function buildLocalFallback(input: ARIAInput): FinalSelection {
    const searchQ = encodeURIComponent(`${input.subject} ${input.topic}`);
    return {
        youtube: [{
            title: `${input.topic} — Complete Lecture (${input.subject})`,
            url: `https://www.youtube.com/results?search_query=${searchQ}+lecture`,
            snippet: `Search YouTube for the best ${input.topic} lectures`,
            type: "youtube",
        }],
        pdf: [{
            title: `${input.topic} — Study Notes PDF`,
            url: `https://www.google.com/search?q=${searchQ}+notes+filetype%3Apdf`,
            snippet: `Find PDF study materials for ${input.topic}`,
            type: "pdf",
        }],
        practice: [{
            title: `${input.topic} — Practice Problems`,
            url: `https://www.google.com/search?q=${searchQ}+practice+questions`,
            snippet: `Practice questions for ${input.topic}`,
            type: "practice",
        }],
        guide: [{
            title: `${input.topic} — Study Guide`,
            url: `https://www.google.com/search?q=${searchQ}+study+guide`,
            snippet: `Comprehensive study guide for ${input.topic}`,
            type: "guide",
        }],
        reasoning: templateCheatSheet(input.topic, input.subject),
    };
}

// ═════════════════════════════════════════════════════════════════════════════
// Template Generators (Tier 3 — no external services)
// ═════════════════════════════════════════════════════════════════════════════

function templatePracticeQuestions(topic: string, subject: string, difficulty: string): string[] {
    const base = [
        `Define ${topic} and explain its significance in ${subject}.`,
        `Compare and contrast the key approaches to ${topic}.`,
        `What are the main advantages and disadvantages of ${topic}?`,
        `Describe the working principle of ${topic} with a suitable example.`,
        `How does ${topic} differ from its alternatives in ${subject}?`,
        `Explain the mathematical foundation behind ${topic}.`,
        `What are the real-world applications of ${topic} in ${subject}?`,
        `Discuss the time and space complexity implications of ${topic}.`,
        `Write a step-by-step algorithm for implementing ${topic}.`,
        `Critically evaluate the role of ${topic} in modern ${subject}.`,
    ];
    const advanced = [
        `Prove the correctness of ${topic} using mathematical induction.`,
        `Derive the recurrence relation for ${topic} and solve it.`,
        `How would you optimize ${topic} for distributed systems?`,
        `Compare the asymptotic behavior of ${topic} with its alternatives.`,
        `Design a system that leverages ${topic} for real-time processing.`,
    ];
    return difficulty === "advanced" ? [...base, ...advanced] : base;
}

function templatePYQs(topic: string, subject: string): { exam: string; year: number; question: string; url?: string }[] {
    const y = new Date().getFullYear();
    const subjectEnc = encodeURIComponent(subject);
    const topicEnc = encodeURIComponent(topic);
    return [
        { exam: "GATE", year: y - 1, question: `Explain the concept of ${topic} with a suitable diagram. Derive its complexity. [5 marks]`, url: `https://www.google.com/search?q=GATE+${y - 1}+${subjectEnc}+${topicEnc}+question+paper+pdf` },
        { exam: "GATE", year: y - 2, question: `Which of the following is true about ${topic} in ${subject}? (a) Option A (b) Option B (c) Option C (d) Option D`, url: `https://www.google.com/search?q=GATE+${y - 2}+${subjectEnc}+${topicEnc}+question+paper+pdf` },
        { exam: "GATE", year: y - 3, question: `Given a ${topic}-based problem, find the optimal solution using the appropriate algorithm.`, url: `https://www.google.com/search?q=GATE+${y - 3}+${subjectEnc}+${topicEnc}+question+paper+pdf` },
        { exam: "B.Tech", year: y - 1, question: `Define ${topic}. Explain its working with an example. [10 marks]`, url: `https://www.ktunotes.in/ktu-2019-scheme-question-papers/?s=${subjectEnc}+${y - 1}` },
        { exam: "B.Tech", year: y - 2, question: `Compare ${topic} with its alternatives in ${subject}. Which is better and why? [8 marks]`, url: `https://www.ktunotes.in/ktu-2019-scheme-question-papers/?s=${subjectEnc}+${y - 2}` },
        { exam: "B.Tech", year: y - 3, question: `Write an algorithm for ${topic}. Analyze its time complexity. [10 marks]`, url: `https://www.ktunotes.in/ktu-2019-scheme-question-papers/?s=${subjectEnc}+${y - 3}` },
    ];
}

function templateFlashcards(topic: string, subject: string): { question: string; answer: string }[] {
    return [
        { question: `What is ${topic}?`, answer: `${topic} is a fundamental concept in ${subject} that deals with the core principles and mechanisms of the domain.` },
        { question: `Why is ${topic} important?`, answer: `It provides the theoretical and practical foundation for solving complex problems in ${subject}.` },
        { question: `What are the key components of ${topic}?`, answer: `The key components include the core algorithm/mechanism, its input/output specifications, and performance characteristics.` },
        { question: `What is the complexity of ${topic}?`, answer: `The complexity depends on the specific implementation, typically involving trade-offs between time and space efficiency.` },
        { question: `Name a real-world application.`, answer: `${topic} is widely used in industry applications of ${subject}, including system optimization and data processing.` },
    ];
}

function templateCheatSheet(topic: string, subject: string): string {
    return `# ${topic} — Quick Reference

## Key Concepts
- **Definition**: ${topic} is a core concept in ${subject}
- **Category**: Fundamental building block
- **Difficulty**: Intermediate

## Important Points
- Understand the theoretical foundation before implementation
- Practice with multiple examples to build intuition
- Focus on edge cases and boundary conditions
- Compare with alternative approaches

## Common Mistakes to Avoid
- Not considering time/space complexity trade-offs
- Ignoring edge cases in implementation
- Confusing ${topic} with related but different concepts

## Exam Tips
- Draw diagrams wherever applicable
- Always mention complexity analysis
- Use examples to support your explanations
- Structure your answers with clear headings`;
}

// ═════════════════════════════════════════════════════════════════════════════
// Strategy & Search Pipeline (Tier 1)
// ═════════════════════════════════════════════════════════════════════════════

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

async function rankResources(input: ARIAInput, results: SearchResult[], strategy: any): Promise<SearchResult[]> {
    const query = `${input.subject} ${input.topic} ${input.weak_topics?.join(" ") || ""}`;
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) return results;
    const resultEmbeddings = await Promise.all(
        results.map(r => generateEmbedding(`${r.title || ""} ${r.snippet || ""}`))
    );
    return rankBySimilarity(queryEmbedding, results, resultEmbeddings, input.difficulty);
}

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
        throw new Error("Invalid AI response: failed to parse JSON from ARIA curation.");
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
