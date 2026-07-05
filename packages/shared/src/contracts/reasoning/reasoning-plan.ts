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

}