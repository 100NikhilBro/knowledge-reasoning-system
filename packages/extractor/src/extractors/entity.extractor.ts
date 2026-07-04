import type { ParsedDocument } from "@knowledge/parser";

import type { KnowledgeEntity } from "../models/entity.js";
import type { ExtractionRule } from "../contracts/extraction-rule.js";

import { ProposalRule } from "../rules/proposal.rule.js";
import { AuthorRule } from "../rules/author.rule.js";


import { FeatureRule } from "../rules/feature.rule.js";
import { ConcernRule } from "../rules/concern.rule.js";

export class EntityExtractor {

  private readonly rules: ExtractionRule[] = [
  new ProposalRule(),
  new AuthorRule(),
  new FeatureRule(),
  new ConcernRule()
];

  extract(document: ParsedDocument): KnowledgeEntity[] {

    const entities: KnowledgeEntity[] = [];

    for (const rule of this.rules) {

      const entity = rule.extract(document);

      if (entity) {
        entities.push(entity);
      }

    }

    return entities;

  }

}