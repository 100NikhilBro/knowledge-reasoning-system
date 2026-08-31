/**
 * Detect open-ended "relationship between A and B" queries.
 *
 * These require a grounded graph edge connecting both sides — never
 * substitute unrelated neighbors of only one side.
 */
export interface RelationshipBetweenQuery {
  left: string;
  right: string;
}

export function detectRelationshipBetweenQuery(
  query: string
): RelationshipBetweenQuery | undefined {

  const normalized =
    query.trim().replace(/\s+/g, " ");

  const match =
    normalized.match(
      /relationship\s+between\s+(.+?)\s+and\s+(.+?)\s*\??$/i
    );

  if (!match) {
    return undefined;
  }

  const left =
    match[1]?.trim();

  const right =
    match[2]?.trim().replace(/\?+$/, "").trim();

  if (!left || !right) {
    return undefined;
  }

  return {
    left,
    right
  };

}

/**
 * Loose entity↔phrase match for relationship-between grounding checks.
 * Uses id/label/source/properties only — no external knowledge.
 */
export function entityMatchesPhrase(
  entity: {
    id: string;
    label: string;
    source: string;
    properties?: Record<string, unknown>;
  },
  phrase: string
): boolean {

  const needle =
    compact(phrase);

  if (!needle) {
    return false;
  }

  const haystack =
    compact(
      [
        entity.id,
        entity.label,
        entity.source,
        ...Object.values(entity.properties ?? {})
      ]
        .filter(
          value =>
            typeof value === "string" ||
            typeof value === "number"
        )
        .join(" ")
    );

  return haystack.includes(needle);

}

function compact(
  value: string
): string {

  return value
    .toLowerCase()
    .replace(/[^\w]/g, "");

}
