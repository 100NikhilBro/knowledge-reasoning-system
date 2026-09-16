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
  executeAnalytical,
  formatAnalyticalAnswer
} from "../src/utils/execute-analytical.js";

import {
  verifyAnswerAgainstIntent
} from "../src/utils/answer-intent-verification.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import type {
  ReasoningContext
} from "../src/types/reasoning-context.js";

function entity(
  id: string,
  type: string,
  label: string,
  properties: Record<string, unknown> = {},
  source = "pep-484.md"
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source,
    confidence: 1,
    properties
  };
}

function rel(
  type: string,
  from: string,
  to: string
): KnowledgeRelationship {
  return {
    type,
    from,
    to,
    confidence: 1,
    properties: {}
  };
}

function ev(
  e: KnowledgeEntity,
  score: number,
  relationship?: KnowledgeRelationship
): Evidence {
  return {
    entity: e,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

const pep484 = entity("proposal:PEP-484", "Proposal", "Type Hints", { pep: "484" });
const pep526 = entity("proposal:PEP-526", "Proposal", "Variable Annotations", { pep: "526" }, "pep-526.md");
const pep544 = entity("proposal:PEP-544", "Proposal", "Protocols", { pep: "544" }, "pep-544.md");
const pep604 = entity("proposal:PEP-604", "Proposal", "Union X | Y", { pep: "604" }, "pep-604.md");
const typing = entity("feature:typing", "Feature", "Typing", { name: "Typing" });

const intro484 = rel("INTRODUCES", pep484.id, typing.id);
const intro526 = rel("INTRODUCES", pep526.id, typing.id);
const intro544 = rel("INTRODUCES", pep544.id, typing.id);
const intro604 = rel("INTRODUCES", pep604.id, typing.id);

const typingUniverse: Evidence[] = [
  ev(pep484, 0.95, intro484),
  ev(typing, 0.9, intro484),
  ev(pep526, 0.9, intro526),
  ev(typing, 0.85, intro526),
  ev(pep544, 0.8, intro544),
  ev(typing, 0.8, intro544),
  ev(pep604, 0.8, intro604),
  ev(typing, 0.8, intro604)
];

function ctx(
  query: string,
  evidence: Evidence[]
): ReasoningContext {
  const understanding =
    understandQuery(query);

  const analyticalResult =
    understanding.intent === "ANALYTICAL" &&
    understanding.analytical
      ? executeAnalytical(understanding.analytical, evidence)
      : undefined;

  return {
    query,
    understanding,
    evidence,
    ...(analyticalResult
      ? { analyticalResult }
      : {}),
    items: evidence.map(item => ({
      entityId: item.entity.id,
      entityType: item.entity.type,
      label: item.entity.label,
      source: item.entity.source,
      confidence: item.entity.confidence,
      score: item.score,
      evidenceSource: item.source,
      properties: item.entity.properties,
      ...(item.relationship
        ? { relationship: item.relationship }
        : {})
    })),
    budget: {
      maxEvidence: evidence.length,
      inputCount: evidence.length,
      retainedCount: evidence.length,
      truncated: false
    }
  };
}

describe("Prompt 2.1 — analytical verification mismatch", () => {

  const verifier =
    new DefaultAnswerVerifier();

  it("supported COUNT + LIST analytical result is accepted", () => {
    const query =
      "How many of the four PEPs in the knowledge base introduce Typing, and which PEPs are they?";

    const context =
      ctx(query, typingUniverse);

    expect(context.analyticalResult?.status).toBe("SUPPORTED");
    expect(context.analyticalResult?.value).toBe(4);

    const naturalAnswer =
      "There are 4 PEPs that introduce Typing: PEP-484, PEP-526, PEP-544, and PEP-604.";

    const check =
      verifyAnswerAgainstIntent(naturalAnswer, context);

    expect(check.semantics.status).toBe("SUPPORTED");
    expect(check.matchesIntent).toBe(true);

    const outcome =
      verifier.verify({
        result: {
          answer: naturalAnswer,
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.answer).toMatch(/4|PEP-484/i);
    expect(
      outcome.result.trace.steps.some(step =>
        /Verification:.*SUPPORTED/i.test(step.description)
      )
    ).toBe(true);
  });

  it("supported COUNT + empty complement is accepted", () => {
    const query =
      "How many PEPs introduce Typing, and which PEPs do not?";

    const context =
      ctx(query, typingUniverse);

    expect(context.analyticalResult?.status).toBe("SUPPORTED");
    expect(context.analyticalResult?.value).toBe(4);
    expect(context.analyticalResult?.nonMatchingEntities).toEqual([]);

    const deterministic =
      formatAnalyticalAnswer(context.analyticalResult!);

    const check =
      verifyAnswerAgainstIntent(deterministic, context);

    expect(check.semantics.status).toBe("SUPPORTED");

    const naturalAnswer =
      "All four PEPs introduce Typing (PEP-484, PEP-526, PEP-544, PEP-604). Non-matching: (none).";

    expect(
      verifyAnswerAgainstIntent(naturalAnswer, context).semantics.status
    ).toBe("SUPPORTED");

    const outcome =
      verifier.verify({
        result: {
          answer:
            "All PEPs introduce Typing: PEP-484, PEP-526, PEP-544, PEP-604.",
          confidence: 0.95,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    /*
     * Generator omitted complement → constrained replacement should still
     * surface a supported deterministic analytical answer with non-zero confidence.
     */
    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.answer).toMatch(/Non-matching|Universe/i);
  });

  it("wrong count is rejected", () => {
    const query =
      "How many PEPs introduce Typing?";

    const context =
      ctx(query, typingUniverse);

    const check =
      verifyAnswerAgainstIntent(
        "There are 2 PEPs that introduce Typing.",
        context
      );

    expect(check.semantics.status).toBe("NOT_SUPPORTED");
  });

  it("wrong list entity is rejected", () => {
    const query =
      "Which PEPs introduce Typing?";

    const context =
      ctx(query, typingUniverse);

    const check =
      verifyAnswerAgainstIntent(
        "PEP-999 introduces Typing.",
        context
      );

    expect(check.semantics.status).toBe("NOT_SUPPORTED");
  });

  it("wrong target remains fail-closed under verification", () => {
    const query =
      "How many PEPs introduce a feature called DistributedComputing, and which?";

    const context =
      ctx(query, typingUniverse);

    const check =
      verifyAnswerAgainstIntent(
        "Count of distinct PEPs: 4. Matched: PEP-484, PEP-526, PEP-544, PEP-604.",
        context
      );

    expect(check.semantics.status).toBe("NOT_SUPPORTED");
  });

  it("omitted complement is PARTIALLY_SUPPORTED", () => {
    const query =
      "How many PEPs introduce Typing, and which PEPs do not?";

    const context =
      ctx(query, typingUniverse);

    const check =
      verifyAnswerAgainstIntent(
        "Count of distinct PEPs in current grounded corpus: 4. Matched canonical IDs: [proposal:PEP-484, proposal:PEP-526, proposal:PEP-544, proposal:PEP-604].",
        context
      );

    expect(check.semantics.status).toBe("PARTIALLY_SUPPORTED");
  });

  it("unsupported analytical result remains fail-closed", () => {
    const query =
      "What is the average number of authors per PEP?";

    const context =
      ctx(query, typingUniverse);

    expect(context.analyticalResult?.status).toBe("NOT_SUPPORTED");

    const outcome =
      verifier.verify({
        result: {
          answer: "The average is 2.5 authors per PEP.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toMatch(/NOT_SUPPORTED|Analytical result/i);
  });

  it("PEP identifiers in a correct answer do not falsely contradict the count", () => {
    const query =
      "How many PEPs introduce Typing, and which PEPs are they?";

    const context =
      ctx(query, typingUniverse);

    const listOnly =
      "The PEPs are PEP-484, PEP-526, PEP-544, and PEP-604.";

    expect(
      verifyAnswerAgainstIntent(listOnly, context).semantics.status
    ).toBe("SUPPORTED");
  });

});
