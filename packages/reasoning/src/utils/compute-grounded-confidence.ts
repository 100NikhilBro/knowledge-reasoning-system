import type {
  Evidence,
  EvidenceSet
} from "@knowledge/shared";

/**
 * Clamp to the public confidence unit interval.
 */
export function clampUnitInterval(
  value: number
): number {

  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;

}

/**
 * Per-item grounded support in [0, 1].
 *
 * Uses entity/relationship quality (already unit-scale) and only the
 * *relative* retrieval/ranking score within the selected set. Absolute
 * graph/vector magnitudes (e.g. 6.25, 15) never become confidence.
 */
function itemGroundedSupport(
  item: Evidence,
  maxScore: number
): number {

  const entityQuality =
    clampUnitInterval(item.entity.confidence);

  const relationshipQuality =
    item.relationship !== undefined
      ? clampUnitInterval(
          item.relationship.confidence
        )
      : 1;

  const rawScore =
    Math.max(0, Number(item.score) || 0);

  const relativeRelevance =
    maxScore > 0
      ? clampUnitInterval(rawScore / maxScore)
      : 0;

  /*
   * Quality is primary; relative relevance only modulates support.
   * Equal absolute scores → relative 1 for all → confidence ≈ quality.
   */
  return (
    entityQuality *
    relationshipQuality *
    (0.55 + 0.45 * relativeRelevance)
  );

}

/**
 * Public grounded-answer confidence ∈ [0, 1].
 *
 * Semantics:
 * - 0 → no selected evidence / fail-closed
 * - reflects how strongly selected evidence can support an answer
 * - NOT raw retrieval, graph traversal, or similarity magnitude
 */
export function computeGroundedAnswerConfidence(
  evidenceSet: EvidenceSet
): number {

  const evidence =
    evidenceSet.evidence;

  if (evidence.length === 0) {
    return 0;
  }

  const maxScore =
    Math.max(
      0,
      ...evidence.map(
        item => Math.max(0, Number(item.score) || 0)
      )
    );

  const totalSupport =
    evidence.reduce(
      (sum, item) =>
        sum + itemGroundedSupport(item, maxScore),
      0
    );

  const meanSupport =
    totalSupport / evidence.length;

  /*
   * Mild corroboration for additional supporting items (capped).
   */
  const corroboration =
    Math.min(
      0.08,
      (evidence.length - 1) * 0.04
    );

  return Number(
    clampUnitInterval(
      meanSupport + corroboration
    ).toFixed(2)
  );

}

/**
 * Confidence after generation failed grounding but evidence remains.
 * Recalculates from evidence and applies a partial-support factor so
 * unsupported LLM claims cannot retain a falsely high score.
 */
export function computePartialGroundedConfidence(
  evidenceSet: EvidenceSet
): number {

  const base =
    computeGroundedAnswerConfidence(evidenceSet);

  if (base <= 0) {
    return 0;
  }

  return Number(
    clampUnitInterval(base * 0.65).toFixed(2)
  );

}
