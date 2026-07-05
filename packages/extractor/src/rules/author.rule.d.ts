import type { ParsedDocument } from "@knowledge/parser";
import type { KnowledgeEntity } from "../models/entity.js";
import type { ExtractionRule } from "../contracts/extraction-rule.js";
export declare class AuthorRule implements ExtractionRule {
    readonly name = "AuthorRule";
    extract(document: ParsedDocument): KnowledgeEntity;
}
