# Architecture overview

## Runtime path

```text
Client
  → apps/api  (security headers, request ID, logging, JSON)
      → /health (public)
      → /reason
          → API key auth
          → rate limit (in-memory)
          → request validation
          → DefaultReasoningEngine
              → evidence collection (hybrid retrieval: Neo4j + Qdrant)
              → planner (strategy selection)
              → graph reasoning / traversal
              → evidence synthesis
              → context construction (budgeted)
              → answer / explanation generation
              → citation + answer verification
          → public ReasoningResult
```

## Ingestion path

```text
knowledge_state/raw
  → RawDocumentDiscovery
  → DocumentIngestionProducer (BullMQ, deterministic job IDs)
  → DocumentIngestionService
      → parse → extract → Neo4j persist → vector index
  → processed marking (filesystem)
```

## Trust boundaries

| Boundary              | Guarantees                                             |
| --------------------- | ------------------------------------------------------ |
| API auth / rate limit | Protects `/reason`; `/health` stays public             |
| Request validation    | Rejects malformed `query` / `topK` / `sessionId`       |
| Reasoning context     | Answers grounded only in verified, budgeted evidence   |
| Answer verification   | Drops invalid citations; fails closed to empty result  |
| API error mapping     | Clients never receive stacks, secrets, or infra errors |
| Logging               | Structured JSON; credentials redacted                  |

## Supported reasoning strategies

Planner selects among `single-hop`, `multi-hop`, `comparison`, and `explanation`.
The strategy factory currently maps `explanation` to the single-hop implementation
(no dedicated explanation strategy class yet).

## Infrastructure

| Service | Default                  | Used by                 |
| ------- | ------------------------ | ----------------------- |
| Neo4j   | `bolt://localhost:7687`  | graph + retrieval       |
| Redis   | `redis://localhost:6379` | working-memory + BullMQ |
| Qdrant  | `http://localhost:6333`  | vector store / indexing |

See `docker/docker-compose.yml` and `.env.example`.

## Package map

See the root [README](../../README.md) for the package/app table.

## Gaps / reserved areas

- `packages/validator` — reserved; no shared validator surface yet
- Distributed rate limiting — not implemented (process-local only)
- Live Redis/Neo4j/Qdrant E2E in CI — deployment verification, not required for unit/integration fakes
- Default local embeddings use `deterministic` (hash) vectors for zero-key
  tests. Production semantic retrieval uses `openai-compatible`
  (`text-embedding-3-small`, explicit `EMBEDDING_DIMENSIONS`, matching
  `QDRANT_VECTOR_SIZE`). Recreate/reindex Qdrant when changing dimensions —
  see `.env.example` and `scripts/recreate-qdrant-collection.mjs`.
- Graph retrieval still does label-scoped in-memory token ranking (usable, not scaled)
