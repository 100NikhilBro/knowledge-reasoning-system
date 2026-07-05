import type {
  ComparisonResult
} from "./compare-evidence.js";

import type {
  ComparisonSummary
} from "../types/comparison-summary.js";

export function buildComparisonSummary(

  comparison: ComparisonResult

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

      )

  };

}