import type { KnowledgeRelationship } from "@knowledge/shared";

export function normalizeRelationships(
  relationships: KnowledgeRelationship[]
): KnowledgeRelationship[] {

  return relationships.map(relationship => ({
    ...relationship,
    properties: relationship.properties ?? {}
  }));

}