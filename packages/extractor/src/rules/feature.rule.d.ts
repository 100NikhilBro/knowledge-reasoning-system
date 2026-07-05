import type { ParsedDocument } from "@knowledge/parser";
import type { ExtractionRule } from "../contracts/extraction-rule.js";
import type { KnowledgeEntity } from "../models/entity.js";
export declare class FeatureRule implements ExtractionRule {
    readonly name = "FeatureRule";
    extract(document: ParsedDocument): KnowledgeEntity | null;
}
