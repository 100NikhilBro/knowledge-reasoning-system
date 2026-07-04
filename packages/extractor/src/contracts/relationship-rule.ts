import type { KnowledgeEntity } from "../models/entity.js";
import type { KnowledgeRelationship } from "../models/relationship.js";


export interface RelationshipRule {

  readonly name: string;

  extract(
    entities: KnowledgeEntity[]
  ): KnowledgeRelationship | null;

}