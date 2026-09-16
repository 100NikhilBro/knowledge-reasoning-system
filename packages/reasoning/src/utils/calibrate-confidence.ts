import type {
  EvidenceSet
} from "@knowledge/shared";

import type { ReasoningContext } from "../types/reasoning-context.js";

import {
  computeGroundedAnswerConfidence,
  computePartialGroundedConfidence,
  clampUnitInterval
} from "./compute-grounded-confidence.js";

import type {
  PathInterpretation
} from "./interpret-path.js";

import type {
  AnswerSupportStatus
} from "./answer-intent-verification.js";

import type {
  ImplicationSupport
} from "./logical-implication.js";

import type {
  RelationalSupportKind
} from "./classify-relational-support.js";

import type {
  QueryIntentKind
} from "./query-understanding.js";

import type {
  AnalyticalStatus
} from "./execute-analytical.js";

import type {
  SummarizationStatus
} from "./execute-summarization.js";

/**
 * Semantic confidence bands (P5).
 *
 * Thresholds (deterministic):
 * - NONE:   score === 0
 * - LOW:    0 < score ≤ 0.45
 * - MEDIUM: 0.45 < score ≤ 0.75
 * - HIGH:   score > 0.75
 */
export type ConfidenceLevel =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "NONE";

export interface CalibratedConfidence {
  score: number;
  level: ConfidenceLevel;
  reasons: string[];
}

export interface ConfidenceCalibrationInput {
  evidenceSet: EvidenceSet;
  /**
   * Verification / structured answer support (P3).
   */
  verificationStatus?: AnswerSupportStatus;
  implicationSupport?: ImplicationSupport;
  relationalKind?: RelationalSupportKind;
  pathInterpretation?: PathInterpretation;
  intent?: QueryIntentKind;
  /**
   * When true, generation exceeded evidence — never inflate confidence.
   */
  exceedsEvidence?: boolean;
  /**
   * P6 analytical execution status.
   */
  analyticalStatus?: AnalyticalStatus;
  /**
   * P7 summarization execution status.
   */
  summarizationStatus?: SummarizationStatus;
}

export function confidenceLevelFromScore(
  score: number
): ConfidenceLevel {

  const clamped =
    clampUnitInterval(score);

  if (clamped <= 0) {
    return "NONE";
  }

  if (clamped <= 0.45) {
    return "LOW";
  }

  if (clamped <= 0.75) {
    return "MEDIUM";
  }

  return "HIGH";

}

function pushUnique(
  reasons: string[],
  reason: string
): void {

  if (!reason.trim()) {
    return;
  }

  if (reasons.includes(reason)) {
    return;
  }

  reasons.push(reason);

}

function dualChannelBonus(
  evidenceSet: EvidenceSet
): number {

  let dualHits = 0;

  for (const item of evidenceSet.evidence) {
    const sources =
      item.metadata?.sources;

    if (
      Array.isArray(sources) &&
      sources.includes("graph") &&
      sources.includes("vector")
    ) {
      dualHits += 1;
    }
  }

  if (dualHits <= 0) {
    return 0;
  }

  return Math.min(0.05, dualHits * 0.025);

}

/**
 * Calibrate public answer confidence from grounded evidence plus
 * path / verification / claim signals. Deterministic — no LLM / ML.
 *
 * Hard constraints:
 * 1. NOT_SUPPORTED → NONE / 0
 * 2. Fail-closed: exceedsEvidence cannot raise confidence
 * 3. DIRECT request + insufficient path → 0
 * 4. Partial claims → cannot be HIGH (cap ≤ 0.65)
 * 5. Strong retrieval cannot override failed verification
 * 6. Semantic/vector relevance alone is not proof for relational claims
 */
export function calibrateAnswerConfidence(
  input: ConfidenceCalibrationInput
): CalibratedConfidence {

  const reasons: string[] = [];

  const verification =
    input.verificationStatus;

  const implication =
    input.implicationSupport;

  const relational =
    input.relationalKind;

  const path =
    input.pathInterpretation;

  const intent =
    input.intent;

  const analytical =
    input.analyticalStatus;

  const summarization =
    input.summarizationStatus;

  /*
   * Hard fail-closed zeros.
   */
  if (
    analytical === "NOT_SUPPORTED" ||
    analytical === "INSUFFICIENT_EVIDENCE" ||
    summarization === "NOT_SUPPORTED" ||
    summarization === "INSUFFICIENT_EVIDENCE"
  ) {
    pushUnique(
      reasons,
      summarization === "INSUFFICIENT_EVIDENCE" ||
      analytical === "INSUFFICIENT_EVIDENCE"
        ? "insufficient grounded evidence for structured execution"
        : "structured operation not supported for available data"
    );

    return {
      score: 0,
      level: "NONE",
      reasons
    };
  }

  if (
    verification === "NOT_SUPPORTED" ||
    implication === "NOT_SUPPORTED" ||
    relational === "relationship_missing" ||
    input.exceedsEvidence === true
  ) {
    if (verification === "NOT_SUPPORTED") {
      pushUnique(reasons, "verification rejected the claim");
    }

    if (implication === "NOT_SUPPORTED") {
      pushUnique(reasons, "logical implication not supported");
    }

    if (relational === "relationship_missing") {
      pushUnique(reasons, "required relationship was not established");
    }

    if (input.exceedsEvidence) {
      pushUnique(reasons, "generated answer exceeded grounded evidence");
    }

    if (
      path?.kind === "INSUFFICIENT" ||
      (
        (intent === "DIRECT_RELATIONSHIP") &&
        path &&
        path.supportsClaim === false
      )
    ) {
      pushUnique(
        reasons,
        "indirect path is insufficient for a direct relationship claim"
      );
    }

    return {
      score: 0,
      level: "NONE",
      reasons
    };
  }

  if (
    (intent === "DIRECT_RELATIONSHIP") &&
    path &&
    path.supportsClaim === false
  ) {
    pushUnique(
      reasons,
      "indirect path is insufficient for a direct relationship claim"
    );

    return {
      score: 0,
      level: "NONE",
      reasons
    };
  }

  if (input.evidenceSet.evidence.length === 0) {
    pushUnique(reasons, "no grounded evidence selected");
    return {
      score: 0,
      level: "NONE",
      reasons
    };
  }

  const partial =
    verification === "PARTIALLY_SUPPORTED" ||
    implication === "PARTIALLY_SUPPORTED" ||
    relational === "partial" ||
    summarization === "PARTIALLY_SUPPORTED";

  let score =
    partial
      ? computePartialGroundedConfidence(input.evidenceSet)
      : computeGroundedAnswerConfidence(input.evidenceSet);

  score =
    clampUnitInterval(score + dualChannelBonus(input.evidenceSet));

  if (path?.supportsClaim && path.kind !== "COMPARISON_EVIDENCE") {
    if (path.kind === "DIRECT") {
      score = clampUnitInterval(score + 0.05);
      pushUnique(reasons, "direct graph relationship found");
    } else if (path.kind === "BRIDGE") {
      score = clampUnitInterval(score + 0.05);
      pushUnique(reasons, "requested bridge entity found");
      pushUnique(reasons, "path matches bridge relationship intent");
    } else if (path.kind === "CONNECTED") {
      score = clampUnitInterval(score + 0.03);
      pushUnique(reasons, "multi-hop path supports connectivity");
    } else if (path.kind === "MULTI_HOP") {
      score = clampUnitInterval(score + 0.02);
      pushUnique(reasons, "multi-hop path supports connectivity");
    }

    if (path.relationships.length > 0) {
      pushUnique(reasons, "valid graph relationships found");
    }
  }

  if (path?.kind === "COMPARISON_EVIDENCE") {
    pushUnique(
      reasons,
      "comparison uses per-subject evidence (not a graph path)"
    );
  }

  if (path?.kind === "FACT_IDENTITY") {
    pushUnique(
      reasons,
      "FACT identity does not require a graph path"
    );
  }

  if (intent) {
    pushUnique(reasons, `query intent matched evidence (${intent})`);
  }

  if (
    verification === "SUPPORTED" ||
    (!verification && !partial && implication === "SUPPORTED")
  ) {
    pushUnique(reasons, "verification passed");
  }

  if (partial) {
    pushUnique(reasons, "some claims remain unsupported");
    pushUnique(reasons, "verification restricted the answer");
    /*
     * Partial claim coverage cannot be HIGH and must stay strictly
     * below full support.
     */
    score = Math.min(score, 0.65);
    if (score >= 1) {
      score = 0.65;
    }
    score = Math.min(score, 0.99);
  }

  if (
    analytical === "SUPPORTED_EXISTS" ||
    analytical === "SUPPORTED_NOT_EXISTS" ||
    analytical === "SUPPORTED"
  ) {
    pushUnique(reasons, "deterministic analytical result grounded in evidence");
  }

  if (
    summarization === "SUPPORTED" ||
    summarization === "PARTIALLY_SUPPORTED"
  ) {
    pushUnique(reasons, "deterministic summarization synthesis grounded in evidence");
  }

  if (
    implication === "SUPPORTED" ||
    (
      !partial &&
      relational === "full" &&
      path?.supportsClaim !== false
    )
  ) {
    pushUnique(reasons, "all requested claims supported");
  }

  /*
   * Relational asks without path/claim support cannot stay HIGH from
   * retrieval strength alone.
   */
  if (
    (
      intent === "DIRECT_RELATIONSHIP" ||
      intent === "CONNECTED_RELATIONSHIP" ||
      intent === "BRIDGE_RELATIONSHIP" ||
      intent === "IMPLICATION" ||
      intent === "RELATIONSHIP"
    ) &&
    path?.supportsClaim !== true &&
    implication !== "SUPPORTED" &&
    relational !== "full"
  ) {
    score = Math.min(score, 0.4);
    pushUnique(
      reasons,
      "retrieval relevance alone is not sufficient for the relational claim"
    );
  }

  score =
    Number(clampUnitInterval(score).toFixed(2));

  const level =
    confidenceLevelFromScore(score);

  if (level === "HIGH" && partial) {
    return {
      score: 0.65,
      level: "MEDIUM",
      reasons
    };
  }

  return {
    score,
    level,
    reasons
  };

}

/**
 * Convenience: calibrate from a ReasoningContext plus optional signals.
 */
export function calibrateFromContext(
  context: ReasoningContext,
  options?: Omit<ConfidenceCalibrationInput, "evidenceSet">
): CalibratedConfidence {

  return calibrateAnswerConfidence({
    evidenceSet: {
      evidence: context.evidence,
      ...(context.comparison !== undefined
        ? { comparison: context.comparison }
        : {})
    },
    ...options
  });

}

/**
 * Trace line for calibrated confidence.
 */
export function formatConfidenceTraceStep(
  calibrated: CalibratedConfidence
): string {

  const reasonText =
    calibrated.reasons.length > 0
      ? calibrated.reasons.join("; ")
      : "no additional reasons";

  return (
    `Confidence: ${calibrated.level} (score=${calibrated.score}) — ${reasonText}`
  );

}
