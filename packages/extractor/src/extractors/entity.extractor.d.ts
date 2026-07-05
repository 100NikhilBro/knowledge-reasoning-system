import type { ParsedDocument } from "@knowledge/parser";
import type { KnowledgeEntity } from "../models/entity.js";
export declare class EntityExtractor {
    private readonly rules;
    extract(document: ParsedDocument): KnowledgeEntity[];
}
