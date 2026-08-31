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
  "What feature does PEP-484 introduce?",
  "How can Python code express expected types?",
  "What decision resulted from PEP-484?",
  "What is the relationship between PEP-484 and quantum computing?"
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
    const banned = [
      "List[int]",
      "Dict[str, float]",
      "Callable[..., str]",
      "Callable["
    ];
    const containsBanned = banned.filter((b) => answer.includes(b));

    console.log(
      JSON.stringify(
        {
          query,
          http: response.status,
          ms: Date.now() - started,
          confidence: body.confidence,
          answer,
          citationCount: Array.isArray(body.citations)
            ? body.citations.length
            : 0,
          citations: Array.isArray(body.citations)
            ? body.citations.map((c) => ({
                entityId: c.entityId,
                source: c.source
              }))
            : [],
          evidenceHint: Array.isArray(body.trace?.steps)
            ? body.trace.steps.reduce(
                (n, step) =>
                  n + (Array.isArray(step.evidence) ? step.evidence.length : 0),
                0
              )
            : 0,
          verificationOutcome:
            response.status === 200
              ? answer.trim().length === 0 && (body.confidence ?? 0) === 0
                ? "fail-closed-empty"
                : "accepted"
              : `error:${body.code || response.status}`,
          bannedFragmentsPresent: containsBanned,
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
