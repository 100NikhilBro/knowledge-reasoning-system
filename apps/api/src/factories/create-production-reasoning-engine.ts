import {
  DefaultEvidenceCollector,
  DefaultReasoningEngine,
  LlmAnswerGenerator,
  createLlmProviderFromEnv
} from "@knowledge/reasoning";

import { createRetrievalServiceFromEnv } from "@knowledge/retriever";

import { RedisSessionStateStore } from "@knowledge/working-memory";

/**
 * Production reasoning engine: hybrid retrieval + Groq LLM generation
 * behind existing verification.
 */
export function createProductionReasoningEngine(
  env: NodeJS.ProcessEnv = process.env
): DefaultReasoningEngine {
  return new DefaultReasoningEngine(
    new DefaultEvidenceCollector(createRetrievalServiceFromEnv(env)),
    undefined,
    undefined,
    undefined,
    new LlmAnswerGenerator(createLlmProviderFromEnv(env)),
    new RedisSessionStateStore()
  );
}
