import { buildGraphId } from "@knowledge/shared";
export class ProposalRule {
    name = "ProposalRule";
    extract(document) {
        return {
            id: buildGraphId("Proposal", `PEP-${document.metadata.pep}`),
            type: "Proposal",
            label: document.metadata.title,
            source: "pep-484.md",
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
