import type {
  Evidence,
  ReasoningResult,
  AnswerExplanation
} from "@knowledge/shared";

import type {
  AnswerVerifier
} from "../contracts/answer-verifier.js";

import type {
  CitationValidator
} from "../contracts/citation-validator.js";

import {
  DefaultCitationValidator
} from "./citation-validator.service.js";

import type {
  AnswerVerificationInput,
  AnswerVerificationOutcome,
  AnswerVerificationReport
} from "../types/answer-verification.js";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

import {
  buildTrace
} from "../utils/trace-builder.js";

import {
  buildAnswerExplanation
} from "../utils/build-answer-explanation.js";

import {
  buildPartialGroundedAnswer,
  buildRelationshipNotEstablishedAnswer,
  buildImplicationGroundedAnswer,
  detectUnsupportedCausalRemainder
} from "../utils/build-partial-grounded-answer.js";

import {
  isGeneratedAnswerGrounded
} from "../utils/is-generated-answer-grounded.js";

import {
  causalClaimsAreGrounded
} from "../utils/relational-claim-grounding.js";

import {
  relationshipAttributionIsGrounded
} from "../utils/relationship-attribution.js";

import {
  classifyRelationalSupport
} from "../utils/classify-relational-support.js";

import {
  detectLogicalConclusionQuery,
  evaluateLogicalImplication
} from "../utils/logical-implication.js";

import {
  interpretEvidencePaths
} from "../utils/interpret-path.js";

import {
  calibrateFromContext,
  type CalibratedConfidence
} from "../utils/calibrate-confidence.js";

import {
  executeAnalytical,
  formatAnalyticalAnswer
} from "../utils/execute-analytical.js";

import {
  executeSummarization,
  formatSummarizationAnswer
} from "../utils/execute-summarization.js";

import {
  verifyAnswerAgainstIntent,
  formatVerificationTraceStep,
  type AnswerIntentVerification,
  type AnswerSupportStatus
} from "../utils/answer-intent-verification.js";

import {
  understandQuery
} from "../utils/query-understanding.js";

function evidenceWithoutRelationships(
  evidence: Evidence[]
): Evidence[] {

  return evidence.map(item => {

    if (!item.relationship) {
      return item;
    }

    const {
      relationship: _relationship,
      ...rest
    } = item;

    return rest;

  });

}

function resolveVerificationStatus(
  verification: AnswerIntentVerification | undefined,
  extraReasons: string[],
  forceNone: boolean
): AnswerSupportStatus | undefined {

  if (
    extraReasons.some(reason =>
      /PARTIALLY_SUPPORTED/i.test(reason)
    )
  ) {
    return "PARTIALLY_SUPPORTED";
  }

  /*
   * Recognize analytical accept/constrain success before the NOT_SUPPORTED
   * substring check so constrained SUPPORTED replacements calibrate correctly.
   */
  if (
    extraReasons.some(reason =>
      /Verification:\s*SUPPORTED\b/i.test(reason) ||
      /SUPPORTED — (?:answer accepted|analytical answer (?:accepted|constrained))/i
        .test(reason)
    )
  ) {
    return "SUPPORTED";
  }

  if (
    extraReasons.some(reason =>
      /NOT_SUPPORTED/i.test(reason)
    )
  ) {
    return "NOT_SUPPORTED";
  }

  if (forceNone) {
    return "NOT_SUPPORTED";
  }

  return verification?.semantics.status;

}

function resolveCalibratedConfidence(
  context: ReasoningContext,
  verification: AnswerIntentVerification | undefined,
  forceNone: boolean,
  extraReasons: string[] = []
): CalibratedConfidence {

  const understanding =
    context.understanding ??
    (context.query
      ? understandQuery(context.query)
      : undefined);

  const pathInterpretation =
    context.query
      ? interpretEvidencePaths(
          context.query,
          context,
          understanding
        )
      : undefined;

  const implication =
    context.query
      ? evaluateLogicalImplication(context.query, context)
      : undefined;

  const relational =
    classifyRelationalSupport(context.query, context);

  const verificationStatus =
    resolveVerificationStatus(
      verification,
      extraReasons,
      forceNone
    );

  /*
   * exceedsEvidence applies to the rejected generator answer only.
   * Constrained replacements (partial / fail-closed) must calibrate from
   * their own support status — never inherit the generator's rejection flag.
   */
  const exceedsEvidence =
    verification?.exceedsEvidence === true &&
    verificationStatus === "NOT_SUPPORTED" &&
    forceNone;

  const calibrated =
    calibrateFromContext(context, {
      pathInterpretation,
      intent: understanding?.intent,
      verificationStatus,
      implicationSupport:
        verificationStatus === "PARTIALLY_SUPPORTED" &&
        implication?.support === "NOT_SUPPORTED"
          ? "PARTIALLY_SUPPORTED"
          : forceNone && implication?.support === "PARTIALLY_SUPPORTED"
            ? "NOT_SUPPORTED"
            : implication?.support,
      relationalKind:
        verificationStatus === "PARTIALLY_SUPPORTED" &&
        (
          relational.kind === "relationship_missing" ||
          relational.kind === "partial"
        )
          ? "partial"
          : forceNone && relational.kind === "partial"
            ? "relationship_missing"
            : relational.kind,
      exceedsEvidence,
      analyticalStatus: context.analyticalResult?.status,
      summarizationStatus: context.summarizationResult?.status
    });

  if (forceNone) {
    return {
      score: 0,
      level: "NONE",
      reasons:
        calibrated.reasons.length > 0
          ? calibrated.reasons
          : ["required relationship was not established"]
    };
  }

  return calibrated;

}

function withVerificationTrace(
  result: ReasoningResult,
  context: ReasoningContext,
  verification?: AnswerIntentVerification,
  extraReasons: string[] = []
): ReasoningResult {

  const forceNone =
    result.confidence <= 0;

  const understanding =
    context.understanding ??
    (context.query
      ? understandQuery(context.query)
      : undefined);

  const pathInterpretation =
    context.query
      ? interpretEvidencePaths(
          context.query,
          context,
          understanding
        )
      : undefined;

  const calibrated =
    resolveCalibratedConfidence(
      context,
      verification,
      forceNone,
      extraReasons
    );

  /*
   * Preserve fail-closed entity-only provenance when relationships were
   * intentionally stripped before verification enrichment.
   */
  const evidenceForTrace =
    forceNone
      ? evidenceWithoutRelationships(context.evidence)
      : context.evidence;

  const evidenceSet = {
    evidence: evidenceForTrace,
    ...(context.comparison !== undefined
      ? { comparison: context.comparison }
      : {})
  };

  const enrichedTrace =
    buildTrace(evidenceSet, {
      query: context.query,
      context: {
        ...context,
        evidence: evidenceForTrace
      },
      understanding,
      pathInterpretation,
      calibratedConfidence: calibrated,
      verificationStatus:
        verification?.semantics.status ??
        (forceNone ? "NOT_SUPPORTED" : undefined)
    });

  const steps =
    [...enrichedTrace.steps];

  const sampleEvidence: Evidence[] =
    [];

  if (verification) {
    for (const line of verification.traceLines) {
      if (
        steps.some(step => step.description === line)
      ) {
        continue;
      }

      steps.push({
        description: line,
        evidence: sampleEvidence
      });
    }

    const summary =
      formatVerificationTraceStep(verification);

    if (
      !steps.some(step => step.description === summary)
    ) {
      steps.push({
        description: summary,
        evidence: sampleEvidence
      });
    }
  }

  for (const reason of extraReasons) {
    if (!reason.trim()) {
      continue;
    }

    const description =
      reason.startsWith("Verification:")
        ? reason
        : `Verification: ${reason}`;

    if (
      steps.some(step => step.description === description)
    ) {
      continue;
    }

    steps.push({
      description,
      evidence: sampleEvidence
    });
  }

  const meta = {
    ...(enrichedTrace.meta ?? {}),
    ...(verification
      ? { verificationStatus: verification.semantics.status }
      : forceNone
        ? { verificationStatus: "NOT_SUPPORTED" }
        : {}),
    ...(verification
      ? {
          claimSupport: {
            supported:
              verification.semantics.claims
                .filter(claim => claim.status === "SUPPORTED")
                .map(claim => claim.predicate),
            unsupported:
              verification.semantics.claims
                .filter(claim => claim.status === "NOT_SUPPORTED")
                .map(claim => claim.predicate),
            missing:
              verification.semantics.claims
                .filter(claim => claim.status === "MISSING")
                .map(claim => claim.predicate)
          }
        }
      : {}),
    confidence: {
      score: calibrated.score,
      level: calibrated.level,
      reasons: calibrated.reasons
    }
  };

  return {
    ...result,
    confidence: calibrated.score,
    confidenceLevel: calibrated.level,
    confidenceReasons: calibrated.reasons,
    trace: {
      steps,
      meta
    }
  };

}

function safeEmptyResult(): ReasoningResult {

  const explanation: AnswerExplanation = {

    answer: "",

    reasoning: [

      "Evidence used: 0"

    ]

  };

  return {

    answer: "",

    confidence: 0,

    confidenceLevel: "NONE",

    confidenceReasons: ["no grounded evidence selected"],

    citations: [],

    trace: {
      steps: []
    },

    explanation

  };

}

/**
 * Deterministic summarization answer replacement (P7).
 */
function safeSummarizationResult(
  context: ReasoningContext
): ReasoningResult {

  const understanding =
    context.understanding ??
    (
      context.query
        ? understandQuery(context.query)
        : undefined
    );

  const summarization =
    context.summarizationResult ??
    (
      understanding?.summarization
        ? executeSummarization(
            understanding.summarization,
            context.evidence,
            {
              query: context.query ?? "",
              includeAnalyticalCount:
                /\bhow many\b|\bcount\b/i.test(context.query ?? "")
            }
          )
        : undefined
    );

  if (summarization) {
    context.summarizationResult =
      summarization;
  }

  const answer =
    summarization
      ? formatSummarizationAnswer(summarization)
      : "Summarization: INSUFFICIENT_EVIDENCE. No summarization specification available.";

  const forceNone =
    !summarization ||
    summarization.status === "NOT_SUPPORTED" ||
    summarization.status === "INSUFFICIENT_EVIDENCE";

  const explanation =
    buildAnswerExplanation(answer, context);

  return {

    answer,

    confidence: forceNone ? 0 : 0.5,

    ...(forceNone
      ? {
          confidenceLevel: "NONE" as const,
          confidenceReasons: [
            summarization?.explanation ??
              "summarization evidence insufficient"
          ]
        }
      : {}),

    citations: context.items.map(item => ({
      entityId: item.entityId,
      source: item.source
    })),

    trace: buildTrace(
      {
        evidence: context.evidence,
        comparison: context.comparison
      },
      {
        query: context.query,
        context,
        understanding
      }
    ),

    explanation,

    ...(context.comparison !== undefined
      ? { comparison: context.comparison }
      : {})

  };

}

/**
 * Deterministic analytical answer replacement (P6).
 * Never invents a calculation — only verbalizes executeAnalytical output.
 */
function safeAnalyticalResult(
  context: ReasoningContext
): ReasoningResult {

  const understanding =
    context.understanding ??
    (
      context.query
        ? understandQuery(context.query)
        : undefined
    );

  const analytical =
    context.analyticalResult ??
    (
      understanding?.analytical
        ? executeAnalytical(
            understanding.analytical,
            context.evidence
          )
        : undefined
    );

  if (analytical) {
    context.analyticalResult =
      analytical;
  }

  const answer =
    analytical
      ? formatAnalyticalAnswer(analytical)
      : "Analytical result: INSUFFICIENT_EVIDENCE. No analytical specification available.";

  const forceNone =
    !analytical ||
    analytical.status === "NOT_SUPPORTED" ||
    analytical.status === "INSUFFICIENT_EVIDENCE";

  const explanation =
    buildAnswerExplanation(answer, context);

  return {

    answer,

    confidence: forceNone ? 0 : 0.5,

    ...(forceNone
      ? {
          confidenceLevel: "NONE" as const,
          confidenceReasons: [
            analytical?.explanation ??
              "analytical evidence insufficient"
          ]
        }
      : {}),

    citations: context.items.map(item => ({
      entityId: item.entityId,
      source: item.source
    })),

    trace: buildTrace(
      {
        evidence: context.evidence,
        comparison: context.comparison
      },
      {
        query: context.query,
        context,
        understanding
      }
    ),

    explanation,

    ...(context.comparison !== undefined
      ? { comparison: context.comparison }
      : {})

  };

}

/**
 * Entities found, requested relationship absent.
 * Confidence stays 0 so public confidence cannot imply the missing edge.
 */
function safeRelationshipNotEstablishedResult(
  context: ReasoningContext
): ReasoningResult {

  const answer =
    detectLogicalConclusionQuery(context.query)
      ? buildImplicationGroundedAnswer(context)
      : buildRelationshipNotEstablishedAnswer(context);

  const entityOnlyEvidence =
    evidenceWithoutRelationships(context.evidence);

  const entityContext: ReasoningContext = {
    ...context,
    evidence: entityOnlyEvidence
  };

  const explanation =
    buildAnswerExplanation(answer, entityContext);

  return {

    answer,

    confidence: 0,

    citations: context.items.map(item => ({
      entityId: item.entityId,
      source: item.source
    })),

    trace: buildTrace(
      {
        evidence: entityOnlyEvidence,
        comparison: context.comparison
      },
      {
        query: context.query,
        context
      }
    ),

    explanation,

    ...(context.comparison !== undefined
      ? { comparison: context.comparison }
      : {})

  };

}

/**
 * When generation invents unsupported claims but evidence exists,
 * return grounded facts plus an explicit insufficiency / partial bound.
 * Never invents domain facts. Empty evidence still fail-closes to empty.
 * Confidence is recomputed (partial) — never retains an inflated generator score.
 */
function safePartialGroundedResult(
  context: ReasoningContext
): ReasoningResult {

  const answer =
    buildPartialGroundedAnswer(context);

  const explanation =
    buildAnswerExplanation(answer, context);

  const support =
    classifyRelationalSupport(
      context.query,
      context
    );

  const implication =
    evaluateLogicalImplication(
      context.query,
      context
    );

  /*
   * Intermediate score; withVerificationTrace recalibrates with path + verification.
   */
  const confidence =
    implication.support === "NOT_SUPPORTED" ||
    support.kind === "relationship_missing"
      ? 0
      : 0.5;

  return {

    answer,

    confidence,

    citations: context.items.map(item => ({
      entityId: item.entityId,
      source: item.source
    })),

    trace: buildTrace(
      {
        evidence: context.evidence,
        comparison: context.comparison
      },
      {
        query: context.query,
        context
      }
    ),

    explanation,

    ...(context.comparison !== undefined
      ? { comparison: context.comparison }
      : {})

  };

}

function explanationIsGrounded(

  explanation: AnswerExplanation | undefined,

  context: ReasoningContext

): boolean {

  if (!explanation) {

    return true;

  }

  const allowed =
    new Set(
      context.items.map(
        item =>
          `Grounded on ${item.entityId} from ${item.source}`
      )
    );

  for (const line of explanation.reasoning) {

    if (!line.startsWith("Grounded on ")) {

      continue;

    }

    if (!allowed.has(line)) {

      return false;

    }

  }

  return true;

}

/**
 * Final verification boundary between generated answer/explanation
 * and the public ReasoningResult.
 *
 * Accepts template or natural-language answers only when grounded in
 * ReasoningContext. Invented entity ids / empty-context claims fail closed.
 */
export class DefaultAnswerVerifier
implements AnswerVerifier {

  constructor(

    private readonly citations:
      CitationValidator =
        new DefaultCitationValidator()

  ) {}

  verify(

    input: AnswerVerificationInput

  ): AnswerVerificationOutcome {

    const {
      result,
      context
    } = input;

    const reasons: string[] = [];

    if (!context.understanding && context.query) {
      context.understanding =
        understandQuery(context.query);
    }

    if (context.evidence.length === 0) {

      if (
        result.answer.trim().length > 0 ||
        (result.citations?.length ?? 0) > 0
      ) {

        reasons.push(
          "Answer or citations present without grounded evidence"
        );

        return {

          result:
            safeEmptyResult(),

          report: {

            accepted: false,

            rejectedCitations:
              result.citations ?? [],

            reasons

          }

        };

      }

      const empty =
        safeEmptyResult();

      return {

        result: empty,

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons: []

        }

      };

    }

    const relationalSupport =
      classifyRelationalSupport(
        context.query,
        context
      );

    const implication =
      evaluateLogicalImplication(
        context.query,
        context
      );

    /*
     * Ensure analytical execution is available for ANALYTICAL intents.
     */
    if (
      !context.analyticalResult &&
      (
        context.understanding?.intent === "ANALYTICAL" ||
        (
          context.query &&
          understandQuery(context.query).intent === "ANALYTICAL"
        )
      )
    ) {
      const understanding =
        context.understanding ??
        understandQuery(context.query ?? "");

      context.understanding =
        understanding;

      if (understanding.analytical) {
        context.analyticalResult =
          executeAnalytical(
            understanding.analytical,
            context.evidence
          );
      }
    }

    /*
     * Ensure summarization synthesis is available for SUMMARIZATION intents.
     */
    if (
      !context.summarizationResult &&
      (
        context.understanding?.intent === "SUMMARIZATION" ||
        (
          context.query &&
          understandQuery(context.query).intent === "SUMMARIZATION"
        )
      )
    ) {
      const understanding =
        context.understanding ??
        understandQuery(context.query ?? "");

      context.understanding =
        understanding;

      if (understanding.summarization) {
        context.summarizationResult =
          executeSummarization(
            understanding.summarization,
            context.evidence,
            {
              query: context.query ?? "",
              includeAnalyticalCount:
                /\bhow many\b|\bcount\b/i.test(context.query ?? "")
            }
          );
      }
    }

    const intentVerification =
      verifyAnswerAgainstIntent(
        result.answer,
        context
      );

    /*
     * P7: summarization intents use deterministic synthesis results.
     */
    if (
      context.understanding?.intent === "SUMMARIZATION" ||
      intentVerification.semantics.intent === "SUMMARIZATION"
    ) {

      if (
        !intentVerification.matchesIntent ||
        intentVerification.exceedsEvidence ||
        intentVerification.semantics.status === "NOT_SUPPORTED" ||
        intentVerification.semantics.status === "PARTIALLY_SUPPORTED"
      ) {

        reasons.push(
          ...intentVerification.semantics.reasons
        );

        const replacement =
          safeSummarizationResult(context);

        return {

          result:
            withVerificationTrace(
              replacement,
              context,
              intentVerification,
              [
                `Verification: ${intentVerification.semantics.status} — summarization answer constrained`
              ]
            ),

          report: {

            accepted: true,

            rejectedCitations: [],

            reasons

          }

        };

      }

      const verifiedSummary =
        withVerificationTrace(
          {
            ...result,
            answer:
              context.summarizationResult
                ? formatSummarizationAnswer(context.summarizationResult)
                : result.answer,
            confidence: 1
          },
          context,
          intentVerification,
          [
            "Verification: SUPPORTED — summarization answer accepted"
          ]
        );

      return {

        result: verifiedSummary,

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    /*
     * P6: analytical intents use deterministic analytical results, not
     * relational fail-closed replacement paths.
     */
    if (
      context.understanding?.intent === "ANALYTICAL" ||
      intentVerification.semantics.intent === "ANALYTICAL"
    ) {

      if (
        !intentVerification.matchesIntent ||
        intentVerification.exceedsEvidence ||
        intentVerification.semantics.status === "NOT_SUPPORTED" ||
        intentVerification.semantics.status === "PARTIALLY_SUPPORTED"
      ) {

        reasons.push(
          ...intentVerification.semantics.reasons
        );

        const replacement =
          safeAnalyticalResult(context);

        /*
         * Re-verify the deterministic analytical rendering. Do not inherit
         * the generator's contradiction status onto a valid AnalyticalResult.
         */
        const replacementVerification =
          verifyAnswerAgainstIntent(
            replacement.answer,
            context
          );

        const constrainedSupported =
          replacementVerification.semantics.status === "SUPPORTED" &&
          context.analyticalResult?.status === "SUPPORTED";

        return {

          result:
            withVerificationTrace(
              {
                ...replacement,
                confidence:
                  replacementVerification.semantics.status === "NOT_SUPPORTED" ||
                  context.analyticalResult?.status === "NOT_SUPPORTED" ||
                  context.analyticalResult?.status === "INSUFFICIENT_EVIDENCE"
                    ? 0
                    : replacementVerification.semantics.status === "PARTIALLY_SUPPORTED"
                      ? Math.min(replacement.confidence, 0.5)
                      : Math.max(replacement.confidence, 0.5)
              },
              context,
              replacementVerification,
              [
                replacementVerification.semantics.status === "SUPPORTED"
                  ? "Verification: SUPPORTED — analytical answer constrained to deterministic result"
                  : `Verification: ${replacementVerification.semantics.status} — analytical answer constrained`
              ]
            ),

          report: {

            accepted: true,

            rejectedCitations: [],

            /*
             * Do not surface stale generator contradiction reasons once the
             * deterministic AnalyticalResult replacement verifies as SUPPORTED.
             */
            reasons:
              constrainedSupported
                ? []
                : reasons

          }

        };

      }

      /*
       * Analytical answer accepted when it matches the deterministic result.
       */
      const verifiedAnalytical =
        withVerificationTrace(
          {
            ...result,
            answer:
              context.analyticalResult
                ? formatAnalyticalAnswer(context.analyticalResult)
                : result.answer,
            confidence: 1
          },
          context,
          intentVerification,
          [
            "Verification: SUPPORTED — analytical answer accepted"
          ]
        );

      return {

        result: verifiedAnalytical,

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    if (implication.support === "NOT_SUPPORTED") {

      reasons.push(
        "Requested logical conclusion is not supported by grounded evidence"
      );

      return {

        result:
          withVerificationTrace(
            safeRelationshipNotEstablishedResult(
              context
            ),
            context,
            intentVerification,
            [
              "Verification: NOT_SUPPORTED — final response constrained to fail-closed"
            ]
          ),

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    if (implication.support === "PARTIALLY_SUPPORTED") {

      reasons.push(
        "Requested logical conclusion is only partially supported by grounded evidence"
      );

      return {

        result:
          withVerificationTrace(
            safePartialGroundedResult(
              context
            ),
            context,
            intentVerification,
            [
              "Verification: PARTIALLY_SUPPORTED — final response constrained to supported claim"
            ]
          ),

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    if (implication.support === "SUPPORTED") {

      reasons.push(
        "Requested logical conclusion is supported by grounded evidence"
      );

      return {

        result:
          withVerificationTrace(
            safePartialGroundedResult(
              context
            ),
            context,
            intentVerification,
            [
              "Verification: SUPPORTED — implication answer constrained to evidence"
            ]
          ),

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    if (
      relationalSupport.kind === "relationship_missing"
    ) {

      reasons.push(
        "Requested relationship is not established by grounded evidence"
      );

      return {

        result:
          withVerificationTrace(
            safeRelationshipNotEstablishedResult(
              context
            ),
            context,
            intentVerification,
            [
              "Verification: NOT_SUPPORTED — relationship not established"
            ]
          ),

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    if (relationalSupport.kind === "partial") {

      reasons.push(
        "Only part of the requested relational claims are established"
      );

      return {

        result:
          withVerificationTrace(
            safePartialGroundedResult(
              context
            ),
            context,
            intentVerification,
            [
              "Verification: PARTIALLY_SUPPORTED — compound/relational answer constrained"
            ]
          ),

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    /*
     * Intent / claim-strength gate: true-but-weaker or stronger-than-evidence
     * answers cannot pass even when token-grounded.
     */
    if (
      !intentVerification.matchesIntent ||
      intentVerification.exceedsEvidence
    ) {

      reasons.push(
        ...intentVerification.semantics.reasons
      );

      const replacement =
        intentVerification.semantics.status === "NOT_SUPPORTED"
          ? safeRelationshipNotEstablishedResult(context)
          : safePartialGroundedResult(context);

      return {

        result:
          withVerificationTrace(
            replacement,
            context,
            intentVerification
          ),

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    if (
      !isGeneratedAnswerGrounded(
        result.answer,
        context
      )
    ) {

      reasons.push(
        "Answer claims are not grounded in the verified context; replaced with grounded partial answer"
      );

      /*
       * For non-relational asks, do not synthesize unrelated relationship
       * prose as a "partial" answer — fail closed / identity+insufficiency.
       */
      const replacement =
        relationalSupport.kind === "not_relational"
          ? safeRelationshipNotEstablishedResult(context)
          : safePartialGroundedResult(context);

      return {

        result:
          withVerificationTrace(
            replacement,
            context,
            intentVerification,
            [
              "Verification: answer claims not grounded"
            ]
          ),

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    const unsupportedCausal =
      detectUnsupportedCausalRemainder(
        context.query,
        context
      );

    if (
      unsupportedCausal &&
      !/does not establish/i.test(result.answer)
    ) {

      reasons.push(
        "Unsupported causal remainder bounded by grounded evidence"
      );

      return {

        result:
          withVerificationTrace(
            safePartialGroundedResult(
              context
            ),
            context,
            intentVerification,
            [
              "Verification: PARTIALLY_SUPPORTED — unsupported causal remainder bounded"
            ]
          ),

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    if (
      !causalClaimsAreGrounded(
        result.answer,
        context
      )
    ) {

      reasons.push(
        "Causal claims are not supported by relationship evidence; replaced with grounded partial answer"
      );

      return {

        result:
          withVerificationTrace(
            safePartialGroundedResult(
              context
            ),
            context,
            intentVerification,
            [
              "Verification: causal language exceeded evidence"
            ]
          ),

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    if (
      !relationshipAttributionIsGrounded(
        result.answer,
        context
      )
    ) {

      reasons.push(
        "Relationship attribution does not match grounded edge direction; replaced with grounded partial answer"
      );

      return {

        result:
          withVerificationTrace(
            safePartialGroundedResult(
              context
            ),
            context,
            intentVerification,
            [
              "Verification: relationship attribution mismatch"
            ]
          ),

        report: {

          accepted: true,

          rejectedCitations: [],

          reasons

        }

      };

    }

    if (
      result.comparison !== undefined &&
      result.comparison !== context.comparison
    ) {

      reasons.push(
        "Comparison field is not grounded in the verified context"
      );

      return {

        result:
          safeEmptyResult(),

        report: {

          accepted: false,

          rejectedCitations:
            result.citations ?? [],

          reasons

        }

      };

    }

    const citationCheck =
      this.citations.validate(

        result.citations ?? [],

        context

      );

    if (citationCheck.rejected.length > 0) {

      reasons.push(
        `Rejected ${citationCheck.rejected.length} unverifiable citation(s)`
      );

    }

    if (
      !explanationIsGrounded(
        input.explanation,
        context
      )
    ) {

      reasons.push(
        "Explanation provenance references evidence outside the verified context"
      );

      return {

        result:
          safeEmptyResult(),

        report: {

          accepted: false,

          rejectedCitations:
            citationCheck.rejected,

          reasons

        }

      };

    }

    const explanation =
      input.explanation &&
      explanationIsGrounded(
        input.explanation,
        context
      )
        ? {
            ...input.explanation,
            answer: result.answer
          }
        : buildAnswerExplanation(
            result.answer,
            context
          );

    const verified: ReasoningResult = withVerificationTrace(
      {

        answer:
          result.answer,

        /*
         * Placeholder; withVerificationTrace applies calibrated confidence.
         */
        confidence: 1,

        citations:
          citationCheck.valid,

        trace: buildTrace(
          {

            evidence:
              context.evidence,

            comparison:
              context.comparison

          },
          {
            query: context.query,
            context
          }
        ),

        explanation

      },
      context,
      intentVerification,
      [
        "Verification: SUPPORTED — answer accepted"
      ]
    );

    if (context.comparison !== undefined) {

      verified.comparison =
        context.comparison;

    }

    const report: AnswerVerificationReport = {

      accepted: true,

      rejectedCitations:
        citationCheck.rejected,

      reasons

    };

    return {

      result: verified,

      report

    };

  }

}
