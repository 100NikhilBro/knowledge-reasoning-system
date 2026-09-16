import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  Evidence,
  KnowledgeEntity,
  KnowledgeRelationship
} from "@knowledge/shared";

import type {
  LlmProvider
} from "../src/contracts/llm-provider.js";

import {
  LlmAnswerGenerator
} from "../src/services/llm-answer-generator.service.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  buildStructuredAnswerContext,
  selectAnswerEvidence
} from "../src/utils/select-answer-evidence.js";

import {
  relationshipAttributionIsGrounded
} from "../src/utils/relationship-attribution.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

/**
 * Step 7 — generation/verification contract: RELATIONSHIP answers must be
 * attributable. Entity-only LLM output is rewritten via grounded synthesis
 * before verification — attribution rules stay strict.
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

function mockLlm(
  answer: string
): LlmProvider {
  return {
    id: "mock",
    model: "mock",
    generate: vi.fn(async () => ({
      answer,
      citedEntityIds: []
    }))
  };
}

describe("relational generation contract (Step 7)", () => {

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

  const foreign =
    entity("proposal:foreign", "Proposal", "Foreign Proposal", {
      pep: "999",
      title: "Foreign Proposal"
    });

  it("Who proposed PEP-484? — entity-only LLM answer becomes attributable and SUPPORTED", async () => {
    const query =
      "Who proposed PEP-484?";

    const bag: Evidence[] = [
      evidenceOf(
        proposal,
        rel(proposal.id, author.id, "PROPOSED_BY")
      ),
      evidenceOf(proposal),
      evidenceOf(author)
    ];

    const context =
      ctx(query, bag);

    expect(context.understanding?.intent).toBe("RELATIONSHIP");

    const generator =
      new LlmAnswerGenerator(
        mockLlm("Guido van Rossum")
      );

    const generated =
      await generator.generate(context);

    expect(generated.answer).not.toBe("Guido van Rossum");
    expect(
      relationshipAttributionIsGrounded(
        generated.answer,
        context
      )
    ).toBe(true);

    const verified =
      new DefaultAnswerVerifier().verify({
        result: generated,
        context
      });

    expect(
      verified.result.trace.meta?.verificationStatus
    ).toBe("SUPPORTED");
    expect(verified.result.confidence).toBeGreaterThan(0);
  });

  it("unsupported who-proposed relationship remains NOT_SUPPORTED", async () => {
    const query =
      "Who proposed Foreign Proposal?";

    /*
     * Foreign proposal present without PROPOSED_BY — no attested author edge.
     */
    const bag: Evidence[] = [
      evidenceOf(foreign),
      evidenceOf(author),
      evidenceOf(
        proposal,
        rel(proposal.id, author.id, "PROPOSED_BY")
      )
    ];

    const context =
      ctx(query, bag);

    const generator =
      new LlmAnswerGenerator(
        mockLlm("Guido van Rossum")
      );

    const generated =
      await generator.generate(context);

    const verified =
      new DefaultAnswerVerifier().verify({
        result: generated,
        context
      });

    expect(
      verified.result.trace.meta?.verificationStatus
    ).not.toBe("SUPPORTED");
  });

  it("keeps a valid relationship LLM answer without rewriting", async () => {
    const query =
      "Who proposed PEP-484?";

    const bag: Evidence[] = [
      evidenceOf(
        proposal,
        rel(proposal.id, author.id, "PROPOSED_BY")
      ),
      evidenceOf(proposal),
      evidenceOf(author)
    ];

    const context =
      ctx(query, bag);

    const valid =
      "Type Hints was proposed by Guido van Rossum.";

    const generated =
      await new LlmAnswerGenerator(mockLlm(valid))
        .generate(context);

    expect(generated.answer).toBe(valid);

    const verified =
      new DefaultAnswerVerifier().verify({
        result: generated,
        context
      });

    expect(
      verified.result.trace.meta?.verificationStatus
    ).toBe("SUPPORTED");
  });

});
