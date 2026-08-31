import type {
  ParsedDocument,
  ParseResult
} from "@knowledge/parser";

import type {
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import type { IndexingResult } from "@knowledge/vector-store";

/**
 * Narrow ports so the worker orchestrates without owning package internals.
 */

export interface DocumentParserPort {

  parse(
    content: string
  ): ParseResult;

}

export interface EntityExtractorPort {

  extract(
    document: ParsedDocument
  ): KnowledgeEntity[];

}

export interface RelationshipExtractorPort {

  extract(
    entities: KnowledgeEntity[]
  ): KnowledgeRelationship[];

}

export interface GraphPersistencePort {

  initialize?(): Promise<void>;

  ingest(
    entities: KnowledgeEntity[],
    relationships: KnowledgeRelationship[]
  ): Promise<void>;

}

export interface EntityIndexerPort {

  index(
    entities: KnowledgeEntity[],
    options?: {
      metadata?: Record<string, unknown>;
    }
  ): Promise<IndexingResult>;

}

export interface DocumentFilePort {

  exists(
    documentPath: string
  ): Promise<boolean>;

  read(
    documentPath: string
  ): Promise<string>;

}
