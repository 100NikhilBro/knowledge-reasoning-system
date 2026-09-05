import type {
  Evidence,
  KnowledgeEntity,
  KnowledgeRelationship,
  ProvenanceChannel,
  ReasoningResult
} from "../types/reasoning";
import { resolveProvenanceChannel } from "./provenance";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  source: string;
  confidence: number;
  provenance: ProvenanceChannel;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  confidence: number;
}

export interface GraphViewModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  hasRelationshipData: boolean;
}

export interface RelationshipPathHop {
  fromId: string;
  fromLabel: string;
  relationshipType: string;
  toId: string;
  toLabel: string;
}

export type RelationshipViewKind = "path" | "set";

export interface RelationshipViewModel {
  kind: RelationshipViewKind;
  hops: RelationshipPathHop[];
  hubId?: string;
  hubLabel?: string;
}

/**
 * Derive graph visualization data only from evidence already present
 * in the public ReasoningResult (trace steps). Never invent edges.
 */
export function deriveGraphFromResult(
  result: ReasoningResult | null
): GraphViewModel {
  if (!result) {
    return {
      nodes: [],
      edges: [],
      hasRelationshipData: false
    };
  }

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const step of result.trace.steps) {
    for (const item of step.evidence) {
      addEntity(nodes, item);
      if (item.relationship) {
        addRelationship(nodes, edges, item);
      }
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    hasRelationshipData: edges.size > 0
  };
}

export function collectGroundedEvidence(
  result: ReasoningResult | null
): Evidence[] {
  if (!result) {
    return [];
  }

  const byId = new Map<string, Evidence>();

  for (const step of result.trace.steps) {
    for (const item of step.evidence) {
      const existing = byId.get(item.entity.id);
      if (!existing || prefersEvidence(item, existing)) {
        byId.set(item.entity.id, item);
      }
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.entity.label.localeCompare(b.entity.label)
  );
}

/**
 * Build relationship visualization from real edges only.
 * Distinguishes a true multi-hop path from an independent relationship set
 * (e.g. hub-and-spoke from a shared source).
 */
export function deriveRelationshipView(
  result: ReasoningResult | null
): RelationshipViewModel {
  const graph = deriveGraphFromResult(result);

  if (!graph.hasRelationshipData) {
    return {
      kind: "set",
      hops: []
    };
  }

  const labelById = new Map(
    graph.nodes.map((node) => [node.id, node.label])
  );

  const hops: RelationshipPathHop[] = graph.edges.map((edge) => ({
    fromId: edge.from,
    fromLabel: labelById.get(edge.from) ?? edge.from,
    relationshipType: edge.type,
    toId: edge.to,
    toLabel: labelById.get(edge.to) ?? edge.to
  }));

  const chain = findTruePath(hops);

  if (chain) {
    return {
      kind: "path",
      hops: chain
    };
  }

  const hubId = findHubId(hops);
  const hubLabel =
    hubId
      ? labelById.get(hubId) ??
        hops.find((hop) => hop.fromId === hubId)?.fromLabel ??
        hops.find((hop) => hop.toId === hubId)?.toLabel ??
        hubId
      : undefined;

  return {
    kind: "set",
    hops: hubId
      ? [
          ...hops.filter((hop) => hop.fromId === hubId || hop.toId === hubId),
          ...hops.filter((hop) => hop.fromId !== hubId && hop.toId !== hubId)
        ]
      : hops,
    hubId,
    hubLabel
  };
}

/** @deprecated Prefer deriveRelationshipView for topology-aware UI. */
export function deriveRelationshipPath(
  result: ReasoningResult | null
): RelationshipPathHop[] {
  return deriveRelationshipView(result).hops;
}

function prefersEvidence(
  candidate: Evidence,
  existing: Evidence
): boolean {
  const candidateRel = candidate.relationship ? 1 : 0;
  const existingRel = existing.relationship ? 1 : 0;

  if (candidateRel !== existingRel) {
    return candidateRel > existingRel;
  }

  return candidate.score > existing.score;
}

function addEntity(
  nodes: Map<string, GraphNode>,
  item: Evidence
): void {
  const entity = item.entity;
  const provenance = resolveProvenanceChannel(item);
  const existing = nodes.get(entity.id);

  if (!existing) {
    nodes.set(entity.id, {
      id: entity.id,
      label: entity.label,
      type: entity.type,
      source: entity.source,
      confidence: entity.confidence,
      provenance
    });
    return;
  }

  if (
    existing.provenance !== "hybrid" &&
    provenance === "hybrid"
  ) {
    nodes.set(entity.id, {
      ...existing,
      provenance
    });
  }
}

function addRelationship(
  nodes: Map<string, GraphNode>,
  edges: Map<string, GraphEdge>,
  item: Evidence
): void {
  const relationship = item.relationship as KnowledgeRelationship;
  const edgeId = `${relationship.from}->${relationship.type}->${relationship.to}`;

  if (!edges.has(edgeId)) {
    edges.set(edgeId, {
      id: edgeId,
      from: relationship.from,
      to: relationship.to,
      type: relationship.type,
      confidence: relationship.confidence
    });
  }

  ensureEndpoint(nodes, relationship.from, item.entity);
  ensureEndpoint(nodes, relationship.to, item.entity);
}

function ensureEndpoint(
  nodes: Map<string, GraphNode>,
  id: string,
  fallback: KnowledgeEntity
): void {
  const existing = nodes.get(id);

  if (!existing) {
    nodes.set(id, {
      id,
      label: id === fallback.id ? fallback.label : humanizeEntityId(id),
      type: id === fallback.id ? fallback.type : inferTypeFromId(id),
      source: fallback.source,
      confidence: fallback.confidence,
      provenance: "unknown"
    });
    return;
  }

  if (
    existing.label === id &&
    id === fallback.id &&
    fallback.label &&
    fallback.label !== id
  ) {
    nodes.set(id, {
      ...existing,
      label: fallback.label,
      type: fallback.type
    });
  }
}

function humanizeEntityId(id: string): string {
  if (!id.includes(":")) {
    return id;
  }
  return id.slice(id.indexOf(":") + 1);
}

function inferTypeFromId(id: string): string {
  const prefix = id.split(":")[0];
  if (!prefix) {
    return "Entity";
  }
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

function findHubId(
  hops: RelationshipPathHop[]
): string | undefined {
  const degree = new Map<string, number>();

  for (const hop of hops) {
    degree.set(hop.fromId, (degree.get(hop.fromId) ?? 0) + 1);
    degree.set(hop.toId, (degree.get(hop.toId) ?? 0) + 1);
  }

  let hub: string | undefined;
  let best = 0;

  for (const [id, value] of degree) {
    if (value > best) {
      best = value;
      hub = id;
    }
  }

  return best >= 2 ? hub : undefined;
}

/**
 * True multi-hop path: consecutive hops share endpoints (A→B→C).
 * Independent spokes from one hub are NOT a path.
 */
function findTruePath(
  hops: RelationshipPathHop[]
): RelationshipPathHop[] | null {
  if (hops.length === 0) {
    return null;
  }

  if (hops.length === 1) {
    return hops;
  }

  const outgoing = new Map<string, RelationshipPathHop[]>();
  const inbound = new Set<string>();

  for (const hop of hops) {
    const list = outgoing.get(hop.fromId) ?? [];
    list.push(hop);
    outgoing.set(hop.fromId, list);
    inbound.add(hop.toId);
  }

  const starts = hops
    .map((hop) => hop.fromId)
    .filter((id) => !inbound.has(id));

  for (const start of starts.length > 0 ? starts : [hops[0]!.fromId]) {
    const ordered: RelationshipPathHop[] = [];
    const used = new Set<string>();
    let current: string | undefined = start;

    while (current) {
      const nextList: RelationshipPathHop[] =
        outgoing.get(current) ?? [];
      const next: RelationshipPathHop | undefined =
        nextList.find(
          (hop: RelationshipPathHop) =>
            !used.has(
              `${hop.fromId}|${hop.relationshipType}|${hop.toId}`
            )
        );

      if (!next) {
        break;
      }

      used.add(
        `${next.fromId}|${next.relationshipType}|${next.toId}`
      );
      ordered.push(next);
      current = next.toId;
    }

    if (
      ordered.length === hops.length &&
      ordered.length >= 2 &&
      isStrictChain(ordered)
    ) {
      return ordered;
    }
  }

  return null;
}

function isStrictChain(
  hops: RelationshipPathHop[]
): boolean {
  for (let index = 1; index < hops.length; index += 1) {
    if (hops[index - 1]!.toId !== hops[index]!.fromId) {
      return false;
    }
  }

  return true;
}
