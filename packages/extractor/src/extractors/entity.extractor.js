import { ProposalRule } from "../rules/proposal.rule.js";
import { AuthorRule } from "../rules/author.rule.js";
import { FeatureRule } from "../rules/feature.rule.js";
import { ConcernRule } from "../rules/concern.rule.js";
import { DecisionRule } from "../rules/decision.rule.js";
import { PythonVersionRule } from "../rules/python-version.rule.js";

export class EntityExtractor {
    constructor() {
        this.rules = [
            new ProposalRule(),
            new AuthorRule(),
            new FeatureRule(),
            new ConcernRule(),
            new DecisionRule(),
            new PythonVersionRule()
        ];
    }
    extract(document) {
        const entities = [];
        for (const rule of this.rules) {
            const entity = rule.extract(document);
            if (entity) {
                entities.push(entity);
            }
        }
        return entities;
    }
}
