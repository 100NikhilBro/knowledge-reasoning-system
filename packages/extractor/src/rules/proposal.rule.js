import { buildGraphId } from "@knowledge/shared";
import { resolveDocumentSource } from "../utils/resolve-document-source.js";

export class ProposalRule {
    name = "ProposalRule";
    extract(document) {
        return {
            id: buildGraphId("Proposal", `PEP-${document.metadata.pep}`),
            type: "Proposal",
            label: document.metadata.title,
            source: resolveDocumentSource(document),
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
