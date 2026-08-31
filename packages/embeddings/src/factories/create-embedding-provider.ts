import type { EmbeddingProvider } from "../contracts/embedding-provider.js";
import type { EmbeddingConfig } from "../types/embedding-config.js";

import { EmbeddingError } from "../errors/embedding-error.js";

import { DeterministicEmbeddingProvider }
from "../providers/deterministic.embedding-provider.js";

import { OpenAICompatibleEmbeddingProvider }
from "../providers/openai-compatible.embedding-provider.js";

import { resolveEmbeddingConfig }
from "../config/resolve-embedding-config.js";

/**
 * Create an EmbeddingProvider from explicit config.
 */
export function createEmbeddingProvider(
  config: EmbeddingConfig
): EmbeddingProvider {

  switch (config.provider) {

    case "deterministic":
      return new DeterministicEmbeddingProvider({
        model: config.model,
        dimensions: config.dimensions,
        maxBatchSize: config.maxBatchSize
      });

    case "openai-compatible":
      if (!config.apiKey) {
        throw new EmbeddingError(
          "MISSING_API_KEY",
          "apiKey is required for openai-compatible provider"
        );
      }

      return new OpenAICompatibleEmbeddingProvider({
        model: config.model,
        dimensions: config.dimensions,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
        maxBatchSize: config.maxBatchSize
      });

    default: {
      const exhaustive: never = config.provider;
      throw new EmbeddingError(
        "INVALID_CONFIG",
        `Unsupported embedding provider: ${String(exhaustive)}`
      );
    }

  }

}

/**
 * Create an EmbeddingProvider from process environment.
 */
export function createEmbeddingProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env
): EmbeddingProvider {

  return createEmbeddingProvider(
    resolveEmbeddingConfig(env)
  );

}
