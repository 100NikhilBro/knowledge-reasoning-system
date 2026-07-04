import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";
import type { RelationshipRule } from "../contracts/relationship-rule.js";

export class ProposalFeatureRule implements RelationshipRule {

    readonly name = "ProposalFeatureRule";

  extract(
    entities: KnowledgeEntity[]
  ): KnowledgeRelationship | null {

    const proposal = entities.find(
      entity => entity.type === "Proposal"
    );

    const feature = entities.find(
      entity => entity.type === "Feature"
    );

    if (!proposal || !feature) {
      return null;
    }

    return {
      from: proposal.id,
      to: feature.id,
      type: "INTRODUCES",
      confidence: 0.9
    };

  }

}