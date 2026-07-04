import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";
import type { RelationshipRule } from "../contracts/relationship-rule.js";

export class ProposalConcernRule implements RelationshipRule {

     readonly name = "ProposalConcernRule";

  extract(
    entities: KnowledgeEntity[]
  ): KnowledgeRelationship | null {

    const proposal = entities.find(
      entity => entity.type === "Proposal"
    );

    const concern = entities.find(
      entity => entity.type === "Concern"
    );

    if (!proposal || !concern) {
      return null;
    }

    return {

      from: proposal.id,

      to: concern.id,

      type: "ADDRESSES",

      confidence: 0.9

    };

  }

}