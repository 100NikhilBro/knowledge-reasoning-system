import type { ReasoningContext } from "../types/reasoning-context.js";

import {
  detectFocusRelationships,
  queryRequiresRelationalEvidence
} from "./detect-focus-relationships.js";

import {
  detectRelationshipBetweenQuery,
  entityMatchesPhrase
} from "./detect-relationship-between-query.js";

export type RelationalSupportKind =
  | "not_relational"
  | "full"
  | "partial"
  | "relationship_missing";

export interface RelationalSupport {
  kind: RelationalSupportKind;
  /**
   * Requested relationship types that are present in grounded evidence.
   */
  established: string[];
  /**
   * Requested relationship types that are absent from grounded evidence.
   */
  missing: string[];
}

function presentRelationshipTypes(
  context: ReasoningContext
): Set<string> {

  const types =
    new Set<string>();

  for (const item of context.items) {
    if (item.relationship?.type) {
      types.add(item.relationship.type);
    }
  }

  for (const item of context.evidence) {
    if (item.relationship?.type) {
      types.add(item.relationship.type);
    }
  }

  return types;

}

function contextHasConnectingEdge(
  context: ReasoningContext,
  left: string,
  right: string
): boolean {

  for (const item of [
    ...context.items.map(entry => ({
      entity: {
        id: entry.entityId,
        label: entry.label,
        source: entry.source,
        properties: entry.properties
      },
      relationship: entry.relationship
    })),
    ...context.evidence
  ]) {

    const relationship =
      item.relationship;

    if (!relationship) {
      continue;
    }

    const endpoints =
      context.evidence.length > 0
        ? context.evidence.map(entry => entry.entity)
        : context.items.map(entry => ({
            id: entry.entityId,
            label: entry.label,
            source: entry.source,
            properties: entry.properties
          }));

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

/**
 * Queries that ask for a concrete relation verb outside the grounded
 * ontology (e.g. contradict). Existing edges of other types must not
 * silently count as establishing that request.
 */
export function detectUnmappedRelationRequest(
  query: string
): boolean {

  const normalized =
    query.toLowerCase();

  return (
    /\bcontradict(?:s|ed|ing)?\b/.test(normalized) ||
    /\brefute[sd]?\b/.test(normalized) ||
    /\boppos(?:e|es|ed|ing)\b/.test(normalized)
  );

}

/**
 * Classify how completely grounded evidence satisfies a relational query.
 * Does not invent relationships — only inspects attested evidence.
 */
export function classifyRelationalSupport(
  query: string | undefined,
  context: ReasoningContext
): RelationalSupport {

  if (
    !query ||
    !queryRequiresRelationalEvidence(query)
  ) {
    return {
      kind: "not_relational",
      established: [],
      missing: []
    };
  }

  if (context.evidence.length === 0) {
    return {
      kind: "relationship_missing",
      established: [],
      missing: detectFocusRelationships(query) ?? []
    };
  }

  /*
   * Unmapped relation verbs (contradict / refute / oppose): keep entities,
   * never treat INTRODUCES/ADDRESSES/etc. as satisfying the ask.
   */
  if (detectUnmappedRelationRequest(query)) {
    return {
      kind: "relationship_missing",
      established: [],
      missing: ["CONNECTED"]
    };
  }

  const between =
    detectRelationshipBetweenQuery(query);

  if (between) {
    if (
      contextHasConnectingEdge(
        context,
        between.left,
        between.right
      )
    ) {
      return {
        kind: "full",
        established: ["CONNECTED"],
        missing: []
      };
    }

    return {
      kind: "relationship_missing",
      established: [],
      missing: ["CONNECTED"]
    };
  }

  const focuses =
    detectFocusRelationships(query);

  const present =
    presentRelationshipTypes(context);

  if (focuses && focuses.length > 0) {
    const established =
      focuses.filter(type => present.has(type));

    const missing =
      focuses.filter(type => !present.has(type));

    if (
      established.length > 0 &&
      missing.length === 0
    ) {
      return {
        kind: "full",
        established,
        missing
      };
    }

    if (
      established.length > 0 &&
      missing.length > 0
    ) {
      return {
        kind: "partial",
        established,
        missing
      };
    }

    return {
      kind: "relationship_missing",
      established,
      missing
    };
  }

  /*
   * Generic HOW/WHY without typed focuses: any attested relationship
   * is full support; entities alone are relationship-missing.
   */
  if (present.size > 0) {
    return {
      kind: "full",
      established: [...present],
      missing: []
    };
  }

  return {
    kind: "relationship_missing",
    established: [],
    missing: []
  };

}
