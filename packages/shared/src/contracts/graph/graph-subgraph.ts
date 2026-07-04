import type { KnowledgeEntity } from "../knowledge-entity.js";
import type { KnowledgeRelationship } from "../knowledge-relationship.js";

export interface GraphSubgraph {

  nodes: KnowledgeEntity[];

  relationships: KnowledgeRelationship[];

}