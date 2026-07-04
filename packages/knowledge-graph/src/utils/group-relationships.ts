import type { KnowledgeRelationship } from "@knowledge/shared";

export function groupRelationshipsByType(
  relationships: KnowledgeRelationship[]
): Map<string, KnowledgeRelationship[]> {

  const groups = new Map<string, KnowledgeRelationship[]>();

  for (const relationship of relationships) {

    const bucket = groups.get(relationship.type);

    if (bucket) {
      bucket.push(relationship);
    } else {
      groups.set(relationship.type, [relationship]);
    }

  }

  return groups;

}