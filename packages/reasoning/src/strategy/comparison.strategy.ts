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
  entityMatchesPhrase
} from "../utils/detect-relationship-between-query.js";

import {
  buildStructuredComparison,
  evidenceWithRelationship
} from "../utils/compare-evidence.js";

import {
  buildStructuredComparisonSummary
} from "../utils/build-comparison-summary.js";

import {
  renderComparison
} from "../utils/render-comparison.js";

import {
  relationshipTypesForDimensions,
  type ComparisonRequest
} from "../utils/detect-comparison-request.js";

import {
  deduplicateEvidence
} from "../utils/deduplicate-evidence.js";

/**
 * Query-driven comparison strategy.
 *
 * Subjects and dimensions come from the plan (query understanding), never
 * from retrieval position. Relationship evidence is bound per subject.
 */
export class ComparisonStrategy
implements ReasoningStrategy {

  async execute(

    graph: GraphTraversalService,

    plan: ReasoningPlan,

    evidence: EvidenceSet

  ): Promise<EvidenceSet> {

    const request =
      plan.comparison;

    if (!request || request.subjects.length < 2) {
      return {
        evidence: evidence.evidence,
        comparison:
          "Comparison subjects could not be resolved from the query."
      };
    }

    const enriched =
      await this.collectSubjectEvidence(
        graph,
        request,
        evidence.evidence
      );

    const structured =
      buildStructuredComparison(request, enriched);

    const summary =
      buildStructuredComparisonSummary(structured);

    const answer =
      renderComparison(summary);

    /*
     * Retain only evidence rows belonging to requested subjects (and their
     * relationship endpoints). Unrelated retrieval hits are dropped.
     */
    const subjectBound =
      enriched.filter(item =>
        request.subjects.some(subject =>
          entityMatchesPhrase(item.entity, subject) ||
          (
            item.relationship &&
            (
              request.subjects.some(subject =>
                entityMatchesPhrase(
                  {
                    id: item.relationship!.from,
                    label: item.relationship!.from,
                    source: "",
                    properties: {}
                  },
                  subject
                )
              ) ||
              request.subjects.some(subject =>
                entityMatchesPhrase(
                  {
                    id: item.relationship!.to,
                    label: item.relationship!.to,
                    source: "",
                    properties: {}
                  },
                  subject
                )
              )
            )
          )
        )
      );

    return {
      evidence: deduplicateEvidence(subjectBound),
      comparison: answer
    };

  }

  private async collectSubjectEvidence(

    graph: GraphTraversalService,

    request: ComparisonRequest,

    seeds: Evidence[]

  ): Promise<Evidence[]> {

    const allowedTypes =
      relationshipTypesForDimensions(request.dimensions);

    const collected: Evidence[] = [...seeds];
    const seenEntity =
      new Set(seeds.map(item => item.entity.id));

    for (const subject of request.subjects) {
      const subjectEntities =
        seeds
          .map(item => item.entity)
          .filter(entity =>
            entityMatchesPhrase(entity, subject)
          );

      const uniqueSubjects =
        [...new Map(
          subjectEntities.map(entity => [entity.id, entity])
        ).values()];

      for (const entity of uniqueSubjects) {
        if (!seenEntity.has(entity.id)) {
          collected.push({
            entity,
            score: 0.95,
            source: "graph"
          });
          seenEntity.add(entity.id);
        }

        let neighbors: Array<{
          neighbor: import("@knowledge/shared").KnowledgeEntity;
          relationship: import("@knowledge/shared").KnowledgeRelationship;
        }> = [];

        try {
          neighbors =
            await graph.findNeighbors(
              entity.type,
              entity.id
            );
        } catch {
          neighbors = [];
        }

        for (const neighbor of neighbors) {
          if (
            allowedTypes &&
            !allowedTypes.has(neighbor.relationship.type)
          ) {
            continue;
          }

          collected.push(
            evidenceWithRelationship(
              entity,
              neighbor.relationship,
              0.95
            )
          );

          collected.push(
            evidenceWithRelationship(
              neighbor.neighbor,
              neighbor.relationship,
              0.9
            )
          );

          seenEntity.add(neighbor.neighbor.id);
        }
      }
    }

    return deduplicateEvidence(collected);

  }

}
