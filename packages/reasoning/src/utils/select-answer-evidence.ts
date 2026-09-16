import type {
  Evidence,
  KnowledgeEntity
} from "@knowledge/shared";

import {
  entityMatchesPhrase
} from "./detect-relationship-between-query.js";

import type {
  QueryIntentKind,
  QueryUnderstanding,
  AnalyticalSpec
} from "./query-understanding.js";

import type {
  LogicalClaim
} from "./logical-implication.js";

import type {
  ComparisonDimension,
  ComparisonRequest
} from "./detect-comparison-request.js";

import {
  relationshipTypesForDimensions
} from "./detect-comparison-request.js";

/**
 * Structured answer-relevant evidence scope derived from query semantics.
 * Retrieval candidates may be broader; answer context must respect this scope.
 */
export interface AnswerEvidenceScope {
  intent: QueryIntentKind;
  focusSubjects: string[];
  focusObjects: string[];
  requestedPredicates: string[];
  requestedClaims: LogicalClaim[];
  requestedDimensions: ComparisonDimension[];
  allowedEntityTypes: string[];
  bridgeEntity?: string;
  relationshipBetween?: {
    left: string;
    right: string;
    bridge?: string;
  };
  /**
   * Selection mode — drives deterministic retention rules.
   */
  mode:
    | "passthrough"
    | "fact"
    | "focused_relationship"
    | "path"
    | "comparison"
    | "analytical"
    | "implication"
    | "compound";
}

const ONTOLOGY_PREDICATES =
  new Set([
    "INTRODUCES",
    "PROPOSED_BY",
    "ADDRESSES",
    "RESULTS_IN",
    "IMPLEMENTED_IN"
  ]);

/**
 * Derive answer-evidence scope from existing QueryUnderstanding (P1–P4).
 */
export function deriveAnswerEvidenceScope(
  understanding: QueryUnderstanding
): AnswerEvidenceScope {

  const requestedClaims =
    understanding.claims.filter(claim =>
      claim.inferenceMode !== "causal_extra" &&
      ONTOLOGY_PREDICATES.has(claim.predicate)
    );

  const focusSubjects =
    uniquePhrases([
      ...understanding.entities,
      ...requestedClaims
        .map(claim => claim.subject)
        .filter(Boolean),
      ...(understanding.requireTypedEdge
        ? [understanding.requireTypedEdge.subject]
        : []),
      ...(understanding.requireRelationshipBetween
        ? [
            understanding.requireRelationshipBetween.left,
            understanding.requireRelationshipBetween.right
          ]
        : []),
      ...(understanding.comparison?.subjects ?? []),
      ...(understanding.bridgeEntity
        ? [understanding.bridgeEntity]
        : []),
      ...extractIdentitySubjects(understanding.originalQuery)
    ]);

  const focusObjects =
    uniquePhrases([
      ...requestedClaims
        .map(claim => claim.object)
        .filter((value): value is string =>
          Boolean(value) && isCleanObjectPhrase(value)
        ),
      ...(understanding.requireTypedEdge?.object &&
      isCleanObjectPhrase(understanding.requireTypedEdge.object)
        ? [understanding.requireTypedEdge.object]
        : []),
      ...(understanding.analytical?.filter?.objectPhrase
        ? [understanding.analytical.filter.objectPhrase]
        : []),
      ...(understanding.subRequests
        .map(item => item.object)
        .filter((value): value is string =>
          typeof value === "string" && isCleanObjectPhrase(value)
        ))
    ]);

  const requestedPredicates =
    uniquePhrases([
      ...(understanding.focusRelationships ?? []),
      ...requestedClaims.map(claim => claim.predicate),
      ...(understanding.requireTypedEdge
        ? [understanding.requireTypedEdge.predicate]
        : []),
      ...(understanding.analytical?.filter?.relationshipType
        ? [understanding.analytical.filter.relationshipType]
        : []),
      ...(understanding.subRequests
        .map(item => item.focus)
        .filter((value): value is string => Boolean(value)))
    ]);

  const requestedDimensions =
    understanding.comparison?.dimensions ?? [];

  const allowedEntityTypes =
    uniquePhrases([
      ...(understanding.analytical?.subjectEntityType
        ? [understanding.analytical.subjectEntityType]
        : []),
      ...(understanding.analytical?.filter?.entityType
        ? [understanding.analytical.filter.entityType]
        : [])
    ]);

  const mode =
    resolveSelectionMode(understanding, requestedPredicates);

  return {
    intent: understanding.intent,
    focusSubjects,
    focusObjects,
    requestedPredicates,
    requestedClaims,
    requestedDimensions,
    allowedEntityTypes,
    ...(understanding.bridgeEntity
      ? { bridgeEntity: understanding.bridgeEntity }
      : {}),
    ...(understanding.requireRelationshipBetween
      ? {
          relationshipBetween: {
            left: understanding.requireRelationshipBetween.left,
            right: understanding.requireRelationshipBetween.right,
            ...(understanding.bridgeEntity
              ? { bridge: understanding.bridgeEntity }
              : {})
          }
        }
      : {}),
    mode
  };

}

function resolveSelectionMode(
  understanding: QueryUnderstanding,
  requestedPredicates: string[]
): AnswerEvidenceScope["mode"] {

  if (
    understanding.intent === "SUMMARIZATION" ||
    understanding.intent === "OUT_OF_CORPUS"
  ) {
    return "passthrough";
  }

  if (understanding.intent === "COMPARISON") {
    return "comparison";
  }

  if (understanding.intent === "ANALYTICAL") {
    return "analytical";
  }

  if (
    understanding.intent === "IMPLICATION" ||
    understanding.intent === "COMPOUND"
  ) {
    return understanding.intent === "IMPLICATION"
      ? "implication"
      : "compound";
  }

  if (
    understanding.requireRelationshipBetween ||
    understanding.relationshipMode === "bridge" ||
    understanding.relationshipMode === "connected" ||
    understanding.intent === "BRIDGE_RELATIONSHIP" ||
    understanding.intent === "CONNECTED_RELATIONSHIP"
  ) {
    return "path";
  }

  if (
    requestedPredicates.length > 0 ||
    understanding.requireTypedEdge ||
    understanding.intent === "DIRECT_RELATIONSHIP" ||
    understanding.intent === "RELATIONSHIP"
  ) {
    return "focused_relationship";
  }

  if (understanding.intent === "FACT") {
    return "fact";
  }

  return requestedPredicates.length > 0
    ? "focused_relationship"
    : "passthrough";

}

/**
 * Select Tier 1–3 answer-supporting evidence from retrieval/reasoning candidates.
 *
 * Retrieval score never overrides semantic irrelevance.
 * Provenance fields (source, relationship, path, metadata) are preserved.
 */
export function selectAnswerEvidence(
  understanding: QueryUnderstanding,
  evidence: Evidence[]
): Evidence[] {

  if (evidence.length === 0) {
    return [];
  }

  const scope =
    deriveAnswerEvidenceScope(understanding);

  if (scope.mode === "passthrough") {
    return [...evidence];
  }

  let selected: Evidence[];

  switch (scope.mode) {
    case "fact":
      selected =
        selectFactEvidence(scope, evidence);
      break;
    case "comparison":
      selected =
        selectComparisonEvidence(
          understanding.comparison,
          evidence
        );
      break;
    case "analytical":
      selected =
        selectAnalyticalEvidence(
          understanding.analytical,
          scope,
          evidence
        );
      break;
    case "path":
      selected =
        selectPathEvidence(scope, evidence);
      break;
    case "implication":
    case "compound":
      selected =
        selectClaimEvidence(scope, evidence);
      break;
    case "focused_relationship":
    default:
      selected =
        selectFocusedRelationshipEvidence(scope, evidence);
      break;
  }

  /*
   * Stable order for order-independence: preserve first-seen semantic keys.
   */
  return dedupePreserveOrder(selected);

}

function selectFactEvidence(
  scope: AnswerEvidenceScope,
  evidence: Evidence[]
): Evidence[] {

  const subjects =
    scope.focusSubjects;

  if (subjects.length === 0) {
    /*
     * No resolvable subject — keep entity rows without expanding
     * relationship neighborhoods into the answer context.
     */
    return evidence.filter(item => !item.relationship);
  }

  return evidence.filter(item => {
    if (item.relationship) {
      /*
       * Identity / FACT asks must not dump the entity neighborhood.
       */
      return false;
    }

    return subjects.some(subject =>
      entityMatchesPhrase(item.entity, subject)
    );
  });

}

function selectComparisonEvidence(
  request: ComparisonRequest | undefined,
  evidence: Evidence[]
): Evidence[] {

  if (!request || request.subjects.length < 2) {
    return evidence.filter(item =>
      item.relationship === undefined
    );
  }

  const allowedTypes =
    relationshipTypesForDimensions(request.dimensions);

  const subjectEntities =
    evidence
      .map(item => item.entity)
      .filter(entity =>
        request.subjects.some(subject =>
          entityMatchesPhrase(entity, subject)
        )
      );

  const subjectIds =
    new Set(subjectEntities.map(entity => entity.id));

  return evidence.filter(item => {
    const isSubject =
      request.subjects.some(subject =>
        entityMatchesPhrase(item.entity, subject)
      );

    if (!item.relationship) {
      return isSubject;
    }

    if (
      allowedTypes &&
      !allowedTypes.has(item.relationship.type)
    ) {
      return false;
    }

    const touchesSubject =
      subjectIds.has(item.relationship.from) ||
      subjectIds.has(item.relationship.to) ||
      isSubject;

    return touchesSubject;
  });

}

function selectAnalyticalEvidence(
  analytical: AnalyticalSpec | undefined,
  scope: AnswerEvidenceScope,
  evidence: Evidence[]
): Evidence[] {

  if (!analytical) {
    return [...evidence];
  }

  const relationshipType =
    analytical.filter?.relationshipType ??
    scope.requestedPredicates[0];

  const objectPhrase =
    analytical.filter?.objectPhrase ??
    analytical.filter?.relatedEntityPhrase;

  const entityType =
    analytical.subjectEntityType ??
    analytical.filter?.entityType;

  const keptIds =
    new Set<string>();

  const retained: Evidence[] = [];

  for (const item of evidence) {
    let keep =
      false;

    if (
      entityType &&
      item.entity.type.toLowerCase() === entityType.toLowerCase()
    ) {
      keep = true;
    }

    if (
      objectPhrase &&
      entityMatchesPhrase(item.entity, objectPhrase)
    ) {
      keep = true;
    }

  if (item.relationship) {
      if (
        relationshipType &&
        item.relationship.type === relationshipType
      ) {
        keep = true;
      } else if (
        relationshipType &&
        item.relationship.type !== relationshipType
      ) {
        /*
         * Foreign predicate rows never enter analytical answer context,
         * even when the subject entity type matches the universe.
         */
        keep = false;
      } else if (
        objectPhrase &&
        (
          relationshipMatchesObject(item, evidence, objectPhrase) ||
          entityMatchesPhrase(item.entity, objectPhrase)
        )
      ) {
        keep = true;
      }
    }

    if (
      !entityType &&
      !relationshipType &&
      !objectPhrase
    ) {
      keep = true;
    }

    if (keep) {
      retained.push(item);
      keptIds.add(item.entity.id);

      if (item.relationship) {
        keptIds.add(item.relationship.from);
        keptIds.add(item.relationship.to);
      }
    }
  }

  /*
   * Tier 2/3: attach identity rows for retained subjects/objects only.
   * Never reintroduce foreign-predicate relationship rows.
   */
  for (const item of evidence) {
    if (item.relationship) {
      continue;
    }

    if (!keptIds.has(item.entity.id)) {
      continue;
    }

    if (
      retained.some(entry =>
        sameEvidenceKey(entry, item)
      )
    ) {
      continue;
    }

    retained.push(item);
  }

  return retained;

}

function selectPathEvidence(
  scope: AnswerEvidenceScope,
  evidence: Evidence[]
): Evidence[] {

  const between =
    scope.relationshipBetween;

  const endpointPhrases =
    uniquePhrases([
      ...(between
        ? [between.left, between.right]
        : scope.focusSubjects),
      ...(between?.bridge
        ? [between.bridge]
        : []),
      ...(scope.bridgeEntity
        ? [scope.bridgeEntity]
        : []),
      ...scope.focusObjects
    ]);

  /*
   * Open multi-hop / related-entity asks name one focus subject without an
   * explicit second endpoint. Keep that subject's relationship neighborhood
   * (all predicates) rather than dropping every spoke.
   */
  if (endpointPhrases.length < 2) {
    return selectFocusedRelationshipEvidence(
      {
        ...scope,
        requestedPredicates: [],
        focusObjects: []
      },
      evidence
    );
  }

  const endpointIds =
    resolvePhraseIds(evidence, endpointPhrases);

  const retained: Evidence[] = [];

  for (const item of evidence) {
    if (!item.relationship) {
      if (
        endpointPhrases.some(phrase =>
          entityMatchesPhrase(item.entity, phrase)
        )
      ) {
        retained.push(item);
      }
      continue;
    }

    const fromIn =
      endpointIds.has(item.relationship.from);
    const toIn =
      endpointIds.has(item.relationship.to);

    /*
     * Bridge/connected answer context: only edges whose both endpoints
     * are among the requested path participants (A, B, and optional X).
     * Do not re-expand via incidental path provenance — that reintroduces
     * unrelated neighborhood edges (proposers, decisions, etc.).
     */
    if (fromIn && toIn) {
      retained.push(item);
    }
  }

  return attachEndpoints(retained, evidence);

}

function selectClaimEvidence(
  scope: AnswerEvidenceScope,
  evidence: Evidence[]
): Evidence[] {

  const claims =
    scope.requestedClaims.length > 0
      ? scope.requestedClaims
      : scope.requestedPredicates.map(predicate => ({
          subject: scope.focusSubjects[0] ?? "",
          predicate,
          object: "",
          inferenceMode: "typed_edge" as const
        }));

  if (claims.length === 0) {
    return selectFocusedRelationshipEvidence(scope, evidence);
  }

  const retained: Evidence[] = [];

  for (const claim of claims) {
    for (const item of evidence) {
      if (!item.relationship) {
        if (
          claim.subject &&
          entityMatchesPhrase(item.entity, claim.subject)
        ) {
          retained.push(item);
        }
        continue;
      }

      if (item.relationship.type !== claim.predicate) {
        continue;
      }

      if (
        claim.subject &&
        !relationshipOwnedBySubject(
          item,
          evidence,
          claim.subject
        )
      ) {
        continue;
      }

      if (
        claim.object &&
        !relationshipMatchesObject(
          item,
          evidence,
          claim.object
        )
      ) {
        continue;
      }

      retained.push(item);
    }
  }

  return attachEndpoints(retained, evidence);

}

function selectFocusedRelationshipEvidence(
  scope: AnswerEvidenceScope,
  evidence: Evidence[]
): Evidence[] {

  const predicates =
    scope.requestedPredicates.filter(type =>
      ONTOLOGY_PREDICATES.has(type)
    );

  const subjects =
    scope.focusSubjects;

  const objects =
    scope.focusObjects;

  const retained: Evidence[] = [];

  for (const item of evidence) {
    if (!item.relationship) {
      if (
        subjects.length === 0 ||
        subjects.some(subject =>
          entityMatchesPhrase(item.entity, subject)
        )
      ) {
        /*
         * Tier 3 identity rows for focus subjects.
         */
        retained.push(item);
      }
      continue;
    }

    if (
      predicates.length > 0 &&
      !predicates.includes(item.relationship.type)
    ) {
      continue;
    }

    if (
      subjects.length > 0 &&
      !relationshipOwnedBySubject(
        item,
        evidence,
        subjects
      )
    ) {
      /*
       * Foreign-subject spillover: another entity's valid edge is excluded.
       */
      continue;
    }

    if (
      objects.length > 0 &&
      !objects.some(object =>
        relationshipMatchesObject(item, evidence, object)
      )
    ) {
      /*
       * Foreign-object spillover: A→X does not answer A→Y.
       */
      continue;
    }

    retained.push(item);
  }

  return attachEndpoints(retained, evidence);

}

function relationshipOwnedBySubject(
  item: Evidence,
  evidence: Evidence[],
  subject: string | string[]
): boolean {

  const relationship =
    item.relationship;

  if (!relationship) {
    return false;
  }

  const subjects =
    Array.isArray(subject) ? subject : [subject];

  const from =
    findEntity(evidence, relationship.from) ??
    {
      id: relationship.from,
      label: relationship.from,
      source: "",
      properties: {}
    };

  /*
   * Subject must own the relationship as its source endpoint.
   * Shared objects (e.g. many proposals INTRODUCES Typing) must not
   * satisfy a claim about a different subject.
   */
  return subjects.some(phrase =>
    entityMatchesPhrase(from, phrase)
  );

}

function relationshipMatchesObject(
  item: Evidence,
  evidence: Evidence[],
  objectPhrase: string
): boolean {

  const relationship =
    item.relationship;

  if (!relationship) {
    return false;
  }

  const to =
    findEntity(evidence, relationship.to) ??
    {
      id: relationship.to,
      label: relationship.to,
      source: "",
      properties: {}
    };

  const from =
    findEntity(evidence, relationship.from) ??
    {
      id: relationship.from,
      label: relationship.from,
      source: "",
      properties: {}
    };

  return (
    entityMatchesPhrase(to, objectPhrase) ||
    entityMatchesPhrase(from, objectPhrase) ||
    entityMatchesPhrase(item.entity, objectPhrase)
  );

}

function attachEndpoints(
  retained: Evidence[],
  all: Evidence[]
): Evidence[] {

  const ids =
    new Set<string>();

  for (const item of retained) {
    ids.add(item.entity.id);

    if (item.relationship) {
      ids.add(item.relationship.from);
      ids.add(item.relationship.to);
    }

    if (item.path?.nodes) {
      for (const node of item.path.nodes) {
        ids.add(node.id);
      }
    }
  }

  const out =
    [...retained];

  for (const item of all) {
    if (!ids.has(item.entity.id)) {
      continue;
    }

    if (
      out.some(entry =>
        sameEvidenceKey(entry, item)
      )
    ) {
      continue;
    }

    /*
     * Attach identity/provenance rows for path endpoints without
     * re-introducing foreign relationships.
     */
    if (!item.relationship) {
      out.push(item);
      continue;
    }

    if (
      ids.has(item.relationship.from) &&
      ids.has(item.relationship.to) &&
      retained.some(entry =>
        entry.relationship &&
        entry.relationship.from === item.relationship!.from &&
        entry.relationship.to === item.relationship!.to &&
        entry.relationship.type === item.relationship!.type
      )
    ) {
      out.push(item);
    }
  }

  return out;

}

function resolvePhraseIds(
  evidence: Evidence[],
  phrases: string[]
): Set<string> {

  const ids =
    new Set<string>();

  for (const item of evidence) {
    if (
      phrases.some(phrase =>
        entityMatchesPhrase(item.entity, phrase)
      )
    ) {
      ids.add(item.entity.id);
    }
  }

  return ids;

}

function findEntity(
  evidence: Evidence[],
  id: string
): KnowledgeEntity | undefined {

  return evidence.find(item => item.entity.id === id)?.entity;

}

function sameEvidenceKey(
  left: Evidence,
  right: Evidence
): boolean {

  const leftRel =
    left.relationship;
  const rightRel =
    right.relationship;

  if (!leftRel && !rightRel) {
    return left.entity.id === right.entity.id;
  }

  if (!leftRel || !rightRel) {
    return false;
  }

  return (
    left.entity.id === right.entity.id &&
    leftRel.from === rightRel.from &&
    leftRel.to === rightRel.to &&
    leftRel.type === rightRel.type
  );

}

function dedupePreserveOrder(
  evidence: Evidence[]
): Evidence[] {

  const seen =
    new Set<string>();
  const out: Evidence[] = [];

  for (const item of evidence) {
    const key =
      item.relationship
        ? `${item.entity.id}|${item.relationship.from}|${item.relationship.type}|${item.relationship.to}`
        : `entity:${item.entity.id}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(item);
  }

  return out;

}

function extractIdentitySubjects(
  query: string
): string[] {

  const match =
    query.match(
      /^\s*what\s+(?:is|are)\s+(.+?)\s*\??\s*$/i
    );

  if (!match?.[1]) {
    return [];
  }

  const subject =
    match[1]
      .trim()
      .replace(/[?"'.]+$/g, "")
      .trim();

  if (
    !subject ||
    /^(?:the|a|an|this|that)\s*$/i.test(subject)
  ) {
    return [];
  }

  return [subject];

}

function isCleanObjectPhrase(
  value: string
): boolean {

  const trimmed =
    value.trim();

  if (!trimmed) {
    return false;
  }

  /*
   * Reject compound clause bleed into a single claim object.
   */
  if (
    /\band\b/i.test(trimmed) &&
    /\b(?:introduc|address|propos|result|implement)\w*/i.test(trimmed)
  ) {
    return false;
  }

  return true;

}

function uniquePhrases(
  values: Array<string | undefined>
): string[] {

  const seen =
    new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const trimmed =
      value?.trim();

    if (!trimmed) {
      continue;
    }

    const key =
      trimmed.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(trimmed);
  }

  return out;

}

/**
 * Whether an evidence relationship type is outside the answer scope.
 * Used by verification to detect foreign-predicate spillover in answers.
 */
export function isPredicateInAnswerScope(
  scope: AnswerEvidenceScope,
  predicate: string
): boolean {

  if (
    scope.mode === "passthrough" ||
    scope.mode === "fact"
  ) {
    return scope.mode !== "fact";
  }

  if (scope.mode === "comparison") {
    if (scope.requestedDimensions.includes("relationships")) {
      return ONTOLOGY_PREDICATES.has(predicate);
    }

    const allowed =
      relationshipTypesForDimensions(scope.requestedDimensions);

    return Boolean(allowed?.has(predicate));
  }

  if (scope.requestedPredicates.length === 0) {
    return true;
  }

  return scope.requestedPredicates.includes(predicate);

}

/**
 * Evidence associated with one atomic requested claim.
 */
export interface ClaimEvidence {
  claimId: string;
  subject: string;
  predicate: string;
  object: string;
  evidence: Evidence[];
}

/**
 * Structured answer context passed to generation/verification.
 * Already query-scoped — do not re-merge raw retrieval evidence.
 */
export interface StructuredAnswerContext {
  query: string;
  intent: QueryIntentKind;
  requestedClaims: LogicalClaim[];
  requestedSubjects: string[];
  requestedPredicates: string[];
  scope: AnswerEvidenceScope;
  answerEvidence: Evidence[];
  claimEvidence: ClaimEvidence[];
  provenance: Array<{
    entityId: string;
    source: string;
    relationshipType?: string;
  }>;
}

/**
 * Bind answer-scoped evidence to each requested atomic claim.
 */
export function bindClaimEvidence(
  scope: AnswerEvidenceScope,
  answerEvidence: Evidence[]
): ClaimEvidence[] {

  const claims =
    scope.requestedClaims.length > 0
      ? scope.requestedClaims
      : scope.requestedPredicates.map((predicate, index) => ({
          subject: scope.focusSubjects[0] ?? "",
          predicate,
          object: scope.focusObjects[0] ?? "",
          inferenceMode: "typed_edge" as const,
          claimId: `focus-${index}`
        }));

  return claims.map((claim, index) => {
    const subject =
      claim.subject || scope.focusSubjects[0] || "";
    const predicate =
      claim.predicate;
    const object =
      ("object" in claim ? claim.object : "") || "";

    const matched =
      answerEvidence.filter(item => {
        if (!item.relationship) {
          return (
            Boolean(subject) &&
            entityMatchesPhrase(item.entity, subject)
          );
        }

        if (item.relationship.type !== predicate) {
          return false;
        }

        if (
          subject &&
          !relationshipOwnedBySubject(item, answerEvidence, subject)
        ) {
          return false;
        }

        if (
          object &&
          isCleanObjectPhrase(object) &&
          !relationshipMatchesObject(item, answerEvidence, object)
        ) {
          return false;
        }

        return true;
      });

    return {
      claimId:
        `claim-${index}-${predicate}`,
      subject,
      predicate,
      object,
      evidence: matched
    };
  });

}

/**
 * Build the structured answer context from understanding + scoped evidence.
 */
export function buildStructuredAnswerContext(
  understanding: QueryUnderstanding,
  answerEvidence: Evidence[]
): StructuredAnswerContext {

  const scope =
    deriveAnswerEvidenceScope(understanding);

  const claimEvidence =
    bindClaimEvidence(scope, answerEvidence);

  return {
    query: understanding.originalQuery,
    intent: understanding.intent,
    requestedClaims: scope.requestedClaims,
    requestedSubjects: scope.focusSubjects,
    requestedPredicates: scope.requestedPredicates,
    scope,
    answerEvidence,
    claimEvidence,
    provenance: answerEvidence.map(item => ({
      entityId: item.entity.id,
      source: item.entity.source,
      ...(item.relationship
        ? { relationshipType: item.relationship.type }
        : {})
    }))
  };

}
