import type { Entity } from "./entity.js";
import type { Relationship } from "./relationship.js";

export interface KnowledgeDocument {

  source: string;

  title: string;

  content: string;

  metadata: Record<string, unknown>;

  entities: Entity[];

  relationships: Relationship[];

}