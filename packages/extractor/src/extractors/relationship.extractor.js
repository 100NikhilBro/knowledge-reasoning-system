import { ProposalAuthorRule } from "../relationship-rules/proposal-author.rule.js";
import { ProposalFeatureRule } from "../relationship-rules/proposal-feature.rule.js";
import { ProposalConcernRule } from "../relationship-rules/proposal-concern.rule.js";
export class RelationshipExtractor {
    rules = [
        new ProposalAuthorRule(),
        new ProposalFeatureRule(),
        new ProposalConcernRule()
    ];
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
