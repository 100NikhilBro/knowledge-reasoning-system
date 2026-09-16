import type { KnowledgeEntity } from "../knowledge-entity.js";
import type { KnowledgeRelationship } from "../knowledge-relationship.js";
export interface GraphPath {
    nodes: KnowledgeEntity[];
    relationships: KnowledgeRelationship[];
    length: number;
    /**
     * When set to shared_hub, relationships are independent spokes to/from
     * the hub node rather than a single directed chain.
     */
    topology?: "directed_chain" | "shared_hub";
}
