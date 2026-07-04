import type { ParsedDocument } from "@knowledge/shared";
import type { KnowledgeEntity } from "../models/entity.js";

export class ProposalRule {

  extract(document: ParsedDocument): KnowledgeEntity {

    return {

      id: `PEP-${document.metadata.pep}`,

      type: "Proposal",

      properties: {

        title: document.metadata.title,

        status: document.metadata.status,

        type: document.metadata.type,

        created: document.metadata.created

      }

    };

  }

}