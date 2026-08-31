import type {
  Citation,
  ReasoningResult
} from "@knowledge/shared";

import type { AnswerGenerator } from "../contracts/answer-generator.js";
import type { LlmProvider } from "../contracts/llm-provider.js";

import type { ReasoningContext } from "../types/reasoning-context.js";

import {
  GROUNDING_SYSTEM_PROMPT,
  serializeGroundedContextForLlm
} from "../llm/build-grounding-prompt.js";

import { buildTrace } from "../utils/trace-builder.js";

import { DefaultConfidenceEngine } from "./confidence-engine.service.js";
import { DefaultCitationBuilder } from "./citation-builder.service.js";
import { DefaultAnswerGenerator } from "./answer-generator.service.js";

/**
 * LLM-backed answer generator.
 *
 * Uses only ReasoningContext as knowledge. Citations/trace/confidence remain
 * derived from grounded evidence. Verification remains the final authority.
 */
export class LlmAnswerGenerator
  implements AnswerGenerator {

  private readonly templateFallback =
    new DefaultAnswerGenerator();

  constructor(

    private readonly llm: LlmProvider,

    private readonly confidence =
      new DefaultConfidenceEngine(),

    private readonly citations =
      new DefaultCitationBuilder()

  ) {}

  async generate(
    context: ReasoningContext
  ): Promise<ReasoningResult> {

    const evidenceSet = {
      evidence: context.evidence,
      comparison: context.comparison
    };

    if (context.evidence.length === 0) {
      return {
        answer: "",
        confidence: 0,
        citations: [],
        trace: buildTrace(evidenceSet),
        ...(context.comparison !== undefined
          ? { comparison: context.comparison }
          : {})
      };
    }

    /*
     * Preserve deterministic comparison summaries without an LLM rewrite.
     */
    if (context.comparison !== undefined) {
      return this.templateFallback.generate(context);
    }

    const query =
      context.query?.trim() ||
      "Answer from the grounded evidence.";

    const generation =
      await this.llm.generate({
        query,
        groundedContextJson:
          serializeGroundedContextForLlm(
            context,
            query
          ),
        systemPrompt: GROUNDING_SYSTEM_PROMPT
      });

    const confidence =
      await this.confidence.calculate(
        evidenceSet
      );

    const citations =
      await this.selectCitations(
        context,
        generation.citedEntityIds
      );

    return {
      answer: generation.answer,
      confidence,
      citations,
      trace: buildTrace(evidenceSet)
    };

  }

  private async selectCitations(
    context: ReasoningContext,
    citedEntityIds: string[] | undefined
  ): Promise<Citation[]> {

    const all =
      await this.citations.build({
        evidence: context.evidence
      });

    if (
      !citedEntityIds ||
      citedEntityIds.length === 0
    ) {
      return all;
    }

    const allowed =
      new Set(
        context.items.map(item => item.entityId)
      );

    const requested =
      citedEntityIds.filter(id =>
        allowed.has(id)
      );

    if (requested.length === 0) {
      return all;
    }

    const byId =
      new Map(
        all.map(citation => [
          citation.entityId,
          citation
        ])
      );

    return requested
      .map(id => byId.get(id))
      .filter(
        (citation): citation is Citation =>
          citation !== undefined
      );

  }

}
