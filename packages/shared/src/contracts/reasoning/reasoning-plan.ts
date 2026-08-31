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
   */
  requireRelationshipBetween?: {
    left: string;
    right: string;
  };

}