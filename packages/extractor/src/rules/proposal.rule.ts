import type { ParsedDocument } from "@knowledge/shared";
import type { KnowledgeEntity } from "../models/entity.js";
import type { ExtractionRule } from "../contracts/extraction-rule.js";

export class ProposalRule implements ExtractionRule {

readonly name = "ProposalRule";

  extract(document: ParsedDocument): KnowledgeEntity {

    return {

  id: `proposal:PEP-${document.metadata.pep}`,

  type: "Proposal",

  label: document.metadata.title,

  source: "pep-484.md",

  confidence: 1.0,

  properties: {

    pep: document.metadata.pep,

    title: document.metadata.title,

    status: document.metadata.status,

    type: document.metadata.type,

    created: document.metadata.created

  }

};

  }

}