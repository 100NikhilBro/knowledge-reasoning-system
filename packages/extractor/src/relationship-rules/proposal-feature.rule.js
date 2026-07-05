export class ProposalFeatureRule {
    name = "ProposalFeatureRule";
    extract(entities) {
        const proposal = entities.find(entity => entity.type === "Proposal");
        const feature = entities.find(entity => entity.type === "Feature");
        if (!proposal || !feature) {
            return null;
        }
        return {
            from: proposal.id,
            to: feature.id,
            type: "INTRODUCES",
            confidence: 0.9
        };
    }
}
