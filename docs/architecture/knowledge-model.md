# Knowledge model

Operational entity and relationship vocabulary used by extraction, graph schema,
and reasoning evidence.

## Entity types

| Type            | Purpose                             | Example IDs          |
| --------------- | ----------------------------------- | -------------------- |
| `Proposal`      | PEP / proposal documents            | `proposal:PEP-484`   |
| `Person`        | Authors / people                    | `person:...`         |
| `Organization`  | Orgs                                | `organization:...`   |
| `Concept`       | Abstract concepts                   | `concept:...`        |
| `Feature`       | Language / product features         | `feature:typing`     |
| `Concern`       | Issues / motivations                | `concern:...`        |
| `Decision`      | Explicit decisions recorded in docs | `decision:...`       |
| `PythonVersion` | Version nodes                       | `python-version:...` |

## Relationship types

| Type                         | Meaning                                  |
| ---------------------------- | ---------------------------------------- |
| `AUTHORED_BY`                | Proposal → Person                        |
| `INTRODUCES` / feature links | Proposal → Feature (via extractor rules) |
| `ADDRESSES` / concern links  | Proposal → Concern                       |
| `RESULTS_IN`                 | Proposal / decision outcomes             |
| `IMPLEMENTED_IN`             | Feature / proposal → PythonVersion       |

Exact relationship rule names live under `packages/extractor/src/relationship-rules/`.

## Evidence shape

Reasoning consumes `Evidence` from `@knowledge/shared`:

- `entity` — id, type, label, source, confidence, properties
- `score` — ranking score
- `source` — provenance channel (`graph`, `vector`, …)
- optional `relationship` when traversal already produced one

## Graph constraints / indexes

Neo4j uniqueness and indexes are defined in
`packages/knowledge-graph/src/schema/` (`constraints`, `indexes`).

## Gaps

- Some relationship ideas (for example `RELATED_TO`, `SUPERSEDES`) may still be
  unsupported by extractor rules / graph schema.
- `packages/validator` does not yet centralize cross-document consistency checks;
  synthesis uses `verifyEvidence` inside `@knowledge/reasoning`.
