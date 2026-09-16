import type { ReasoningStrategy } from "@knowledge/shared";

import {
  detectFocusRelationships,
  detectMultiHopPathQuery
} from "./detect-focus-relationships.js";

import {
  detectRelationshipBetweenQuery,
  type RelationshipBetweenQuery
} from "./detect-relationship-between-query.js";

import {
  detectLogicalConclusionQuery,
  extractLogicalClaims,
  splitIndependentClaimClauses,
  type LogicalClaim
} from "./logical-implication.js";

import {
  ALLOWED_RELATIONSHIP_TYPES
} from "@knowledge/shared";

/**
 * Canonical query intents for KRS routing.
 * Not every intent maps to a new strategy — some reserve P6/P7 work.
 */
export type QueryIntentKind =
  | "FACT"
  | "RELATIONSHIP"
  | "DIRECT_RELATIONSHIP"
  | "CONNECTED_RELATIONSHIP"
  | "BRIDGE_RELATIONSHIP"
  | "COMPOUND"
  | "IMPLICATION"
  | "COMPARISON"
  | "ANALYTICAL"
  | "SUMMARIZATION"
  | "OUT_OF_CORPUS";

export interface QuerySubRequest {
  /**
   * Ontology relationship type when known.
   */
  focus?: string;
  /**
   * Short inspectable label for the sub-ask.
   */
  label: string;
  /**
   * Subject entity for this atomic request when known.
   */
  subject?: string;
  /**
   * Object entity when the request names one.
   */
  object?: string;
}

export type AnalyticalOperation =
  | "COUNT"
  | "DISTINCT_COUNT"
  | "LIST"
  | "EXISTS"
  | "MIN"
  | "MAX"
  | "AVG"
  | "UNKNOWN";

export interface AnalyticalFilter {
  /**
   * Ontology relationship type when the query names one.
   */
  relationshipType?: string;
  /**
   * Soft phrase for related endpoint matching (legacy / non-exact paths).
   */
  relatedEntityPhrase?: string;
  /**
   * Exact relationship object/target phrase (e.g. Typing, DistributedComputing).
   * When requireObjectMatch is true, only the relationship object endpoint
   * may satisfy this constraint — subjects and unrelated entities must not.
   */
  objectPhrase?: string;
  /**
   * When true, objectPhrase is a hard constraint. If no grounded entity
   * establishes that object, analytical execution fails closed.
   */
  requireObjectMatch?: boolean;
  /**
   * Entity type constraint for the analytical subject.
   */
  entityType?: string;
}

export interface AnalyticalSpec {
  operation: AnalyticalOperation;
  /**
   * Human-readable subject (PEPs, authors, …).
   */
  target?: string;
  /**
   * Canonical entity type for the subject when known.
   */
  subjectEntityType?: string;
  filter?: AnalyticalFilter;
  /**
   * Structured numeric property for MIN/MAX (e.g. pep).
   */
  numericField?: string;
  /**
   * Analytical population scope (always corpus-grounded for P6).
   */
  scope?: string;
  /**
   * Explicit outputs requested by compound analytical asks.
   */
  requestedOutputs?: Array<"count" | "list" | "complement">;
  /**
   * When true, compute non-matching subjects from an explicit universe.
   */
  includeComplement?: boolean;
}

export type SummarizationMode =
  | "SINGLE_DOCUMENT_SUMMARY"
  | "CROSS_DOCUMENT_SYNTHESIS";

export interface SummarizationSpec {
  /**
   * Requested summarization mode from query cues.
   */
  mode: SummarizationMode;
  /**
   * Soft topic phrases (typing, readability, …).
   */
  topics: string[];
  /**
   * Ontology relationship filters when named.
   */
  relationshipFilters: string[];
  /**
   * Always corpus-grounded for P7.
   */
  scope: string;
  /**
   * True when the query wording asks for multi-document / evolution synthesis.
   */
  requiresCrossDocument: boolean;
}

/**
 * Structured internal query representation produced before planning.
 */
export interface QueryUnderstanding {
  intent: QueryIntentKind;
  originalQuery: string;
  /**
   * Soft-normalized text; identifiers like PEP-484 are preserved.
   */
  normalizedQuery: string;
  entities: string[];
  bridgeEntity?: string;
  relationshipRequested: string[];
  relationshipMode?: "direct" | "connected" | "bridge";
  claims: LogicalClaim[];
  subRequests: QuerySubRequest[];
  analytical?: AnalyticalSpec;
  summarization?: SummarizationSpec;
  /**
   * Deterministic rewrite that preserves the user's claim/constraints.
   * Never substitutes an easier question.
   */
  rewrittenRepresentation: string;
  /**
   * Existing ReasoningStrategy to execute (no new strategy types).
   */
  strategy: ReasoningStrategy;
  /**
   * Focus relationship types for single-hop expansion.
   */
  focusRelationships?: string[];
  requireRelationshipBetween?: {
    left: string;
    right: string;
  };
  /**
   * Exact typed edge when the query names subject, predicate, and object.
   */
  requireTypedEdge?: {
    subject: string;
    predicate: string;
    object: string;
    direction: "outgoing" | "incoming" | "undirected";
  };
  /**
   * Traversal depth hint for multi-hop.
   */
  maxDepth: number;
  traversal: "bfs" | "dfs";
}

const DOMAIN_CUE =
  /\b(?:pep[\s_-]?\d+|python|typing|type[\s_-]?hints?|protocol|mypy|pyright|author|proposal|feature|concern|readability|asyncio|annotation)\b/i;

const OUT_OF_CORPUS_CUE =
  /\b(?:capital of|population of|weather in|stock price|who (?:is|was) the (?:president|king|queen)|distance (?:from|between)|recipe for)\b/i;

const ANALYTICAL_CUE =
  /\b(?:how many|count(?:\s+of)?|average|avg\b|mean number|most authors?|least authors?|total number|which peps?\b|list(?:\s+the)?\s+peps?\b|are there any|is there (?:a|any)|does any|minimum|maximum|lowest|highest|min(?:imum)?\s+pep|max(?:imum)?\s+pep|and which\b|do not|don't)\b/i;

const SUMMARIZATION_CUE =
  /\b(?:summar(?:y|ize|ise)|overview of|evol(?:ve|ved|ving|ution)\b.*\b(?:across|over|through)\b|how did .+ evolv)/i;

const COMPARISON_CUE =
  /\bcompar(?:e|ison|ing)\b/i;

/**
 * Soft normalize without destroying PEP/typing identifiers.
 */
export function normalizeQueryText(
  query: string
): string {

  return query
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ");

}

function uniqueStrings(
  values: string[]
): string[] {

  const seen =
    new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key =
      value.trim();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(key);
  }

  return result;

}

/**
 * Extract PEP codes and high-signal entity phrases from the query.
 */
export function extractQueryEntities(
  query: string,
  between?: RelationshipBetweenQuery,
  claims: LogicalClaim[] = []
): string[] {

  const entities: string[] = [];
  const seen =
    new Set<string>();

  function push(
    value: string | undefined
  ): void {

    const cleaned =
      (value ?? "").trim().replace(/[?"'.]+$/g, "");

    if (!cleaned) {
      return;
    }

    const key =
      cleaned.toLowerCase();

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    entities.push(cleaned);

  }

  for (const match of query.matchAll(
    /\bPEP[\s_-]?(\d+)\b/gi
  )) {
    push(`PEP-${match[1]}`);
  }

  for (const match of query.matchAll(
    /\btyping\.[A-Za-z_][\w.]*/g
  )) {
    push(match[0]);
  }

  if (between) {
    push(between.left);
    push(between.right);
    push(between.bridge);
  }

  for (const claim of claims) {
    push(claim.subject);
    push(claim.object);
    push(claim.bridge);
  }

  if (/\btyping\b/i.test(query)) {
    push("Typing");
  }

  if (/\breadability\b/i.test(query)) {
    push("Readability");
  }

  return entities;

}

function extractAnalyticalObjectPhrase(
  query: string
): string | undefined {

  const called =
    query.match(
      /\b(?:feature|concern|protocol|entity)\s+(?:called|named)\s+([A-Za-z][\w.-]*)/i
    );

  if (called?.[1]) {
    return called[1].trim();
  }

  const introduce =
    query.match(
      /\bintroduc(?:e|es|ed)\s+(?:a\s+|an\s+|the\s+)?(?:feature\s+)?(?:called\s+|named\s+)?(.+?)(?=\s*,\s*and\b|\s+and\s+which\b|\s+and\s+what\b|\s*\?|$)/i
    );

  if (introduce?.[1]) {
    let object =
      introduce[1]
        .trim()
        .replace(/[?"'.]+$/g, "")
        .trim();

    object =
      object
        .replace(/\s*-?\s*related\s+features?$/i, "")
        .replace(/\s+features?$/i, "")
        .trim();

    if (!object || /^(?:a|an|the)$/i.test(object)) {
      return undefined;
    }

    if (
      /^typing\b/i.test(object) ||
      /^type[\s_-]?hints?\b/i.test(object)
    ) {
      return "Typing";
    }

    if (/^readability\b/i.test(object)) {
      return "Readability";
    }

    return object;
  }

  const address =
    query.match(
      /\baddress(?:es|ed|ing)?\s+(?:the\s+|a\s+|an\s+)?(.+?)(?=\s*,\s*and\b|\s+and\s+which\b|\s*\?|$)/i
    );

  if (address?.[1]) {
    let object =
      address[1]
        .trim()
        .replace(/[?"'.]+$/g, "")
        .trim();

    object =
      object
        .replace(/\s+concerns?$/i, "")
        .trim();

    if (/^readability\b/i.test(object)) {
      return "Readability";
    }

    if (object) {
      return object;
    }
  }

  return undefined;

}

function detectAnalyticalSpec(
  query: string
): AnalyticalSpec | undefined {

  if (!ANALYTICAL_CUE.test(query)) {
    return undefined;
  }

  const normalized =
    query.toLowerCase();

  let operation: AnalyticalOperation =
    "UNKNOWN";

  const wantsCount =
    /\bhow many\b|\bcount\b|\btotal number\b/.test(normalized);

  const wantsList =
    /\bwhich peps?\b|\blist(?:\s+the)?\s+peps?\b|\benumerate\b|\band which\b/.test(
      normalized
    );

  const wantsComplement =
    /\b(?:which\s+peps?\s+)?(?:do not|don't|does not|did not)\b|\bnon[\s-]?matching\b|\bcomplement\b|\bwhich(?:\s+peps?)?\s+do\s+not\b/i
      .test(query);

  if (
    /\bare there any\b|\bis there (?:a|any)\b|\bdoes any\b|\bdo any\b/.test(normalized)
  ) {
    operation = "EXISTS";
  } else if (
    wantsCount &&
    /\bdistinct\b/.test(normalized)
  ) {
    operation = "DISTINCT_COUNT";
  } else if (wantsCount) {
    operation = "COUNT";
  } else if (
    /\bwhich peps?\b|\blist(?:\s+the)?\s+peps?\b|\benumerate\b/.test(normalized)
  ) {
    operation = "LIST";
  } else if (/\baverage\b|\bavg\b|\bmean number\b/.test(normalized)) {
    /*
     * AVG is classified but not executable without a reliable numeric field.
     */
    operation = "AVG";
  } else if (
    /\b(?:maximum|highest|largest)\b.*\bpep\b|\bmax(?:imum)?\s+pep\b|\bpep\b.*\b(?:maximum|highest|largest)\b/.test(normalized)
  ) {
    operation = "MAX";
  } else if (
    /\b(?:minimum|lowest|smallest)\b.*\bpep\b|\bmin(?:imum)?\s+pep\b|\bpep\b.*\b(?:minimum|lowest|smallest)\b/.test(normalized)
  ) {
    operation = "MIN";
  } else if (/\bmost\b/.test(normalized)) {
    /*
     * "most authors" without a structured per-entity metric → UNKNOWN.
     */
    operation = "UNKNOWN";
  } else if (/\bleast\b/.test(normalized)) {
    operation = "UNKNOWN";
  }

  const filter: AnalyticalFilter = {};

  if (
    /\bintroduc/.test(normalized)
  ) {
    filter.relationshipType = "INTRODUCES";
  } else if (
    /\baddress/.test(normalized) ||
    /\bconcern\b/.test(normalized)
  ) {
    filter.relationshipType = "ADDRESSES";
  } else if (
    /\bpropos(?:e|ed|es|ing)\b/.test(normalized) &&
    /\bauthor/.test(normalized)
  ) {
    filter.relationshipType = "PROPOSED_BY";
  }

  const objectPhrase =
    extractAnalyticalObjectPhrase(query);

  if (objectPhrase) {
    filter.objectPhrase = objectPhrase;
    filter.requireObjectMatch = true;
    filter.relatedEntityPhrase = objectPhrase;
  } else if (
    /\btyping\b|\btype[\s_-]?hints?\b|\bannotations?\b/.test(normalized)
  ) {
    /*
     * Legacy soft cue when no explicit introduce-object was parsed.
     */
    filter.relatedEntityPhrase = "typing";
  } else if (/\breadability\b/.test(normalized)) {
    filter.relatedEntityPhrase = "readability";
  }

  let target: string | undefined;
  let subjectEntityType: string | undefined;

  if (/\bauthors?\b/i.test(query)) {
    target = "authors";
    subjectEntityType = "Author";
  } else if (/\bpep/i.test(query) || /\bproposals?\b/i.test(query)) {
    target = "PEPs";
    subjectEntityType = "Proposal";
    filter.entityType = "Proposal";
  } else if (/\bfeatures?\b/i.test(query)) {
    target = "features";
    subjectEntityType = "Feature";
    filter.entityType = "Feature";
  } else if (/\bconcerns?\b/i.test(query)) {
    target = "concerns";
    subjectEntityType = "Concern";
    filter.entityType = "Concern";
  }

  const numericField =
    (
      operation === "MIN" ||
      operation === "MAX"
    ) &&
    subjectEntityType === "Proposal"
      ? "pep"
      : undefined;

  const requestedOutputs: Array<"count" | "list" | "complement"> = [];

  if (
    operation === "COUNT" ||
    operation === "DISTINCT_COUNT" ||
    wantsCount
  ) {
    requestedOutputs.push("count");
  }

  if (
    operation === "LIST" ||
    wantsList
  ) {
    requestedOutputs.push("list");
  }

  if (wantsComplement) {
    requestedOutputs.push("complement");
  }

  const hasFilter =
    Boolean(
      filter.relationshipType ||
      filter.relatedEntityPhrase ||
      filter.objectPhrase ||
      filter.entityType
    );

  return {
    operation,
    ...(target ? { target } : {}),
    ...(subjectEntityType
      ? { subjectEntityType }
      : {}),
    ...(hasFilter ? { filter } : {}),
    ...(numericField
      ? { numericField }
      : {}),
    scope: "current grounded corpus",
    ...(requestedOutputs.length > 0
      ? { requestedOutputs }
      : {}),
    ...(wantsComplement
      ? { includeComplement: true }
      : {})
  };

}

function detectSummarizationSpec(
  query: string
): SummarizationSpec | undefined {

  if (!SUMMARIZATION_CUE.test(query)) {
    return undefined;
  }

  const normalized =
    query.toLowerCase();

  const topics: string[] = [];

  if (
    /\btyping\b|\btype[\s_-]?hints?\b|\bannotations?\b/.test(normalized)
  ) {
    topics.push("typing");
  }

  if (/\breadability\b/.test(normalized)) {
    topics.push("readability");
  }

  const relationshipFilters: string[] = [];

  if (/\bintroduc/.test(normalized)) {
    relationshipFilters.push("INTRODUCES");
  }

  if (
    /\baddress/.test(normalized) ||
    /\bconcern\b/.test(normalized)
  ) {
    relationshipFilters.push("ADDRESSES");
  }

  const requiresCrossDocument =
    /\b(?:across|multiple\s+documents?|indexed\s+peps|evol(?:ve|ved|ving|ution)|corpus)\b/i
      .test(normalized) ||
    topics.length > 1;

  return {
    mode: requiresCrossDocument
      ? "CROSS_DOCUMENT_SYNTHESIS"
      : "SINGLE_DOCUMENT_SUMMARY",
    topics,
    relationshipFilters,
    scope: "current grounded corpus",
    requiresCrossDocument
  };

}

function detectCompoundRequest(
  query: string,
  focuses: string[] | undefined
): boolean {

  const independentClauses =
    splitIndependentClaimClauses(query);

  if (independentClauses.length >= 2) {
    return true;
  }

  const whoWhatCount =
    (query.match(/\b(?:who|what|which)\b/gi) ?? []).length;

  /*
   * Multiple focuses from a single WHY/HOW explanation are not compound
   * multi-requests unless the user listed independent who/what asks.
   */
  if (
    focuses &&
    focuses.length >= 2 &&
    (
      whoWhatCount >= 2 ||
      /,/.test(query)
    )
  ) {
    return true;
  }

  const normalized =
    query.toLowerCase();

  const cues = [
    /\bwho proposed\b/,
    /\bwhat (?:did|does) (?:it|this|the proposal)?\s*introduce/,
    /\bwhat (?:feature|concern|problem|decision)\b/,
    /\bwhat concern\b/,
    /\bhow (?:does|do|is|are)\b.+\b(?:relate|related|connect|connected)\b/
  ];

  const hits =
    cues.filter(pattern => pattern.test(normalized)).length;

  return hits >= 2;

}

function buildSubRequests(
  query: string,
  focuses: string[] | undefined,
  claims: LogicalClaim[] = []
): QuerySubRequest[] {

  const requests: QuerySubRequest[] = [];

  if (claims.length > 0) {
    for (const claim of claims) {
      const label =
        `${claim.subject || "?"} → ${claim.predicate} → ${claim.object || "?"}`;

      requests.push({
        ...(ONTOLOGY_TYPES.has(claim.predicate)
          ? { focus: claim.predicate }
          : {}),
        label,
        ...(claim.subject ? { subject: claim.subject } : {}),
        ...(claim.object ? { object: claim.object } : {})
      });
    }

    return requests;
  }

  if (focuses) {
    for (const focus of focuses) {
      requests.push({
        focus,
        label: `${focus} request`
      });
    }
  }

  if (
    /\bhow (?:does|do|is|are)\b.+\b(?:relate|related|connect|connected)\b/i.test(
      query
    ) &&
    !requests.some(item =>
      item.label.includes("relate")
    )
  ) {
    requests.push({
      label: "relationship-to request"
    });
  }

  return requests;

}

const ONTOLOGY_TYPES =
  new Set<string>(ALLOWED_RELATIONSHIP_TYPES);

function detectBridgeParaphrase(
  query: string
): {
  left: string;
  right: string;
  bridge: string;
} | undefined {

  const match =
    query.match(
      /(?:is|are)\s+(.+?)\s+connected\s+to\s+(.+?)\s+through\s+(.+?)\s*\??$/i
    ) ??
    query.match(
      /(.+?)\s+connected\s+to\s+(.+?)\s+through\s+(.+?)\s*\??$/i
    ) ??
    query.match(
      /(?:is|are)\s+(.+?)\s+(?:and|&)\s+(.+?)\s+connected\s+through\s+(.+?)\s*\??$/i
    );

  if (!match) {
    return undefined;
  }

  const left =
    (match[1] ?? "").trim().replace(/[?"']+$/g, "");
  const right =
    (match[2] ?? "").trim().replace(/[?"']+$/g, "");
  const bridge =
    (match[3] ?? "").trim().replace(/[?"']+$/g, "");

  if (!left || !right || !bridge) {
    return undefined;
  }

  return { left, right, bridge };

}

function detectConnectedParaphrase(
  query: string
): boolean {

  return (
    /\b(?:what evidence|evidence that)\s+connects?\b/i.test(query) ||
    /\bconnects?\s+.+\band\b.+/i.test(query)
  );

}

function buildRewrittenRepresentation(
  understanding: Omit<
    QueryUnderstanding,
    "rewrittenRepresentation" | "strategy" | "maxDepth" | "traversal" | "focusRelationships" | "requireRelationshipBetween"
  > & {
    focusRelationships?: string[];
    requireRelationshipBetween?: QueryUnderstanding["requireRelationshipBetween"];
  }
): string {

  switch (understanding.intent) {

    case "IMPLICATION": {
      const claimParts =
        understanding.claims.map(claim =>
          `${claim.subject || "?"} → ${claim.predicate} → ${claim.object || "?"}`
        );

      return claimParts.length > 0
        ? `Evaluate whether the available evidence supports the claim(s): ${claimParts.join("; ")}`
        : "Evaluate whether the available evidence supports the requested conclusion.";
    }

    case "BRIDGE_RELATIONSHIP":
      return [
        `start=${understanding.entities[0] ?? "?"}`,
        `end=${understanding.entities[1] ?? "?"}`,
        `bridge=${understanding.bridgeEntity ?? "?"}`,
        "mode=BRIDGE"
      ].join("; ");

    case "DIRECT_RELATIONSHIP":
      return [
        `start=${understanding.requireRelationshipBetween?.left ?? understanding.entities[0] ?? "?"}`,
        `end=${understanding.requireRelationshipBetween?.right ?? understanding.entities[1] ?? "?"}`,
        "mode=DIRECT"
      ].join("; ");

    case "CONNECTED_RELATIONSHIP":
      return [
        `start=${understanding.entities[0] ?? "?"}`,
        `end=${understanding.entities[1] ?? "?"}`,
        "mode=CONNECTED"
      ].join("; ");

    case "COMPOUND":
      return understanding.claims.length > 0
        ? `compound claims: ${understanding.claims.map(claim =>
            `${claim.subject || "?"} → ${claim.predicate} → ${claim.object || "?"}`
          ).join("; ")}`
        : understanding.subRequests.length > 0
          ? `subrequests: ${understanding.subRequests.map(item => item.focus ?? item.label).join("; ")}`
          : "compound multi-request";

    case "ANALYTICAL":
      return [
        `operation=${understanding.analytical?.operation ?? "UNKNOWN"}`,
        understanding.analytical?.target
          ? `subject=${understanding.analytical.target}`
          : undefined,
        understanding.analytical?.filter?.relationshipType
          ? `relationship=${understanding.analytical.filter.relationshipType}`
          : undefined,
        understanding.analytical?.filter?.objectPhrase
          ? `object=${understanding.analytical.filter.objectPhrase}`
          : understanding.analytical?.filter?.relatedEntityPhrase
            ? `filter.related=${understanding.analytical.filter.relatedEntityPhrase}`
            : undefined,
        understanding.analytical?.includeComplement
          ? "outputs=count,list,complement"
          : understanding.analytical?.requestedOutputs?.length
            ? `outputs=${understanding.analytical.requestedOutputs.join(",")}`
            : undefined,
        understanding.analytical?.numericField
          ? `field=${understanding.analytical.numericField}`
          : undefined,
        understanding.analytical?.scope
          ? `scope=${understanding.analytical.scope}`
          : undefined
      ]
        .filter(Boolean)
        .join("; ");

    case "SUMMARIZATION":
      return [
        `mode=${understanding.summarization?.mode ?? "SINGLE_DOCUMENT_SUMMARY"}`,
        understanding.summarization?.topics?.length
          ? `topics=${understanding.summarization.topics.join(",")}`
          : undefined,
        understanding.summarization?.relationshipFilters?.length
          ? `relationships=${understanding.summarization.relationshipFilters.join(",")}`
          : undefined,
        understanding.summarization?.scope
          ? `scope=${understanding.summarization.scope}`
          : undefined
      ]
        .filter(Boolean)
        .join("; ");

    case "COMPARISON":
      return `compare entities: ${understanding.entities.join(", ") || understanding.normalizedQuery}`;

    case "OUT_OF_CORPUS":
      return "out-of-corpus request; fail closed if no grounded evidence";

    case "RELATIONSHIP":
      return understanding.focusRelationships &&
        understanding.focusRelationships.length > 0
        ? `relationship focuses: ${understanding.focusRelationships.join(", ")}`
        : "relationship request";

    default:
      return `factual ask: ${understanding.normalizedQuery}`;

  }

}

function resolveStrategy(
  intent: QueryIntentKind,
  focuses: string[] | undefined,
  between: RelationshipBetweenQuery | undefined,
  pathQuery: boolean,
  query: string
): {
  strategy: ReasoningStrategy;
  maxDepth: number;
  traversal: "bfs" | "dfs";
  focusRelationships?: string[];
  requireRelationshipBetween?: {
    left: string;
    right: string;
  };
} {

  const lower =
    query.toLowerCase();

  if (intent === "COMPARISON") {
    return {
      strategy: "comparison",
      maxDepth: 1,
      traversal: "dfs"
    };
  }

  if (intent === "DIRECT_RELATIONSHIP" && between) {
    return {
      strategy: "single-hop",
      maxDepth: 1,
      traversal: "dfs",
      requireRelationshipBetween: {
        left: between.left,
        right: between.right
      }
    };
  }

  if (
    intent === "BRIDGE_RELATIONSHIP" ||
    intent === "CONNECTED_RELATIONSHIP"
  ) {
    return {
      strategy: "multi-hop",
      maxDepth: 2,
      traversal: "bfs",
      ...(between
        ? {
            requireRelationshipBetween: {
              left: between.left,
              right: between.right
            }
          }
        : {})
    };
  }

  if (intent === "IMPLICATION") {
    return {
      strategy: "explanation",
      maxDepth: 1,
      traversal: "dfs",
      ...(focuses && focuses.length > 0
        ? { focusRelationships: focuses }
        : {})
    };
  }

  if (intent === "COMPOUND") {
    return {
      strategy: "single-hop",
      maxDepth: 1,
      traversal: "dfs",
      ...(focuses && focuses.length > 0
        ? { focusRelationships: focuses }
        : {})
    };
  }

  if (intent === "ANALYTICAL" || intent === "SUMMARIZATION") {
    return {
      strategy: "single-hop",
      maxDepth: 1,
      traversal: "dfs",
      ...(focuses && focuses.length > 0
        ? { focusRelationships: focuses }
        : {})
    };
  }

  if (intent === "OUT_OF_CORPUS") {
    return {
      strategy: "single-hop",
      maxDepth: 1,
      traversal: "dfs"
    };
  }

  /*
   * Preserve legacy planner behavior for RELATIONSHIP / FACT / residual cases.
   */
  if (pathQuery) {
    return {
      strategy: "multi-hop",
      maxDepth: 2,
      traversal: "bfs"
    };
  }

  if (lower.includes("why")) {
    return {
      strategy: "explanation",
      maxDepth: 1,
      traversal: "dfs",
      ...(focuses && focuses.length > 0
        ? { focusRelationships: focuses }
        : {})
    };
  }

  if (
    (
      lower.includes(" and ") ||
      lower.includes("both")
    ) &&
    !(focuses && focuses.length > 0)
  ) {
    return {
      strategy: "multi-hop",
      maxDepth: 3,
      traversal: "bfs"
    };
  }

  if (
    lower.includes("how") &&
    !(focuses && focuses.length > 0)
  ) {
    return {
      strategy: "multi-hop",
      maxDepth: 3,
      traversal: "bfs"
    };
  }

  return {
    strategy: "single-hop",
    maxDepth: 1,
    traversal: "dfs",
    ...(focuses && focuses.length > 0
      ? { focusRelationships: focuses }
      : {})
  };

}

/**
 * Classify query intent with explicit precedence.
 *
 * Precedence (highest first):
 * OUT_OF_CORPUS → IMPLICATION → COMPARISON → BRIDGE → DIRECT →
 * CONNECTED → ANALYTICAL → SUMMARIZATION → COMPOUND → RELATIONSHIP → FACT
 */
export function classifyQueryIntent(
  query: string
): QueryIntentKind {

  const normalized =
    normalizeQueryText(query);

  if (!normalized) {
    return "FACT";
  }

  if (
    OUT_OF_CORPUS_CUE.test(normalized) &&
    !DOMAIN_CUE.test(normalized)
  ) {
    return "OUT_OF_CORPUS";
  }

  if (detectLogicalConclusionQuery(normalized)) {
    return "IMPLICATION";
  }

  if (COMPARISON_CUE.test(normalized)) {
    return "COMPARISON";
  }

  const between =
    detectRelationshipBetweenQuery(normalized);

  if (between?.mode === "bridge") {
    return "BRIDGE_RELATIONSHIP";
  }

  if (detectBridgeParaphrase(normalized)) {
    return "BRIDGE_RELATIONSHIP";
  }

  if (between?.mode === "direct") {
    return "DIRECT_RELATIONSHIP";
  }

  if (between?.mode === "connected") {
    return "CONNECTED_RELATIONSHIP";
  }

  if (
    detectConnectedParaphrase(normalized) ||
    (
      detectMultiHopPathQuery(normalized) &&
      /\b(?:connect|connected|related|through|via)\b/i.test(normalized)
    )
  ) {
    return "CONNECTED_RELATIONSHIP";
  }

  if (detectAnalyticalSpec(normalized)) {
    return "ANALYTICAL";
  }

  if (SUMMARIZATION_CUE.test(normalized)) {
    return "SUMMARIZATION";
  }

  const focuses =
    detectFocusRelationships(normalized);

  if (detectCompoundRequest(normalized, focuses)) {
    return "COMPOUND";
  }

  if (focuses && focuses.length > 0) {
    return "RELATIONSHIP";
  }

  return "FACT";

}

/**
 * Full query understanding: normalize, classify, extract, rewrite, route.
 */
export function understandQuery(
  query: string
): QueryUnderstanding {

  const originalQuery =
    query;

  const normalizedQuery =
    normalizeQueryText(query);

  const intent =
    classifyQueryIntent(normalizedQuery);

  const between =
    detectRelationshipBetweenQuery(normalizedQuery) ??
    (() => {
      const bridge =
        detectBridgeParaphrase(normalizedQuery);

      if (!bridge) {
        return undefined;
      }

      return {
        left: bridge.left,
        right: bridge.right,
        mode: "bridge" as const,
        bridge: bridge.bridge
      };
    })();

  const focuses =
    detectFocusRelationships(normalizedQuery);

  const pathQuery =
    detectMultiHopPathQuery(normalizedQuery);

  const claims =
    intent === "IMPLICATION" ||
    intent === "COMPOUND" ||
    intent === "RELATIONSHIP"
      ? extractLogicalClaims(normalizedQuery)
      : [];

  const analytical =
    intent === "ANALYTICAL"
      ? detectAnalyticalSpec(normalizedQuery)
      : undefined;

  const summarization =
    intent === "SUMMARIZATION"
      ? detectSummarizationSpec(normalizedQuery)
      : undefined;

  const entities =
    extractQueryEntities(
      normalizedQuery,
      between,
      claims
    );

  const claimFocuses =
    claims
      .map(claim => claim.predicate)
      .filter((predicate): predicate is string =>
        ONTOLOGY_TYPES.has(predicate)
      );

  const mergedFocuses =
    uniqueStrings([
      ...(focuses ?? []),
      ...claimFocuses
    ]);

  const typedEdgeClaim =
    claims.find(claim =>
      claim.inferenceMode === "typed_edge" &&
      Boolean(claim.subject?.trim()) &&
      Boolean(claim.object?.trim()) &&
      ONTOLOGY_TYPES.has(claim.predicate)
    );

  const requireTypedEdge =
    typedEdgeClaim
      ? {
          subject: typedEdgeClaim.subject,
          predicate: typedEdgeClaim.predicate,
          object: typedEdgeClaim.object,
          direction: "outgoing" as const
        }
      : undefined;

  const subRequests =
    intent === "COMPOUND"
      ? buildSubRequests(normalizedQuery, mergedFocuses, claims)
      : mergedFocuses.length === 1
        ? buildSubRequests(normalizedQuery, mergedFocuses, [])
        : [];

  const routing =
    resolveStrategy(
      intent,
      mergedFocuses.length > 0 ? mergedFocuses : focuses,
      between,
      pathQuery,
      normalizedQuery
    );

  const partial = {
    intent,
    originalQuery,
    normalizedQuery,
    entities,
    ...(between?.bridge
      ? { bridgeEntity: between.bridge }
      : intent === "BRIDGE_RELATIONSHIP" && entities.length >= 3
        ? { bridgeEntity: entities[2] }
        : {}),
    relationshipRequested:
      mergedFocuses.length > 0
        ? mergedFocuses
        : focuses
          ? [...focuses]
          : [],
    ...(between
      ? { relationshipMode: between.mode }
      : intent === "CONNECTED_RELATIONSHIP"
        ? { relationshipMode: "connected" as const }
        : intent === "DIRECT_RELATIONSHIP"
          ? { relationshipMode: "direct" as const }
          : intent === "BRIDGE_RELATIONSHIP"
            ? { relationshipMode: "bridge" as const }
            : {}),
    claims,
    subRequests,
    ...(analytical ? { analytical } : {}),
    ...(summarization ? { summarization } : {}),
    ...(routing.focusRelationships
      ? { focusRelationships: routing.focusRelationships }
      : {}),
    ...(routing.requireRelationshipBetween
      ? {
          requireRelationshipBetween:
            routing.requireRelationshipBetween
        }
      : {}),
    ...(requireTypedEdge
      ? { requireTypedEdge }
      : {})
  };

  const rewrittenRepresentation =
    buildRewrittenRepresentation(partial);

  return {
    ...partial,
    rewrittenRepresentation,
    strategy: routing.strategy,
    maxDepth: routing.maxDepth,
    traversal: routing.traversal
  };

}

/**
 * Concise trace line for resolved intent.
 */
export function formatIntentTraceStep(
  understanding: QueryUnderstanding
): string {

  if (understanding.intent === "IMPLICATION") {
    return "Intent: IMPLICATION → evaluated by logical support checker";
  }

  if (understanding.intent === "ANALYTICAL") {
    return `Intent: ANALYTICAL (structured; executable)`;
  }

  if (understanding.intent === "SUMMARIZATION") {
    return (
      `Intent: SUMMARIZATION` +
      (understanding.summarization
        ? ` mode=${understanding.summarization.mode}`
        : "")
    );
  }

  return `Intent: ${understanding.intent}`;

}
