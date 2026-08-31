# @knowledge/validator

Reserved workspace package for future **knowledge validation** and consistency checks
(schema constraints, extraction quality gates, graph integrity helpers).

## Status

Not implemented. The ingestion, graph, and reasoning packages currently own their
own validation boundaries (`verifyEvidence`, API request validation, Neo4j
constraints).

## Intended future scope

- Cross-entity consistency checks after extraction
- Optional CI gates over `knowledge_state`
- Shared validators used by worker + API without duplicating rules

Do not import this package until a concrete validator surface exists.
