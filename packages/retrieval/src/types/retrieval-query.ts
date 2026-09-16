export type RetrievalMode =
  | "hybrid"
  | "graph"
  | "vector";

/**
 * Optional claim fragment for claim-aware retrieval (from P2).
 */
export interface RetrievalClaimHint {
  subject?: string;
  predicate: string;
  object?: string;
}

export interface RetrievalQuery {

  query: string;

  topK?: number;

  /**
   * Defaults to hybrid (graph + vector).
   */
  mode?: RetrievalMode;

  /**
   * Canonical P2 intent when available (routing metadata only).
   */
  intent?: string;

  /**
   * Soft-normalized entities extracted by query understanding.
   */
  entities?: string[];

  /**
   * Ontology relationship types requested by the query.
   */
  relationshipRequested?: string[];

  /**
   * Structured claims for implication / compound evaluation.
   */
  claims?: RetrievalClaimHint[];

  /**
   * Deterministic rewritten representation (preserves user constraints).
   */
  rewrittenRepresentation?: string;

  /**
   * Candidate generation size before quality gates / final ranking.
   * Defaults to max(topK * 3, 15) in hybrid mode.
   */
  candidateK?: number;

  /**
   * Fusion strategy. Default retains current max-norm weighted fusion.
   */
  fusion?: "weighted" | "wrrf";

}
