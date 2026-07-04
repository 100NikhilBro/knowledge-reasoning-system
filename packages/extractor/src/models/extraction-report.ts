import type { KnowledgeEntity } from "./entity.js";
import type { KnowledgeRelationship } from "./relationship.js";

export interface ExtractionReport {

  entities: KnowledgeEntity[];

  relationships: KnowledgeRelationship[];

  warnings: string[];

  stats: {

    entityCount: number;

    relationshipCount: number;

    skippedRules: number;

  };

}