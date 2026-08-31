export type VectorDistance =
  | "Cosine"
  | "Euclid"
  | "Dot";

export interface VectorStoreConfig {

  url: string;

  collection: string;

  vectorSize: number;

  distance: VectorDistance;

  /**
   * Optional Qdrant API key. Never hardcoded — read from env when needed.
   */
  apiKey?: string;

  timeoutMs?: number;

}
