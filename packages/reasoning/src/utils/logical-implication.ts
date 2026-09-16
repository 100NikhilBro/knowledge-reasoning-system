import type { ReasoningContext } from "../types/reasoning-context.js";

import {
  detectMultiHopPathQuery,
  detectFocusRelationships
} from "./detect-focus-relationships.js";

import {
  detectRelationshipBetweenQuery,
  entityMatchesPhrase
} from "./detect-relationship-between-query.js";

import {
  ALLOWED_RELATIONSHIP_TYPES,
  type AllowedRelationshipType
} from "@knowledge/shared";

/**
 * Explicit logical-support outcomes for conclusion / implication queries.
 */
export type ImplicationSupport =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "NOT_SUPPORTED"
  | "NOT_APPLICABLE";

/**
 * Structured claim used by the implication checker.
 * Predicates are either ontology relationship types or reserved
 * conclusion predicates (IMPROVES, RELATED, DIRECT, CONNECTED, BRIDGE, CAUSAL).
 */
export interface LogicalClaim {
  subject: string;
  predicate: string;
  object: string;
  /**
   * How the claim must be established against the graph.
   */
  inferenceMode:
    | "typed_edge"
    | "direct_edge"
    | "connected"
    | "bridge"
    | "causal_extra";
  bridge?: string;
}

export interface ClaimEvaluation {
  claim: LogicalClaim;
  support: "SUPPORTED" | "NOT_SUPPORTED";
  reason: string;
}

export interface ImplicationDecision {
  support: ImplicationSupport;
  claims: ClaimEvaluation[];
  summary: string;
  /**
   * Ontology / mode tokens established by supported claims.
   */
  established: string[];
  /**
   * Ontology / mode tokens missing from unsupported claims.
   */
  missing: string[];
}

const CONCLUSION_CUE =
  /\b(?:can we conclude|does (?:this|it) (?:imply|mean)|does\s+\S+\s+imply|is it (?:correct|fair|true) to say|can we (?:infer|say that)|supports? the conclusion|therefore|implies|proves|establish(?:es)?)\b/i;

const ONTOLOGY_TYPES =
  new Set<string>(ALLOWED_RELATIONSHIP_TYPES);

/**
 * Detect logical / conclusion language that needs an implication check.
 * Factual asks ("What did PEP-484 introduce?") stay out of this path.
 */
export function detectLogicalConclusionQuery(
  query: string | undefined
): boolean {

  if (!query?.trim()) {
    return false;
  }

  const normalized =
    query.trim();

  /*
   * Explicit path / bridge questions are connectivity asks, not
   * conclusion implication checks.
   */
  if (
    detectRelationshipBetweenQuery(normalized)?.mode === "bridge" ||
    (
      detectMultiHopPathQuery(normalized) &&
      !CONCLUSION_CUE.test(normalized)
    )
  ) {
    return false;
  }

  if (CONCLUSION_CUE.test(normalized)) {
    return true;
  }

  /*
   * Explicit meta-evaluation of a statement. Do not treat ordinary
   * "how is X directly related to Y" connectivity asks as conclusions.
   */
  if (
    /\bis\s+it\s+(?:correct|fair|true)\s+to\s+say\s+that\s+/i.test(normalized)
  ) {
    return true;
  }

  /*
   * WHY/HOW introduce … to improve/enable … asks for a stronger causal
   * conclusion than INTRODUCES alone — route to implication (P1).
   * Plain "Why was PEP-484 proposed?" stays non-implication.
   */
  if (
    /\b(?:why|how)\b/i.test(normalized) &&
    /\b(?:introduce|introduced|introduces)\b/i.test(normalized) &&
    /\bto\s+(?:improve|increase|reduce|help|enable|allow)\b/i.test(normalized)
  ) {
    return true;
  }

  return false;

}

/**
 * Extract the clause being concluded / implied when present.
 */
export function extractConclusionClause(
  query: string
): string {

  const normalized =
    query.trim().replace(/\s+/g, " ");

  const thatMatch =
    normalized.match(
      /(?:conclude|imply|implies|infer|mean|say(?:\s+that)?|proves?|establish(?:es)?)\s+that\s+(.+?)\s*\??$/i
    ) ??
    normalized.match(
      /is it (?:correct|fair|true) to say that\s+(.+?)\s*\??$/i
    ) ??
    normalized.match(
      /can we say that\s+(.+?)\s*\??$/i
    );

  if (thatMatch?.[1]) {
    return thatMatch[1].trim().replace(/[."']+$/g, "");
  }

  return normalized.replace(/\?+$/, "").trim();

}

/**
 * Parse one or more atomic claims from a conclusion clause.
 */
export function extractLogicalClaims(
  query: string
): LogicalClaim[] {

  const clause =
    extractConclusionClause(query);

  const claims: LogicalClaim[] = [];

  const segments =
    clause
      .split(/\band that\b/i)
      .map(part => part.trim())
      .filter(Boolean);

  for (const segment of segments) {

    const causalTail =
      segment.match(
        /^(.+?)\s+to\s+(improve|increase|reduce|help|enable|allow)\s+(.+)$/i
      );

    if (causalTail) {
      const head =
        causalTail[1]?.trim() ?? "";
      const verb =
        causalTail[2]?.trim() ?? "improve";
      const object =
        causalTail[3]?.trim() ?? "";

      claims.push(
        ...extractAtomicClaims(head)
      );

      claims.push({
        subject:
          extractPrimarySubject(head) ?? head,
        predicate:
          verb.toUpperCase() === "IMPROVE"
            ? "IMPROVES"
            : "CAUSAL",
        object,
        inferenceMode: "causal_extra"
      });

      continue;
    }

    claims.push(
      ...extractAtomicClaims(segment)
    );

    const between =
      detectRelationshipBetweenQuery(segment) ??
      detectEmbeddedRelatedness(segment);

    if (between) {
      claims.push({
        subject: between.left,
        predicate:
          between.mode === "direct"
            ? "DIRECT"
            : between.mode === "bridge"
              ? "BRIDGE"
              : "RELATED",
        object: between.right,
        inferenceMode:
          between.mode === "direct"
            ? "direct_edge"
            : between.mode === "bridge"
              ? "bridge"
              : "direct_edge",
        ...(between.bridge
          ? { bridge: between.bridge }
          : {})
      });
    }

  }

  return dedupeClaims(claims);

}

function detectEmbeddedRelatedness(
  clause: string
): {
  left: string;
  right: string;
  mode: "direct" | "connected" | "bridge";
  bridge?: string;
} | undefined {

  const direct =
    clause.match(
      /(.+?)\s+is\s+directly\s+(?:related|connected|linked)\s+to\s+(.+)/i
    );

  if (direct) {
    return {
      left: clean(direct[1]),
      right: clean(direct[2]),
      mode: "direct"
    };
  }

  const related =
    clause.match(
      /(.+?)\s+is\s+(?:related|connected|linked)\s+to\s+(.+)/i
    );

  if (related) {
    /*
     * Conclusion "is related" requires a direct edge — shared hubs
     * must not silently upgrade to RELATED.
     */
    return {
      left: clean(related[1]),
      right: clean(related[2]),
      mode: "direct"
    };
  }

  return undefined;

}

function extractAtomicClaims(
  text: string
): LogicalClaim[] {

  const claims: LogicalClaim[] = [];
  const normalized =
    text
      .trim()
      .replace(/^(?:why|how)\s+(?:did|does|do|is|are|was|were)\s+/i, "")
      .replace(/^(?:why|how)\s+/i, "");

  if (!normalized) {
    return claims;
  }

  const introduced =
    normalized.match(
      /(.+?)\s+introduced\s+(.+)/i
    ) ??
    normalized.match(
      /(.+?)\s+introduces\s+(.+)/i
    );

  if (introduced) {
    claims.push({
      subject: clean(introduced[1]),
      predicate: "INTRODUCES",
      object: clean(introduced[2]),
      inferenceMode: "typed_edge"
    });
  }

  const addressed =
    normalized.match(
      /(.+?)\s+addressed\s+(.+)/i
    ) ??
    normalized.match(
      /(.+?)\s+addresses\s+(.+)/i
    );

  if (addressed) {
    claims.push({
      subject: clean(addressed[1]),
      predicate: "ADDRESSES",
      object: clean(addressed[2]),
      inferenceMode: "typed_edge"
    });
  }

  const proposed =
    normalized.match(
      /(.+?)\s+was proposed by\s+(.+)/i
    ) ??
    normalized.match(
      /(.+?)\s+proposed by\s+(.+)/i
    );

  if (proposed) {
    claims.push({
      subject: clean(proposed[1]),
      predicate: "PROPOSED_BY",
      object: clean(proposed[2]),
      inferenceMode: "typed_edge"
    });
  }

  const improves =
    normalized.match(
      /(.+?)\s+improves?\s+(.+)/i
    );

  if (improves) {
    claims.push({
      subject: clean(improves[1]),
      predicate: "IMPROVES",
      object: clean(improves[2]),
      inferenceMode: "causal_extra"
    });
  }

  /*
   * Fall back to focus relationship types named by the query when no
   * subject-verb-object claim was parsed — still conclusion-gated.
   */
  if (claims.length === 0) {
    const focuses =
      detectFocusRelationships(normalized);

    if (focuses && focuses.length > 0) {
      for (const focus of focuses) {
        claims.push({
          subject: "",
          predicate: focus,
          object: "",
          inferenceMode: "typed_edge"
        });
      }
    }
  }

  return claims;

}

function extractPrimarySubject(
  head: string
): string | undefined {

  const cleaned =
    head
      .trim()
      .replace(/^(?:why|how)\s+(?:did|does|do|is|are|was|were)\s+/i, "")
      .replace(/^(?:why|how)\s+/i, "");

  const introduced =
    cleaned.match(
      /^(.+?)\s+(?:introduced|introduces|introduce)\s+/i
    );

  if (introduced?.[1]) {
    return clean(introduced[1]);
  }

  const featureObject =
    cleaned.match(
      /(?:introduced|introduces|introduce)\s+(.+)$/i
    );

  if (featureObject?.[1]) {
    return clean(featureObject[1]);
  }

  return undefined;

}

function clean(
  value: string | undefined
): string {

  return (value ?? "")
    .trim()
    .replace(/^that\s+/i, "")
    .replace(/[."']+$/g, "")
    .replace(/\s+/g, " ");

}

function dedupeClaims(
  claims: LogicalClaim[]
): LogicalClaim[] {

  const seen =
    new Set<string>();

  const unique: LogicalClaim[] = [];

  for (const claim of claims) {
    const key =
      `${claim.subject}|${claim.predicate}|${claim.object}|${claim.inferenceMode}|${claim.bridge ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(claim);
  }

  return unique;

}

function listRelationships(
  context: ReasoningContext
): Array<{ from: string; to: string; type: string }> {

  const seen =
    new Set<string>();

  const rows: Array<{ from: string; to: string; type: string }> = [];

  for (const item of [
    ...context.items,
    ...context.evidence.map(entry => ({
      relationship: entry.relationship
    }))
  ]) {

    const relationship =
      item.relationship;

    if (!relationship) {
      continue;
    }

    const key =
      `${relationship.from}|${relationship.type}|${relationship.to}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rows.push({
      from: relationship.from,
      to: relationship.to,
      type: relationship.type
    });

  }

  return rows;

}

function listEndpoints(
  context: ReasoningContext
): Array<{
  id: string;
  label: string;
  source: string;
  properties?: Record<string, unknown>;
}> {

  if (context.evidence.length > 0) {
    return context.evidence.map(entry => entry.entity);
  }

  return context.items.map(entry => ({
    id: entry.entityId,
    label: entry.label,
    source: entry.source,
    properties: entry.properties
  }));

}

/**
 * Exact typed edge between phrase-matched endpoints (either direction).
 */
export function contextHasTypedEdge(
  context: ReasoningContext,
  left: string,
  right: string,
  type: string
): boolean {

  const endpoints =
    listEndpoints(context);

  for (const relationship of listRelationships(context)) {

    if (relationship.type !== type) {
      continue;
    }

    const from =
      endpoints.find(entity => entity.id === relationship.from);

    const to =
      endpoints.find(entity => entity.id === relationship.to);

    if (!from || !to) {
      continue;
    }

    const connects =
      (
        entityMatchesPhrase(from, left) &&
        entityMatchesPhrase(to, right)
      ) ||
      (
        entityMatchesPhrase(from, right) &&
        entityMatchesPhrase(to, left)
      );

    if (connects) {
      return true;
    }

  }

  return false;

}

function contextHasConnectingEdge(
  context: ReasoningContext,
  left: string,
  right: string
): boolean {

  const endpoints =
    listEndpoints(context);

  for (const relationship of listRelationships(context)) {

    const from =
      endpoints.find(entity => entity.id === relationship.from);

    const to =
      endpoints.find(entity => entity.id === relationship.to);

    if (!from || !to) {
      continue;
    }

    const connects =
      (
        entityMatchesPhrase(from, left) &&
        entityMatchesPhrase(to, right)
      ) ||
      (
        entityMatchesPhrase(from, right) &&
        entityMatchesPhrase(to, left)
      );

    if (connects) {
      return true;
    }

  }

  return false;

}

function contextHasSharedHubBridge(
  context: ReasoningContext,
  left: string,
  right: string,
  requiredBridge?: string
): boolean {

  const endpoints =
    listEndpoints(context);

  const leftIds =
    new Set(
      endpoints
        .filter(entity => entityMatchesPhrase(entity, left))
        .map(entity => entity.id)
    );

  const rightIds =
    new Set(
      endpoints
        .filter(entity => entityMatchesPhrase(entity, right))
        .map(entity => entity.id)
    );

  if (leftIds.size === 0 || rightIds.size === 0) {
    return false;
  }

  const neighborsById =
    new Map<string, Set<string>>();

  function touch(
    a: string,
    b: string
  ): void {

    const setA =
      neighborsById.get(a) ?? new Set<string>();

    setA.add(b);
    neighborsById.set(a, setA);

    const setB =
      neighborsById.get(b) ?? new Set<string>();

    setB.add(a);
    neighborsById.set(b, setB);

  }

  for (const relationship of listRelationships(context)) {
    touch(relationship.from, relationship.to);
  }

  const bridgeCandidates =
    new Set<string>();

  for (const leftId of leftIds) {
    for (const neighbor of neighborsById.get(leftId) ?? []) {
      if (!rightIds.has(neighbor) && !leftIds.has(neighbor)) {
        bridgeCandidates.add(neighbor);
      }
    }
  }

  for (const bridgeId of bridgeCandidates) {
    const bridgeEntity =
      endpoints.find(entity => entity.id === bridgeId);

    if (
      requiredBridge &&
      bridgeEntity &&
      !entityMatchesPhrase(bridgeEntity, requiredBridge)
    ) {
      continue;
    }

    if (
      requiredBridge &&
      !bridgeEntity &&
      !entityMatchesPhrase(
        {
          id: bridgeId,
          label: bridgeId,
          source: "",
          properties: {}
        },
        requiredBridge
      )
    ) {
      continue;
    }

    const neighbors =
      neighborsById.get(bridgeId) ?? new Set<string>();

    const touchesLeft =
      [...leftIds].some(id => neighbors.has(id));

    const touchesRight =
      [...rightIds].some(id => neighbors.has(id));

    if (touchesLeft && touchesRight) {
      return true;
    }
  }

  return false;

}

function presentTypes(
  context: ReasoningContext
): Set<string> {

  return new Set(
    listRelationships(context).map(row => row.type)
  );

}

function evaluateClaim(
  claim: LogicalClaim,
  context: ReasoningContext
): ClaimEvaluation {

  if (claim.inferenceMode === "causal_extra") {
    return {
      claim,
      support: "NOT_SUPPORTED",
      reason:
        `No evidence establishes ${claim.subject || "the subject"} → ${claim.predicate} → ${claim.object || "the object"}.`
    };
  }

  if (
    claim.inferenceMode === "typed_edge" &&
    claim.subject &&
    claim.object &&
    ONTOLOGY_TYPES.has(claim.predicate)
  ) {
    const ok =
      contextHasTypedEdge(
        context,
        claim.subject,
        claim.object,
        claim.predicate
      );

    return {
      claim,
      support: ok ? "SUPPORTED" : "NOT_SUPPORTED",
      reason: ok
        ? `Evidence establishes ${claim.subject} → ${claim.predicate} → ${claim.object}.`
        : `No evidence establishes ${claim.subject} → ${claim.predicate} → ${claim.object}.`
    };
  }

  if (
    claim.inferenceMode === "typed_edge" &&
    !claim.subject &&
    !claim.object &&
    ONTOLOGY_TYPES.has(claim.predicate)
  ) {
    const ok =
      presentTypes(context).has(claim.predicate);

    return {
      claim,
      support: ok ? "SUPPORTED" : "NOT_SUPPORTED",
      reason: ok
        ? `Evidence includes ${claim.predicate}.`
        : `No evidence establishes ${claim.predicate}.`
    };
  }

  if (claim.inferenceMode === "direct_edge") {
    const ok =
      contextHasConnectingEdge(
        context,
        claim.subject,
        claim.object
      );

    return {
      claim,
      support: ok ? "SUPPORTED" : "NOT_SUPPORTED",
      reason: ok
        ? `Evidence establishes a direct relationship between ${claim.subject} and ${claim.object}.`
        : `No evidence establishes a direct relationship between ${claim.subject} and ${claim.object}.`
    };
  }

  if (claim.inferenceMode === "bridge") {
    const ok =
      contextHasSharedHubBridge(
        context,
        claim.subject,
        claim.object,
        claim.bridge
      );

    return {
      claim,
      support: ok ? "SUPPORTED" : "NOT_SUPPORTED",
      reason: ok
        ? `Evidence establishes a bridge between ${claim.subject} and ${claim.object}${claim.bridge ? ` through ${claim.bridge}` : ""}.`
        : `No evidence establishes the requested bridge between ${claim.subject} and ${claim.object}.`
    };
  }

  if (claim.inferenceMode === "connected") {
    const direct =
      contextHasConnectingEdge(
        context,
        claim.subject,
        claim.object
      );

    const bridge =
      contextHasSharedHubBridge(
        context,
        claim.subject,
        claim.object
      );

    const ok =
      direct || bridge;

    return {
      claim,
      support: ok ? "SUPPORTED" : "NOT_SUPPORTED",
      reason: ok
        ? `Evidence establishes a connection between ${claim.subject} and ${claim.object}.`
        : `No evidence establishes a connection between ${claim.subject} and ${claim.object}.`
    };
  }

  /*
   * Unknown / non-ontology predicates never silently pass.
   */
  return {
    claim,
    support: "NOT_SUPPORTED",
    reason:
      `No evidence establishes ${claim.subject || "the subject"} → ${claim.predicate} → ${claim.object || "the object"}.`
  };

}

/**
 * Deterministic implication check over grounded evidence only.
 * Prefer NOT_SUPPORTED over unsupported inference.
 */
export function evaluateLogicalImplication(
  query: string | undefined,
  context: ReasoningContext
): ImplicationDecision {

  if (
    !query ||
    !detectLogicalConclusionQuery(query)
  ) {
    return {
      support: "NOT_APPLICABLE",
      claims: [],
      summary: "No logical conclusion check required.",
      established: [],
      missing: []
    };
  }

  if (context.evidence.length === 0) {
    return {
      support: "NOT_SUPPORTED",
      claims: [],
      summary:
        "No grounded evidence is available for the requested conclusion.",
      established: [],
      missing: ["EVIDENCE"]
    };
  }

  const claims =
    extractLogicalClaims(query);

  if (claims.length === 0) {
    return {
      support: "NOT_SUPPORTED",
      claims: [],
      summary:
        "The requested conclusion could not be mapped to an inspectable claim.",
      established: [],
      missing: ["CLAIM"]
    };
  }

  const evaluations =
    claims.map(claim => evaluateClaim(claim, context));

  const supported =
    evaluations.filter(item => item.support === "SUPPORTED");

  const unsupported =
    evaluations.filter(item => item.support === "NOT_SUPPORTED");

  const established =
    supported.map(item => item.claim.predicate);

  const missing =
    unsupported.map(item => item.claim.predicate);

  if (
    supported.length > 0 &&
    unsupported.length === 0
  ) {
    return {
      support: "SUPPORTED",
      claims: evaluations,
      summary:
        supported.map(item => item.reason).join(" "),
      established,
      missing: []
    };
  }

  if (
    supported.length > 0 &&
    unsupported.length > 0
  ) {
    return {
      support: "PARTIALLY_SUPPORTED",
      claims: evaluations,
      summary:
        [
          ...supported.map(item => item.reason),
          ...unsupported.map(item => item.reason)
        ].join(" "),
      established,
      missing
    };
  }

  return {
    support: "NOT_SUPPORTED",
    claims: evaluations,
    summary:
      unsupported.map(item => item.reason).join(" ") ||
      "The available evidence does not establish the requested conclusion.",
    established: [],
    missing
  };

}

/**
 * Concise trace line for the implication decision.
 */
export function formatImplicationTraceStep(
  decision: ImplicationDecision
): string | undefined {

  if (decision.support === "NOT_APPLICABLE") {
    return undefined;
  }

  const detail =
    decision.summary.trim() ||
    decision.support;

  return `Logical conclusion check: ${decision.support} — ${detail}`;

}

export function isOntologyRelationshipType(
  type: string
): type is AllowedRelationshipType {

  return ONTOLOGY_TYPES.has(type);

}
