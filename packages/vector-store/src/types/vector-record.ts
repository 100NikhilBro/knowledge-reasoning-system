import type { KnowledgeEntity } from "@knowledge/shared";
import type { EmbeddingVector } from "@knowledge/embeddings";

/**
 * A document/entity embedding ready for persistence.
 */
export interface VectorRecord {

  /**
   * Stable business id (typically KnowledgeEntity.id).
   * Stored in payload; mapped to a Qdrant point UUID.
   */
  id: string;

  vector: EmbeddingVector;

  entity: KnowledgeEntity;

  /**
   * Extra searchable / diagnostic metadata.
   */
  metadata?: Record<string, unknown>;

}
