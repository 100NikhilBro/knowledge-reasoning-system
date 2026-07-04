import type { KnowledgeEntity } from "../knowledge-entity.js";
import type { KnowledgeRelationship } from "../knowledge-relationship.js";

export interface GraphNeighbor {

  relationship: KnowledgeRelationship;

  neighbor: KnowledgeEntity;

}