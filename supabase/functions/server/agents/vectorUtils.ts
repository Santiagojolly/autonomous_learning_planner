/**
 * vectorUtils.ts
 * Mathematical utilities for vector similarity and ranking.
 */

import { SearchResult } from "./searchService.ts";

/**
 * Calculates the cosine similarity between two vectors.
 */
export function cosineSimilarity(v1: number[], v2: number[]): number {
    if (v1.length !== v2.length) return 0;

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < v1.length; i++) {
        dotProduct += v1[i] * v2[i];
        mag1 += v1[i] * v1[i];
        mag2 += v2[i] * v2[i];
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (mag1 * mag2);
}

/**
 * Ranks search results by similarity to a query embedding.
 * Uses a weighted scoring formula:
 * final_score = similarity_score * 0.6 + domain_authority_score * 0.2 + difficulty_match_score * 0.2
 */
export function rankBySimilarity(
    queryEmbedding: number[],
    results: SearchResult[],
    resultsEmbeddings: (number[] | null)[],
    targetDifficulty: string
): SearchResult[] {
    const scoredResults = results.map((res, i) => {
        const resEmb = resultsEmbeddings[i];
        const similarity = resEmb ? cosineSimilarity(queryEmbedding, resEmb) : 0;

        // Simple domain authority score (0 to 1)
        const domainScore = getDomainAuthority(res.url);

        // Difficulty match score (0 to 1)
        const diffScore = getDifficultyMatch(res.title + " " + res.snippet, targetDifficulty);

        const finalScore = (similarity * 0.6) + (domainScore * 0.2) + (diffScore * 0.2);

        return { res, score: finalScore };
    });

    return scoredResults
        .sort((a, b) => b.score - a.score)
        .map(sr => sr.res);
}

function getDomainAuthority(url: string): number {
    const u = url.toLowerCase();
    if (u.includes("mit.edu") || u.includes("stanford.edu") || u.includes("harvard.edu")) return 1.0;
    if (u.includes("nptel.ac.in") || u.includes("ktunotes.in") || u.includes("aktu.ac.in")) return 1.0;
    if (u.includes(".edu") || u.includes(".ac.in") || u.includes(".gov")) return 0.9;
    if (u.includes("youtube.com") || u.includes("youtu.be")) return 0.8;
    if (u.includes("geeksforgeeks.org") || u.includes("khanacademy.org")) return 0.8;
    if (u.includes("github.com") || u.includes("wikipedia.org")) return 0.7;
    return 0.4;
}

function getDifficultyMatch(text: string, target: string): number {
    const t = text.toLowerCase();
    const d = target.toLowerCase();

    if (d === "beginner") {
        if (t.includes("beginner") || t.includes("introduction") || t.includes("basics")) return 1.0;
        if (t.includes("advanced") || t.includes("expert")) return 0.2;
    } else if (d === "advanced") {
        if (t.includes("advanced") || t.includes("deep dive") || t.includes("advanced concepts")) return 1.0;
        if (t.includes("beginner") || t.includes("introduction")) return 0.4;
    } else {
        // Intermediate
        if (t.includes("intermediate") || t.includes("beyond basics")) return 1.0;
        return 0.6;
    }
    return 0.5;
}
