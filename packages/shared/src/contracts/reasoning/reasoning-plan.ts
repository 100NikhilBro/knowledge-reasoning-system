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

export interface ReasoningPlan {

  strategy: ReasoningStrategy;

  maxDepth: number;

}