/**
 * embeddingService.ts
 * Generates text embeddings via local Ollama instance (nomic-embed-text model).
 */

const OLLAMA_EMBED_URL = "http://localhost:11434/api/embeddings";
const EMBED_MODEL = "nomic-embed-text";

/**
 * Generates an embedding vector for a given string of text.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const response = await fetch(OLLAMA_EMBED_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: EMBED_MODEL,
                prompt: text,
            }),
        });

        if (!response.ok) {
            console.error(`[EmbeddingService] Ollama embedding failed with status ${response.status}`);
            return null;
        }

        const data = await response.json();
        return data.embedding ?? null;
    } catch (err: any) {
        console.error("[EmbeddingService] Ollama unavailable for embedding:", err.message);
        return null;
    }
}

/**
 * Embeds a search query for ranking purposes.
 */
export async function embedQuery(query: string): Promise<number[] | null> {
    return generateEmbedding(query);
}
