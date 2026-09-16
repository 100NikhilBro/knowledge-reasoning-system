import type { ParsedDocument } from "@knowledge/parser";
import type { ExtractionRule } from "../contracts/extraction-rule.js";
import type { KnowledgeEntity } from "../models/entity.js";

import { buildGraphId } from "@knowledge/shared";

import { resolveDocumentSource } from "../utils/resolve-document-source.js";

export class ConcernRule implements ExtractionRule {

  readonly name = "ConcernRule";

  extract(document: ParsedDocument): KnowledgeEntity | null {

    const content = document.sections
      .map(section => section.content.toLowerCase())
      .join(" ");

    if (content.includes("readability")) {

      return {

        id: buildGraphId(
          "Concern",
          "Readability"
        ),

        type: "Concern",

        label: "Readability",

        source: resolveDocumentSource(document),

        confidence: 0.9,

        properties: {

          name: "Readability"

        }

      };

    }

    return null;

  }

}
