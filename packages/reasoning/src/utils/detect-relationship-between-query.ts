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
 * Entity↔phrase match for relationship grounding checks.
 *
 * Uses id, label, and string/number properties only — not document
 * `source` — so a shared corpus filename cannot make every entity look
 * like a coded topic (e.g. pep-484.md matching "PEP-484").
 *
 * Matching is boundary-aware on original text plus compact equality, so
 * "Type Hints" does not falsely match the phrase "Typing".
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
    phrase.trim();

  if (!needle) {
    return false;
  }

  const fields: string[] = [
    entity.id,
    entity.label,
    ...Object.values(entity.properties ?? {})
      .filter(
        value =>
          typeof value === "string" ||
          typeof value === "number"
      )
      .map(String)
  ];

  return fields.some(field => textMatchesPhrase(field, needle));

}

function textMatchesPhrase(
  text: string,
  phrase: string
): boolean {

  const normalizedText =
    text.toLowerCase();

  const normalizedPhrase =
    phrase.toLowerCase().trim();

  if (!normalizedPhrase) {
    return false;
  }

  if (normalizedText === normalizedPhrase) {
    return true;
  }

  if (normalizedText.includes(normalizedPhrase)) {
    const index =
      normalizedText.indexOf(normalizedPhrase);

    const beforeOk =
      index === 0 ||
      /[^a-z0-9]/i.test(normalizedText.charAt(index - 1));

    const afterIndex =
      index + normalizedPhrase.length;

    const afterOk =
      afterIndex >= normalizedText.length ||
      /[^a-z0-9]/i.test(normalizedText.charAt(afterIndex));

    if (beforeOk && afterOk) {
      return true;
    }
  }

  const compactText =
    compact(text);

  const compactPhrase =
    compact(phrase);

  return (
    compactText.length > 0 &&
    compactPhrase.length > 0 &&
    compactText === compactPhrase
  );

}

function compact(
  value: string
): string {

  return value
    .toLowerCase()
    .replace(/[^\w]/g, "");

}
