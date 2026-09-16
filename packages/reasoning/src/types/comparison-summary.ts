import type {
  ComparisonDimension
} from "../utils/detect-comparison-request.js";

import type {
  SubjectRelationshipFact,
  StructuredComparisonResult
} from "../utils/compare-evidence.js";

/**
 * Legacy left/right label summary (two-way set-diff rendering).
 */
export interface ComparisonSummary {

  common: string[];

  leftOnly: string[];

  rightOnly: string[];

  /**
   * Structured N-way comparison when available.
   */
  structured?: StructuredComparisonResult;

}

export type {
  ComparisonDimension,
  SubjectRelationshipFact,
  StructuredComparisonResult
};
