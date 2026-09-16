import type {
  ReasoningResult
} from "@knowledge/shared";

import type {
  ReasoningContext
} from "../types/reasoning-context.js";

import {
  buildTrace
} from "../utils/trace-builder.js";

import type {
  AnswerGenerator
} from "../contracts/answer-generator.js";

import {
  DefaultConfidenceEngine
} from "./confidence-engine.service.js";

import {
  DefaultCitationBuilder
} from "./citation-builder.service.js";

import {
  calibrateAnswerConfidence
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
  buildPartialGroundedAnswer
} from "../utils/build-partial-grounded-answer.js";

import {
  buildStructuredAnswerContext,
  selectAnswerEvidence
} from "../utils/select-answer-evidence.js";

/**
 * Deterministic / template-based answer generator.
 * Answers are produced only from the supplied grounded ReasoningContext.
 */
export class DefaultAnswerGenerator
implements AnswerGenerator {

  constructor(

    private readonly confidence =
      new DefaultConfidenceEngine(),

    private readonly citations =
      new DefaultCitationBuilder()

  ) {}

  async generate(

    context: ReasoningContext

  ): Promise<ReasoningResult> {

    if (
      !context.analyticalResult &&
      context.understanding?.intent === "ANALYTICAL" &&
      context.understanding.analytical
    ) {
      context.analyticalResult =
        executeAnalytical(
          context.understanding.analytical,
          context.evidence
        );
    }

    if (
      !context.summarizationResult &&
      context.understanding?.intent === "SUMMARIZATION" &&
      context.understanding.summarization
    ) {
      const queryText =
        context.query ?? "";

      context.summarizationResult =
        executeSummarization(
          context.understanding.summarization,
          context.evidence,
          {
            query: queryText,
            includeAnalyticalCount:
              /\bhow many\b|\bcount\b/i.test(queryText)
          }
        );
    }

    const evidenceSet = {

      evidence:
        context.evidence,

      ...(context.comparison !== undefined
        ? { comparison: context.comparison }
        : {})

    };

    if (
      !context.answerContext &&
      context.understanding
    ) {
      const scoped =
        selectAnswerEvidence(
          context.understanding,
          context.evidence
        );

      context.answerContext =
        buildStructuredAnswerContext(
          context.understanding,
          scoped
        );

      /*
       * Keep generator evidence aligned with structured answer scope —
       * never reintroduce broader candidate evidence here.
       */
      context.evidence =
        scoped;

      context.items =
        scoped.map(item => ({
          entityId: item.entity.id,
          entityType: item.entity.type,
          label: item.entity.label,
          source: item.entity.source,
          confidence: item.entity.confidence,
          score: item.score,
          evidenceSource: item.source,
          properties: item.entity.properties ?? {},
          ...(item.relationship
            ? { relationship: item.relationship }
            : {}),
          ...(item.path ? { path: item.path } : {})
        }));
    }

    const natural =
      context.comparison ??
      buildPartialGroundedAnswer(context);

    const answer =
      context.summarizationResult
        ? formatSummarizationAnswer(context.summarizationResult)
        : context.analyticalResult
          ? formatAnalyticalAnswer(context.analyticalResult)
          : natural.trim().length > 0
            ? natural
            : context.items
                .map(
                  item =>
                    `${item.entityType}: ${item.label}`
                )
                .join("\n");

    const calibrated =
      calibrateAnswerConfidence({
        evidenceSet,
        intent: context.understanding?.intent,
        analyticalStatus:
          context.analyticalResult?.status,
        summarizationStatus:
          context.summarizationResult?.status
      });

    await this.confidence.calculate(evidenceSet);

    const citations =
      await this.citations.build(evidenceSet);

    return {

      answer,

      comparison:
        context.comparison,

      confidence: calibrated.score,

      confidenceLevel: calibrated.level,

      confidenceReasons: calibrated.reasons,

      citations,

      trace: buildTrace(
        evidenceSet,
        {
          query: context.query,
          context,
          understanding: context.understanding,
          calibratedConfidence: calibrated
        }
      )

    };

  }

}
