// import type { ParsedDocument } from "@knowledge/parser";
// import type { ExtractionRule } from "../contracts/extraction-rule.js";
// import type { KnowledgeEntity } from "../models/entity.js";
// import { buildGraphId } from "@knowledge/shared";
import { buildGraphId } from "@knowledge/shared";
export class FeatureRule {
    name = "FeatureRule";
    extract(document) {
        const content = document.sections
            .map(section => section.content.toLowerCase())
            .join(" ");
        if (content.includes("type hint") ||
            content.includes("type hints") ||
            content.includes("typing")) {
            const slug = "typing";
            return {
                id: buildGraphId("Feature", slug),
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
