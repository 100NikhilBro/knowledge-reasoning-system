export class ProposalAuthorRule {
    name = "ProposalAuthorRule";
    extract(entities) {
        const proposal = entities.find(entity => entity.type === "Proposal");
        const author = entities.find(entity => entity.type === "Author");
        if (!proposal || !author) {
            return null;
        }
        return {
            from: proposal.id,
            to: author.id,
            type: "PROPOSED_BY",
            confidence: 1.0
        };
    }
}
