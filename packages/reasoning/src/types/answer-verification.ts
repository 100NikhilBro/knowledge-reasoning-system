import type {
  Citation,
  ReasoningResult,
  AnswerExplanation
} from "@knowledge/shared";

import type {
  ReasoningContext
} from "./reasoning-context.js";

/**
 * Internal verification report — never attached to the public API response.
 */
export interface AnswerVerificationReport {

  accepted: boolean;

  rejectedCitations: Citation[];

  reasons: string[];

}

export interface AnswerVerificationInput {

  result: ReasoningResult;

  context: ReasoningContext;

  explanation?: AnswerExplanation;

}

export interface AnswerVerificationOutcome {

  result: ReasoningResult;

  report: AnswerVerificationReport;

}
