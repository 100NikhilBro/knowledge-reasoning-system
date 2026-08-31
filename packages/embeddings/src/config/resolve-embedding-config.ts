import type {
  EmbeddingConfig,
  EmbeddingProviderKind
} from "../types/embedding-config.js";

import { EmbeddingError } from "../errors/embedding-error.js";

const DEFAULT_DIMENSIONS = 32;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BATCH_SIZE = 64;

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  field: string
): number {

  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new EmbeddingError(
      "INVALID_CONFIG",
      `${field} must be a positive integer`
    );
  }

  return parsed;

}

function parseProviderKind(
  value: string | undefined
): EmbeddingProviderKind {

  const kind =
    (value ?? "deterministic").trim().toLowerCase();

  if (
    kind === "deterministic" ||
    kind === "openai-compatible"
  ) {
    return kind;
  }

  throw new EmbeddingError(
    "INVALID_CONFIG",
    `Unsupported EMBEDDING_PROVIDER "${value}". Use deterministic or openai-compatible.`
  );

}

/**
 * Resolve embedding configuration from environment variables.
 *
 * EMBEDDING_PROVIDER=deterministic|openai-compatible
 * EMBEDDING_MODEL=...
 * EMBEDDING_DIMENSIONS=...
 * EMBEDDING_API_KEY=...
 * EMBEDDING_BASE_URL=...
 * EMBEDDING_TIMEOUT_MS=...
 * EMBEDDING_MAX_BATCH_SIZE=...
 */
export function resolveEmbeddingConfig(
  env: NodeJS.ProcessEnv = process.env
): EmbeddingConfig {

  const provider =
    parseProviderKind(env.EMBEDDING_PROVIDER);

  // Semantic providers must declare dimensions explicitly so Qdrant
  // collection size cannot silently drift from the embedding model.
  if (
    provider === "openai-compatible" &&
    (env.EMBEDDING_DIMENSIONS === undefined ||
      env.EMBEDDING_DIMENSIONS.trim() === "")
  ) {
    throw new EmbeddingError(
      "INVALID_CONFIG",
      "EMBEDDING_DIMENSIONS is required for openai-compatible " +
        "(e.g. 1536 for text-embedding-3-small). " +
        "Set QDRANT_VECTOR_SIZE to the same value and recreate/reindex " +
        "the collection before relying on semantic retrieval."
    );
  }

  const dimensions =
    parsePositiveInt(
      env.EMBEDDING_DIMENSIONS,
      DEFAULT_DIMENSIONS,
      "EMBEDDING_DIMENSIONS"
    );

  const timeoutMs =
    parsePositiveInt(
      env.EMBEDDING_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      "EMBEDDING_TIMEOUT_MS"
    );

  const maxBatchSize =
    parsePositiveInt(
      env.EMBEDDING_MAX_BATCH_SIZE,
      DEFAULT_MAX_BATCH_SIZE,
      "EMBEDDING_MAX_BATCH_SIZE"
    );

  const model =
    env.EMBEDDING_MODEL?.trim()
    || (
      provider === "openai-compatible"
        ? "text-embedding-3-small"
        : "deterministic-hash-v1"
    );

  const config: EmbeddingConfig = {
    provider,
    model,
    dimensions,
    timeoutMs,
    maxBatchSize
  };

  if (env.EMBEDDING_API_KEY?.trim()) {
    config.apiKey = env.EMBEDDING_API_KEY.trim();
  }

  if (env.EMBEDDING_BASE_URL?.trim()) {
    config.baseUrl = env.EMBEDDING_BASE_URL.trim();
  }

  return config;

}
