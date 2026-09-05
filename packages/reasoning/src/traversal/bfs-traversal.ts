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

interface QueueItem {

  entity: KnowledgeEntity;

  depth: number;

  /**
   * Edge used to reach this entity from its predecessor.
   */
  relationship?: KnowledgeRelationship;

  pathNodes: KnowledgeEntity[];

  pathRelationships: KnowledgeRelationship[];

}

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

function toHit(
  item: QueueItem
): TraversalHit {

  const propagated =
    buildPropagatedConfidence(item.depth);

  const entity: KnowledgeEntity = {
    ...item.entity,
    confidence: propagated.confidence
  };

  const hit: TraversalHit = {
    entity,
    depth: item.depth,
    path: toPath(
      item.pathNodes.map((node, index) =>
        index === item.pathNodes.length - 1
          ? entity
          : node
      ),
      item.pathRelationships
    )
  };

  if (item.relationship !== undefined) {
    hit.relationship = item.relationship;
  }

  return hit;

}

/**
 * When retrieval already seeded both endpoints, BFS visits them at depth 0
 * without edges. Later neighbor discovery must still attach the real
 * relationship instead of dropping it as "already visited".
 */
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
 * Breadth-first traversal that retains real GraphNeighbor relationships
 * and reconstructible GraphPath provenance per discovered node.
 */
export class BFSTraversal
implements GraphTraversal {

  async traverse(

    graph: GraphTraversalService,

    evidence: EvidenceSet,

    maxDepth: number

  ): Promise<TraversalHit[]> {

    const limiter =
      new TraversalLimiter({
        maxDepth,
        maxNodes: 100
      });

    const visited =
      new TraversalGuard();

    const result: TraversalHit[] = [];

    const queue: QueueItem[] =
      evidence.evidence.map(item => ({
        entity: item.entity,
        depth: 0,
        pathNodes: [item.entity],
        pathRelationships: []
      }));

    let depth =
      0;

    while (
      queue.length > 0 &&
      limiter.canContinue(depth, visited.size())
    ) {

      const levelSize =
        queue.length;

      for (let i = 0; i < levelSize; i++) {

        const current =
          queue.shift()!;

        if (visited.has(current.entity.id)) {
          continue;
        }

        visited.add(current.entity.id);

        const hit =
          toHit(current);

        result.push(hit);

        if (current.depth >= maxDepth) {
          continue;
        }

        const neighbors =
          await graph.findNeighbors(
            current.entity.type,
            current.entity.id
          );

        for (const neighbor of neighbors) {

          if (visited.has(neighbor.neighbor.id)) {
            attachRelationshipIfMissing(
              result,
              neighbor.neighbor.id,
              neighbor.relationship,
              current.entity
            );
            /*
             * Also attach on the current node when the neighbor was a
             * co-seed: otherwise the outbound edge is lost forever.
             */
            attachRelationshipIfMissing(
              result,
              current.entity.id,
              neighbor.relationship,
              current.entity
            );
            continue;
          }

          queue.push({
            entity: neighbor.neighbor,
            depth: current.depth + 1,
            relationship: neighbor.relationship,
            pathNodes: [
              ...current.pathNodes,
              neighbor.neighbor
            ],
            pathRelationships: [
              ...current.pathRelationships,
              neighbor.relationship
            ]
          });

        }

      }

      depth += 1;

    }

    return result;

  }

}
