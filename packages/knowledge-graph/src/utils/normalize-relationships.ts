import type { KnowledgeRelationship } from "@knowledge/shared";

import { canonicalizeRelationshipType } from "@knowledge/shared";

export function normalizeRelationships(
  relationships: KnowledgeRelationship[]
): KnowledgeRelationship[] {

  return relationships.map(relationship => ({
    ...relationship,
    type: canonicalizeRelationshipType(relationship.type),
    properties: relationship.properties ?? {}
  }));

}
