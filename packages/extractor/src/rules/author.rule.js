import { buildGraphId } from "@knowledge/shared";
import { resolveDocumentSource } from "../utils/resolve-document-source.js";

export class AuthorRule {
    name = "AuthorRule";
    extract(document) {
        return {
            id: buildGraphId("Author", document.metadata.author),
            type: "Author",
            label: document.metadata.author,
            source: resolveDocumentSource(document),
            confidence: 1.0,
            properties: {
                name: document.metadata.author
            }
        };
    }
}
