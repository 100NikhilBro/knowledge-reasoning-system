#!/usr/bin/env node

/**
 * Validates environment completeness against .env.example.
 *
 * - Ensures .env.example defines the expected production keys
 * - When .env exists, warns if recommended keys are missing (values are not printed)
 * - Exits non-zero when .env.example documentation is incomplete
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const EXAMPLE_PATH = resolve(ROOT, ".env.example");
const ENV_PATH = resolve(ROOT, ".env");

/** Keys that must be present for a working local/prod API + infra stack. */
const REQUIRED_KEYS = [
  "NEO4J_URI",
  "NEO4J_USERNAME",
  "NEO4J_PASSWORD",
  "REDIS_URL",
  "API_KEY",
  "EMBEDDING_PROVIDER",
  "QDRANT_URL",
  "QDRANT_COLLECTION",
  "KNOWLEDGE_RAW_DIR",
  "KNOWLEDGE_PROCESSED_DIR"
];

/** Keys that should appear in .env.example for discoverability. */
const DOCUMENTED_KEYS = [
  ...REQUIRED_KEYS,
  "EMBEDDING_MODEL",
  "EMBEDDING_DIMENSIONS",
  "EMBEDDING_API_KEY",
  "EMBEDDING_BASE_URL",
  "EMBEDDING_TIMEOUT_MS",
  "EMBEDDING_MAX_BATCH_SIZE",
  "QDRANT_VECTOR_SIZE",
  "QDRANT_DISTANCE",
  "INDEXING_BATCH_SIZE",
  "INDEXING_ENSURE_COLLECTION",
  "INGESTION_QUEUE_NAME",
  "INGESTION_CONCURRENCY",
  "INGESTION_INITIALIZE_GRAPH_SCHEMA",
  "INGESTION_SUPPORTED_EXTENSIONS",
  "REASONING_CONTEXT_MAX_EVIDENCE",
  "LLM_PROVIDER",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "GROQ_BASE_URL",
  "GROQ_TIMEOUT_MS",
  "RATE_LIMIT_WINDOW_MS",
  "RATE_LIMIT_MAX_REQUESTS"
];

function parseEnvFile(contents) {
  const values = new Map();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    values.set(key, value);
  }

  return values;
}

function fail(message) {
  console.error(`[check-env] ${message}`);
  process.exitCode = 1;
}

if (!existsSync(EXAMPLE_PATH)) {
  fail(".env.example is missing");
  process.exit(1);
}

const example = parseEnvFile(readFileSync(EXAMPLE_PATH, "utf8"));

const missingFromExample = DOCUMENTED_KEYS.filter((key) => !example.has(key));

if (missingFromExample.length > 0) {
  fail(
    `.env.example missing documented keys: ${missingFromExample.join(", ")}`
  );
}

if (existsSync(ENV_PATH)) {
  const env = parseEnvFile(readFileSync(ENV_PATH, "utf8"));

  const missingRequired = REQUIRED_KEYS.filter((key) => {
    const value = env.get(key);
    return value === undefined || value.trim() === "";
  });

  if (missingRequired.length > 0) {
    console.warn(
      `[check-env] warning: .env missing recommended keys (values not shown): ${missingRequired.join(", ")}`
    );
    console.warn(
      "[check-env] copy from .env.example before running API/worker against real infra"
    );
  } else {
    console.log("[check-env] .env contains all required keys");
  }
} else {
  console.log(
    "[check-env] .env not found; validated .env.example documentation only"
  );
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[check-env] environment documentation looks complete");
