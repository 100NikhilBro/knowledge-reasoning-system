import type { KnowledgeEntity }
from "../knowledge-entity.js";

import type { KnowledgeRelationship }
from "../knowledge-relationship.js";

import type { GraphPath }
from "../graph/graph-path.js";

export interface RetrievalResult {

  entity: KnowledgeEntity;

  score: number;

  source: "graph" | "vector";

  /**
   * Real graph edge that discovered or grounds this entity.
   * Absent for vector/entity-only hits.
   */
  relationship?: KnowledgeRelationship;

  /**
   * Optional multi-hop path provenance when available from expansion.
   */
  path?: GraphPath;

  metadata?: Record<string, unknown>;

}
