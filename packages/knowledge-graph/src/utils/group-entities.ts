import type { KnowledgeEntity } from "@knowledge/shared";

export function groupEntitiesByType(
  entities: KnowledgeEntity[]
): Map<string, KnowledgeEntity[]> {

  const groups = new Map<string, KnowledgeEntity[]>();

  for (const entity of entities) {

    const bucket = groups.get(entity.type);

    if (bucket) {
      bucket.push(entity);
    } else {
      groups.set(entity.type, [entity]);
    }

  }

  return groups;

}