import type { ParsedDocument } from "@knowledge/parser";
import type { KnowledgeEntity } from "../models/entity.js";

export interface ExtractionRule {

  readonly name: string;

  extract(
    document: ParsedDocument
  ): KnowledgeEntity | null;

}