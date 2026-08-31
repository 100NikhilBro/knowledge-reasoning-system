import type { RetrievalResult } from "@knowledge/shared";

import type { VectorRecord } from "../types/vector-record.js";
import type { VectorSearchQuery } from "../types/vector-search-query.js";

/**
 * Replaceable vector storage backend.
 *
 * Operates on embedding vectors so it can store document embeddings
 * and search with query embeddings interchangeably.
 */
export interface VectorStore {

  ensureCollection(): Promise<void>;

  /**
   * Optional migration helper — remove the collection so it can be
   * recreated at the current configured vector size.
   */
  deleteCollection?(): Promise<void>;

  upsert(
    records: VectorRecord[]
  ): Promise<void>;

  /**
   * Similarity search. Returns [] when nothing matches.
   */
  search(
    query: VectorSearchQuery
  ): Promise<RetrievalResult[]>;

}
