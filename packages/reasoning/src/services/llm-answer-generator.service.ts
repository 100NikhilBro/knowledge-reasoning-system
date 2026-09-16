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

import {
  buildStructuredAnswerContext,
  selectAnswerEvidence
} from "../utils/select-answer-evidence.js";

import {
  understandQuery
} from "../utils/query-understanding.js";

import {
  buildPartialGroundedAnswer
} from "../utils/build-partial-grounded-answer.js";

import {
  relationshipAttributionIsGrounded
} from "../utils/relationship-attribution.js";

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

    if (!context.understanding && context.query) {
      context.understanding =
        understandQuery(context.query);
    }

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

    const answer =
      enforceRelationalGenerationContract(
        generation.answer,
        context
      );

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
      answer,
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

/**
 * RELATIONSHIP-family asks require an attributable S-P-O verbalization.
 * Entity-only LLM answers (e.g. target name alone) violate that contract;
 * substitute the existing deterministic grounded synthesis instead of
 * weakening attribution verification.
 */
function enforceRelationalGenerationContract(
  answer: string,
  context: ReasoningContext
): string {

  if (!requiresRelationalAnswer(context)) {
    return answer;
  }

  if (relationshipAttributionIsGrounded(answer, context)) {
    return answer;
  }

  const grounded =
    buildPartialGroundedAnswer(context).trim();

  return grounded.length > 0
    ? grounded
    : answer;

}

function requiresRelationalAnswer(
  context: ReasoningContext
): boolean {

  const understanding =
    context.understanding ??
    (context.query
      ? understandQuery(context.query)
      : undefined);

  if (!understanding) {
    return false;
  }

  if (understanding.requireTypedEdge) {
    return true;
  }

  return (
    understanding.intent === "RELATIONSHIP" ||
    understanding.intent === "DIRECT_RELATIONSHIP" ||
    understanding.intent === "CONNECTED_RELATIONSHIP" ||
    understanding.intent === "BRIDGE_RELATIONSHIP" ||
    understanding.intent === "COMPOUND"
  );

}
