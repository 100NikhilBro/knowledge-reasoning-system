import type { ParsedDocument } from "@knowledge/shared";
import type { ExtractionRule } from "../contracts/extraction-rule.js";
import type { KnowledgeEntity } from "../models/entity.js";

export class FeatureRule implements ExtractionRule {

    readonly name = "FeatureRule";

  extract(document: ParsedDocument): KnowledgeEntity | null {

    const content = document.sections
      .map(section => section.content.toLowerCase())
      .join(" ");

    if (
      content.includes("type hint") ||
      content.includes("type hints") ||
      content.includes("typing")
    ) {

      return {

        id: "feature:typing",

        type: "Feature",

        label: "Typing",

        source: "pep-484.md",

        confidence: 0.9,

        properties: {

          name: "Typing"

        }

      };

    }

    return null;

  }

}