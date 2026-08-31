export class ProposalDecisionRule {
    constructor() {
        this.name = "ProposalDecisionRule";
    }
    extract(entities) {
        const proposal = entities.find(entity => entity.type === "Proposal");
        const decision = entities.find(entity => entity.type === "Decision");
        if (!proposal || !decision) {
            return null;
        }
        return {
            from: proposal.id,
            to: decision.id,
            type: "RESULTS_IN",
            confidence: 1.0
        };
    }
}
