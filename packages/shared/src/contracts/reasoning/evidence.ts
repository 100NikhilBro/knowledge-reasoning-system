import type {
  KnowledgeEntity
} from "../knowledge-entity.js";

import type {
  KnowledgeRelationship
} from "../knowledge-relationship.js";

import type {
  GraphPath
} from "../graph/graph-path.js";

export interface Evidence {

  entity: KnowledgeEntity;

  score: number;

  source: string;

  /**
   * Present only when the pipeline has an attested graph edge for this item.
   * Entity co-occurrence alone must never invent this field.
   */
  relationship?: KnowledgeRelationship;

  /**
   * Multi-hop path provenance (nodes + relationships + length) when known.
   */
  path?: GraphPath;

  /**
   * Optional retrieval provenance (e.g. hybrid sources, channel scores).
   * Never treated as public answer confidence.
   */
  metadata?: Record<string, unknown>;

}
