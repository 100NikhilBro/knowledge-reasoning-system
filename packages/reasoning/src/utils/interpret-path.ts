import type {
  GraphPath,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import type { ReasoningContext } from "../types/reasoning-context.js";

import {
  detectRelationshipBetweenQuery,
  entityMatchesPhrase,
  type RelationshipBetweenQuery
} from "./detect-relationship-between-query.js";

import {
  contextHasConnectingEdge,
  contextHasSharedHubBridge
} from "./classify-relational-support.js";

import {
  understandQuery,
  type QueryIntentKind,
  type QueryUnderstanding
} from "./query-understanding.js";

/**
 * Deterministic semantic reading of a discovered graph topology
 * relative to the requested claim (P5). Never invents edges.
 */
export type PathInterpretationKind =
  | "DIRECT"
  | "CONNECTED"
  | "BRIDGE"
  | "MULTI_HOP"
  | "INSUFFICIENT";

export interface PathInterpretation {
  kind: PathInterpretationKind;
  sourceEntity?: string;
  targetEntity?: string;
  bridgeEntities: string[];
  relationships: string[];
  hopCount: number;
  /**
   * Whether this topology satisfies the *requested* claim/intent.
   * Indirect topology for a DIRECT ask → false (INSUFFICIENT).
   */
  supportsClaim: boolean;
  explanation: string;
  path?: GraphPath;
}

type EndpointRef = {
  id: string;
  label: string;
  source: string;
  properties?: Record<string, unknown>;
};

function resolveUnderstanding(
  query: string | undefined,
  context?: ReasoningContext,
  understanding?: QueryUnderstanding
): QueryUnderstanding | undefined {

  if (understanding) {
    return understanding;
  }

  if (context?.understanding) {
    return context.understanding;
  }

  if (query?.trim()) {
    return understandQuery(query);
  }

  return undefined;
}

function listEndpoints(
  context: ReasoningContext
): EndpointRef[] {

  if (context.evidence.length > 0) {
    return context.evidence.map(item => item.entity);
  }

  return context.items.map(item => ({
    id: item.entityId,
    label: item.label,
    source: item.source,
    properties: item.properties
  }));

}

function listRelationships(
  context: ReasoningContext
): KnowledgeRelationship[] {

  const seen =
    new Set<string>();

  const rows: KnowledgeRelationship[] = [];

  for (const item of context.evidence) {
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
    rows.push(relationship);
  }

  for (const item of context.items) {
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
    rows.push(relationship);
  }

  return rows;

}

function labelForId(
  endpoints: EndpointRef[],
  id: string
): string {

  return (
    endpoints.find(item => item.id === id)?.label ??
    id
  );

}

/**
 * Interpret an explicit GraphPath relative to optional endpoint/bridge constraints.
 */
export function interpretGraphPath(
  path: GraphPath,
  options?: {
    query?: string;
    between?: RelationshipBetweenQuery;
    intent?: QueryIntentKind;
  }
): PathInterpretation {

  const relationships =
    path.relationships.map(item => item.type);

  const hopCount =
    Math.max(
      path.length,
      path.relationships.length,
      Math.max(0, path.nodes.length - 1)
    );

  const nodes =
    path.nodes;

  const sourceEntity =
    nodes[0]?.label ?? nodes[0]?.id;

  const targetEntity =
    nodes.length > 0
      ? (nodes[nodes.length - 1]?.label ?? nodes[nodes.length - 1]?.id)
      : undefined;

  const bridgeEntities =
    nodes
      .slice(1, -1)
      .map(node => node.label || node.id);

  const between =
    options?.between ??
    (options?.query
      ? detectRelationshipBetweenQuery(options.query)
      : undefined);

  const intent =
    options?.intent;

  if (hopCount <= 0 || relationships.length === 0) {
    return {
      kind: "INSUFFICIENT",
      sourceEntity,
      targetEntity,
      bridgeEntities: [],
      relationships: [],
      hopCount: 0,
      supportsClaim: false,
      explanation:
        "No attested graph relationships on the path.",
      path
    };
  }

  if (hopCount === 1) {
    const supportsDirect =
      !between ||
      (
        nodes.length >= 2 &&
        (
          (
            entityMatchesPhrase(nodes[0], between.left) &&
            entityMatchesPhrase(nodes[nodes.length - 1], between.right)
          ) ||
          (
            entityMatchesPhrase(nodes[0], between.right) &&
            entityMatchesPhrase(nodes[nodes.length - 1], between.left)
          )
        )
      );

    return {
      kind: "DIRECT",
      sourceEntity,
      targetEntity,
      bridgeEntities: [],
      relationships,
      hopCount: 1,
      supportsClaim:
        supportsDirect &&
        (
          !between ||
          between.mode === "direct" ||
          between.mode === "connected" ||
          between.mode === "bridge"
        ),
      explanation:
        supportsDirect
          ? `Direct relationship ${relationships[0]} connects ${sourceEntity} and ${targetEntity}.`
          : `Direct edge present but endpoints do not match the requested pair.`,
      path
    };
  }

  const bridgeMatch =
    between?.mode === "bridge" &&
    between.bridge &&
    bridgeEntities.some(label =>
      entityMatchesPhrase(
        { id: label, label, source: "", properties: {} },
        between.bridge as string
      )
    );

  if (
    intent === "DIRECT_RELATIONSHIP" ||
    between?.mode === "direct"
  ) {
    return {
      kind: "INSUFFICIENT",
      sourceEntity,
      targetEntity,
      bridgeEntities,
      relationships,
      hopCount,
      supportsClaim: false,
      explanation:
        `Requested a direct relationship, but only an indirect ${hopCount}-hop path exists` +
        (bridgeEntities.length > 0
          ? ` via ${bridgeEntities.join(", ")}.`
          : "."),
      path
    };
  }

  if (
    between?.mode === "bridge" ||
    intent === "BRIDGE_RELATIONSHIP"
  ) {
    const supports =
      Boolean(bridgeMatch) ||
      (
        !between?.bridge &&
        bridgeEntities.length > 0
      );

    return {
      kind: supports ? "BRIDGE" : "INSUFFICIENT",
      sourceEntity,
      targetEntity,
      bridgeEntities,
      relationships,
      hopCount,
      supportsClaim: supports,
      explanation:
        supports
          ? `Bridge path connects ${sourceEntity} and ${targetEntity} through ${bridgeEntities.join(", ") || "intermediate entity"}.`
          : `Path does not establish the requested bridge` +
            (between?.bridge ? ` through ${between.bridge}.` : "."),
      path
    };
  }

  if (hopCount === 2) {
    return {
      kind: "CONNECTED",
      sourceEntity,
      targetEntity,
      bridgeEntities,
      relationships,
      hopCount,
      supportsClaim:
        !between ||
        between.mode === "connected" ||
        intent === "CONNECTED_RELATIONSHIP" ||
        intent === "RELATIONSHIP",
      explanation:
        `Connected via intermediate ${bridgeEntities.join(", ") || "entity"} using ${relationships.join(", ")}.`,
      path
    };
  }

  return {
    kind: "MULTI_HOP",
    sourceEntity,
    targetEntity,
    bridgeEntities,
    relationships,
    hopCount,
    supportsClaim:
      !between ||
      between.mode === "connected" ||
      intent === "CONNECTED_RELATIONSHIP" ||
      intent === "RELATIONSHIP",
    explanation:
      `Multi-hop path (${hopCount} hops) with relationships ${relationships.join(", ")}.`,
    path
  };

}

function findBridgeEntityIds(
  context: ReasoningContext,
  between: RelationshipBetweenQuery
): string[] {

  const endpoints =
    listEndpoints(context);

  const leftIds =
    new Set(
      endpoints
        .filter(entity => entityMatchesPhrase(entity, between.left))
        .map(entity => entity.id)
    );

  const rightIds =
    new Set(
      endpoints
        .filter(entity => entityMatchesPhrase(entity, between.right))
        .map(entity => entity.id)
    );

  const neighborsById =
    new Map<string, Set<string>>();

  for (const relationship of listRelationships(context)) {
    const left =
      neighborsById.get(relationship.from) ?? new Set<string>();
    left.add(relationship.to);
    neighborsById.set(relationship.from, left);

    const right =
      neighborsById.get(relationship.to) ?? new Set<string>();
    right.add(relationship.from);
    neighborsById.set(relationship.to, right);
  }

  const bridges: string[] = [];

  for (const leftId of leftIds) {
    for (const neighbor of neighborsById.get(leftId) ?? []) {
      if (leftIds.has(neighbor) || rightIds.has(neighbor)) {
        continue;
      }

      const neighborSet =
        neighborsById.get(neighbor) ?? new Set<string>();

      const touchesRight =
        [...rightIds].some(id => neighborSet.has(id));

      if (!touchesRight) {
        continue;
      }

      const bridgeEntity =
        endpoints.find(entity => entity.id === neighbor);

      if (
        between.bridge &&
        bridgeEntity &&
        !entityMatchesPhrase(bridgeEntity, between.bridge)
      ) {
        continue;
      }

      if (
        between.bridge &&
        !bridgeEntity &&
        !entityMatchesPhrase(
          { id: neighbor, label: neighbor, source: "", properties: {} },
          between.bridge
        )
      ) {
        continue;
      }

      bridges.push(neighbor);
    }
  }

  return [...new Set(bridges)];

}

function reconstructBridgePath(
  context: ReasoningContext,
  between: RelationshipBetweenQuery,
  bridgeId: string
): GraphPath | undefined {

  const endpoints =
    listEndpoints(context);

  const relationships =
    listRelationships(context);

  const left =
    endpoints.find(entity => entityMatchesPhrase(entity, between.left));

  const right =
    endpoints.find(entity => entityMatchesPhrase(entity, between.right));

  const bridge =
    endpoints.find(entity => entity.id === bridgeId);

  if (!left || !right || !bridge) {
    return undefined;
  }

  const edgeLeft =
    relationships.find(item =>
      (item.from === left.id && item.to === bridge.id) ||
      (item.to === left.id && item.from === bridge.id)
    );

  const edgeRight =
    relationships.find(item =>
      (item.from === right.id && item.to === bridge.id) ||
      (item.to === right.id && item.from === bridge.id)
    );

  if (!edgeLeft || !edgeRight) {
    return undefined;
  }

  const nodes: KnowledgeEntity[] = [
    {
      id: left.id,
      type: "type" in left && typeof (left as KnowledgeEntity).type === "string"
        ? (left as KnowledgeEntity).type
        : "Entity",
      label: left.label,
      source: left.source,
      confidence:
        "confidence" in left &&
        typeof (left as KnowledgeEntity).confidence === "number"
          ? (left as KnowledgeEntity).confidence
          : 1,
      properties: left.properties ?? {}
    },
    {
      id: bridge.id,
      type: "type" in bridge && typeof (bridge as KnowledgeEntity).type === "string"
        ? (bridge as KnowledgeEntity).type
        : "Entity",
      label: bridge.label,
      source: bridge.source,
      confidence:
        "confidence" in bridge &&
        typeof (bridge as KnowledgeEntity).confidence === "number"
          ? (bridge as KnowledgeEntity).confidence
          : 1,
      properties: bridge.properties ?? {}
    },
    {
      id: right.id,
      type: "type" in right && typeof (right as KnowledgeEntity).type === "string"
        ? (right as KnowledgeEntity).type
        : "Entity",
      label: right.label,
      source: right.source,
      confidence:
        "confidence" in right &&
        typeof (right as KnowledgeEntity).confidence === "number"
          ? (right as KnowledgeEntity).confidence
          : 1,
      properties: right.properties ?? {}
    }
  ];

  return {
    nodes,
    relationships: [edgeLeft, edgeRight],
    length: 2
  };

}

/**
 * Interpret grounded evidence topology for the user query (P5 entrypoint).
 */
export function interpretEvidencePaths(
  query: string | undefined,
  context: ReasoningContext,
  understanding?: QueryUnderstanding
): PathInterpretation {

  const resolved =
    resolveUnderstanding(query, context, understanding);

  const between =
    query
      ? detectRelationshipBetweenQuery(query)
      : undefined;

  const intent =
    resolved?.intent;

  const relationships =
    listRelationships(context);

  const relationshipTypes =
    relationships.map(item => item.type);

  if (
    !between &&
    intent !== "DIRECT_RELATIONSHIP" &&
    intent !== "CONNECTED_RELATIONSHIP" &&
    intent !== "BRIDGE_RELATIONSHIP"
  ) {
    if (relationships.length === 0) {
      return {
        kind: "INSUFFICIENT",
        bridgeEntities: [],
        relationships: [],
        hopCount: 0,
        supportsClaim: false,
        explanation:
          "No relational path request and no attested relationships in evidence."
      };
    }

    return {
      kind: relationships.length === 1 ? "DIRECT" : "MULTI_HOP",
      bridgeEntities: [],
      relationships: relationshipTypes,
      hopCount: relationships.length === 1 ? 1 : relationships.length,
      supportsClaim: true,
      explanation:
        relationships.length === 1
          ? `Attested relationship ${relationshipTypes[0]} present in evidence.`
          : `Attested relationship set: ${relationshipTypes.join(", ")}.`
    };
  }

  if (!between) {
    return {
      kind: "INSUFFICIENT",
      bridgeEntities: [],
      relationships: relationshipTypes,
      hopCount: 0,
      supportsClaim: false,
      explanation:
        "Relational intent detected but endpoints could not be resolved from the query."
    };
  }

  const direct =
    contextHasConnectingEdge(
      context,
      between.left,
      between.right
    );

  if (direct) {
    const interpretation =
      interpretGraphPath(
        {
          nodes: [],
          relationships: relationships.filter(item => {
            const endpoints =
              listEndpoints(context);
            const from =
              endpoints.find(entity => entity.id === item.from);
            const to =
              endpoints.find(entity => entity.id === item.to);
            if (!from || !to) {
              return false;
            }
            return (
              (
                entityMatchesPhrase(from, between.left) &&
                entityMatchesPhrase(to, between.right)
              ) ||
              (
                entityMatchesPhrase(from, between.right) &&
                entityMatchesPhrase(to, between.left)
              )
            );
          }),
          length: 1
        },
        { between, intent, query }
      );

    return {
      ...interpretation,
      kind: "DIRECT",
      sourceEntity: between.left,
      targetEntity: between.right,
      hopCount: 1,
      supportsClaim: true,
      explanation:
        `Direct relationship establishes ${between.left} ↔ ${between.right}.`
    };
  }

  const bridgeIds =
    findBridgeEntityIds(context, between);

  const endpoints =
    listEndpoints(context);

  const bridgeLabels =
    bridgeIds.map(id => labelForId(endpoints, id));

  const hasBridge =
    between.mode === "bridge"
      ? contextHasSharedHubBridge(
          context,
          between.left,
          between.right,
          between.bridge
        )
      : contextHasSharedHubBridge(
          context,
          between.left,
          between.right
        );

  if (
    between.mode === "direct" ||
    intent === "DIRECT_RELATIONSHIP"
  ) {
    return {
      kind: "INSUFFICIENT",
      sourceEntity: between.left,
      targetEntity: between.right,
      bridgeEntities: bridgeLabels,
      relationships: relationshipTypes,
      hopCount: hasBridge ? 2 : 0,
      supportsClaim: false,
      explanation:
        hasBridge
          ? `Only an indirect connection exists via ${bridgeLabels.join(", ") || "an intermediate"}; direct relationship not established.`
          : `No direct relationship between ${between.left} and ${between.right}.`,
      ...(bridgeIds[0]
        ? {
            path:
              reconstructBridgePath(context, between, bridgeIds[0])
          }
        : {})
    };
  }

  if (hasBridge && bridgeIds.length > 0) {
    const path =
      reconstructBridgePath(context, between, bridgeIds[0]);

    const kind: PathInterpretationKind =
      between.mode === "bridge" || intent === "BRIDGE_RELATIONSHIP"
        ? "BRIDGE"
        : path && path.length > 2
          ? "MULTI_HOP"
          : "CONNECTED";

    return {
      kind,
      sourceEntity: between.left,
      targetEntity: between.right,
      bridgeEntities: bridgeLabels,
      relationships: path?.relationships.map(item => item.type) ?? relationshipTypes,
      hopCount: path?.length ?? 2,
      supportsClaim: true,
      explanation:
        kind === "BRIDGE"
          ? `Bridge path connects ${between.left} and ${between.right} through ${bridgeLabels.join(", ")}.`
          : `Connected path links ${between.left} and ${between.right} via ${bridgeLabels.join(", ")}.`,
      path
    };
  }

  return {
    kind: "INSUFFICIENT",
    sourceEntity: between.left,
    targetEntity: between.right,
    bridgeEntities: between.bridge ? [between.bridge] : [],
    relationships: relationshipTypes,
    hopCount: 0,
    supportsClaim: false,
    explanation:
      between.mode === "bridge"
        ? `Requested bridge through ${between.bridge ?? "named entity"} was not established.`
        : `No connecting path between ${between.left} and ${between.right} in evidence.`
  };

}

/**
 * Deterministic trace line for path interpretation.
 */
export function formatPathInterpretationTraceStep(
  interpretation: PathInterpretation
): string {

  const claim =
    interpretation.supportsClaim
      ? "supports claim"
      : "does not support claim";

  const bridge =
    interpretation.bridgeEntities.length > 0
      ? `; bridge=${interpretation.bridgeEntities.join(",")}`
      : "";

  return (
    `Path interpretation: ${interpretation.kind}` +
    ` (hops=${interpretation.hopCount}${bridge}; ${claim}) — ` +
    interpretation.explanation
  );

}

/**
 * Compact serializable summary for ReasoningTrace.meta.
 */
export function toPathInterpretationSummary(
  interpretation: PathInterpretation
): {
  kind: PathInterpretationKind;
  sourceEntity?: string;
  targetEntity?: string;
  bridgeEntities: string[];
  relationships: string[];
  hopCount: number;
  supportsClaim: boolean;
  explanation: string;
} {

  return {
    kind: interpretation.kind,
    ...(interpretation.sourceEntity
      ? { sourceEntity: interpretation.sourceEntity }
      : {}),
    ...(interpretation.targetEntity
      ? { targetEntity: interpretation.targetEntity }
      : {}),
    bridgeEntities: interpretation.bridgeEntities,
    relationships: interpretation.relationships,
    hopCount: interpretation.hopCount,
    supportsClaim: interpretation.supportsClaim,
    explanation: interpretation.explanation
  };

}
