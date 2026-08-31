import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

for (const line of fs
  .readFileSync(path.join(root, ".env"), "utf8")
  .split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i <= 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1);
}

function redact(value) {
  let s = String(value);
  for (const key of [
    "EMBEDDING_API_KEY",
    "GROQ_API_KEY",
    "API_KEY",
    "NEO4J_PASSWORD"
  ]) {
    const secret = process.env[key];
    if (secret) s = s.split(secret).join("[REDACTED]");
  }
  return s;
}

const { createEmbeddingProviderFromEnv, EmbeddingService } =
  await import("../packages/embeddings/dist/index.js");

const { createQdrantVectorStoreFromEnv, VectorStoreService } =
  await import("../packages/vector-store/dist/index.js");

const store = new VectorStoreService(
  createQdrantVectorStoreFromEnv(process.env),
  new EmbeddingService(createEmbeddingProviderFromEnv(process.env))
);

const collectionUrl = `${process.env.QDRANT_URL}/collections/${process.env.QDRANT_COLLECTION}`;
const col = await fetch(collectionUrl).then((r) => r.json());

console.log(
  JSON.stringify(
    {
      vector_size: col?.result?.config?.params?.vectors?.size,
      points_count: col?.result?.points_count,
      provider: process.env.EMBEDDING_PROVIDER,
      model: process.env.EMBEDDING_MODEL,
      embedding_dims: Number(process.env.EMBEDDING_DIMENSIONS),
      qdrant_size: Number(process.env.QDRANT_VECTOR_SIZE)
    },
    null,
    2
  )
);

const queries = [
  "Python type hints",
  "code readability",
  "Guido van Rossum",
  "standard notation for type information"
];

for (const query of queries) {
  try {
    const results = await store.searchByText(query, { topK: 5 });
    console.log(
      JSON.stringify(
        {
          query,
          hitCount: results.length,
          top: results.slice(0, 3).map((r) => ({
            id: r.entity?.id,
            label: r.entity?.label,
            type: r.entity?.type,
            score: Number(Number(r.score).toFixed(4)),
            source: r.entity?.source
          }))
        },
        null,
        2
      )
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        query,
        error: redact(error instanceof Error ? error.message : error),
        code: error?.code
      })
    );
  }
}
