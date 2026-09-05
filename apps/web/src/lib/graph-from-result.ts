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
 * Build ordered relationship hops from real edges only.
 * Uses a simple chain walk when the graph forms a path;
 * otherwise returns each unique edge as a hop.
 */
export function deriveRelationshipPath(
  result: ReasoningResult | null
): RelationshipPathHop[] {
  const graph = deriveGraphFromResult(result);

  if (!graph.hasRelationshipData) {
    return [];
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

  return orderHops(hops);
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
  if (nodes.has(id)) {
    return;
  }

  nodes.set(id, {
    id,
    label: id === fallback.id ? fallback.label : id,
    type: id === fallback.id ? fallback.type : "Entity",
    source: fallback.source,
    confidence: fallback.confidence,
    provenance: "unknown"
  });
}

function orderHops(
  hops: RelationshipPathHop[]
): RelationshipPathHop[] {
  if (hops.length <= 1) {
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

  const start =
    starts[0] ?? hops[0]?.fromId;

  if (!start) {
    return hops;
  }

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

  for (const hop of hops) {
    const key = `${hop.fromId}|${hop.relationshipType}|${hop.toId}`;
    if (!used.has(key)) {
      ordered.push(hop);
    }
  }

  return ordered;
}
