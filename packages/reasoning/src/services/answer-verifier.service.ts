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
 * Keep entity provenance but drop edge attachments so a missing
 * requested relation cannot be visualized via unrelated edges.
 */
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

/**
 * Entities found, requested relationship absent.
 * Confidence stays 0 so public confidence cannot imply the missing edge.
 */
function safeRelationshipNotEstablishedResult(
  context: ReasoningContext
): ReasoningResult {

  const answer =
    buildRelationshipNotEstablishedAnswer(context);

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

    trace: buildTrace({
      evidence: entityOnlyEvidence,
      comparison: context.comparison
    }),

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

  const confidence =
    support.kind === "relationship_missing"
      ? 0
      : computePartialGroundedConfidence({
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

    const relationalSupport =
      classifyRelationalSupport(
        context.query,
        context
      );

    if (
      relationalSupport.kind === "relationship_missing"
    ) {

      reasons.push(
        "Requested relationship is not established by grounded evidence"
      );

      return {

        result:
          safeRelationshipNotEstablishedResult(
            context
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
