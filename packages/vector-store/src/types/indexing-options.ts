export interface IndexingOptions {

  /**
   * Extra metadata applied to every indexed entity in this call.
   */
  metadata?: Record<string, unknown>;

  /**
   * When true (default), ensure the vector collection exists before upsert.
   */
  ensureCollection?: boolean;

  /**
   * Max entities embedded/upserted per batch.
   * Defaults to indexing config / 64.
   */
  batchSize?: number;

}
