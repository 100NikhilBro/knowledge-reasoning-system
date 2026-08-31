#!/usr/bin/env node

/**
 * Prepare Qdrant for a semantic embedding migration.
 *
 * When switching from deterministic (e.g. 32-d) vectors to openai-compatible
 * semantic embeddings, the existing collection MUST be deleted and entities
 * reindexed. Mixing vector spaces silently breaks retrieval.
 *
 * Usage (from monorepo root, after updating .env):
 *   node scripts/recreate-qdrant-collection.mjs
 *
 * Then re-ingest so EntityIndexer writes semantic vectors:
 *   # remove processed marker for docs that need reindexing, e.g.
 *   # knowledge_state/processed/<doc>/...
 *   pnpm --filter @knowledge/worker produce
 *   pnpm --filter @knowledge/worker start   # or pnpm dev:worker
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_PATH = resolve(ROOT, ".env");

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

    values.set(
      line.slice(0, separator).trim(),
      line.slice(separator + 1).trim()
    );
  }

  return values;
}

function loadEnv() {
  const env = { ...process.env };

  if (existsSync(ENV_PATH)) {
    for (const [key, value] of parseEnvFile(readFileSync(ENV_PATH, "utf8"))) {
      if (env[key] === undefined || env[key] === "") {
        env[key] = value;
      }
    }
  }

  return env;
}

function fail(message) {
  console.error(`[recreate-qdrant] ${message}`);
  process.exit(1);
}

const env = loadEnv();

const provider = (env.EMBEDDING_PROVIDER || "deterministic").trim();
const embeddingDims = Number(env.EMBEDDING_DIMENSIONS || "");
const qdrantSize = Number(
  env.QDRANT_VECTOR_SIZE || env.EMBEDDING_DIMENSIONS || ""
);
const url = (env.QDRANT_URL || "http://localhost:6333").replace(/\/$/, "");
const collection = env.QDRANT_COLLECTION?.trim() || "knowledge_entities";

if (provider === "deterministic") {
  console.warn(
    "[recreate-qdrant] EMBEDDING_PROVIDER is still deterministic. " +
      "Set openai-compatible + EMBEDDING_DIMENSIONS + matching QDRANT_VECTOR_SIZE first."
  );
}

if (
  !Number.isInteger(embeddingDims) ||
  embeddingDims < 2 ||
  !Number.isInteger(qdrantSize) ||
  qdrantSize < 2
) {
  fail(
    "Set EMBEDDING_DIMENSIONS and QDRANT_VECTOR_SIZE to the same positive integer " +
      "(e.g. 1536 for text-embedding-3-small)."
  );
}

if (embeddingDims !== qdrantSize) {
  fail(
    `EMBEDDING_DIMENSIONS (${embeddingDims}) != QDRANT_VECTOR_SIZE (${qdrantSize})`
  );
}

const headers = {
  "Content-Type": "application/json"
};

if (env.QDRANT_API_KEY?.trim()) {
  headers["api-key"] = env.QDRANT_API_KEY.trim();
}

const collectionUrl = `${url}/collections/${encodeURIComponent(collection)}`;

console.log(
  `[recreate-qdrant] deleting collection "${collection}" at ${url} ` +
    `(target vector size ${qdrantSize}, provider=${provider})`
);

const response = await fetch(collectionUrl, {
  method: "DELETE",
  headers
});

if (response.status === 404) {
  console.log("[recreate-qdrant] collection did not exist — nothing to delete");
} else if (!response.ok) {
  const body = await response.text();
  fail(`Qdrant DELETE failed HTTP ${response.status}: ${body.slice(0, 200)}`);
} else {
  console.log("[recreate-qdrant] collection deleted");
}

console.log(
  [
    "[recreate-qdrant] next steps:",
    "  1. Clear processed markers for documents that need semantic reindex",
    "     (e.g. knowledge_state/processed/... for PEP-484).",
    "  2. pnpm --filter @knowledge/worker produce",
    "  3. pnpm dev:worker  # EntityIndexer embeds with the configured provider",
    "  4. Confirm collection vector size via GET /collections/<name>",
    "  5. Query vector retrieval before trusting hybrid/LLM answers"
  ].join("\n")
);
