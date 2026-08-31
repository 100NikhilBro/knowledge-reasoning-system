import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";
import type { RelationshipRule } from "../contracts/relationship-rule.js";
export declare class DecisionPythonVersionRule implements RelationshipRule {
    readonly name = "DecisionPythonVersionRule";
    extract(entities: KnowledgeEntity[]): KnowledgeRelationship | null;
}
