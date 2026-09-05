import type {
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
  buildPartialGroundedAnswer
} from "../utils/build-partial-grounded-answer.js";

import {
  isGeneratedAnswerGrounded
} from "../utils/is-generated-answer-grounded.js";

import {
  causalClaimsAreGrounded,
  relationalQueryIsSupported
} from "../utils/relational-claim-grounding.js";

import {
  computeGroundedAnswerConfidence,
  computePartialGroundedConfidence
} from "../utils/compute-grounded-confidence.js";

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

    citations: [],

    trace: {
      steps: []
    },

    explanation

  };

}

/**
 * When generation invents unsupported claims but evidence exists,
 * return grounded facts plus an explicit insufficiency clause.
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

  const confidence =
    computePartialGroundedConfidence({
      evidence: context.evidence,
      ...(context.comparison !== undefined
        ? { comparison: context.comparison }
        : {})
    });

  return {

    answer,

    confidence,

    citations: context.items.map(item => ({
      entityId: item.entityId,
      source: item.source
    })),

    trace: buildTrace({
      evidence: context.evidence,
      comparison: context.comparison
    }),

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

    if (
      !relationalQueryIsSupported(
        context.query,
        context
      )
    ) {

      reasons.push(
        "Relational or causal query lacks relationship-backed evidence"
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

    if (
      !isGeneratedAnswerGrounded(
        result.answer,
        context
      )
    ) {

      reasons.push(
        "Answer claims are not grounded in the verified context; replaced with grounded partial answer"
      );

      return {

        result:
          safePartialGroundedResult(
            context
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
          safePartialGroundedResult(
            context
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

    const verified: ReasoningResult = {

      answer:
        result.answer,

      confidence:
        computeGroundedAnswerConfidence({
          evidence: context.evidence,
          ...(context.comparison !== undefined
            ? { comparison: context.comparison }
            : {})
        }),

      citations:
        citationCheck.valid,

      trace: buildTrace({

        evidence:
          context.evidence,

        comparison:
          context.comparison

      }),

      explanation

    };

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
