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

import {
  detectMultiHopPathQuery
} from "./detect-focus-relationships.js";

/**
 * Structured answer-relevant evidence scope derived from query semantics.
 * Retrieval candidates may be broader; answer context must respect this scope.
 */
export interface AnswerEvidenceScope {
  intent: QueryIntentKind;
  originalQuery: string;
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
    originalQuery: understanding.originalQuery,
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
    default: {
      const typed =
        understanding.requireTypedEdge;

      /*
       * Exact S-P-O narrowing only for clean typed-edge asks
       * ("Does A introduce X?"). Compound RELATIONSHIP parses that bleed
       * "and …" into the object must keep multi-predicate claim scope.
       */
      const exactTyped =
        Boolean(
          typed &&
          typeof typed.object === "string" &&
          isCleanObjectPhrase(typed.object) &&
          (
            scope.requestedPredicates.length <= 1 ||
            scope.requestedPredicates.every(
              predicate => predicate === typed.predicate
            )
          )
        );

      selected =
        selectFocusedRelationshipEvidence(
          exactTyped && typed
            ? {
                ...scope,
                focusSubjects: [typed.subject],
                focusObjects: [typed.object],
                requestedPredicates: [typed.predicate]
              }
            : scope,
          evidence
        );
      break;
    }
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

  const bridgePhrase =
    between?.bridge ??
    scope.bridgeEntity;

  const leftPhrase =
    between?.left;

  const rightPhrase =
    between?.right;

  const openExploration =
    isOpenExplorationScope(
      leftPhrase,
      rightPhrase,
      bridgePhrase,
      scope.focusSubjects,
      scope.originalQuery
    );

  /*
   * Open multi-hop / related-entity exploration: subject neighborhood only.
   * Recover subjects from query text when understanding left entities empty
   * (e.g. non-PEP labels in "X and its related entities …").
   */
  if (openExploration) {
    const subjects =
      scope.focusSubjects.length > 0
        ? scope.focusSubjects
        : recoverSubjectPhrasesFromQuery(
            scope.originalQuery,
            evidence
          );

    return selectFocusedRelationshipEvidence(
      {
        ...scope,
        focusSubjects: subjects,
        requestedPredicates: [],
        focusObjects: []
      },
      evidence
    );
  }

  if (!leftPhrase || !rightPhrase) {
    return selectFocusedRelationshipEvidence(scope, evidence);
  }

  const leftIds =
    resolvePhraseIds(evidence, [leftPhrase]);
  const rightIds =
    resolvePhraseIds(evidence, [rightPhrase]);
  const bridgeIds =
    bridgePhrase
      ? resolvePhraseIds(evidence, [bridgePhrase])
      : new Set<string>();

  /*
   * Explicit bridge through X: only A—X and B—X spokes.
   */
  if (bridgePhrase && bridgeIds.size > 0) {
    const spokes =
      evidence.filter(item => {
        if (!item.relationship) {
          return (
            leftIds.has(item.entity.id) ||
            rightIds.has(item.entity.id) ||
            bridgeIds.has(item.entity.id)
          );
        }

        return isBridgeSpoke(
          item.relationship,
          leftIds,
          rightIds,
          bridgeIds
        );
      });

    return attachEndpoints(spokes, evidence);
  }

  /*
   * Closed connected/direct between A and B:
   * 1) prefer exact edges with both endpoints in {A,B}
   * 2) otherwise keep only shared-hub spokes A—H / B—H
   */
  const direct =
    evidence.filter(item => {
      if (!item.relationship) {
        return (
          leftIds.has(item.entity.id) ||
          rightIds.has(item.entity.id)
        );
      }

      return isDirectBetween(
        item.relationship,
        leftIds,
        rightIds
      );
    });

  if (direct.some(item => item.relationship)) {
    return attachEndpoints(direct, evidence);
  }

  const hubIds =
    findSharedHubIds(evidence, leftIds, rightIds);

  if (hubIds.size === 0) {
    return attachEndpoints(
      evidence.filter(item =>
        !item.relationship &&
        (
          leftIds.has(item.entity.id) ||
          rightIds.has(item.entity.id)
        )
      ),
      evidence
    );
  }

  const spokes =
    evidence.filter(item => {
      if (!item.relationship) {
        return (
          leftIds.has(item.entity.id) ||
          rightIds.has(item.entity.id) ||
          hubIds.has(item.entity.id)
        );
      }

      return isBridgeSpoke(
        item.relationship,
        leftIds,
        rightIds,
        hubIds
      );
    });

  return attachEndpoints(spokes, evidence);

}

function isOpenExplorationScope(
  leftPhrase: string | undefined,
  rightPhrase: string | undefined,
  bridgePhrase: string | undefined,
  focusSubjects: string[],
  originalQuery = ""
): boolean {

  if (leftPhrase && rightPhrase) {
    return false;
  }

  if (bridgePhrase) {
    return false;
  }

  if (focusSubjects.length >= 2) {
    return false;
  }

  /*
   * Broader neighborhood only for explicit exploration / multi-hop discovery.
   */
  return detectMultiHopPathQuery(originalQuery);

}

/**
 * Recover focus subject phrases mentioned in the query from evidence labels.
 * Prefer the earliest mention; skip generic stop tokens.
 */
function recoverSubjectPhrasesFromQuery(
  query: string,
  evidence: Evidence[]
): string[] {

  const lower =
    query.toLowerCase();

  const candidates: Array<{ phrase: string; index: number }> = [];
  const seen =
    new Set<string>();

  for (const item of evidence) {
    const phrases =
      uniquePhrases([
        item.entity.label,
        typeof item.entity.properties?.pep === "string"
          ? `PEP-${item.entity.properties.pep}`
          : undefined,
        item.entity.id.includes(":")
          ? item.entity.id.split(":").slice(1).join(":")
          : item.entity.id
      ]);

    for (const phrase of phrases) {
      const key =
        phrase.toLowerCase();

      if (
        seen.has(key) ||
        key.length < 2 ||
        /^(?:feature|proposal|author|concern|decision|entity|typing)$/i
          .test(phrase)
      ) {
        continue;
      }

      const index =
        lower.indexOf(key);

      if (index < 0) {
        continue;
      }

      seen.add(key);
      candidates.push({ phrase, index });
    }
  }

  candidates.sort((a, b) => a.index - b.index);

  /*
   * Open exploration is subject-neighborhood: keep the primary (earliest) subject.
   */
  return candidates.length > 0
    ? [candidates[0].phrase]
    : [];

}

function isDirectBetween(
  relationship: { from: string; to: string },
  leftIds: Set<string>,
  rightIds: Set<string>
): boolean {

  return (
    (
      leftIds.has(relationship.from) &&
      rightIds.has(relationship.to)
    ) ||
    (
      rightIds.has(relationship.from) &&
      leftIds.has(relationship.to)
    )
  );

}

function isBridgeSpoke(
  relationship: { from: string; to: string },
  leftIds: Set<string>,
  rightIds: Set<string>,
  hubIds: Set<string>
): boolean {

  const fromHub =
    hubIds.has(relationship.from);
  const toHub =
    hubIds.has(relationship.to);
  const fromLeft =
    leftIds.has(relationship.from);
  const toLeft =
    leftIds.has(relationship.to);
  const fromRight =
    rightIds.has(relationship.from);
  const toRight =
    rightIds.has(relationship.to);

  const leftSpoke =
    (fromLeft && toHub) ||
    (fromHub && toLeft);

  const rightSpoke =
    (fromRight && toHub) ||
    (fromHub && toRight);

  return leftSpoke || rightSpoke;

}

function findSharedHubIds(
  evidence: Evidence[],
  leftIds: Set<string>,
  rightIds: Set<string>
): Set<string> {

  const leftNeighbors =
    new Set<string>();
  const rightNeighbors =
    new Set<string>();

  for (const item of evidence) {
    if (!item.relationship) {
      continue;
    }

    const { from, to } =
      item.relationship;

    if (leftIds.has(from)) {
      leftNeighbors.add(to);
    }

    if (leftIds.has(to)) {
      leftNeighbors.add(from);
    }

    if (rightIds.has(from)) {
      rightNeighbors.add(to);
    }

    if (rightIds.has(to)) {
      rightNeighbors.add(from);
    }
  }

  const hubs =
    new Set<string>();

  for (const id of leftNeighbors) {
    if (rightNeighbors.has(id)) {
      hubs.add(id);
    }
  }

  return hubs;

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

    if (!item.relationship) {
      continue;
    }

    const from =
      findEntity(evidence, item.relationship.from) ??
      {
        id: item.relationship.from,
        label: item.relationship.from,
        source: "",
        properties: {}
      };

    const to =
      findEntity(evidence, item.relationship.to) ??
      {
        id: item.relationship.to,
        label: item.relationship.to,
        source: "",
        properties: {}
      };

    if (
      phrases.some(phrase =>
        entityMatchesPhrase(from, phrase)
      )
    ) {
      ids.add(item.relationship.from);
    }

    if (
      phrases.some(phrase =>
        entityMatchesPhrase(to, phrase)
      )
    ) {
      ids.add(item.relationship.to);
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
 *
 * When the scope has no explicit claims/predicates (connected/bridge path
 * modes), derive one claim binding per unique relationship already retained
 * in answerEvidence so attribution validates against bound edges only.
 */
export function bindClaimEvidence(
  scope: AnswerEvidenceScope,
  answerEvidence: Evidence[]
): ClaimEvidence[] {

  const explicitClaims =
    scope.requestedClaims.length > 0
      ? scope.requestedClaims
      : scope.requestedPredicates.map((predicate, index) => ({
          subject: scope.focusSubjects[0] ?? "",
          predicate,
          object: scope.focusObjects[0] ?? "",
          inferenceMode: "typed_edge" as const,
          claimId: `focus-${index}`
        }));

  const claims =
    explicitClaims.length > 0
      ? explicitClaims
      : deriveClaimsFromAnswerRelationships(scope, answerEvidence);

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
      evidence:
        withClaimEndpointIdentities(matched, answerEvidence)
    };
  });

}

/**
 * Derive claim bindings from already-scoped relationship rows when the
 * query did not emit explicit LogicalClaim entries (typical connected /
 * bridge path asks).
 */
function deriveClaimsFromAnswerRelationships(
  scope: AnswerEvidenceScope,
  answerEvidence: Evidence[]
): Array<{
  subject: string;
  predicate: string;
  object: string;
  inferenceMode: "typed_edge";
}> {

  const seen =
    new Set<string>();

  const derived: Array<{
    subject: string;
    predicate: string;
    object: string;
    inferenceMode: "typed_edge";
  }> = [];

  for (const item of answerEvidence) {
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

    derived.push({
      subject:
        resolveEndpointPhrase(
          relationship.from,
          scope,
          answerEvidence,
          "subject"
        ),
      predicate: relationship.type,
      object:
        resolveEndpointPhrase(
          relationship.to,
          scope,
          answerEvidence,
          "object"
        ),
      inferenceMode: "typed_edge"
    });
  }

  return derived;

}

function resolveEndpointPhrase(
  endpointId: string,
  scope: AnswerEvidenceScope,
  answerEvidence: Evidence[],
  role: "subject" | "object"
): string {

  const endpoint =
    findEntity(answerEvidence, endpointId) ??
    {
      id: endpointId,
      label: endpointId.includes(":")
        ? endpointId.slice(endpointId.indexOf(":") + 1)
        : endpointId,
      source: "",
      properties: {}
    };

  const candidates =
    role === "subject"
      ? [
          ...scope.focusSubjects,
          scope.relationshipBetween?.left,
          scope.relationshipBetween?.right
        ]
      : [
          ...scope.focusObjects,
          scope.relationshipBetween?.right,
          scope.relationshipBetween?.left,
          scope.bridgeEntity
        ];

  for (const phrase of candidates) {
    if (
      phrase &&
      entityMatchesPhrase(endpoint, phrase)
    ) {
      return phrase;
    }
  }

  return endpoint.label || endpointId;

}

/**
 * Ensure each bound claim retains identity rows for relationship endpoints
 * (id / label / properties) so alias resolution can use existing metadata.
 */
function withClaimEndpointIdentities(
  matched: Evidence[],
  answerEvidence: Evidence[]
): Evidence[] {

  const out =
    [...matched];

  const hasIdentity =
    (id: string) =>
      out.some(item =>
        item.entity.id === id && !item.relationship
      );

  for (const item of matched) {
    if (!item.relationship) {
      continue;
    }

    for (const endpointId of [
      item.relationship.from,
      item.relationship.to
    ]) {
      if (hasIdentity(endpointId)) {
        continue;
      }

      const identity =
        answerEvidence.find(entry =>
          entry.entity.id === endpointId &&
          !entry.relationship
        ) ??
        answerEvidence.find(entry =>
          entry.entity.id === endpointId
        );

      if (identity) {
        out.push({
          entity: identity.entity,
          score: identity.score,
          source: identity.source,
          ...(identity.metadata
            ? { metadata: identity.metadata }
            : {})
        });
      }
    }
  }

  return out;

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
