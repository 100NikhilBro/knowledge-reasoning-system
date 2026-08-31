import type { ParsedDocument } from "@knowledge/parser";
import type { KnowledgeEntity } from "../models/entity.js";
import type { ExtractionRule } from "../contracts/extraction-rule.js";
export declare class PythonVersionRule implements ExtractionRule {
    readonly name = "PythonVersionRule";
    extract(document: ParsedDocument): KnowledgeEntity | null;
}
