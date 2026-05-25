/**
 * searchService.ts
 * Dynamic academic resource discovery via DuckDuckGo HTML Search.
 * No external API keys required.
 */

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    type: "youtube" | "pdf" | "practice" | "guide" | "other";
}

const SEARCH_URL = "https://html.duckduckgo.com/html";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

const FORBIDDEN_DOMAINS = [
    "brainly.", "quora.com", "chegg.com", "coursehero.com",
    "facebook.com", "twitter.com", "reddit.com", "pinterest.",
    "answers.com", "tutorme.com", "studocu.com", "scribd.com",
    "slideshare.net", "homeworklib.com", "gradebuddy.com"
];

/**
 * Searches for academic resources based on subject and topics.
 */
export async function searchAcademicResources(
    subject: string,
    weakTopics: string[],
    difficulty: string
): Promise<SearchResult[]> {
    // Fast-fail search. Browser CORS policies and unstable proxies cause extreme lag.
    // By returning empty, we instantly skip to Tier 2 (Ollama AI generation) 
    // which generates highly contextual mock URLs without freezing the UI.
    return [];
}

/**
 * Performs a fetch to DuckDuckGo HTML and parses the results.
 * Note: Since we are in Deno/Supabase Edge, we don't have a full DOM parser.
 * We will use regex to extract titles, URLs, and snippets from the HTML.
 */
async function performRawSearch(query: string): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query });
    const rawUrl = `${SEARCH_URL}?${params.toString()}`;
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(rawUrl)}`, {
        headers: { "User-Agent": USER_AGENT }
    });

    if (!res.ok) throw new Error(`Search failed with status ${res.status}`);
    const html = await res.text();

    const results: SearchResult[] = [];

    // Regex to find results in DDG HTML Lite structure
    // <a class="result__a" rel="noopener" href="...">Title</a>
    // <a class="result__snippet" ...>Snippet</a>
    const resultBlockRegex = /<div class="result__body">([\s\S]*?)<\/div>/g;
    const titleRegex = /<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;

    let match;
    while ((match = resultBlockRegex.exec(html)) !== null) {
        const body = match[1];
        const titleMatch = body.match(titleRegex);
        const snippetMatch = body.match(snippetRegex);

        if (titleMatch) {
            let url = titleMatch[1];
            // Decode DDG proxy URLs if necessary
            if (url.includes("uddg=")) {
                try {
                    const u = new URL(url.startsWith("http") ? url : `https://duckduckgo.com${url}`);
                    url = u.searchParams.get("uddg") || url;
                } catch (e) {
                    // fall back to raw URL if URL class throws
                }
            }

            results.push({
                title: stripHtml(titleMatch[2]),
                url: url,
                snippet: snippetMatch ? stripHtml(snippetMatch[1]) : "",
                type: "other"
            });
        }
    }

    return results;
}

function classifyResult(res: SearchResult): SearchResult {
    const url = res.url.toLowerCase();
    const title = res.title.toLowerCase();

    if (url.includes("youtube.com") || url.includes("youtu.be")) {
        res.type = "youtube";
    } else if (url.endsWith(".pdf") || title.includes("pdf") || res.snippet.toLowerCase().includes("pdf")) {
        res.type = "pdf";
    } else if (title.includes("practice") || title.includes("question") || title.includes("quiz") || title.includes("exam")) {
        res.type = "practice";
    } else if (title.includes("guide") || title.includes("tutorial") || title.includes("notes") || title.includes("handbook")) {
        res.type = "guide";
    }

    return res;
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}
