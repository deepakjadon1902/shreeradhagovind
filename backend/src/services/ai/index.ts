import { AIProvider } from "./ai.types";
import { GeminiProvider } from "./geminiProvider";

let defaultProvider: AIProvider | null = null;

/**
 * Returns the configured AI provider.
 * Supports swappable provider abstraction (Gemini by default; can be extended to OpenAI).
 */
export function getAIProvider(): AIProvider {
  if (!defaultProvider) {
    defaultProvider = new GeminiProvider();
  }
  return defaultProvider;
}

export * from "./ai.types";
export * from "./storeTools";
export * from "./geminiProvider";
