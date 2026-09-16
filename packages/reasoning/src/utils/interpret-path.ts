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
  findValidatedEndpointPath,
  listPathEndpoints,
  reconstructSharedHubPath,
  validateEndpointPath,
  validateSharedHubBridge
} from "./validate-relationship-path.js";

import {
  understandQuery,
  type QueryIntentKind,
  type QueryUnderstanding
} from "./query-understanding.js";

export {
  validateEndpointPath,
  validateSharedHubBridge,
  reconstructSharedHubPath,
  findValidatedEndpointPath
} from "./validate-relationship-path.js";

/**
 * Deterministic semantic reading of a discovered graph topology
 * relative to the requested claim (P5). Never invents edges.
 */
export type PathInterpretationKind =
  | "DIRECT"
  | "CONNECTED"
  | "BRIDGE"
  | "MULTI_HOP"
  | "COMPARISON_EVIDENCE"
  | "FACT_IDENTITY"
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

  if (path.topology === "shared_hub") {
    const supports =
      !between ||
      validateSharedHubBridge(
        path,
        between.left,
        between.right,
        between.bridge
      );

    return {
      kind: supports ? "BRIDGE" : "INSUFFICIENT",
      sourceEntity: between?.left ?? sourceEntity,
      targetEntity: between?.right ?? targetEntity,
      bridgeEntities,
      relationships,
      hopCount: path.relationships.length,
      supportsClaim: supports,
      explanation:
        supports
          ? `Bridge path connects ${between?.left ?? sourceEntity} and ${between?.right ?? targetEntity} through ${bridgeEntities.join(", ") || "shared hub"}.`
          : "Shared-hub bridge topology is not established for the requested endpoints.",
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
    const sharedCandidate: GraphPath = {
      ...path,
      topology: "shared_hub",
      length: 2
    };

    const sharedOk =
      between
        ? validateSharedHubBridge(
            sharedCandidate,
            between.left,
            between.right,
            between.bridge
          )
        : validateSharedHubBridge(
            sharedCandidate,
            nodes[0]?.label ?? nodes[0]?.id ?? "",
            nodes[nodes.length - 1]?.label ?? nodes[nodes.length - 1]?.id ?? ""
          );

    if (sharedOk) {
      return {
        kind: "BRIDGE",
        sourceEntity: between?.left ?? sourceEntity,
        targetEntity: between?.right ?? targetEntity,
        bridgeEntities,
        relationships,
        hopCount: path.relationships.length,
        supportsClaim: true,
        explanation:
          `Bridge path connects ${between?.left ?? sourceEntity} and ${between?.right ?? targetEntity} through ${bridgeEntities.join(", ") || "shared hub"}.`,
        path: sharedCandidate
      };
    }

    const oriented =
      !between ||
      (
        nodes.length >= 3 &&
        (
          (
            entityMatchesPhrase(nodes[0], between.left) &&
            entityMatchesPhrase(nodes[nodes.length - 1], between.right)
          ) ||
          (
            entityMatchesPhrase(nodes[0], between.right) &&
            entityMatchesPhrase(nodes[nodes.length - 1], between.left)
          )
        ) &&
        path.relationships.every((edge, index) =>
          edge.from === nodes[index]?.id &&
          edge.to === nodes[index + 1]?.id
        )
      );

    return {
      kind: oriented ? "CONNECTED" : "INSUFFICIENT",
      sourceEntity,
      targetEntity,
      bridgeEntities,
      relationships,
      hopCount,
      supportsClaim:
        Boolean(oriented) &&
        (
          !between ||
          between.mode === "connected" ||
          intent === "CONNECTED_RELATIONSHIP" ||
          intent === "RELATIONSHIP"
        ),
      explanation:
        oriented
          ? `Connected via intermediate ${bridgeEntities.join(", ") || "entity"} using ${relationships.join(", ")}.`
          : "Path does not form a validated endpoint-to-endpoint chain.",
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

function insufficientBetween(
  between: RelationshipBetweenQuery,
  explanation: string
): PathInterpretation {

  return {
    kind: "INSUFFICIENT",
    sourceEntity: between.left,
    targetEntity: between.right,
    bridgeEntities: [],
    relationships: [],
    hopCount: 0,
    supportsClaim: false,
    explanation
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

  const typedEdge =
    resolved?.requireTypedEdge ??
    (() => {
      const claim =
        resolved?.claims?.find(item =>
          item.inferenceMode === "typed_edge" &&
          Boolean(item.subject?.trim()) &&
          Boolean(item.object?.trim())
        );

      if (!claim) {
        return undefined;
      }

      return {
        subject: claim.subject,
        predicate: claim.predicate,
        object: claim.object,
        direction: "outgoing" as const
      };
    })();

  /*
   * Comparison queries use per-subject relationship evidence — never a
   * fabricated multi-hop path over the pooled comparison edges.
   */
  if (intent === "COMPARISON") {
    const subjects =
      resolved?.comparison?.subjects ?? [];

    return {
      kind: "COMPARISON_EVIDENCE",
      sourceEntity: subjects[0],
      targetEntity: subjects[1],
      bridgeEntities: [],
      relationships: [],
      hopCount: 0,
      supportsClaim: false,
      explanation:
        subjects.length > 0
          ? `Comparison evidence for subjects [${subjects.join(", ")}] is not a graph path.`
          : "Comparison evidence is not a graph path."
    };
  }

  /*
   * FACT identity asks do not require a graph path / relationship topology.
   */
  if (intent === "FACT") {
    const subject =
      resolved?.entities[0];

    return {
      kind: "FACT_IDENTITY",
      sourceEntity: subject,
      bridgeEntities: [],
      relationships: [],
      hopCount: 0,
      supportsClaim: true,
      explanation:
        subject
          ? `FACT identity answer for ${subject} does not require a graph path.`
          : "FACT identity answer does not require a graph path."
    };
  }

  /*
   * Exact subject-predicate-object(+direction) relationship claims.
   */
  if (typedEdge && !between) {
    const match =
      relationships.find(item => {
        const endpoints =
          listEndpoints(context);

        const from =
          endpoints.find(entity => entity.id === item.from);

        const to =
          endpoints.find(entity => entity.id === item.to);

        if (!from || !to) {
          return false;
        }

        if (item.type !== typedEdge.predicate) {
          return false;
        }

        if (typedEdge.direction === "incoming") {
          return (
            entityMatchesPhrase(to, typedEdge.subject) &&
            entityMatchesPhrase(from, typedEdge.object)
          );
        }

        if (typedEdge.direction === "undirected") {
          return (
            (
              entityMatchesPhrase(from, typedEdge.subject) &&
              entityMatchesPhrase(to, typedEdge.object)
            ) ||
            (
              entityMatchesPhrase(from, typedEdge.object) &&
              entityMatchesPhrase(to, typedEdge.subject)
            )
          );
        }

        return (
          entityMatchesPhrase(from, typedEdge.subject) &&
          entityMatchesPhrase(to, typedEdge.object)
        );
      });

    if (!match) {
      return {
        kind: "INSUFFICIENT",
        sourceEntity: typedEdge.subject,
        targetEntity: typedEdge.object,
        bridgeEntities: [],
        relationships: [],
        hopCount: 0,
        supportsClaim: false,
        explanation:
          `No evidence establishes ${typedEdge.subject} → ${typedEdge.predicate} → ${typedEdge.object}.`
      };
    }

    const endpoints =
      listEndpoints(context);

    const from =
      endpoints.find(entity => entity.id === match.from);

    const to =
      endpoints.find(entity => entity.id === match.to);

    const path: GraphPath | undefined =
      from && to
        ? {
            nodes: [
              {
                id: from.id,
                type:
                  "type" in from &&
                  typeof (from as KnowledgeEntity).type === "string"
                    ? (from as KnowledgeEntity).type
                    : "Entity",
                label: from.label,
                source: from.source,
                confidence: 1,
                properties: from.properties ?? {}
              },
              {
                id: to.id,
                type:
                  "type" in to &&
                  typeof (to as KnowledgeEntity).type === "string"
                    ? (to as KnowledgeEntity).type
                    : "Entity",
                label: to.label,
                source: to.source,
                confidence: 1,
                properties: to.properties ?? {}
              }
            ],
            relationships: [match],
            length: 1,
            topology: "directed_chain"
          }
        : undefined;

    return {
      kind: "DIRECT",
      sourceEntity: typedEdge.subject,
      targetEntity: typedEdge.object,
      bridgeEntities: [],
      relationships: [match.type],
      hopCount: 1,
      supportsClaim: true,
      explanation:
        `Direct relationship ${match.type} establishes ${typedEdge.subject} → ${typedEdge.object}.`,
      ...(path ? { path } : {})
    };
  }

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
      relationships: [],
      hopCount: 0,
      supportsClaim: false,
      explanation:
        "Relational intent detected but endpoints could not be resolved from the query."
    };
  }

  const endpoints =
    listPathEndpoints(context);

  const direct =
    contextHasConnectingEdge(
      context,
      between.left,
      between.right
    );

  if (direct) {
    const directRels =
      relationships.filter(item => {
        const from =
          listEndpoints(context).find(entity => entity.id === item.from) ??
          { id: item.from, label: item.from, source: "", properties: {} };
        const to =
          listEndpoints(context).find(entity => entity.id === item.to) ??
          { id: item.to, label: item.to, source: "", properties: {} };

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
      });

    const edge =
      directRels[0];

    if (!edge) {
      return insufficientBetween(
        between,
        `No direct relationship between ${between.left} and ${between.right}.`
      );
    }

    const fromRef =
      resolveEntityFromContext(context, edge.from);

    const toRef =
      resolveEntityFromContext(context, edge.to);

    const path: GraphPath = {
      nodes: [fromRef, toRef],
      relationships: [edge],
      length: 1,
      topology: "directed_chain"
    };

    const oriented =
      validateEndpointPath(path, between.left, between.right, endpoints) ||
      validateEndpointPath(path, between.right, between.left, endpoints);

    if (!oriented) {
      return insufficientBetween(
        between,
        `No direct relationship between ${between.left} and ${between.right}.`
      );
    }

    return {
      kind: "DIRECT",
      sourceEntity: between.left,
      targetEntity: between.right,
      bridgeEntities: [],
      relationships: [edge.type],
      hopCount: 1,
      supportsClaim: true,
      explanation:
        `Direct relationship establishes ${between.left} ↔ ${between.right}.`,
      path
    };
  }

  const hasBridgeEvidence =
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
    return insufficientBetween(
      between,
      hasBridgeEvidence
        ? `Only an indirect connection exists; direct relationship not established.`
        : `No direct relationship between ${between.left} and ${between.right}.`
    );
  }

  /*
   * Prefer a validated directed endpoint-to-endpoint chain.
   */
  if (between.mode !== "bridge") {
    const forward =
      findValidatedEndpointPath(
        context,
        between.left,
        between.right
      );

    const reverse =
      forward
        ? undefined
        : findValidatedEndpointPath(
            context,
            between.right,
            between.left
          );

    const connectedPath =
      forward ?? reverse;

    const pathValid =
      connectedPath &&
      (
        validateEndpointPath(
          connectedPath,
          between.left,
          between.right,
          endpoints
        ) ||
        validateEndpointPath(
          connectedPath,
          between.right,
          between.left,
          endpoints
        )
      );

    if (connectedPath && pathValid) {
      const hopCount =
        connectedPath.relationships.length;

      return {
        kind:
          hopCount === 1
            ? "DIRECT"
            : hopCount === 2
              ? "CONNECTED"
              : "MULTI_HOP",
        sourceEntity: between.left,
        targetEntity: between.right,
        bridgeEntities:
          connectedPath.nodes
            .slice(1, -1)
            .map(node => node.label || node.id),
        relationships:
          connectedPath.relationships.map(item => item.type),
        hopCount,
        supportsClaim: true,
        path: connectedPath,
        explanation:
          hopCount === 1
            ? `Direct relationship establishes ${between.left} ↔ ${between.right}.`
            : `Endpoint-constrained path connects ${between.left} to ${between.right}.`
      };
    }
  }

  const bridgePath =
    reconstructSharedHubPath(
      context,
      between.left,
      between.right,
      between.bridge
    );

  if (
    bridgePath &&
    validateSharedHubBridge(
      bridgePath,
      between.left,
      between.right,
      between.bridge
    )
  ) {
    const hub =
      bridgePath.nodes[1];

    return {
      kind: "BRIDGE",
      sourceEntity: between.left,
      targetEntity: between.right,
      bridgeEntities: hub ? [hub.label || hub.id] : [],
      relationships: bridgePath.relationships.map(item => item.type),
      hopCount: bridgePath.length,
      supportsClaim: true,
      explanation:
        `Bridge path connects ${between.left} and ${between.right} through ${hub?.label || hub?.id || "shared hub"}.`,
      path: bridgePath
    };
  }

  return insufficientBetween(
    between,
    between.mode === "bridge"
      ? `Requested bridge through ${between.bridge ?? "named entity"} was not established.`
      : `No connecting path between ${between.left} and ${between.right} in evidence.`
  );

}

function resolveEntityFromContext(
  context: ReasoningContext,
  id: string
): KnowledgeEntity {

  const endpoints =
    listEndpoints(context);

  const ref =
    endpoints.find(entity => entity.id === id);

  return {
    id,
    type:
      ref &&
      "type" in ref &&
      typeof (ref as KnowledgeEntity).type === "string"
        ? (ref as KnowledgeEntity).type
        : "Entity",
    label: ref?.label ?? id,
    source: ref?.source ?? "",
    confidence: 1,
    properties: ref?.properties ?? {}
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
