export interface IndexingResult {

  /**
   * Number of entities successfully submitted for upsert.
   */
  indexed: number;

  /**
   * Entity ids in the order they were indexed.
   */
  entityIds: string[];

}
