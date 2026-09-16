import {
  describe,
  expect,
  it
} from "vitest";

import type {
  Evidence,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import {
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  buildStructuredAnswerContext,
  selectAnswerEvidence
} from "../src/utils/select-answer-evidence.js";

import {
  buildPartialGroundedAnswer
} from "../src/utils/build-partial-grounded-answer.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

/**
 * Diagnostic instrumentation: original LLM answer preserved in trace.meta
 * when attribution runs; fallback behavior unchanged on failure.
 */

function entity(
  id: string,
  type: string,
  label: string,
  properties: Record<string, unknown> = {}
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source: "fixture.md",
    confidence: 1,
    properties
  };
}

function rel(
  from: string,
  to: string,
  type: string
): KnowledgeRelationship {
  return {
    from,
    to,
    type,
    confidence: 1,
    properties: {}
  };
}

function evidenceOf(
  node: KnowledgeEntity,
  relationship?: KnowledgeRelationship,
  score = 0.95
): Evidence {
  return {
    entity: node,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

function ctx(
  query: string,
  bag: Evidence[]
): ReasoningContext {
  const understanding =
    understandQuery(query);

  const selected =
    selectAnswerEvidence(understanding, bag);

  return {
    query,
    understanding,
    answerContext:
      buildStructuredAnswerContext(understanding, selected),
    evidence: selected,
    items: selected.map(item => ({
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
        : {})
    })),
    budget: {
      maxEvidence: 50,
      inputCount: bag.length,
      retainedCount: selected.length,
      truncated: false
    },
    config: { maxEvidence: 50 }
  };
}

describe("attribution diagnostics instrumentation", () => {

  const proposal =
    entity("proposal:PEP-484", "Proposal", "Type Hints", {
      pep: "484",
      title: "Type Hints"
    });

  const author =
    entity(
      "author:guido-van-rossum",
      "Author",
      "Guido van Rossum"
    );

  const bag: Evidence[] = [
    evidenceOf(
      proposal,
      rel(proposal.id, author.id, "PROPOSED_BY")
    ),
    evidenceOf(proposal),
    evidenceOf(author)
  ];

  const query =
    "Who proposed PEP-484?";

  it("preserves original answer in trace when attribution fails and keeps fallback", () => {
    const context =
      ctx(query, bag);

    const original =
      "Type Hints PROPOSED_BY Guido van Rossum";

    const expectedFallback =
      buildPartialGroundedAnswer(context);

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer: original,
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    const diagnostics =
      outcome.result.trace.meta?.attributionDiagnostics;

    expect(diagnostics).toBeDefined();
    expect(diagnostics?.originalAnswerBeforeVerification)
      .toBe(original);
    expect(diagnostics?.attributionResult).toBe(false);
    expect(diagnostics?.finalAnswerAfterVerification)
      .toBe(expectedFallback);
    expect(diagnostics?.finalVerificationStatus)
      .toBe("NOT_SUPPORTED");

    expect(outcome.result.answer).toBe(expectedFallback);
    expect(outcome.result.trace.meta?.verificationStatus)
      .toBe("NOT_SUPPORTED");
    expect(outcome.result.answer).not.toBe(original);
  });

  it("preserves original answer when attribution passes (no fallback)", () => {
    const context =
      ctx(query, bag);

    const original =
      "Type Hints was proposed by Guido van Rossum.";

    const outcome =
      new DefaultAnswerVerifier().verify({
        result: {
          answer: original,
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    const diagnostics =
      outcome.result.trace.meta?.attributionDiagnostics;

    expect(diagnostics).toBeDefined();
    expect(diagnostics?.originalAnswerBeforeVerification)
      .toBe(original);
    expect(diagnostics?.attributionResult).toBe(true);
    expect(diagnostics?.finalAnswerAfterVerification)
      .toBe(original);
    expect(outcome.result.answer).toBe(original);
    expect(outcome.result.trace.meta?.verificationStatus)
      .toBe("SUPPORTED");
  });

});
