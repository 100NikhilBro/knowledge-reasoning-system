# Knowledge Reasoning System

Monorepo for a knowledge-based reasoning stack: ingest PEP-style documents, persist
a Neo4j knowledge graph, optionally index vectors in Qdrant, and answer questions
through a grounded reasoning API.

## Stack

| Layer            | Package / app              | Role                                                                        |
| ---------------- | -------------------------- | --------------------------------------------------------------------------- |
| API              | `apps/api`                 | Authenticated `/reason` + `/health`, validation, rate limits, observability |
| Worker           | `apps/worker`              | BullMQ document ingestion orchestration                                     |
| Shared contracts | `packages/shared`          | Entities, evidence, reasoning result types                                  |
| Parser           | `packages/parser`          | PEP markdown parsing                                                        |
| Extractor        | `packages/extractor`       | Rule-based entity/relationship extraction                                   |
| Graph            | `packages/knowledge-graph` | Neo4j persistence + traversal                                               |
| Retrieval        | `packages/retrieval`       | Graph / vector / hybrid retrieval                                           |
| Embeddings       | `packages/embeddings`      | Embedding providers                                                         |
| Vector store     | `packages/vector-store`    | Qdrant + entity indexing                                                    |
| Reasoning        | `packages/reasoning`       | Planner, strategies, context, verification                                  |
| Working memory   | `packages/working-memory`  | Redis session state                                                         |
| Validator        | `packages/validator`       | Reserved (not implemented)                                                  |
| Web              | `apps/web`                 | Reasoning workspace UI consuming `/reason` + `/health`                      |

## Prerequisites

- Node.js `>= 22`
- pnpm `10.33.2` (see `packageManager`)
- Docker (Neo4j, Redis, Qdrant) via `docker/docker-compose.yml`

## Quick start

```bash
# Infrastructure
docker compose -f docker/docker-compose.yml up -d

# Dependencies
pnpm install

# Environment
cp .env.example .env
# Set API_KEY and review Neo4j/Redis/Qdrant settings

pnpm check:env
pnpm build
```

### Run API

```bash
pnpm dev:api
# GET  /health
# POST /reason  (header: x-api-key: <API_KEY>)
# Production default wires hybrid retrieval (Neo4j + Qdrant) and Groq LLM
# generation from .env (GROQ_API_KEY required when LLM_PROVIDER=groq)
```

### Run web UI

```bash
# In apps/web/.env.local (gitignored):
# VITE_API_BASE_URL=/api
# VITE_API_KEY=<same value as API_KEY>

pnpm --filter @knowledge/web install   # first time
pnpm dev:web
# Open http://localhost:5173/
# Vite proxies /api → http://localhost:3000 (no CORS changes required)
```

### End-to-end local loop

```bash
docker compose -f docker/docker-compose.yml up -d
cp .env.example .env   # then set API_KEY
pnpm build

pnpm --filter @knowledge/worker produce
pnpm dev:worker        # ingest → Neo4j + Qdrant (paths resolve from monorepo root)

# separate terminals:
pnpm dev:api
pnpm dev:web
```

### Run ingestion worker

```bash
pnpm --filter @knowledge/worker produce   # enqueue discovered raw docs
pnpm dev:worker                           # process queue
```

## Embeddings (semantic production)

| Setting                | Local / CI default      | Production semantic           |
| ---------------------- | ----------------------- | ----------------------------- |
| `EMBEDDING_PROVIDER`   | `deterministic`         | `openai-compatible`           |
| `EMBEDDING_MODEL`      | `deterministic-hash-v1` | `text-embedding-3-small`      |
| `EMBEDDING_DIMENSIONS` | `32`                    | **required** (e.g. `1536`)    |
| `QDRANT_VECTOR_SIZE`   | same as dims            | **must equal** embedding dims |

Switching providers or dimensions requires deleting the Qdrant collection and
reindexing (`node scripts/recreate-qdrant-collection.mjs`, then clear processed
markers and re-run the worker). Do not mix deterministic and semantic vectors.

## Root scripts

| Script                                              | Purpose                                          |
| --------------------------------------------------- | ------------------------------------------------ |
| `pnpm build`                                        | Build all workspace packages/apps                |
| `pnpm test`                                         | Run all package tests                            |
| `pnpm lint` / `pnpm lint:fix`                       | ESLint                                           |
| `pnpm format` / `pnpm format:check`                 | Prettier                                         |
| `pnpm typecheck`                                    | `tsc --noEmit` across the workspace              |
| `pnpm check:env`                                    | Validate `.env.example` (+ `.env` if present)    |
| `node scripts/recreate-qdrant-collection.mjs`       | Delete Qdrant collection before semantic reindex |
| `pnpm dev:api` / `pnpm dev:worker` / `pnpm dev:web` | App entrypoints                                  |

## API contract (summary)

**Success `/reason`**

```json
{
  "answer": "string",
  "confidence": 0,
  "citations": [{ "entityId": "string", "source": "string" }],
  "trace": { "steps": [] },
  "explanation": { "answer": "string", "reasoning": ["string"] }
}
```

**Errors**

```json
{ "error": "Unauthorized", "code": "UNAUTHORIZED" }
```

Codes: `INVALID_REQUEST` (400), `UNAUTHORIZED` (401), `RATE_LIMITED` (429),
`REASONING_FAILED` (500). Responses include `x-request-id`.

## Documentation

- [Architecture overview](docs/architecture/overview.md)
- [Knowledge model](docs/architecture/knowledge-model.md)
- [Environment variables](.env.example)

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs `check:env`, format check, lint,
typecheck, build, and test on pushes/PRs.
