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
       * If a later path discovers a real inbound relationship, attach it
       * on both the already-visited node and the predecessor when present.
       */
      if (inbound !== undefined) {
        const existing =
          result.find(hit => hit.entity.id === node.id);

        if (
          existing &&
          existing.relationship === undefined
        ) {
          existing.relationship = inbound;
          existing.path = toPath(
            [pathNodes[pathNodes.length - 2] ?? node, existing.entity],
            [inbound]
          );
        }

        const predecessor =
          pathNodes[pathNodes.length - 2];

        if (predecessor) {
          const prior =
            result.find(
              hit => hit.entity.id === predecessor.id
            );

          if (
            prior &&
            prior.relationship === undefined
          ) {
            prior.relationship = inbound;
            prior.path = toPath(
              [predecessor, node],
              [inbound]
            );
          }
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
