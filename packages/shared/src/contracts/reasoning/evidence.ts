import type {
  KnowledgeEntity
} from "../knowledge-entity.js";

import type {
  KnowledgeRelationship
} from "../knowledge-relationship.js";

export interface Evidence {

  entity: KnowledgeEntity;

  score: number;

  source: string;

  /**
   * Present only when the reasoning pipeline already produced a relationship
   * for this evidence item (e.g. neighbor traversal).
   */
  relationship?: KnowledgeRelationship;

  /**
   * Optional retrieval provenance (e.g. hybrid sources, channel scores).
   * Never treated as public answer confidence.
   */
  metadata?: Record<string, unknown>;

}
