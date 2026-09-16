import type {
  Evidence,
  EvidenceSet,
  KnowledgeRelationship,
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
 * Endpoint retention for ungrounded relationship-between queries.
 * Uses id/label/properties only — not document source — so a shared
 * corpus filename cannot make every entity look like both endpoints.
 */
function entityMatchesEndpoint(
  entity: {
    id: string;
    label: string;
    properties?: Record<string, unknown>;
  },
  phrase: string
): boolean {

  const needle =
    phrase.toLowerCase().replace(/[^\w]/g, "");

  if (!needle) {
    return false;
  }

  const haystack =
    [
      entity.id,
      entity.label,
      ...Object.values(entity.properties ?? {})
    ]
      .filter(
        value =>
          typeof value === "string" ||
          typeof value === "number"
      )
      .join(" ")
      .toLowerCase()
      .replace(/[^\w]/g, "");

  return haystack.includes(needle);

}

function edgeKey(
  entityId: string,
  relationship: KnowledgeRelationship
): string {

  return (
    `${relationship.from}|${relationship.type}|${relationship.to}|${entityId}`
  );

}

function endpointById(
  byId: Map<string, Evidence>,
  id: string
): Evidence["entity"] | undefined {

  return byId.get(id)?.entity;

}

/**
 * Exact subject-predicate-object(+direction) match for typed-edge asks.
 */
function relationshipMatchesTypedEdge(
  relationship: KnowledgeRelationship,
  typedEdge: NonNullable<ReasoningPlan["requireTypedEdge"]>,
  byId: Map<string, Evidence>
): boolean {

  if (relationship.type !== typedEdge.predicate) {
    return false;
  }

  const from =
    endpointById(byId, relationship.from);

  const to =
    endpointById(byId, relationship.to);

  if (!from || !to) {
    /*
     * Fall back to id/phrase matching against relationship endpoints
     * when endpoint entities are not yet indexed in byId.
     */
    const fromRef =
      { id: relationship.from, label: relationship.from, source: "", properties: {} };

    const toRef =
      { id: relationship.to, label: relationship.to, source: "", properties: {} };

    if (typedEdge.direction === "incoming") {
      return (
        entityMatchesPhrase(toRef, typedEdge.subject) &&
        entityMatchesPhrase(fromRef, typedEdge.object)
      );
    }

    if (typedEdge.direction === "undirected") {
      return (
        (
          entityMatchesPhrase(fromRef, typedEdge.subject) &&
          entityMatchesPhrase(toRef, typedEdge.object)
        ) ||
        (
          entityMatchesPhrase(fromRef, typedEdge.object) &&
          entityMatchesPhrase(toRef, typedEdge.subject)
        )
      );
    }

    return (
      entityMatchesPhrase(fromRef, typedEdge.subject) &&
      entityMatchesPhrase(toRef, typedEdge.object)
    );
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

}

function dedupeEvidenceRows(
  rows: Evidence[]
): Evidence[] {

  const seen =
    new Set<string>();

  const out: Evidence[] = [];

  for (const item of rows) {
    const key =
      item.relationship
        ? edgeKey(item.entity.id, item.relationship)
        : `entity:${item.entity.id}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(item);
  }

  return out;

}

/**
 * Default path: pass collected evidence through unchanged.
 *
 * When the planner sets focusRelationships, expand focused relationship
 * types from seeds and from newly reached neighbors (bounded second pass)
 * so compound chains like INTRODUCES → ADDRESSES can be grounded without
 * dumping unrelated neighbors.
 *
 * When requireTypedEdge is set, only retain edges matching subject +
 * predicate + object + direction.
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

    const typedEdge =
      plan.requireTypedEdge;

    const byId =
      new Map<string, Evidence>();

    /*
     * Edge-keyed rows so independent hub branches (A→X, B→X) are not
     * collapsed when collecting focused neighbors.
     */
    const byEdge =
      new Map<string, Evidence>();

    for (const item of evidence.evidence) {
      byId.set(item.entity.id, item);
      if (item.relationship) {
        byEdge.set(
          edgeKey(item.entity.id, item.relationship),
          item
        );
      }
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
        byEdge,
        [...seedIds],
        typedEdge
      );

    /*
     * Second pass: expand from newly reached nodes so a second hop along
     * focused types can be collected (e.g. Feature --ADDRESSES--> Concern
     * after Proposal --INTRODUCES--> Feature).
     */
    if (focusedHit && !typedEdge) {
      const frontier =
        [...byId.keys()].filter(
          id => !seedIds.has(id)
        );

      const secondHit =
        await this.expandFocusedNeighbors(
          graph,
          focusSet,
          byId,
          byEdge,
          frontier,
          typedEdge
        );

      focusedHit =
        focusedHit || secondHit;
    }

    if (!focusedHit) {
      /*
       * Keep seed entities without inventing the missing focused edge.
       * Answer synthesis will bound "relationship not established".
       */
      return {
        evidence: evidence.evidence.map(item => ({
          entity: item.entity,
          score: item.score,
          source: item.source,
          ...(item.metadata
            ? { metadata: item.metadata }
            : {})
        }))
      };
    }

    const focusedEvidence =
      [...byEdge.values()];

    const focusedIds =
      new Set<string>();

    for (const item of focusedEvidence) {
      if (
        item.relationship &&
        focusSet.has(item.relationship.type)
      ) {
        focusedIds.add(item.entity.id);
        focusedIds.add(item.relationship.from);
        focusedIds.add(item.relationship.to);
      }
    }

    /*
     * Exact typed-edge asks: retain only matching edges (and their
     * endpoints). Same-predicate spillover objects are excluded.
     */
    if (typedEdge) {
      const matching =
        focusedEvidence.filter(item =>
          item.relationship &&
          relationshipMatchesTypedEdge(
            item.relationship,
            typedEdge,
            byId
          )
        );

      if (matching.length === 0) {
        return {
          evidence: evidence.evidence.map(item => ({
            entity: item.entity,
            score: item.score,
            source: item.source,
            ...(item.metadata
              ? { metadata: item.metadata }
              : {})
          }))
        };
      }

      const retainIds =
        new Set<string>();

      for (const item of matching) {
        retainIds.add(item.entity.id);
        if (item.relationship) {
          retainIds.add(item.relationship.from);
          retainIds.add(item.relationship.to);
        }
      }

      const endpoints =
        evidence.evidence.filter(item =>
          retainIds.has(item.entity.id) && !item.relationship
        );

      return {
        evidence: dedupeEvidenceRows([
          ...matching,
          ...endpoints
        ])
      };
    }

    /*
     * Prefer edge-bearing neighbor rows; keep bare endpoint seeds that are
     * not already represented as an edge entity row.
     */
    const edgeRows =
      focusedEvidence.filter(item =>
        item.relationship &&
        focusSet.has(item.relationship.type)
      );

    const edgeEntityIds =
      new Set(edgeRows.map(item => item.entity.id));

    const bareEndpoints: Evidence[] =
      [...byId.values()].filter(item =>
        focusedIds.has(item.entity.id) &&
        !edgeEntityIds.has(item.entity.id)
      ).map(item => ({
        entity: item.entity,
        score: item.score,
        source: item.source,
        ...(item.metadata
          ? { metadata: item.metadata }
          : {})
      }));

    const ordered: Evidence[] =
      [...bareEndpoints, ...edgeRows];

    ordered.sort((a, b) => {
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
      evidence: dedupeEvidenceRows(ordered)
    };

  }

  private async expandFocusedNeighbors(

    graph: GraphTraversalService,

    focusSet: Set<string>,

    byId: Map<string, Evidence>,

    byEdge: Map<string, Evidence>,

    fromIds: string[],

    typedEdge: ReasoningPlan["requireTypedEdge"]

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

        /*
         * Index the neighbor endpoint so typed-edge object matching can
         * resolve target phrases against real entity labels/ids.
         */
        if (!byId.has(neighbor.neighbor.id)) {
          byId.set(neighbor.neighbor.id, {
            entity: neighbor.neighbor,
            score: Math.max(item.score, 0.95),
            source: "graph"
          });
        }

        if (
          typedEdge &&
          !relationshipMatchesTypedEdge(
            neighbor.relationship,
            typedEdge,
            byId
          )
        ) {
          continue;
        }

        focusedHit = true;

        const key =
          edgeKey(
            neighbor.neighbor.id,
            neighbor.relationship
          );

        const existingEdge =
          byEdge.get(key);

        const focusedItem: Evidence = {
          entity: neighbor.neighbor,
          score: Math.max(
            existingEdge?.score ?? 0,
            item.score,
            0.95
          ),
          source: "graph",
          relationship: neighbor.relationship,
          ...(existingEdge?.metadata
            ? { metadata: existingEdge.metadata }
            : {})
        };

        byEdge.set(key, focusedItem);

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
      /*
       * No connecting edge. Retain endpoint entities that match either
       * side of the query so synthesis can report relationship-not-established
       * instead of looking identical to "no information".
       */
      const endpoints =
        evidence.evidence
          .filter(item =>
            entityMatchesEndpoint(
              item.entity,
              pair.left
            ) ||
            entityMatchesEndpoint(
              item.entity,
              pair.right
            )
          )
          .map(item => ({
            entity: item.entity,
            score: item.score,
            source: item.source,
            ...(item.metadata
              ? { metadata: item.metadata }
              : {})
          }));

      return {
        evidence: endpoints
      };
    }

    return {
      evidence: dedupeEvidenceRows(grounded).sort((a, b) =>
        a.entity.id.localeCompare(b.entity.id)
      )
    };

  }

}
