import type { ReasoningContext } from "../types/reasoning-context.js";

import {
  detectFocusRelationships,
  queryRequiresRelationalEvidence
} from "./detect-focus-relationships.js";

import {
  detectRelationshipBetweenQuery,
  entityMatchesPhrase,
  type RelationshipBetweenQuery
} from "./detect-relationship-between-query.js";

export type RelationalSupportKind =
  | "not_relational"
  | "full"
  | "partial"
  | "relationship_missing";

export interface RelationalSupport {
  /**
   * Requested relationship types that are present in grounded evidence.
   */
  kind: RelationalSupportKind;
  established: string[];
  missing: string[];
}

type EndpointEntity = {
  id: string;
  label: string;
  source: string;
  properties?: Record<string, unknown>;
};

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

function listEndpoints(
  context: ReasoningContext
): EndpointEntity[] {

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

function listRelationships(
  context: ReasoningContext
): Array<{
  from: string;
  to: string;
  type: string;
}> {

  const seen =
    new Set<string>();

  const rows: Array<{
    from: string;
    to: string;
    type: string;
  }> = [];

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

/**
 * Exact endpoint-to-endpoint edge (either direction).
 */
export function contextHasConnectingEdge(
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

/**
 * Shared-hub / two-edge bridge: left and right both attach to the same
 * intermediate entity (e.g. Typing ← INTRODUCES ← PEP-484 → ADDRESSES → Readability).
 * Does not invent edges — only inspects attested relationships.
 */
export function contextHasSharedHubBridge(
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

function betweenIsSupported(
  context: ReasoningContext,
  between: RelationshipBetweenQuery
): boolean {

  const direct =
    contextHasConnectingEdge(
      context,
      between.left,
      between.right
    );

  if (between.mode === "direct") {
    return direct;
  }

  if (direct) {
    return true;
  }

  if (between.mode === "bridge") {
    return contextHasSharedHubBridge(
      context,
      between.left,
      between.right,
      between.bridge
    );
  }

  return contextHasSharedHubBridge(
    context,
    between.left,
    between.right
  );

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
    if (betweenIsSupported(context, between)) {
      return {
        kind: "full",
        established: [
          between.mode === "direct"
            ? "DIRECT"
            : between.mode === "bridge"
              ? "BRIDGE"
              : "CONNECTED"
        ],
        missing: []
      };
    }

    return {
      kind: "relationship_missing",
      established: [],
      missing: [
        between.mode === "direct"
          ? "DIRECT"
          : "CONNECTED"
      ]
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
