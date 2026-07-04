import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";
import type { RelationshipRule } from "../contracts/relationship-rule.js";

import { ProposalAuthorRule } from "../relationship-rules/proposal-author.rule.js";
import { ProposalFeatureRule } from "../relationship-rules/proposal-feature.rule.js";
import { ProposalConcernRule } from "../relationship-rules/proposal-concern.rule.js";

export class RelationshipExtractor {

  private readonly rules: RelationshipRule[] = [
    new ProposalAuthorRule(),
    new ProposalFeatureRule(),
    new ProposalConcernRule()
  ];

  extract(
    entities: KnowledgeEntity[]
  ): KnowledgeRelationship[] {

    const relationships: KnowledgeRelationship[] = [];

    for (const rule of this.rules) {

      const relationship = rule.extract(entities);

      if (relationship) {
        relationships.push(relationship);
      }

    }

    return relationships;

  }

}