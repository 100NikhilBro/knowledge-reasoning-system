import type { ParsedDocument } from "@knowledge/shared";

import type { KnowledgeEntity } from "../models/entity.js";

import { ProposalRule } from "../rules/proposal.rule.js";
import { AuthorRule } from "../rules/author.rule.js";

export class EntityExtractor {

  private proposalRule = new ProposalRule();

  private authorRule = new AuthorRule();

  extract(document: ParsedDocument): KnowledgeEntity[] {

    return [

      this.proposalRule.extract(document),

      this.authorRule.extract(document)

    ];

  }

}