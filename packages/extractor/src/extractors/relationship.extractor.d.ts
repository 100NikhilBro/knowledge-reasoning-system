import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";
export declare class RelationshipExtractor {
    private readonly rules;
    extract(entities: KnowledgeEntity[]): KnowledgeRelationship[];
}
