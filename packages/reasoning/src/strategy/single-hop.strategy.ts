import type {
  Evidence,
  EvidenceSet,
  ReasoningPlan
} from "@knowledge/shared";

import type {
  ReasoningStrategy
} from "./reasoning-strategy.js";

import { GraphTraversalService } from "@knowledge/graph";

import {
  entityMatchesPhrase
} from "../utils/detect-relationship-between-query.js";

/**
 * Default path: pass collected evidence through unchanged.
 *
 * When the planner sets focusRelationships, expand focused relationship
 * types from seeds and from newly reached neighbors (bounded second pass)
 * so compound chains like INTRODUCES → ADDRESSES can be grounded without
 * dumping unrelated neighbors.
 *
 * When requireRelationshipBetween is set, only retain an edge whose
 * endpoints match both query phrases; otherwise return empty evidence.
 */
export class SingleHopStrategy
implements ReasoningStrategy {

  async execute(

    graph: GraphTraversalService,

    plan: ReasoningPlan,

    evidence: EvidenceSet

  ): Promise<EvidenceSet> {

    if (plan.requireRelationshipBetween) {
      return this.executeRelationshipBetween(
        graph,
        plan.requireRelationshipBetween,
        evidence
      );
    }

    const focus =
      plan.focusRelationships;

    if (!focus || focus.length === 0) {
      return evidence;
    }

    const focusSet =
      new Set(focus);

    const byId =
      new Map<string, Evidence>();

    for (const item of evidence.evidence) {
      byId.set(item.entity.id, item);
    }

    const seedIds =
      new Set(
        evidence.evidence.map(
          item => item.entity.id
        )
      );

    let focusedHit =
      await this.expandFocusedNeighbors(
        graph,
        focusSet,
        byId,
        [...seedIds]
      );

    /*
     * Second pass: expand from newly reached nodes so a second hop along
     * focused types can be collected (e.g. Feature --ADDRESSES--> Concern
     * after Proposal --INTRODUCES--> Feature).
     */
    if (focusedHit) {
      const frontier =
        [...byId.keys()].filter(
          id => !seedIds.has(id)
        );

      const secondHit =
        await this.expandFocusedNeighbors(
          graph,
          focusSet,
          byId,
          frontier
        );

      focusedHit =
        focusedHit || secondHit;
    }

    if (!focusedHit) {
      // Focused relationship type was requested but not grounded.
      return { evidence: [] };
    }

    const focusedIds =
      new Set<string>();

    for (const item of byId.values()) {
      if (
        item.relationship &&
        focusSet.has(item.relationship.type)
      ) {
        focusedIds.add(item.entity.id);
        focusedIds.add(item.relationship.from);
        focusedIds.add(item.relationship.to);
      }
    }

    const focusedEvidence =
      [...byId.values()].filter(item =>
        focusedIds.has(item.entity.id)
      );

    focusedEvidence.sort((a, b) => {
      const aFocused =
        a.relationship &&
        focusSet.has(a.relationship.type)
          ? 1
          : 0;
      const bFocused =
        b.relationship &&
        focusSet.has(b.relationship.type)
          ? 1
          : 0;

      if (aFocused !== bFocused) {
        return aFocused - bFocused;
      }

      return a.entity.id.localeCompare(
        b.entity.id
      );
    });

    return {
      evidence: focusedEvidence
    };

  }

  private async expandFocusedNeighbors(

    graph: GraphTraversalService,

    focusSet: Set<string>,

    byId: Map<string, Evidence>,

    fromIds: string[]

  ): Promise<boolean> {

    let focusedHit = false;

    for (const id of fromIds) {

      const item =
        byId.get(id);

      if (!item) {
        continue;
      }

      const neighbors =
        await graph.findNeighbors(
          item.entity.type,
          item.entity.id
        );

      for (const neighbor of neighbors) {

        if (
          !focusSet.has(
            neighbor.relationship.type
          )
        ) {
          continue;
        }

        focusedHit = true;

        const existing =
          byId.get(neighbor.neighbor.id);

        /*
         * Prefer keeping an existing focused relationship over overwriting
         * with a later edge of a different type.
         */
        if (
          existing?.relationship &&
          focusSet.has(existing.relationship.type)
        ) {
          continue;
        }

        const focusedItem: Evidence = {
          entity: neighbor.neighbor,
          score: Math.max(
            existing?.score ?? 0,
            item.score,
            0.95
          ),
          source: "graph",
          relationship: neighbor.relationship,
          ...(existing?.metadata
            ? { metadata: existing.metadata }
            : {})
        };

        byId.set(
          neighbor.neighbor.id,
          focusedItem
        );

        if (!byId.has(item.entity.id)) {
          byId.set(item.entity.id, item);
        }

      }

    }

    return focusedHit;

  }

  private async executeRelationshipBetween(

    graph: GraphTraversalService,

    pair: {
      left: string;
      right: string;
    },

    evidence: EvidenceSet

  ): Promise<EvidenceSet> {

    const grounded: Evidence[] = [];
    const seen =
      new Set<string>();

    for (const item of evidence.evidence) {

      const neighbors =
        await graph.findNeighbors(
          item.entity.type,
          item.entity.id
        );

      for (const neighbor of neighbors) {

        const a =
          item.entity;

        const b =
          neighbor.neighbor;

        const connectsPair =
          (
            entityMatchesPhrase(a, pair.left) &&
            entityMatchesPhrase(b, pair.right)
          ) ||
          (
            entityMatchesPhrase(a, pair.right) &&
            entityMatchesPhrase(b, pair.left)
          );

        if (!connectsPair) {
          continue;
        }

        const seedKey =
          `${a.id}|${neighbor.relationship.type}|${b.id}`;

        if (seen.has(seedKey)) {
          continue;
        }

        seen.add(seedKey);

        grounded.push({
          entity: a,
          score: Math.max(item.score, 0.95),
          source: "graph",
          relationship: neighbor.relationship
        });

        grounded.push({
          entity: b,
          score: 0.95,
          source: "graph",
          relationship: neighbor.relationship
        });

      }

    }

    if (grounded.length === 0) {
      return { evidence: [] };
    }

    // Deterministic dedupe by entity id (keep first / higher score).
    const byId =
      new Map<string, Evidence>();

    for (const item of grounded) {
      const existing =
        byId.get(item.entity.id);

      if (
        !existing ||
        item.score > existing.score
      ) {
        byId.set(item.entity.id, item);
      }
    }

    const ordered =
      [...byId.values()].sort((a, b) =>
        a.entity.id.localeCompare(b.entity.id)
      );

    return {
      evidence: ordered
    };

  }

}
