import type {
  Evidence,
  EvidenceSet,
  ReasoningPlan
} from "@knowledge/shared";

import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  ReasoningStrategy
} from "./reasoning-strategy.js";

import {
  TraversalFactory
} from "../traversal/traversal-factory.js";

import {
  scoreHop
} from "../utils/score-hop.js";

import type {
  TraversalHit
} from "../types/traversal-hit.js";

/**
 * Convert relationship-aware traversal hits into Evidence, preserving
 * real Neo4j edge provenance (never invent RELATED when an edge exists).
 */
export function traversalHitsToEvidence(
  hits: TraversalHit[],
  seeds: Evidence[]
): Evidence[] {

  const seedById =
    new Map(
      seeds.map(item => [item.entity.id, item])
    );

  const expanded: Evidence[] = [];

  for (const hit of hits) {

    const seed =
      seedById.get(hit.entity.id);

    if (seed && hit.depth === 0) {
      const seeded: Evidence = {
        ...seed,
        entity: hit.entity
      };

      /*
       * Preserve edge provenance when traversal upgrades a co-seeded
       * neighbor with a real relationship after the depth-0 visit.
       */
      if (hit.relationship !== undefined) {
        seeded.relationship = hit.relationship;
      }

      expanded.push(seeded);
      continue;
    }

    const hop =
      scoreHop(
        Math.max(hit.depth, 1),
        hit.entity.confidence
      );

    const item: Evidence = {
      entity: hit.entity,
      score: hop.score,
      source: "graph"
    };

    if (hit.relationship !== undefined) {
      item.relationship = hit.relationship;
    }

    expanded.push(item);

  }

  return expanded;

}

/**
 * Multi-hop reasoning over real graph edges returned by traversal.
 */
export class MultiHopStrategy
implements ReasoningStrategy {

  async execute(

    graph: GraphTraversalService,

    plan: ReasoningPlan,

    evidence: EvidenceSet

  ): Promise<EvidenceSet> {

    const traversal =
      TraversalFactory.create(
        plan.traversal
      );

    const hits =
      await traversal.traverse(
        graph,
        evidence,
        plan.maxDepth
      );

    return {
      evidence: traversalHitsToEvidence(
        hits,
        evidence.evidence
      )
    };

  }

}
