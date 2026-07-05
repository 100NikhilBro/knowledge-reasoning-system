import type { ParsedDocument } from "@knowledge/parser";
import type { ExtractionRule } from "../contracts/extraction-rule.js";
import type { KnowledgeEntity } from "../models/entity.js";
export declare class ConcernRule implements ExtractionRule {
    readonly name = "ConcernRule";
    extract(document: ParsedDocument): KnowledgeEntity | null;
}
