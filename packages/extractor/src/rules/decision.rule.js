import { buildGraphId } from "@knowledge/shared";
import { resolveDocumentSource } from "../utils/resolve-document-source.js";

export class DecisionRule {
    constructor() {
        this.name = "DecisionRule";
    }
    extract(document) {
        const status = document.metadata.status?.trim();
        if (!status) {
            return null;
        }
        const slug = status
            .toLowerCase()
            .replace(/\s+/g, "-");
        return {
            id: buildGraphId("Decision", slug),
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
