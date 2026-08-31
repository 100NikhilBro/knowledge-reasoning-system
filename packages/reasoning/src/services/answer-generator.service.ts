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

    const evidenceSet = {

      evidence:
        context.evidence,

      comparison:
        context.comparison

    };

    const answer =

      context.comparison ??

      context.items
        .map(
          item =>
            `${item.entityType}: ${item.label}`
        )
        .join("\n");

    const confidence =

      await this.confidence.calculate(

        evidenceSet

      );

    const citations =

      await this.citations.build(

        evidenceSet

      );

    return {

      answer,

      comparison:
        context.comparison,

      confidence,

      citations,

      trace: buildTrace(

        evidenceSet

      )

    };

  }

}
