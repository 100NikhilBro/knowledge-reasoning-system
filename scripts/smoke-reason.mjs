import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

const queries = [
  "What is PEP-484?",
  "Who proposed PEP-484?",
  "How do type hints relate to code readability?"
];

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("API_KEY missing");
  process.exit(1);
}

for (const query of queries) {
  const started = Date.now();
  try {
    const response = await fetch("http://127.0.0.1:3000/reason", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({ query, topK: 8 })
    });

    const body = await response.json();
    const answer = typeof body.answer === "string" ? body.answer : "";
    console.log(
      JSON.stringify(
        {
          query,
          http: response.status,
          ms: Date.now() - started,
          confidence: body.confidence,
          answerPreview: answer.slice(0, 220),
          citationCount: Array.isArray(body.citations)
            ? body.citations.length
            : 0,
          citations: Array.isArray(body.citations)
            ? body.citations.slice(0, 5).map((c) => ({
                entityId: c.entityId,
                source: c.source
              }))
            : [],
          error: body.error ? redact(body.error) : undefined,
          code: body.code
        },
        null,
        2
      )
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        query,
        error: redact(error instanceof Error ? error.message : error)
      })
    );
  }
}
