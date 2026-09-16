import type {
  Evidence
} from "@knowledge/shared";

function relationshipKey(
  item: Evidence
): string | undefined {

  const relationship =
    item.relationship;

  if (!relationship) {
    return undefined;
  }

  return (
    `${relationship.from}|${relationship.type}|${relationship.to}|${item.entity.id}`
  );

}

/**
 * Deduplicate evidence without collapsing independent relationship branches.
 *
 * Entity-only rows collapse by entity id.
 * Relationship-bearing rows collapse by (from, type, to, entityId) so
 * A→X and B→X both survive when X is the shared hub.
 */
export function deduplicateEvidence(

  evidence: Evidence[]

): Evidence[] {

  const withRelationship =
    new Map<string, Evidence>();

  const entityOnly =
    new Map<string, Evidence>();

  for (const item of evidence) {

    const relKey =
      relationshipKey(item);

    if (relKey) {
      const existing =
        withRelationship.get(relKey);

      if (
        !existing ||
        item.score > existing.score
      ) {
        withRelationship.set(relKey, item);
      }

      continue;
    }

    const existing =
      entityOnly.get(item.entity.id);

    if (
      !existing ||
      item.score > existing.score
    ) {
      entityOnly.set(item.entity.id, item);
    }

  }

  const entitiesWithRelationship =
    new Set(
      [...withRelationship.values()].map(item => item.entity.id)
    );

  const bareEntities =
    [...entityOnly.values()].filter(item =>
      !entitiesWithRelationship.has(item.entity.id)
    );

  return [
    ...withRelationship.values(),
    ...bareEntities
  ];

}
