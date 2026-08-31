import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";
import type { RelationshipRule } from "../contracts/relationship-rule.js";
export declare class ProposalDecisionRule implements RelationshipRule {
    readonly name = "ProposalDecisionRule";
    extract(entities: KnowledgeEntity[]): KnowledgeRelationship | null;
}
