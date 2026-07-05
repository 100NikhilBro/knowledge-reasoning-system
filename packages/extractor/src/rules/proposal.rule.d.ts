import type { ParsedDocument } from "@knowledge/parser";
import type { KnowledgeEntity } from "../models/entity.js";
import type { ExtractionRule } from "../contracts/extraction-rule.js";
export declare class ProposalRule implements ExtractionRule {
    readonly name = "ProposalRule";
    extract(document: ParsedDocument): KnowledgeEntity;
}
