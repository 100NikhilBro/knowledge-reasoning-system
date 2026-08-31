import type { ParsedDocument } from "@knowledge/parser";
import type { KnowledgeEntity } from "../models/entity.js";
import type { ExtractionRule } from "../contracts/extraction-rule.js";

import { buildGraphId } from "@knowledge/shared";

import { resolveDocumentSource } from "../utils/resolve-document-source.js";

/**
 * Extracts a Decision from PEP status metadata when present.
 * Example evidence: Status: Accepted
 */
export class DecisionRule implements ExtractionRule {

  readonly name = "DecisionRule";

  extract(
    document: ParsedDocument
  ): KnowledgeEntity | null {

    const status =
      document.metadata.status?.trim();

    if (!status) {
      return null;
    }

    const slug =
      status
        .toLowerCase()
        .replace(/\s+/g, "-");

    return {

      id: buildGraphId(
        "Decision",
        slug
      ),

      type: "Decision",

      label: status,

      source: resolveDocumentSource(document),

      confidence: 1.0,

      properties: {

        outcome: status

      }

    };

  }

}
