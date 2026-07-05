import type {
  KnowledgeEntity
} from "../knowledge-entity.js";

export interface Evidence {

  entity: KnowledgeEntity;

  score: number;

  source: string;

}