// // export interface RetrievalResult<T> {

// //   items: T[];

// //   total: number;

// // }





// import type { KnowledgeEntity } from "@knowledge/shared";

// export interface RetrievalResult {

//   entity: KnowledgeEntity;

//   score: number;

//   source: "graph" | "vector";

//   metadata?: Record<string, unknown>;

// }



export type {
  RetrievalResult
} from "@knowledge/shared";