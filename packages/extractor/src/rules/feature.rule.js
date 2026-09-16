import { buildGraphId } from "@knowledge/shared";
import { resolveDocumentSource } from "../utils/resolve-document-source.js";

export class FeatureRule {
    name = "FeatureRule";
    extract(document) {
        const content = document.sections
            .map(section => section.content.toLowerCase())
            .join(" ");
        if (content.includes("type hint") ||
            content.includes("type hints") ||
            content.includes("typing")) {
            return {
                id: buildGraphId("Feature", "Typing"),
                type: "Feature",
                label: "Typing",
                source: resolveDocumentSource(document),
                confidence: 0.9,
                properties: {
                    name: "Typing"
                }
            };
        }
        return null;
    }
}
