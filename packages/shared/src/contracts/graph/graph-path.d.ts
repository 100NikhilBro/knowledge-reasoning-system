import type { KnowledgeEntity } from "../knowledge-entity.js";
import type { KnowledgeRelationship } from "../knowledge-relationship.js";
export interface GraphPath {
    nodes: KnowledgeEntity[];
    relationships: KnowledgeRelationship[];
    length: number;
}
