import type { LlmProvider } from "../contracts/llm-provider.js";
import type { LlmConfig } from "../types/llm-config.js";

import { resolveLlmConfig } from "../config/resolve-llm-config.js";
import { LlmError } from "../errors/llm-error.js";
import { GroqLlmProvider } from "../providers/groq.llm-provider.js";

/**
 * Create an LLM provider from explicit config.
 */
export function createLlmProvider(
  config: LlmConfig,
  options: {
    fetchImpl?: typeof fetch;
  } = {}
): LlmProvider {

  switch (config.provider) {

    case "groq":
      return new GroqLlmProvider({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
        fetchImpl: options.fetchImpl
      });

    case "template":
      throw new LlmError(
        "INVALID_CONFIG",
        "template provider is handled by DefaultAnswerGenerator, not createLlmProvider"
      );

    default: {
      const exhaustive: never =
        config.provider;
      throw new LlmError(
        "INVALID_CONFIG",
        `Unsupported LLM provider: ${String(exhaustive)}`
      );
    }

  }

}

/**
 * Create an LLM provider from process environment.
 */
export function createLlmProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: {
    fetchImpl?: typeof fetch;
  } = {}
): LlmProvider {

  return createLlmProvider(
    resolveLlmConfig(env),
    options
  );

}
