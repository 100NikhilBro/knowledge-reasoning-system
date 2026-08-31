import type { KnowledgeEntity } from "@knowledge/shared";

import type { IndexingOptions } from "../types/indexing-options.js";
import type { IndexingResult } from "../types/indexing-result.js";

/**
 * Indexes KnowledgeEntity objects into the vector store.
 *
 * Implementations must embed via @knowledge/embeddings and persist via VectorStore,
 * without Neo4j or Qdrant-specific logic in the caller-facing API.
 */
export interface EntityIndexer {

  index(
    entities: KnowledgeEntity | KnowledgeEntity[],
    options?: IndexingOptions
  ): Promise<IndexingResult>;

}
