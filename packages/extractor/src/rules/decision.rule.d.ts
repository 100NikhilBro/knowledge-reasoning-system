import type { ParsedDocument } from "@knowledge/parser";
import type { KnowledgeEntity } from "../models/entity.js";
import type { ExtractionRule } from "../contracts/extraction-rule.js";
export declare class DecisionRule implements ExtractionRule {
    readonly name = "DecisionRule";
    extract(document: ParsedDocument): KnowledgeEntity | null;
}
