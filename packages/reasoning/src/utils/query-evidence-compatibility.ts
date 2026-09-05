import type {
  Evidence,
  KnowledgeEntity
} from "@knowledge/shared";

/**
 * Discourse / interrogative tokens that must not decide topic match.
 * Kept local so retrieval and reasoning stay independent packages.
 */
const STOP_TOKENS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "of", "to", "for", "from", "in", "on", "at", "by", "with", "as",
  "about", "into", "over", "after", "before", "between", "through",
  "tell", "me", "what", "who", "whom", "whose", "which", "when", "where",
  "why", "how", "does", "did", "do", "can", "could", "should", "would",
  "will", "shall", "may", "might", "must", "and", "or", "but", "not",
  "no", "yes", "it", "its", "this", "that", "these", "those", "there",
  "their", "them", "they", "we", "you", "your", "our", "us", "please",
  "explain", "describe", "define", "definition", "meaning", "means"
]);

/**
 * Coded topic identifiers: letter family + number (PEP-484, RFC 822, ISO9001).
 * Generic — not tied to Python PEPs.
 */
const TOPIC_CODE_PATTERN =
  /\b([A-Za-z]{1,16})[-_\s]?(\d{1,6}[A-Za-z]?)\b/g;

export type EvidenceCompatibilityKind =
  | "exact_topic"
  | "paraphrase"
  | "related"
  | "unrelated";

export interface EvidenceCompatibility {
  kind: EvidenceCompatibilityKind;
  compatible: boolean;
}

function compact(value: string): string {
  return value.toLowerCase().replace(/[^\w]/g, "");
}

/**
 * Extract normalized topic codes from free text (pep484, rfc822, …).
 */
export function extractTopicCodes(text: string): string[] {
  const found = new Set<string>();
  const source = text ?? "";
  TOPIC_CODE_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TOPIC_CODE_PATTERN.exec(source)) !== null) {
    const family = match[1]?.toLowerCase() ?? "";
    const number = match[2]?.toLowerCase() ?? "";
    if (family && number) {
      found.add(`${family}${number}`);
    }
  }

  return [...found];
}

/**
 * Significant non-stop tokens used for paraphrase / open lookup overlap.
 */
export function extractSignificantTokens(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(token => token.trim())
    .filter(
      token =>
        token.length > 2 &&
        !STOP_TOKENS.has(token)
    );
}

function entitySearchText(
  entity: Pick<
    KnowledgeEntity,
    "id" | "label" | "source" | "properties"
  >
): string {
  return [
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
    .join(" ");
}

function entityHasTopicCode(
  entity: Pick<
    KnowledgeEntity,
    "id" | "label" | "source" | "properties"
  >,
  code: string
): boolean {
  const haystack =
    compact(entitySearchText(entity));
  return haystack.includes(code);
}

function significantOverlap(
  query: string,
  entity: Pick<
    KnowledgeEntity,
    "id" | "label" | "source" | "properties"
  >
): boolean {
  const queryTokens =
    extractSignificantTokens(query);

  if (queryTokens.length === 0) {
    return false;
  }

  const haystack =
    entitySearchText(entity).toLowerCase();

  const compactHaystack =
    compact(haystack);

  const compactLabel =
    compact(entity.label);

  const compactQuery =
    compact(query);

  if (
    compactLabel.length >= 4 &&
    compactQuery.includes(compactLabel)
  ) {
    return true;
  }

  const matched =
    queryTokens.filter(token => {
      if (haystack.includes(token)) {
        return true;
      }
      return compactHaystack.includes(token);
    });

  if (matched.length === 0) {
    return false;
  }

  if (matched.some(token => token.length >= 5)) {
    return true;
  }

  return matched.length >= 2;
}

/**
 * Direct query↔entity compatibility (seeds), before relationship expansion.
 */
export function classifyEntityCompatibility(
  query: string,
  entity: Pick<
    KnowledgeEntity,
    "id" | "label" | "source" | "properties"
  >
): EvidenceCompatibility {
  const queryCodes =
    extractTopicCodes(query);

  const entityCodes =
    extractTopicCodes(entitySearchText(entity));

  if (queryCodes.length > 0) {
    const shared =
      queryCodes.filter(code =>
        entityHasTopicCode(entity, code)
      );

    if (shared.length > 0) {
      return {
        kind: "exact_topic",
        compatible: true
      };
    }

    /*
     * Query names a coded topic the entity does not carry.
     * A different coded topic on the entity is a near-match conflict
     * (e.g. PEP-8 query vs PEP-484 evidence) — fail closed.
     */
    if (entityCodes.length > 0) {
      return {
        kind: "unrelated",
        compatible: false
      };
    }

    /*
     * Query names a coded topic the entity does not carry, and the entity
     * has no coded topic of its own. Do not paraphrase-seed from generic
     * structural words ("feature", "problem", …) — those would let
     * wrong-topic complex queries borrow unrelated graph neighbors.
     * Uncoded neighbors may still join later via relationship expansion
     * from an exact_topic seed.
     */
    return {
      kind: "unrelated",
      compatible: false
    };
  }

  if (significantOverlap(query, entity)) {
    return {
      kind: "paraphrase",
      compatible: true
    };
  }

  return {
    kind: "unrelated",
    compatible: false
  };
}

export function isEntityCompatibleWithQuery(
  query: string,
  entity: Pick<
    KnowledgeEntity,
    "id" | "label" | "source" | "properties"
  >
): boolean {
  return classifyEntityCompatibility(query, entity)
    .compatible;
}

/**
 * Keep evidence that is query-compatible as a seed, or reachable from a
 * compatible seed through real relationship provenance (any hop depth).
 * Empty when no seed matches — near-match wrong topics stay fail-closed.
 */
export function filterCompatibleEvidence(
  query: string,
  evidence: Evidence[]
): Evidence[] {
  if (evidence.length === 0) {
    return [];
  }

  const seedIds =
    new Set<string>();

  for (const item of evidence) {
    if (
      isEntityCompatibleWithQuery(
        query,
        item.entity
      )
    ) {
      seedIds.add(item.entity.id);
    }
  }

  if (seedIds.size === 0) {
    return [];
  }

  const kept =
    new Set<string>(seedIds);

  let grew =
    true;

  while (grew) {
    grew = false;

    for (const item of evidence) {
      if (kept.has(item.entity.id)) {
        continue;
      }

      const relationship =
        item.relationship;

      if (!relationship) {
        continue;
      }

      if (
        kept.has(relationship.from) ||
        kept.has(relationship.to)
      ) {
        kept.add(item.entity.id);
        grew = true;
      }
    }
  }

  return evidence.filter(item =>
    kept.has(item.entity.id)
  );
}
