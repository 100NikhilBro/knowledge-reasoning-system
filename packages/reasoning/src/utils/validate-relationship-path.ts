import type {
  GraphPath,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import type { ReasoningContext } from "../types/reasoning-context.js";

import {
  entityMatchesPhrase,
  type RelationshipBetweenQuery
} from "./detect-relationship-between-query.js";

export type EndpointRef = {
  id: string;
  label: string;
  source: string;
  properties?: Record<string, unknown>;
  type?: string;
  confidence?: number;
};

/**
 * Stable identity for an attested edge. Shared-hub spokes must not collapse
 * when they share the same hub entity id.
 */
export function relationshipEdgeKey(
  relationship: KnowledgeRelationship
): string {

  return (
    `${relationship.from}|${relationship.type}|${relationship.to}`
  );

}

export function listPathEndpoints(
  context: ReasoningContext
): EndpointRef[] {

  if (context.evidence.length > 0) {
    return context.evidence.map(item => item.entity);
  }

  return context.items.map(item => ({
    id: item.entityId,
    label: item.label,
    source: item.source,
    properties: item.properties,
    type: item.entityType
  }));

}

export function listAttestedRelationships(
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
      relationshipEdgeKey(relationship);

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
      relationshipEdgeKey(relationship);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    rows.push(relationship);
  }

  return rows;

}

/**
 * Resolve phrase-matched endpoint ids from entity rows and from attested
 * relationship endpoint ids (so spokes remain usable when a hub/PEP row
 * is missing from the entity list).
 */
export function resolveEndpointIds(
  context: ReasoningContext,
  phrase: string
): string[] {

  const endpoints =
    listPathEndpoints(context);

  const ids =
    new Set<string>();

  for (const entity of endpoints) {
    if (entityMatchesPhrase(entity, phrase)) {
      ids.add(entity.id);
    }
  }

  for (const relationship of listAttestedRelationships(context)) {
    for (const id of [relationship.from, relationship.to]) {
      if (
        entityMatchesPhrase(
          { id, label: id, source: "", properties: {} },
          phrase
        )
      ) {
        ids.add(id);
      }
    }
  }

  return [...ids];

}

function toEntity(
  ref: EndpointRef | undefined,
  id: string
): KnowledgeEntity {

  return {
    id,
    type:
      ref && typeof ref.type === "string"
        ? ref.type
        : "Entity",
    label: ref?.label ?? id,
    source: ref?.source ?? "",
    confidence:
      typeof ref?.confidence === "number"
        ? ref.confidence
        : 1,
    properties: ref?.properties ?? {}
  };

}

function resolveEntityRef(
  context: ReasoningContext,
  id: string
): EndpointRef | undefined {

  return listPathEndpoints(context).find(entity => entity.id === id);

}

/**
 * Strict directed endpoint-to-endpoint path validation.
 * Evidence relationship pools are not paths.
 */
export function validateEndpointPath(
  path: GraphPath | undefined,
  startPhrase: string,
  goalPhrase: string,
  endpoints: EndpointRef[]
): boolean {

  if (!path) {
    return false;
  }

  if (path.topology === "shared_hub") {
    return false;
  }

  const nodes =
    path.nodes;

  const relationships =
    path.relationships;

  if (
    nodes.length < 2 ||
    relationships.length < 1 ||
    relationships.length !== nodes.length - 1
  ) {
    return false;
  }

  if (path.length !== relationships.length) {
    return false;
  }

  const start =
    nodes[0];

  const goal =
    nodes[nodes.length - 1];

  if (!start || !goal) {
    return false;
  }

  if (
    !entityMatchesPhrase(start, startPhrase) ||
    !entityMatchesPhrase(goal, goalPhrase)
  ) {
    return false;
  }

  for (let index = 0; index < relationships.length; index++) {
    const edge =
      relationships[index];

    const fromNode =
      nodes[index];

    const toNode =
      nodes[index + 1];

    if (!edge || !fromNode || !toNode) {
      return false;
    }

    if (edge.from !== fromNode.id || edge.to !== toNode.id) {
      return false;
    }
  }

  /*
   * Endpoints list is advisory for presence; path topology itself must
   * already be internally consistent. Reject empty endpoint catalogs when
   * callers supply them as the grounded entity set for start/goal checks
   * beyond the path nodes (path nodes are authoritative).
   */
  void endpoints;

  return true;

}

type SharedHubShape =
  | {
      kind: "converging";
      hubId: string;
      leftEdge: KnowledgeRelationship;
      rightEdge: KnowledgeRelationship;
    }
  | {
      kind: "diverging";
      hubId: string;
      leftEdge: KnowledgeRelationship;
      rightEdge: KnowledgeRelationship;
    };

/**
 * Locate an attested shared-hub topology for A and B (optional required X).
 * Converging: A→X←B. Diverging: A←X→B. Directions are preserved as attested.
 */
export function findSharedHubShape(
  context: ReasoningContext,
  leftPhrase: string,
  rightPhrase: string,
  requiredBridge?: string
): SharedHubShape | undefined {

  const relationships =
    listAttestedRelationships(context);

  const leftIds =
    new Set(resolveEndpointIds(context, leftPhrase));

  const rightIds =
    new Set(resolveEndpointIds(context, rightPhrase));

  if (leftIds.size === 0 || rightIds.size === 0) {
    return undefined;
  }

  const byKey =
    new Map(
      relationships.map(item => [
        relationshipEdgeKey(item),
        item
      ])
    );

  const edges =
    [...byKey.values()];

  /*
   * Converging spokes: both terminate at the same hub.
   */
  const incomingByHub =
    new Map<string, KnowledgeRelationship[]>();

  for (const edge of edges) {
    const list =
      incomingByHub.get(edge.to) ?? [];
    list.push(edge);
    incomingByHub.set(edge.to, list);
  }

  for (const [hubId, incoming] of incomingByHub) {
    if (
      requiredBridge &&
      !hubMatchesPhrase(context, hubId, requiredBridge)
    ) {
      continue;
    }

    const leftEdge =
      incoming.find(edge => leftIds.has(edge.from));

    const rightEdge =
      incoming.find(edge =>
        rightIds.has(edge.from) &&
        relationshipEdgeKey(edge) !==
          (leftEdge ? relationshipEdgeKey(leftEdge) : "")
      );

    if (leftEdge && rightEdge) {
      return {
        kind: "converging",
        hubId,
        leftEdge,
        rightEdge
      };
    }
  }

  /*
   * Diverging spokes: both originate from the same hub.
   */
  const outgoingByHub =
    new Map<string, KnowledgeRelationship[]>();

  for (const edge of edges) {
    const list =
      outgoingByHub.get(edge.from) ?? [];
    list.push(edge);
    outgoingByHub.set(edge.from, list);
  }

  for (const [hubId, outgoing] of outgoingByHub) {
    if (
      requiredBridge &&
      !hubMatchesPhrase(context, hubId, requiredBridge)
    ) {
      continue;
    }

    const leftEdge =
      outgoing.find(edge => leftIds.has(edge.to));

    const rightEdge =
      outgoing.find(edge =>
        rightIds.has(edge.to) &&
        relationshipEdgeKey(edge) !==
          (leftEdge ? relationshipEdgeKey(leftEdge) : "")
      );

    if (leftEdge && rightEdge) {
      return {
        kind: "diverging",
        hubId,
        leftEdge,
        rightEdge
      };
    }
  }

  return undefined;

}

function hubMatchesPhrase(
  context: ReasoningContext,
  hubId: string,
  phrase: string
): boolean {

  const ref =
    resolveEntityRef(context, hubId);

  if (ref && entityMatchesPhrase(ref, phrase)) {
    return true;
  }

  return entityMatchesPhrase(
    { id: hubId, label: hubId, source: "", properties: {} },
    phrase
  );

}

/**
 * Build a shared_hub GraphPath from attested spokes. Never fabricates edges
 * or reverses direction.
 */
export function reconstructSharedHubPath(
  context: ReasoningContext,
  leftPhrase: string,
  rightPhrase: string,
  requiredBridge?: string
): GraphPath | undefined {

  const shape =
    findSharedHubShape(
      context,
      leftPhrase,
      rightPhrase,
      requiredBridge
    );

  if (!shape) {
    return undefined;
  }

  const leftId =
    shape.kind === "converging"
      ? shape.leftEdge.from
      : shape.leftEdge.to;

  const rightId =
    shape.kind === "converging"
      ? shape.rightEdge.from
      : shape.rightEdge.to;

  const left =
    toEntity(resolveEntityRef(context, leftId), leftId);

  const right =
    toEntity(resolveEntityRef(context, rightId), rightId);

  const hub =
    toEntity(resolveEntityRef(context, shape.hubId), shape.hubId);

  const path: GraphPath = {
    nodes: [left, hub, right],
    relationships: [shape.leftEdge, shape.rightEdge],
    length: 2,
    topology: "shared_hub"
  };

  if (
    !validateSharedHubBridge(
      path,
      leftPhrase,
      rightPhrase,
      requiredBridge
    )
  ) {
    return undefined;
  }

  return path;

}

/**
 * Authoritative shared-hub validation. Both spokes must be real, involve
 * the hub, and connect the requested endpoints without synthetic edges.
 */
export function validateSharedHubBridge(
  path: GraphPath | undefined,
  leftPhrase: string,
  rightPhrase: string,
  requiredBridge?: string
): boolean {

  if (!path) {
    return false;
  }

  if (path.topology !== "shared_hub") {
    return false;
  }

  if (
    path.nodes.length !== 3 ||
    path.relationships.length !== 2 ||
    path.length !== 2
  ) {
    return false;
  }

  const leftNode =
    path.nodes[0];

  const hub =
    path.nodes[1];

  const rightNode =
    path.nodes[2];

  const edgeLeft =
    path.relationships[0];

  const edgeRight =
    path.relationships[1];

  if (!leftNode || !hub || !rightNode || !edgeLeft || !edgeRight) {
    return false;
  }

  if (relationshipEdgeKey(edgeLeft) === relationshipEdgeKey(edgeRight)) {
    return false;
  }

  if (
    !entityMatchesPhrase(leftNode, leftPhrase) ||
    !entityMatchesPhrase(rightNode, rightPhrase)
  ) {
    return false;
  }

  if (
    requiredBridge &&
    !entityMatchesPhrase(hub, requiredBridge)
  ) {
    return false;
  }

  const leftConverging =
    edgeLeft.from === leftNode.id &&
    edgeLeft.to === hub.id;

  const rightConverging =
    edgeRight.from === rightNode.id &&
    edgeRight.to === hub.id;

  if (leftConverging && rightConverging) {
    return true;
  }

  const leftDiverging =
    edgeLeft.from === hub.id &&
    edgeLeft.to === leftNode.id;

  const rightDiverging =
    edgeRight.from === hub.id &&
    edgeRight.to === rightNode.id;

  if (leftDiverging && rightDiverging) {
    return true;
  }

  return false;

}

/**
 * True when a validated shared-hub bridge exists for the requested pair.
 */
export function contextHasValidatedSharedHub(
  context: ReasoningContext,
  left: string,
  right: string,
  requiredBridge?: string
): boolean {

  const path =
    reconstructSharedHubPath(
      context,
      left,
      right,
      requiredBridge
    );

  return validateSharedHubBridge(
    path,
    left,
    right,
    requiredBridge
  );

}

/**
 * Directed endpoint-constrained path finder with strict validation.
 */
export function findValidatedEndpointPath(
  context: ReasoningContext,
  startPhrase: string,
  goalPhrase: string
): GraphPath | undefined {

  const endpoints =
    listPathEndpoints(context);

  const relationships =
    listAttestedRelationships(context);

  const startIds =
    resolveEndpointIds(context, startPhrase);

  const goalIds =
    new Set(resolveEndpointIds(context, goalPhrase));

  if (startIds.length === 0 || goalIds.size === 0) {
    return undefined;
  }

  const outgoing =
    new Map<string, KnowledgeRelationship[]>();

  for (const relationship of relationships) {
    const list =
      outgoing.get(relationship.from) ?? [];
    list.push(relationship);
    outgoing.set(relationship.from, list);
  }

  for (const startId of startIds) {
    if (goalIds.has(startId)) {
      continue;
    }

    const queue: Array<{
      id: string;
      nodes: string[];
      edges: KnowledgeRelationship[];
    }> = [
      { id: startId, nodes: [startId], edges: [] }
    ];

    const visited =
      new Set<string>([startId]);

    while (queue.length > 0) {
      const current =
        queue.shift()!;

      for (const edge of outgoing.get(current.id) ?? []) {
        if (visited.has(edge.to)) {
          continue;
        }

        if (edge.from !== current.id) {
          continue;
        }

        const nextNodes =
          [...current.nodes, edge.to];

        const nextEdges =
          [...current.edges, edge];

        if (goalIds.has(edge.to)) {
          const nodes =
            nextNodes.map(id =>
              toEntity(resolveEntityRef(context, id), id)
            );

          const path: GraphPath = {
            nodes,
            relationships: nextEdges,
            length: nextEdges.length,
            topology: "directed_chain"
          };

          if (
            validateEndpointPath(
              path,
              startPhrase,
              goalPhrase,
              endpoints
            )
          ) {
            return path;
          }

          continue;
        }

        visited.add(edge.to);
        queue.push({
          id: edge.to,
          nodes: nextNodes,
          edges: nextEdges
        });
      }
    }
  }

  return undefined;

}

/**
 * Whether a between-query is supported by a validated direct edge, directed
 * chain, or shared-hub bridge — never by an unordered evidence pool.
 */
export function betweenTopologySupported(
  context: ReasoningContext,
  between: RelationshipBetweenQuery
): boolean {

  const relationships =
    listAttestedRelationships(context);

  const endpoints =
    listPathEndpoints(context);

  const directEdges =
    relationships.filter(item => {
      const from =
        resolveEntityRef(context, item.from) ??
        { id: item.from, label: item.from, source: "", properties: {} };

      const to =
        resolveEntityRef(context, item.to) ??
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

  if (between.mode === "direct") {
    return directEdges.length > 0;
  }

  if (directEdges.length > 0) {
    return true;
  }

  if (between.mode === "bridge") {
    return contextHasValidatedSharedHub(
      context,
      between.left,
      between.right,
      between.bridge
    );
  }

  const chain =
    findValidatedEndpointPath(
      context,
      between.left,
      between.right
    ) ??
    findValidatedEndpointPath(
      context,
      between.right,
      between.left
    );

  if (
    chain &&
    validateEndpointPath(
      chain,
      between.left,
      between.right,
      endpoints
    )
  ) {
    return true;
  }

  if (
    chain &&
    validateEndpointPath(
      chain,
      between.right,
      between.left,
      endpoints
    )
  ) {
    return true;
  }

  return contextHasValidatedSharedHub(
    context,
    between.left,
    between.right,
    between.bridge
  );

}
