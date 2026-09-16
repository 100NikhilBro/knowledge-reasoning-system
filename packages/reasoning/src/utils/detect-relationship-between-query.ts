/**
 * Detect relationship queries between two named endpoints.
 *
 * Modes:
 * - direct: exact endpoint-to-endpoint edge required
 * - connected: multi-hop / shared-hub bridge allowed
 * - bridge: explicit path through a named intermediate
 */

export type RelationshipBetweenMode =
  | "direct"
  | "connected"
  | "bridge";

export interface RelationshipBetweenQuery {
  left: string;
  right: string;
  mode: RelationshipBetweenMode;
  bridge?: string;
}

const DIRECTNESS_CUE =
  /\bdirectly\s+(?:related|connected|linked)\b|\bdirect\s+(?:relationship|connection|edge|link)\b/i;

/**
 * Detect open-ended relationship queries between two sides.
 */
export function detectRelationshipBetweenQuery(
  query: string
): RelationshipBetweenQuery | undefined {

  const normalized =
    query.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return undefined;
  }

  const throughMatch =
    normalized.match(
      /how\s+(?:is|are)\s+(.+?)\s+(?:and|&)\s+(.+?)\s+connected\s+through\s+(.+?)\s*\??$/i
    ) ??
    normalized.match(
      /how\s+(?:is|are)\s+(.+?)\s+connected\s+to\s+(.+?)\s+through\s+(.+?)\s*\??$/i
    ) ??
    normalized.match(
      /how\s+(?:is|are)\s+(.+?)\s+(?:and|&)\s+(.+?)\s+connected\s+via\s+(.+?)\s*\??$/i
    );

  if (throughMatch) {
    const left =
      cleanEndpoint(throughMatch[1]);
    const right =
      cleanEndpoint(throughMatch[2]);
    const bridge =
      cleanEndpoint(throughMatch[3]);

    if (left && right && bridge) {
      return {
        left,
        right,
        mode: "bridge",
        bridge
      };
    }
  }

  const classic =
    normalized.match(
      /(?:what\s+is\s+the\s+)?relationship\s+between\s+(.+?)\s+and\s+(.+?)\s*\??$/i
    );

  if (classic) {
    const left =
      cleanEndpoint(classic[1]);
    const right =
      cleanEndpoint(classic[2]);

    if (left && right) {
      return {
        left,
        right,
        mode: queryRequestsDirectRelationship(normalized)
          ? "direct"
          : "connected"
      };
    }
  }

  const relatedMatch =
    normalized.match(
      /how\s+(?:is|are)\s+(.+?)\s+directly\s+(?:related|connected|linked)\s+to\s+(.+?)\s*\??$/i
    ) ??
    normalized.match(
      /how\s+(?:is|are)\s+(.+?)\s+(?:related|connected|linked)\s+to\s+(.+?)\s*\??$/i
    ) ??
    normalized.match(
      /how\s+(?:is|are)\s+(.+?)\s+(?:and|&)\s+(.+?)\s+(?:directly\s+)?(?:related|connected|linked)\s*\??$/i
    );

  if (relatedMatch) {
    const left =
      cleanEndpoint(relatedMatch[1]);
    const right =
      cleanEndpoint(relatedMatch[2]);

    if (left && right) {
      return {
        left,
        right,
        mode: queryRequestsDirectRelationship(normalized)
          ? "direct"
          : "connected"
      };
    }
  }

  const areRelatedMatch =
    normalized.match(
      /(?:are|is)\s+(.+?)\s+(?:and|&)\s+(.+?)\s+directly\s+(?:related|connected|linked)\s*\??$/i
    ) ??
    normalized.match(
      /(?:are|is)\s+(.+?)\s+(?:and|&)\s+(.+?)\s+(?:related|connected|linked)(?:\s+to\s+each\s+other)?\s*\??$/i
    );

  if (areRelatedMatch) {
    const left =
      cleanEndpoint(areRelatedMatch[1]);
    const right =
      cleanEndpoint(areRelatedMatch[2]);

    if (left && right) {
      return {
        left,
        right,
        mode: queryRequestsDirectRelationship(normalized)
          ? "direct"
          : "connected"
      };
    }
  }

  return undefined;

}

/**
 * Explicit directness language requiring an exact endpoint edge.
 */
export function queryRequestsDirectRelationship(
  query: string
): boolean {

  return DIRECTNESS_CUE.test(query);

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

  const normalized =
    normalizeEntityPhrase(needle);

  if (!normalized) {
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

  return fields.some(field => {
    const normalizedField =
      normalizeEntityPhrase(field);

    return (
      textMatchesPhrase(field, needle) ||
      textMatchesPhrase(field, normalized) ||
      (
        normalizedField.length > 0 &&
        (
          textMatchesPhrase(normalizedField, needle) ||
          textMatchesPhrase(normalizedField, normalized)
        )
      )
    );
  });

}

/**
 * Deterministic NL cleanup for entity phrases used in attribution /
 * endpoint resolution. Does not invent aliases.
 */
export function normalizeEntityPhrase(
  phrase: string
): string {

  return phrase
    .trim()
    .replace(/[?"'.]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(
      /\s+(?:feature|proposal|concern|decision|author|entity|module|protocol)s?\s*$/i,
      ""
    )
    .trim();

}

function cleanEndpoint(
  value: string | undefined
): string | undefined {

  if (!value) {
    return undefined;
  }

  const cleaned =
    normalizeEntityPhrase(
      value
        .trim()
        .replace(/[?.,;:]+$/g, "")
    );

  return cleaned || undefined;

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
