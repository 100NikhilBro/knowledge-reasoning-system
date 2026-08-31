import type { IndexingConfig } from "../types/indexing-config.js";

import { VectorStoreError } from "../errors/vector-store-error.js";

const DEFAULT_BATCH_SIZE = 64;

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

function parseBoolean(
  value: string | undefined,
  fallback: boolean
): boolean {

  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  throw new VectorStoreError(
    "INVALID_CONFIG",
    `INDEXING_ENSURE_COLLECTION must be a boolean (received "${value}")`
  );

}

/**
 * Resolve indexing defaults from environment.
 *
 * INDEXING_BATCH_SIZE=64
 * INDEXING_ENSURE_COLLECTION=true
 *
 * Falls back to EMBEDDING_MAX_BATCH_SIZE when INDEXING_BATCH_SIZE is unset.
 */
export function resolveIndexingConfig(
  env: NodeJS.ProcessEnv = process.env
): IndexingConfig {

  return {
    batchSize: parsePositiveInt(
      env.INDEXING_BATCH_SIZE ?? env.EMBEDDING_MAX_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      "INDEXING_BATCH_SIZE"
    ),
    ensureCollection: parseBoolean(
      env.INDEXING_ENSURE_COLLECTION,
      true
    )
  };

}
