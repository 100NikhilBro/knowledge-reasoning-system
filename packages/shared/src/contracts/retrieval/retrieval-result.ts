import type { KnowledgeEntity }
from "../knowledge-entity.js";

export interface RetrievalResult {

  entity: KnowledgeEntity;

  score: number;

  source: "graph" | "vector";

  metadata?: Record<string, unknown>;

}