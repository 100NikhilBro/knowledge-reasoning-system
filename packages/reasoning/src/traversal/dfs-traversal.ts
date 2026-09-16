import type {
  EvidenceSet,
  GraphPath,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import {
  buildPropagatedConfidence
} from "../utils/build-propagated-confidence.js";

import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  GraphTraversal
} from "../contracts/graph-traversal.js";

import type {
  TraversalHit
} from "../types/traversal-hit.js";

import {
  TraversalGuard
} from "../utils/traversal-guard.js";

import {
  TraversalLimiter
} from "../utils/traversal-limiter.js";

function toPath(
  nodes: KnowledgeEntity[],
  relationships: KnowledgeRelationship[]
): GraphPath {

  return {
    nodes: [...nodes],
    relationships: [...relationships],
    length: relationships.length
  };

}

function relationshipKey(
  relationship: KnowledgeRelationship
): string {

  return (
    `${relationship.from}|${relationship.type}|${relationship.to}`
  );

}

function hitsHaveRelationship(
  hits: TraversalHit[],
  entityId: string,
  relationship: KnowledgeRelationship
): boolean {

  const key =
    relationshipKey(relationship);

  return hits.some(hit =>
    hit.entity.id === entityId &&
    hit.relationship !== undefined &&
    relationshipKey(hit.relationship) === key
  );

}

/**
 * Preserve every independent real edge, including multiple inbound edges
 * to the same hub (A→X and B→X).
 */
function attachIndependentRelationship(
  hits: TraversalHit[],
  entity: KnowledgeEntity,
  relationship: KnowledgeRelationship,
  fromEntity: KnowledgeEntity,
  depth: number
): void {

  if (hitsHaveRelationship(hits, entity.id, relationship)) {
    return;
  }

  const existingEmpty =
    hits.find(hit =>
      hit.entity.id === entity.id &&
      hit.relationship === undefined
    );

  if (existingEmpty) {
    existingEmpty.relationship = relationship;
    existingEmpty.path = toPath(
      [fromEntity, existingEmpty.entity],
      [relationship]
    );
    return;
  }

  const propagated =
    buildPropagatedConfidence(depth);

  hits.push({
    entity: {
      ...entity,
      confidence: propagated.confidence
    },
    depth,
    relationship,
    path: toPath(
      [fromEntity, entity],
      [relationship]
    )
  });

}

function attachRelationshipIfMissing(
  hits: TraversalHit[],
  entityId: string,
  relationship: KnowledgeRelationship,
  fromEntity: KnowledgeEntity
): void {

  const existing =
    hits.find(hit => hit.entity.id === entityId);

  if (!existing || existing.relationship !== undefined) {
    return;
  }

  existing.relationship = relationship;
  existing.path = toPath(
    [fromEntity, existing.entity],
    [relationship]
  );

}

/**
 * Depth-first traversal that retains real GraphNeighbor relationships
 * and reconstructible GraphPath provenance per discovered node.
 */
export class DFSTraversal
implements GraphTraversal {

  async traverse(

    graph: GraphTraversalService,

    evidence: EvidenceSet,

    maxDepth: number

  ): Promise<TraversalHit[]> {

    const result: TraversalHit[] = [];

    const visited =
      new TraversalGuard();

    const limiter =
      new TraversalLimiter({
        maxDepth,
        maxNodes: 100
      });

    for (const item of evidence.evidence) {

      await this.visit(
        graph,
        item.entity,
        undefined,
        [item.entity],
        [],
        result,
        visited,
        limiter,
        0,
        maxDepth
      );

    }

    return result;

  }

  private async visit(

    graph: GraphTraversalService,

    node: KnowledgeEntity,

    inbound: KnowledgeRelationship | undefined,

    pathNodes: KnowledgeEntity[],

    pathRelationships: KnowledgeRelationship[],

    result: TraversalHit[],

    visited: TraversalGuard,

    limiter: TraversalLimiter,

    depth: number,

    maxDepth: number

  ): Promise<void> {

    if (!limiter.canContinue(depth, visited.size())) {
      return;
    }

    if (visited.has(node.id)) {
      /*
       * Co-seeded endpoints are marked visited at depth 0 without an edge.
       * Later discoveries of independent real edges (including a second
       * shared-hub branch A→X and B→X) must still be preserved.
       */
      if (inbound !== undefined) {
        const predecessor =
          pathNodes[pathNodes.length - 2] ?? node;

        if (inbound.to === node.id) {
          attachIndependentRelationship(
            result,
            node,
            inbound,
            predecessor,
            depth
          );
        } else {
          attachRelationshipIfMissing(
            result,
            node.id,
            inbound,
            predecessor
          );
        }

        if (predecessor.id !== node.id) {
          attachRelationshipIfMissing(
            result,
            predecessor.id,
            inbound,
            predecessor
          );
        }
      }
      return;
    }

    visited.add(node.id);

    const propagated =
      buildPropagatedConfidence(depth);

    const entity: KnowledgeEntity = {
      ...node,
      confidence: propagated.confidence
    };

    const hit: TraversalHit = {
      entity,
      depth,
      path: toPath(
        [
          ...pathNodes.slice(0, -1),
          entity
        ],
        pathRelationships
      )
    };

    if (inbound !== undefined) {
      hit.relationship = inbound;
    }

    result.push(hit);

    if (depth >= maxDepth) {
      return;
    }

    const neighbors =
      await graph.findNeighbors(
        node.type,
        node.id
      );

    for (const neighbor of neighbors) {

      await this.visit(
        graph,
        neighbor.neighbor,
        neighbor.relationship,
        [...pathNodes, neighbor.neighbor],
        [...pathRelationships, neighbor.relationship],
        result,
        visited,
        limiter,
        depth + 1,
        maxDepth
      );

    }

  }

}
