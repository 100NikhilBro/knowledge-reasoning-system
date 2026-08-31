export type RetrievalMode =
  | "hybrid"
  | "graph"
  | "vector";

export interface RetrievalQuery {

  query: string;

  topK?: number;

  /**
   * Defaults to hybrid (graph + vector).
   */
  mode?: RetrievalMode;

}
