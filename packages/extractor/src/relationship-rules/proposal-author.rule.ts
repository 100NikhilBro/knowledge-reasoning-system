import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";
import type { RelationshipRule } from "../contracts/relationship-rule.js";

export class ProposalAuthorRule implements RelationshipRule {

    readonly name = "ProposalAuthorRule";

  extract(
    entities: KnowledgeEntity[]
  ): KnowledgeRelationship | null {

    const proposal = entities.find(
      entity => entity.type === "Proposal"
    );

    const author = entities.find(
      entity => entity.type === "Author"
    );

    if (!proposal || !author) {
      return null;
    }

    return {

      from: proposal.id,

      to: author.id,

      type: "PROPOSED_BY",

      confidence: 1.0

    };

  }

}