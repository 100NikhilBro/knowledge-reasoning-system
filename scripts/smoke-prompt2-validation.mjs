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

function summarize(body) {
  const answer = typeof body.answer === "string" ? body.answer : "";
  const citations = Array.isArray(body.citations) ? body.citations : [];
  const steps = Array.isArray(body.trace?.steps) ? body.trace.steps : [];
  const evidenceIds = [];
  for (const step of steps) {
    for (const ev of step.evidence || []) {
      if (ev?.entity?.id) evidenceIds.push(ev.entity.id);
    }
  }
  const banned = [
    "List[int]",
    "Dict[str, float]",
    "Callable[",
    "IMPLEMENTED_IN",
    "PythonVersion",
    "python version 3",
    "Python 3."
  ].filter((b) => answer.toLowerCase().includes(b.toLowerCase()));

  return {
    httpOk: true,
    confidence: body.confidence,
    answer,
    citationCount: citations.length,
    citations: citations.map((c) => ({
      entityId: c.entityId,
      source: c.source
    })),
    evidenceIds: [...new Set(evidenceIds)],
    stepCount: steps.length,
    verificationOutcome:
      answer.trim().length === 0 && (body.confidence ?? 0) === 0
        ? "fail-closed-empty"
        : "accepted",
    bannedOrInventedHints: banned
  };
}

async function reason(query) {
  const res = await fetch("http://127.0.0.1:3000/reason", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.API_KEY
    },
    body: JSON.stringify({ query, topK: 8 })
  });
  const body = await res.json();
  return {
    query,
    http: res.status,
    code: body.code,
    error: body.error ? redact(body.error) : undefined,
    ...summarize(body)
  };
}

const queries = [
  "What is PEP-484?",
  "Who proposed PEP-484?",
  "What feature does PEP-484 introduce?",
  "What concern is addressed by PEP-484?",
  "What decision resulted from PEP-484?",
  "Who proposed PEP-484, what feature did it introduce, what concern did it address, and what decision resulted from it?",
  "What is the relationship between PEP-484 and quantum computing?",
  "What decision resulted from PEP-484 and which Python version implemented it?"
];

const repeats = [
  "What is PEP-484?",
  "Who proposed PEP-484?",
  "What decision resulted from PEP-484?"
];

console.log("=== PRIMARY SMOKE ===");
for (const q of queries) {
  console.log(JSON.stringify(await reason(q), null, 2));
}

console.log("=== DETERMINISM REPEATS (3x) ===");
for (const q of repeats) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const r = await reason(q);
    runs.push({
      n: i + 1,
      confidence: r.confidence,
      answer: r.answer,
      evidenceIds: r.evidenceIds,
      citations: r.citations.map((c) => c.entityId),
      verificationOutcome: r.verificationOutcome
    });
  }
  console.log(JSON.stringify({ query: q, runs }, null, 2));
}
