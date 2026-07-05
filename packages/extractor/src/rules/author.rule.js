// import type { ParsedDocument } from "@knowledge/parser";
// import type { KnowledgeEntity } from "../models/entity.js";
// import type { ExtractionRule } from "../contracts/extraction-rule.js";
import { buildGraphId } from "@knowledge/shared";
export class AuthorRule {
    name = "AuthorRule";
    extract(document) {
        const slug = document.metadata.author
            .toLowerCase()
            .replace(/\s+/g, "-");
        return {
            id: buildGraphId("Author", slug),
            type: "Author",
            label: document.metadata.author,
            source: "pep-484.md",
            confidence: 1.0,
            properties: {
                name: document.metadata.author
            }
        };
    }
}
