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

/**
 * Map comparison dimensions to ontology relationship types used for filtering.
 * "relationships" expands to the full allowed ontology set.
 * "properties" contributes no relationship types.
 */
export function relationshipTypesForDimensions(
  dimensions: ComparisonDimension[]
): Set<string> | undefined {

  if (dimensions.includes("properties") && dimensions.length === 1) {
    return new Set();
  }

  if (
    dimensions.includes("relationships") ||
    dimensions.length === 0
  ) {
    return new Set(ALLOWED_RELATIONSHIP_TYPES);
  }

  const types =
    new Set<string>();

  for (const dimension of dimensions) {
    if (
      dimension === "relationships" ||
      dimension === "properties"
    ) {
      continue;
    }

    types.add(DIMENSION_TO_TYPES[dimension]);
  }

  return types.size > 0
    ? types
    : new Set(ALLOWED_RELATIONSHIP_TYPES);

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

  if (
    relationshipsOnly ||
    /\brelationships?\b/i.test(query)
  ) {
    if (!dimensions.includes("relationships")) {
      dimensions.unshift("relationships");
    }
  }

  if (dimensions.length === 0) {
    return {
      dimensions: ["relationships"],
      relationshipsOnly: true
    };
  }

  return {
    dimensions: uniquePreserve(dimensions) as ComparisonDimension[],
    relationshipsOnly
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
