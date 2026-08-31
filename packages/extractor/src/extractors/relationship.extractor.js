import { ProposalAuthorRule } from "../relationship-rules/proposal-author.rule.js";
import { ProposalFeatureRule } from "../relationship-rules/proposal-feature.rule.js";
import { ProposalConcernRule } from "../relationship-rules/proposal-concern.rule.js";
import { ProposalDecisionRule } from "../relationship-rules/proposal-decision.rule.js";
import { DecisionPythonVersionRule } from "../relationship-rules/decision-python-version.rule.js";

export class RelationshipExtractor {
    constructor() {
        this.rules = [
            new ProposalAuthorRule(),
            new ProposalFeatureRule(),
            new ProposalConcernRule(),
            new ProposalDecisionRule(),
            new DecisionPythonVersionRule()
        ];
    }
    extract(entities) {
        const relationships = [];
        for (const rule of this.rules) {
            const relationship = rule.extract(entities);
            if (relationship) {
                relationships.push(relationship);
            }
        }
        return relationships;
    }
}
