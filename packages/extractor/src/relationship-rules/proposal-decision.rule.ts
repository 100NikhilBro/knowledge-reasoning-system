import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";
import type { RelationshipRule } from "../contracts/relationship-rule.js";

/**
 * Proposal RESULTS_IN Decision when both entities were extracted.
 */
export class ProposalDecisionRule implements RelationshipRule {

  readonly name = "ProposalDecisionRule";

  extract(
    entities: KnowledgeEntity[]
  ): KnowledgeRelationship | null {

    const proposal = entities.find(
      entity => entity.type === "Proposal"
    );

    const decision = entities.find(
      entity => entity.type === "Decision"
    );

    if (!proposal || !decision) {
      return null;
    }

    return {
      from: proposal.id,
      to: decision.id,
      type: "RESULTS_IN",
      confidence: 1.0
    };

  }

}
