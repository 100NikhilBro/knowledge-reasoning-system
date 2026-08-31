/**
 * Narrow Qdrant surface used by QdrantVectorStore.
 * Enables constructor DI and unit tests without a live server.
 */
export interface QdrantClientPort {

  getCollections(): Promise<{
    collections: Array<{ name: string }>;
  }>;

  /**
   * Optional — used to verify existing collection vector size.
   * Real Qdrant clients implement this; tests may omit it.
   */
  getCollection?(
    collectionName: string
  ): Promise<unknown>;

  createCollection(
    collectionName: string,
    options: {
      vectors: {
        size: number;
        distance: "Cosine" | "Euclid" | "Dot";
      };
    }
  ): Promise<unknown>;

  /**
   * Optional — migration/reindex tooling may delete an incompatible collection.
   */
  deleteCollection?(
    collectionName: string
  ): Promise<unknown>;

  upsert(
    collectionName: string,
    options: {
      wait?: boolean;
      points: Array<{
        id: string | number;
        vector: number[];
        payload?: Record<string, unknown>;
      }>;
    }
  ): Promise<unknown>;

  query(
    collectionName: string,
    options: {
      query: number[];
      limit?: number;
      score_threshold?: number;
      with_payload?: boolean;
    }
  ): Promise<{
    points: Array<{
      id: string | number;
      score?: number;
      payload?: Record<string, unknown> | null;
    }>;
  }>;

}
