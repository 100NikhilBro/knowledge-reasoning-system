export class ProposalConcernRule {
    name = "ProposalConcernRule";
    extract(entities) {
        const proposal = entities.find(entity => entity.type === "Proposal");
        const concern = entities.find(entity => entity.type === "Concern");
        if (!proposal || !concern) {
            return null;
        }
        return {
            from: proposal.id,
            to: concern.id,
            type: "ADDRESSES",
            confidence: 0.9
        };
    }
}
