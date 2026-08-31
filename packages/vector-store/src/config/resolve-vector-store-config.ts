import type {
  VectorDistance,
  VectorStoreConfig
} from "../types/vector-store-config.js";

import { VectorStoreError } from "../errors/vector-store-error.js";

const DEFAULT_URL = "http://localhost:6333";
const DEFAULT_COLLECTION = "knowledge_entities";
const DEFAULT_VECTOR_SIZE = 32;
const DEFAULT_DISTANCE: VectorDistance = "Cosine";
const DEFAULT_TIMEOUT_MS = 30_000;

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
    throw new VectorStoreError(
      "INVALID_CONFIG",
      `${field} must be a positive integer`
    );
  }

  return parsed;

}

function parseDistance(
  value: string | undefined
): VectorDistance {

  const distance =
    (value ?? DEFAULT_DISTANCE).trim();

  if (
    distance === "Cosine" ||
    distance === "Euclid" ||
    distance === "Dot"
  ) {
    return distance;
  }

  throw new VectorStoreError(
    "INVALID_CONFIG",
    `Unsupported QDRANT_DISTANCE "${value}". Use Cosine, Euclid, or Dot.`
  );

}

/**
 * Resolve vector store configuration from environment variables.
 *
 * QDRANT_URL=http://localhost:6333
 * QDRANT_COLLECTION=knowledge_entities
 * QDRANT_VECTOR_SIZE=32   (falls back to EMBEDDING_DIMENSIONS)
 * QDRANT_DISTANCE=Cosine
 * QDRANT_API_KEY=         (optional)
 * QDRANT_TIMEOUT_MS=30000
 */
export function resolveVectorStoreConfig(
  env: NodeJS.ProcessEnv = process.env
): VectorStoreConfig {

  const url =
    env.QDRANT_URL?.trim() || DEFAULT_URL;

  const collection =
    env.QDRANT_COLLECTION?.trim() || DEFAULT_COLLECTION;

  const vectorSize =
    parsePositiveInt(
      env.QDRANT_VECTOR_SIZE ?? env.EMBEDDING_DIMENSIONS,
      DEFAULT_VECTOR_SIZE,
      "QDRANT_VECTOR_SIZE"
    );

  const timeoutMs =
    parsePositiveInt(
      env.QDRANT_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      "QDRANT_TIMEOUT_MS"
    );

  const config: VectorStoreConfig = {
    url,
    collection,
    vectorSize,
    distance: parseDistance(env.QDRANT_DISTANCE),
    timeoutMs
  };

  if (env.QDRANT_API_KEY?.trim()) {
    config.apiKey = env.QDRANT_API_KEY.trim();
  }

  return config;

}
