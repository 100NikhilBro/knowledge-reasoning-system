import type { Citation }
from "./citation.js";

import type { ReasoningTrace }
from "./reasoning-trace.js";

import type { AnswerExplanation }
from "./answer-explanation.js";

/**
 * Semantic confidence band accompanying the numeric score (P5).
 */
export type ConfidenceLevel =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "NONE";

export interface ReasoningResult {

  answer: string;

  /**
   * Calibrated public confidence in [0, 1].
   */
  confidence: number;

  /**
   * Semantic band for the calibrated score (optional for older callers).
   */
  confidenceLevel?: ConfidenceLevel;

  /**
   * Deterministic reasons for the calibrated confidence.
   */
  confidenceReasons?: string[];

  citations: Citation[];

  trace: ReasoningTrace;

  comparison?: string;

  explanation?: AnswerExplanation;

}
