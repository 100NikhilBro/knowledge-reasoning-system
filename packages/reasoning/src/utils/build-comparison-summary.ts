import type {
  ComparisonResult,
  StructuredComparisonResult
} from "./compare-evidence.js";

import type {
  ComparisonSummary
} from "../types/comparison-summary.js";

export function buildComparisonSummary(
  comparison: ComparisonResult,
  structured?: StructuredComparisonResult
): ComparisonSummary {

  return {
    common:
      comparison.common.map(
        e => e.entity.label
      ),
    leftOnly:
      comparison.onlyLeft.map(
        e => e.entity.label
      ),
    rightOnly:
      comparison.onlyRight.map(
        e => e.entity.label
      ),
    ...(structured
      ? { structured }
      : {})
  };

}

export function buildStructuredComparisonSummary(
  structured: StructuredComparisonResult
): ComparisonSummary {

  /*
   * Legacy left/right fields: for two-way, map first vs rest differences;
   * for N-way leave left/right empty and rely on structured rendering.
   */
  if (structured.subjects.length === 2) {
    const left =
      structured.differences[0];
    const right =
      structured.differences[1];

    return {
      common:
        structured.common.map(fact =>
          formatFact(fact)
        ),
      leftOnly:
        (left?.facts ?? []).map(fact =>
          formatFact(fact)
        ),
      rightOnly:
        (right?.facts ?? []).map(fact =>
          formatFact(fact)
        ),
      structured
    };
  }

  return {
    common:
      structured.common.map(fact =>
        formatFact(fact)
      ),
    leftOnly: [],
    rightOnly: [],
    structured
  };

}

function formatFact(
  fact: {
    type: string;
    targetLabel: string;
    direction: string;
  }
): string {

  return fact.direction === "outgoing"
    ? `${fact.type}→${fact.targetLabel}`
    : `${fact.type}←${fact.targetLabel}`;

}
