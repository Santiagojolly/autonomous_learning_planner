import { isOllamaAvailable } from "./agents/agentUtils.ts";

export async function runHealthCheck() {
    console.log("[HealthCheck] Initiating startup checks...");

    const ollamaOnline = await isOllamaAvailable();
    if (!ollamaOnline) {
        console.warn("\n=======================================================");
        console.warn("⚠️ WARNING: Ollama is UNREACHABLE at http://localhost:11434");
        console.warn("⚠️ AI features will fail. Please start Ollama.");
        console.warn("=======================================================\n");
    } else {
        console.log("✅ [HealthCheck] Ollama is online and ready.");
    }
}
