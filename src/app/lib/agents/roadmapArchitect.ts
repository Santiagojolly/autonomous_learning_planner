// @ts-nocheck
/**
 * roadmapArchitect.ts — Agent 1: The Roadmap Architect
 *
 * Generates a structured, phased study roadmap for any subject.
 * Uses local Ollama (llama3) when available, otherwise produces a
 * rich deterministic mock — no external API keys ever required.
 */

import {
    callOllama,
    isOllamaAvailable,
    extractJSON,
    generateId,
    addDays,
    todayISO,
    getDifficultyBase,
    clampDifficulty,
    buildMeta,
    agentLog,
    getPersistentCache,
    setPersistentCache,
} from "./agentUtils";

const AGENT_NAME = "RoadmapArchitect";

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface RoadmapTopic {
    id: string;
    name: string;
    difficulty: number;
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

export interface RoadmapArchitectInput {
    subject: string;
    level: "beginner" | "intermediate" | "advanced";
    dailyHours: number;
    timeframeWeeks: number;
    additionalContext?: string;
}

export interface RoadmapArchitectOutput {
    success: boolean;
    roadmap: Roadmap;
    meta: {
        agentName: string;
        ranAt: string;
        usedOllama: boolean;
        durationMs: number;
    };
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
    return `You are the Roadmap Architect, an expert educational AI that creates detailed, personalized study roadmaps.
You always respond with ONLY valid JSON — no explanations, no markdown, no extra text.
The JSON must match exactly the schema provided in the user prompt.
Every topic must have a difficulty score from 1-10 where 1 is trivial and 10 is expert-level.
Resources should be freely available (YouTube, Wikipedia, official docs, open textbooks, etc).`;
}

function buildUserPrompt(input: RoadmapArchitectInput): string {
    const totalHours = input.dailyHours * 7 * input.timeframeWeeks;
    return `Create a comprehensive study roadmap for the following:

Subject: ${input.subject}
Current Level: ${input.level}
Daily Study Hours: ${input.dailyHours}
Timeframe: ${input.timeframeWeeks} weeks
Total Available Hours: ${totalHours}
Additional Context: ${input.additionalContext || "none"}

Generate exactly 4 phases: Foundation, Core Concepts, Applied Practice, and Mastery.
Distribute topics and hours proportionally across phases.

Return ONLY this JSON structure (no text outside it):
{
  "phases": [
    {
      "name": "Foundation",
      "description": "short description",
      "weekRange": "Week 1-3",
      "topics": [
        {
          "name": "topic name",
          "difficulty": 3,
          "estimatedHours": 4,
          "resources": ["Free Resource 1", "Free Resource 2"],
          "notes": "study tip or key insight"
        }
      ]
    }
  ]
}`;
}

// ─── Mock Generator ───────────────────────────────────────────────────────────

/**
 * Rich deterministic mock — produces realistic output without any LLM.
 * Scaled to the actual subject, level, and timeframe provided.
 */
function generateMockRoadmap(input: RoadmapArchitectInput): Partial<Roadmap> {
    const base = getDifficultyBase(input.level);
    const totalHours = input.dailyHours * 7 * input.timeframeWeeks;
    const subject = input.subject;

    const SUBJECT_LIBRARY: Record<string, string[][]> = {
        "database": [
            ["ER Modeling", "Relational Algebra", "SQL Fundamentals", "Schema Design"],
            ["Indexing (B-Trees)", "Hashing Techniques", "Query Optimization", "Storage Management"],
            ["Transactions (ACID)", "Concurrency Control", "Deadlock Management", "Recovery Sys"],
            ["NoSQL Basics", "Distributed DB", "Data Warehousing", "DB Security"]
        ],
        "dbms": [
            ["ER Modeling", "Relational Algebra", "SQL Fundamentals", "Schema Design"],
            ["Indexing (B-Trees)", "Hashing Techniques", "Query Optimization", "Storage Management"],
            ["Transactions (ACID)", "Concurrency Control", "Deadlock Management", "Recovery Sys"],
            ["NoSQL Basics", "Distributed DB", "Data Warehousing", "DB Security"]
        ],
        "machine learning": [
            ["Linear Algebra", "Probability", "Calculus for ML", "Intro to ML"],
            ["Supervised Learning", "Unsupervised", "Neural Networks", "Gradient Descent"],
            ["Feature Engineering", "Model Evaluation", "Scikit-Learn", "Hyperparameter Tuning"],
            ["Deep Learning", "NLP Basics", "Computer Vision", "Deployment"]
        ],
        "ml": [
            ["Linear Algebra", "Probability", "Calculus for ML", "Intro to ML"],
            ["Supervised Learning", "Unsupervised", "Neural Networks", "Gradient Descent"],
            ["Feature Engineering", "Model Evaluation", "Scikit-Learn", "Hyperparameter Tuning"],
            ["Deep Learning", "NLP Basics", "Computer Vision", "Deployment"]
        ],
        "data structures": [
            ["Arrays & Stacks", "Queues & Lists", "Binary Search Trees", "Heaps"],
            ["AVL & Red-Black", "Hash Tables", "Graphs (BFS/DFS)", "Topological Sort"],
            ["Dijkstra's Algo", "MST (Prims/Kruskals)", "Disjoint Sets", "Segment Trees"],
            ["Greedy Methods", "DP Foundations", "Complexity Analysis", "Mock Interviews"]
        ],
        "ds": [
            ["Arrays & Stacks", "Queues & Lists", "Binary Search Trees", "Heaps"],
            ["AVL & Red-Black", "Hash Tables", "Graphs (BFS/DFS)", "Topological Sort"],
            ["Dijkstra's Algo", "MST (Prims/Kruskals)", "Disjoint Sets", "Segment Trees"],
            ["Greedy Methods", "DP Foundations", "Complexity Analysis", "Mock Interviews"]
        ],
        "operating systems": [
            ["Processes & Threads", "CPU Scheduling", "IPC Mechanisms", "Sync Problems"],
            ["Deadlock Science", "Memory Segments", "Paging Systems", "Virtual Memory"],
            ["Page Replacement", "File Systems", "Disk Scheduling", "I/O Hardware"],
            ["Shell Scripting", "Kernel Design", "Virtualization", "RTOS Concepts"]
        ],
        "os": [
            ["Processes & Threads", "CPU Scheduling", "IPC Mechanisms", "Sync Problems"],
            ["Deadlock Science", "Memory Segments", "Paging Systems", "Virtual Memory"],
            ["Page Replacement", "File Systems", "Disk Scheduling", "I/O Hardware"],
            ["Shell Scripting", "Kernel Design", "Virtualization", "RTOS Concepts"]
        ],
        "networking": [
            ["OSI & TCP/IP", "Physical Media", "MAC Layer", "Error Control"],
            ["IPv4/v6 Logic", "Routing Algos", "BGP & OSPF", "Subnetting"],
            ["TCP/UDP Logic", "Flow Control", "DNS & HTTP", "Socket Programming"],
            ["Network Security", "SSL/TLS", "SDN Fundamentals", "Troubleshooting"]
        ],
        "cn": [
            ["OSI & TCP/IP", "Physical Media", "MAC Layer", "Error Control"],
            ["IPv4/v6 Logic", "Routing Algos", "BGP & OSPF", "Subnetting"],
            ["TCP/UDP Logic", "Flow Control", "DNS & HTTP", "Socket Programming"],
            ["Network Security", "SSL/TLS", "SDN Fundamentals", "Troubleshooting"]
        ],
        "artificial intelligence": [
            ["Search Algorithms", "Heuristics & A*", "Game Theory", "Adversarial Search"],
            ["Knowledge Rep", "Propositional Logic", "First Order Logic", "Inference"],
            ["Probabilistic Reasoning", "Bayesian Networks", "Markov Models", "Decision Theory"],
            ["NLP Basics", "Robotics Intro", "Ethics of AI", "AGI Philosophy"]
        ],
        "cyber security": [
            ["Security Protocols", "Cryptography Basics", "Identity Access Mgmt", "Risk Analysis"],
            ["Network Security", "Firewall Tech", "Intrusion Detection", "Vulnerability Scan"],
            ["Application Security", "Penetration Testing", "Security Auditing", "Malware Analysis"],
            ["Incident Response", "Compliance & Law", "Ethical Hacking", "Forensics"]
        ],
        "cloud computing": [
            ["Virtualization Tech", "Cloud Models (SaaS/PaaS)", "Deployment Models", "Cloud Arch"],
            ["Compute Services", "Storage Services", "Logical Networking", "Identity & Access"],
            ["Serverless Architecture", "Containerization (Docker)", "Kubernetes", "CI/CD Pipeline"],
            ["Cost Management", "Cloud Security", "Disaster Recovery", "Cloud Optimization"]
        ],
        "software engineering": [
            ["SDLC Models", "Requirements Eng", "Project Management", "Agile Methodologies"],
            ["System Design", "UI/UX Principles", "Design Patterns", "Clean Code"],
            ["Software Testing", "Unit/Integration Test", "Debugging Tools", "Refactoring"],
            ["Versioning (Git)", "DevOps Intro", "Documentation", "Maintenance"]
        ],
    };

    const subKey = Object.keys(SUBJECT_LIBRARY).find(k => subject.toLowerCase().includes(k));
    const realTopics = subKey ? SUBJECT_LIBRARY[subKey] : null;

    const phaseConfig = [
        {
            name: "Foundation",
            description: `Build strong fundamentals of ${subject} from the ground up`,
            weekFrac: [0, 0.25],
            diffOffset: -1,
            topicTemplates: realTopics ? realTopics[0].map(t => ({ name: t, resFn: introResources })) : [
                { name: `Introduction to ${subject}`, resFn: introResources },
                { name: `Core Terminology & Concepts`, resFn: basicsResources },
                { name: `Historical Context & Overview`, resFn: wikiResources },
                { name: `Essential Mathematics / Prerequisites`, resFn: mathResources },
            ],
        },
        {
            name: "Core Concepts",
            description: `Master the fundamental theories and techniques of ${subject}`,
            weekFrac: [0.25, 0.55],
            diffOffset: 0,
            topicTemplates: realTopics ? realTopics[1].map(t => ({ name: t, resFn: lectureResources })) : [
                { name: `Key Principles of ${subject}`, resFn: lectureResources },
                { name: `Primary Methods & Techniques`, resFn: practiceResources },
                { name: `Tools & Frameworks`, resFn: toolResources },
                { name: `Problem Solving Patterns`, resFn: problemResources },
                { name: `Case Studies & Real-World Examples`, resFn: caseResources },
            ],
        },
        {
            name: "Applied Practice",
            description: `Apply knowledge through hands-on projects and exercises`,
            weekFrac: [0.55, 0.82],
            diffOffset: 1,
            topicTemplates: realTopics ? realTopics[2].map(t => ({ name: t, resFn: projectResources })) : [
                { name: `Guided Project: ${subject} Fundamentals`, resFn: projectResources },
                { name: `Advanced Techniques Deep-Dive`, resFn: advancedResources },
                { name: `Debugging & Troubleshooting`, resFn: debugResources },
                { name: `Integration with Related Domains`, resFn: integrationResources },
            ],
        },
        {
            name: "Mastery",
            description: `Achieve expert-level proficiency and prepare for real-world application`,
            weekFrac: [0.82, 1.0],
            diffOffset: 2,
            topicTemplates: realTopics ? realTopics[3].map(t => ({ name: t, resFn: expertResources })) : [
                { name: `Advanced ${subject} Patterns`, resFn: expertResources },
                { name: `Performance Optimization`, resFn: optimizeResources },
                { name: `Capstone Project`, resFn: capstoneResources },
                { name: `Best Practices & Industry Standards`, resFn: bestPracticeResources },
            ],
        },
    ];

    const phases: RoadmapPhase[] = phaseConfig.map((pc, pi) => {
        const weekStart = Math.round(pc.weekFrac[0] * input.timeframeWeeks) + 1;
        const weekEnd = Math.round(pc.weekFrac[1] * input.timeframeWeeks);
        const phaseHours = Math.round(totalHours * (pc.weekFrac[1] - pc.weekFrac[0]));
        const hoursPerTopic = Math.max(
            1,
            Math.round(phaseHours / pc.topicTemplates.length)
        );

        const topics: RoadmapTopic[] = pc.topicTemplates.map((tt, ti) => ({
            id: generateId("topic"),
            name: tt.name,
            difficulty: clampDifficulty(base + pc.diffOffset + (ti % 3 === 2 ? 1 : 0)),
            estimatedHours: hoursPerTopic + (ti % 2 === 0 ? 1 : -1),
            resources: tt.resFn(subject),
            status: "pending",
            notes: topicNotes(subject, pc.name, ti),
        }));

        return {
            id: generateId("phase"),
            name: pc.name,
            weekRange:
                weekStart === weekEnd
                    ? `Week ${weekStart}`
                    : `Week ${weekStart}–${weekEnd}`,
            description: pc.description,
            topics,
            totalHours: topics.reduce((s, t) => s + t.estimatedHours, 0),
        };
    });

    return { phases };
}

// Resource helpers — return curated free resources per topic type
function introResources(s: string) {
    return [
        `YouTube: "${s} for Beginners" (freeCodeCamp / Traversy Media)`,
        `Wikipedia: ${s} Overview`,
        `Khan Academy: Foundations`,
    ];
}
function basicsResources(s: string) {
    return [
        `Glossary of ${s} Terms (Wikipedia)`,
        `Open Textbook Library`,
        `MIT OpenCourseWare — Introduction lectures`,
    ];
}
function wikiResources(s: string) {
    return [
        `Wikipedia: History of ${s}`,
        `YouTube: "Origins of ${s}" documentary`,
        `Britannica Encyclopedia`,
    ];
}
function mathResources(_s: string) {
    return [
        `Khan Academy: Math Foundations`,
        `3Blue1Brown: Essence of Linear Algebra (YouTube)`,
        `Paul's Online Math Notes (tutorial.math.lamar.edu)`,
    ];
}
function lectureResources(s: string) {
    return [
        `MIT OpenCourseWare: ${s} Lectures (ocw.mit.edu)`,
        `Coursera Audit: ${s} Fundamentals (free to audit)`,
        `YouTube: University lecture series`,
    ];
}
function practiceResources(s: string) {
    return [
        `Practice Exercises on ${s} (GitHub search)`,
        `Official Documentation & Tutorials`,
        `Open source project examples`,
    ];
}
function toolResources(s: string) {
    return [
        `Official ${s} tooling documentation`,
        `GitHub: Awesome-${s} list`,
        `Dev.to articles on ${s} setup`,
    ];
}
function problemResources(_s: string) {
    return [
        `LeetCode / HackerRank (free tier)`,
        `Project Euler (projecteuler.net)`,
        `Exercism.io (free code challenges)`,
    ];
}
function caseResources(s: string) {
    return [
        `arXiv.org: ${s} papers (free)`,
        `Medium: ${s} case studies (free articles)`,
        `YouTube: Industry application talks`,
    ];
}
function projectResources(s: string) {
    return [
        `GitHub: beginner ${s} project templates`,
        `freeCodeCamp project challenges`,
        `Odin Project (theodinproject.com)`,
    ];
}
function advancedResources(s: string) {
    return [
        `Advanced ${s} (official docs deep-dive)`,
        `YouTube: Advanced ${s} tutorials`,
        `Book: "Deep ${s}" (check Open Library)`,
    ];
}
function debugResources(_s: string) {
    return [
        `Stack Overflow community wiki`,
        `YouTube: Debugging techniques`,
        `Official issue tracker & discussions (GitHub)`,
    ];
}
function integrationResources(s: string) {
    return [
        `Dev.to: ${s} integration tutorials`,
        `GitHub: Projects combining ${s} with other tools`,
        `YouTube: System design talks`,
    ];
}
function expertResources(s: string) {
    return [
        `Advanced ${s} Conference Talks (YouTube)`,
        `Research papers on arXiv.org`,
        `Expert blogs and newsletters (free)`,
    ];
}
function optimizeResources(_s: string) {
    return [
        `Performance profiling guides (official docs)`,
        `YouTube: Optimization masterclasses`,
        `Benchmark reports on GitHub`,
    ];
}
function capstoneResources(s: string) {
    return [
        `Build your own: ${s} from scratch (GitHub examples)`,
        `freeCodeCamp certification project`,
        `Open source contribution guide`,
    ];
}
function bestPracticeResources(s: string) {
    return [
        `${s} style guides (GitHub)`,
        `"Clean Code" principles (freely summarized online)`,
        `Official community best practice docs`,
    ];
}

function topicNotes(subject: string, phase: string, idx: number): string {
    const notes = [
        `Focus on understanding "why" before "how" for ${subject}`,
        `Use the Feynman technique: explain this topic as if teaching someone else`,
        `Practice spaced repetition — revisit this topic after 3 days`,
        `Build a small demo as you learn. Action beats passive reading`,
        `Connect this to what you already know from ${phase}`,
        `Take handwritten notes — they improve retention significantly`,
    ];
    return notes[idx % notes.length];
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function runRoadmapArchitect(
    input: RoadmapArchitectInput,
    userId: string
): Promise<RoadmapArchitectOutput> {
    const startTime = Date.now();
    agentLog(AGENT_NAME, "Starting run", { userId, subject: input.subject });

    const totalHours =
        input.dailyHours * 7 * (input.timeframeWeeks || 8);
    const roadmapId = generateId("roadmap");
    
    // ── Step 0: Check Cache ──────────────────────────────────────────────────
    const cacheKey = `roadmap:${input.subject}:${input.level}:${input.dailyHours}:${input.timeframeWeeks}`.toLowerCase();
    const cachedRoadmap = getPersistentCache<Roadmap>(cacheKey);
    if (cachedRoadmap) {
        agentLog(AGENT_NAME, "Serving from persistent cache");
        return { 
            success: true, 
            roadmap: { ...cachedRoadmap, id: roadmapId, createdAt: new Date().toISOString() }, 
            meta: buildMeta(AGENT_NAME, false, startTime) 
        };
    }

    let usedOllama = false;
    let phasesData: any = null;

    // ── Step 1: Try Ollama ────────────────────────────────────────────────────
    const ollamaOk = await isOllamaAvailable();
    if (ollamaOk) {
        try {
            agentLog(AGENT_NAME, "Ollama online — calling LLM");
            const raw = await callOllama(
                buildSystemPrompt(),
                buildUserPrompt(input),
                0.6
            );
            if (raw) {
                const parsed = extractJSON<{ phases: any[] }>(raw);
                if (parsed && parsed.phases && parsed.phases.length >= 4) {
                    phasesData = parsed;
                    usedOllama = true;
                    agentLog(AGENT_NAME, "Ollama response parsed successfully");
                }
            }
        } catch (e) {
            agentLog(AGENT_NAME, "Ollama call failed or invalid response, falling back to mock", e);
        }
    }

    // ── Step 2: Fallback ──────────────────────────────────────────────────────
    if (!usedOllama) {
        agentLog(AGENT_NAME, "Ollama offline or failed — using deterministic mock generator");
        phasesData = generateMockRoadmap(input);
    }

    // ── Step 3: Normalise phases (works for both Ollama and mock output) ───────
    const base = getDifficultyBase(input.level);
    const normalizedPhases: RoadmapPhase[] = (phasesData.phases as any[]).map(
        (p: any, pi: number) => {
            const topics: RoadmapTopic[] = (p.topics ?? []).map(
                (t: any, ti: number) => ({
                    id: t.id ?? generateId("topic"),
                    name: t.name ?? `Topic ${ti + 1}`,
                    difficulty: clampDifficulty(t.difficulty ?? base + pi),
                    estimatedHours:
                        t.estimatedHours ??
                        Math.max(1, Math.round(totalHours / 16)),
                    resources: Array.isArray(t.resources) ? t.resources : [],
                    status: "pending",
                    notes: t.notes ?? "",
                })
            );

            const totalPhaseHours = topics.reduce(
                (s, t) => s + t.estimatedHours,
                0
            );

            return {
                id: p.id ?? generateId("phase"),
                name: p.name ?? `Phase ${pi + 1}`,
                weekRange: p.weekRange ?? `Week ${pi * 3 + 1}–${(pi + 1) * 3}`,
                description: p.description ?? "",
                topics,
                totalHours: totalPhaseHours,
            };
        }
    );

    // ── Step 4: Assemble final roadmap ────────────────────────────────────────
    const roadmap: Roadmap = {
        id: roadmapId,
        subject: input.subject,
        level: input.level,
        dailyHours: input.dailyHours,
        totalWeeks: input.timeframeWeeks,
        totalHours,
        phases: normalizedPhases,
        createdAt: new Date().toISOString(),
    };

    const meta = buildMeta(AGENT_NAME, usedOllama, startTime);
    agentLog(AGENT_NAME, "Completed", {
        phases: roadmap.phases.length,
        totalHours,
        usedOllama,
        durationMs: meta.durationMs,
    });

    // Save to cache
    setPersistentCache(cacheKey, roadmap, 72); // Cache roadmaps for 3 days

    return { success: true, roadmap, meta };
}
