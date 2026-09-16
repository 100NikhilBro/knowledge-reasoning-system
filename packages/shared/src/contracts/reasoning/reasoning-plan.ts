// export type ReasoningStrategy =

//   | "single-hop"

//   | "multi-hop"

//   | "comparison"

//   | "explanation";

// export interface ReasoningPlan {

//   strategy: ReasoningStrategy;

// }



export type ReasoningStrategy =

  | "single-hop"

  | "multi-hop"

  | "comparison"

  | "explanation";

export type TraversalType =

  | "bfs"

  | "dfs";

export interface ReasoningPlan {

  strategy: ReasoningStrategy;

  traversal: TraversalType;

  maxDepth: number;

  /**
   * When set, single-hop reasoning expands only these relationship types
   * and keeps their endpoints — avoiding unrelated neighbor noise.
   */
  focusRelationships?: string[];

  /**
   * When set, single-hop must ground an edge connecting both phrases.
   * If no such edge exists, evidence is emptied (fail closed).
   * Also passed for CONNECTED/BRIDGE so downstream path interpretation
   * receives explicit endpoints from the plan.
   */
  requireRelationshipBetween?: {
    left: string;
    right: string;
  };

  /**
   * Optional bridge phrase for BRIDGE_RELATIONSHIP plans.
   */
  bridgeEntity?: string;

  /**
   * Exact typed edge required for RELATIONSHIP asks with an explicit object.
   * source --predicate--> target must match; same-predicate spillover is rejected.
   */
  requireTypedEdge?: {
    subject: string;
    predicate: string;
    object: string;
    direction: "outgoing" | "incoming" | "undirected";
  };

  /**
   * Canonical query intent from P2 understanding (routing metadata).
   */
  intent?: string;

  /**
   * Deterministic rewritten representation that preserves user constraints.
   */
  rewrittenRepresentation?: string;

}
