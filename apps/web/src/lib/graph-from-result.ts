import type {
  Evidence,
  KnowledgeEntity,
  KnowledgeRelationship,
  ReasoningResult
} from "../types/reasoning";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  source: string;
  confidence: number;
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
      addEntity(nodes, item.entity);
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
      if (!existing || item.score > existing.score) {
        byId.set(item.entity.id, item);
      }
    }
  }

  return [...byId.values()].sort((a, b) => b.score - a.score);
}

function addEntity(
  nodes: Map<string, GraphNode>,
  entity: KnowledgeEntity
): void {
  if (nodes.has(entity.id)) {
    return;
  }

  nodes.set(entity.id, {
    id: entity.id,
    label: entity.label,
    type: entity.type,
    source: entity.source,
    confidence: entity.confidence
  });
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

  // Ensure endpoints exist even if only referenced by relationship ids.
  if (!nodes.has(relationship.from)) {
    nodes.set(relationship.from, {
      id: relationship.from,
      label: relationship.from,
      type: "Unknown",
      source: item.entity.source,
      confidence: relationship.confidence
    });
  }

  if (!nodes.has(relationship.to)) {
    nodes.set(relationship.to, {
      id: relationship.to,
      label: relationship.to,
      type: "Unknown",
      source: item.entity.source,
      confidence: relationship.confidence
    });
  }
}
