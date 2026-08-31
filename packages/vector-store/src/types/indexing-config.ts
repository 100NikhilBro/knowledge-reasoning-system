export interface IndexingConfig {

  /**
   * Default batch size for multi-entity indexing.
   */
  batchSize: number;

  /**
   * Whether to ensure the collection exists before indexing by default.
   */
  ensureCollection: boolean;

}
