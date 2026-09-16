import {
  ALLOWED_RELATIONSHIP_TYPES
} from "@knowledge/shared";

/**
 * Query-requested comparison facets. Generic ontology-aligned dimensions only.
 */
export type ComparisonDimension =
  | "relationships"
  | "introduces"
  | "proposed_by"
  | "addresses"
  | "results_in"
  | "implemented_in"
  | "properties";

/**
 * Structured comparison request derived from the user query — never from
 * retrieval order.
 */
export interface ComparisonRequest {
  /**
   * Explicit comparison subjects as query phrases (order preserved).
   */
  subjects: string[];
  /**
   * Requested comparison dimensions.
   */
  dimensions: ComparisonDimension[];
  /**
   * True when the query restricts the comparison to relationship evidence.
   */
  relationshipsOnly: boolean;
}

const DIMENSION_TO_TYPES: Record<
  Exclude<ComparisonDimension, "relationships" | "properties">,
  string
> = {
  introduces: "INTRODUCES",
  proposed_by: "PROPOSED_BY",
  addresses: "ADDRESSES",
  results_in: "RESULTS_IN",
  implemented_in: "IMPLEMENTED_IN"
};

export function relationshipTypeForDimension(
  dimension: ComparisonDimension
): string | undefined {

  if (
    dimension === "relationships" ||
    dimension === "properties"
  ) {
    return undefined;
  }

  return DIMENSION_TO_TYPES[dimension];

}

/**
 * Map comparison dimensions to ontology relationship types used for filtering.
 *
 * Explicit predicate dimensions (introduces, proposed_by, …) are authoritative:
 * the umbrella "relationships" token must not expand the set to every ontology
 * type when specifics are also present.
 */
export function relationshipTypesForDimensions(
  dimensions: ComparisonDimension[]
): Set<string> | undefined {

  if (dimensions.includes("properties") && dimensions.length === 1) {
    return new Set();
  }

  const specificTypes =
    new Set<string>();

  for (const dimension of dimensions) {
    if (
      dimension === "relationships" ||
      dimension === "properties"
    ) {
      continue;
    }

    specificTypes.add(DIMENSION_TO_TYPES[dimension]);
  }

  /*
   * Explicit relationship predicates constrain the comparison output.
   * Do not widen to the full ontology merely because "relationships"
   * was also mentioned as a scope cue.
   */
  if (specificTypes.size > 0) {
    return specificTypes;
  }

  if (
    dimensions.includes("relationships") ||
    dimensions.length === 0
  ) {
    return new Set(ALLOWED_RELATIONSHIP_TYPES);
  }

  return new Set(ALLOWED_RELATIONSHIP_TYPES);

}

/**
 * Normalize dimensions so explicit predicates replace the umbrella
 * "relationships" token in the structured request used for output/verification.
 */
export function normalizeComparisonDimensions(
  dimensions: ComparisonDimension[],
  relationshipsOnly: boolean
): ComparisonDimension[] {

  const specific =
    dimensions.filter(dimension =>
      dimension !== "relationships"
    );

  if (specific.length > 0) {
    return uniquePreserve(specific) as ComparisonDimension[];
  }

  if (
    relationshipsOnly ||
    dimensions.includes("relationships") ||
    dimensions.length === 0
  ) {
    return ["relationships"];
  }

  return uniquePreserve(dimensions) as ComparisonDimension[];

}

function uniquePreserve(
  values: string[]
): string[] {

  const seen =
    new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const key =
      value.trim().toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(value.trim());
  }

  return out;

}

function cleanSubjectToken(
  value: string
): string | undefined {

  const cleaned =
    value
      .trim()
      .replace(/^[,;\s]+|[,;\s]+$/g, "")
      .replace(/^(?:the|a|an)\s+/i, "")
      .replace(/[?"'.]+$/g, "")
      .trim();

  if (!cleaned) {
    return undefined;
  }

  if (
    /^(?:based|only|on|relationships?|features?|proposers?|authors?|decisions?|versions?|properties|and|vs|versus)$/i
      .test(cleaned)
  ) {
    return undefined;
  }

  return cleaned;

}

/**
 * Extract explicit comparison subjects from compare-style queries.
 * Prefer already-extracted PEP codes when present (≥2).
 */
export function extractComparisonSubjects(
  query: string,
  knownEntities: string[] = []
): string[] {

  const peps =
    knownEntities.filter(entity =>
      /^PEP-\d+$/i.test(entity)
    );

  if (peps.length >= 2) {
    return uniquePreserve(peps);
  }

  const listMatch =
    query.match(
      /\bcompare\s+(.+?)(?:\s+based\s+(?:only\s+)?on\b|\s*;|\s*,?\s*what\b|\s*$)/i
    );

  if (listMatch?.[1]) {
    const raw =
      listMatch[1];

    const parts =
      raw
        .split(/\s*(?:,|&|\bvs\.?\b|\bversus\b|\band\b)\s*/i)
        .map(cleanSubjectToken)
        .filter((item): item is string => Boolean(item));

    if (parts.length >= 2) {
      return uniquePreserve(parts);
    }
  }

  const vsMatch =
    query.match(
      /\bcompare\s+(.+?)\s+(?:vs\.?|versus|with|to)\s+(.+?)(?:\s+based\b|\s*;|$)/i
    );

  if (vsMatch?.[1] && vsMatch[2]) {
    const left =
      cleanSubjectToken(vsMatch[1]);
    const right =
      cleanSubjectToken(vsMatch[2]);

    if (left && right) {
      return uniquePreserve([left, right]);
    }
  }

  if (knownEntities.length >= 2) {
    return uniquePreserve(knownEntities);
  }

  return uniquePreserve(knownEntities);

}

/**
 * Detect requested comparison dimensions from query wording.
 */
export function detectComparisonDimensions(
  query: string
): {
  dimensions: ComparisonDimension[];
  relationshipsOnly: boolean;
} {

  const relationshipsOnly =
    /\bbased\s+only\s+on\s+relationships?\b/i.test(query) ||
    /\bonly\s+(?:on\s+)?relationships?\b/i.test(query);

  const dimensions: ComparisonDimension[] = [];

  if (/\bintroduc/i.test(query)) {
    dimensions.push("introduces");
  }

  if (/\bpropos(?:e|ed|es|er|ers|al)?\b/i.test(query)) {
    dimensions.push("proposed_by");
  }

  if (/\baddress/i.test(query)) {
    dimensions.push("addresses");
  }

  if (
    /\bdecisions?\b/i.test(query) ||
    /\bresults?\s+in\b/i.test(query) ||
    /\bresult(?:ing)?\b/i.test(query)
  ) {
    dimensions.push("results_in");
  }

  if (
    /\bimplement/i.test(query) ||
    /\bversion\b/i.test(query)
  ) {
    dimensions.push("implemented_in");
  }

  if (/\bpropert/i.test(query)) {
    dimensions.push("properties");
  }

  const mentionsRelationships =
    relationshipsOnly ||
    /\brelationships?\b/i.test(query);

  if (mentionsRelationships) {
    if (!dimensions.includes("relationships")) {
      dimensions.unshift("relationships");
    }
  }

  const normalized =
    normalizeComparisonDimensions(
      uniquePreserve(dimensions) as ComparisonDimension[],
      relationshipsOnly
    );

  if (normalized.length === 0) {
    return {
      dimensions: ["relationships"],
      relationshipsOnly: true
    };
  }

  return {
    dimensions: normalized,
    relationshipsOnly:
      relationshipsOnly ||
      (
        normalized.length === 1 &&
        normalized[0] === "relationships"
      )
  };

}

/**
 * Build a ComparisonRequest from query text and known entity phrases.
 */
export function detectComparisonRequest(
  query: string,
  knownEntities: string[] = []
): ComparisonRequest | undefined {

  if (!/\bcompar(?:e|ison|ing)\b/i.test(query)) {
    return undefined;
  }

  const subjects =
    extractComparisonSubjects(query, knownEntities);

  if (subjects.length < 2) {
    return {
      subjects,
      ...detectComparisonDimensions(query)
    };
  }

  return {
    subjects,
    ...detectComparisonDimensions(query)
  };

}
