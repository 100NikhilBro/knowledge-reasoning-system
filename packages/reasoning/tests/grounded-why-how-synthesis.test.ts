import {
  describe,
  expect,
  it
} from "vitest";

import type { Evidence } from "@knowledge/shared";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  buildPartialGroundedAnswer,
  buildRelationalGroundedAnswer,
  INSUFFICIENT_EVIDENCE_CLAUSE
} from "../src/utils/build-partial-grounded-answer.js";

import {
  isGeneratedAnswerGrounded
} from "../src/utils/is-generated-answer-grounded.js";

import {
  serializeGroundedContextForLlm
} from "../src/llm/build-grounding-prompt.js";

function evidence(
  id: string,
  type: string,
  label: string,
  relationship?: Evidence["relationship"]
): Evidence {
  return {
    entity: {
      id,
      type,
      label,
      source: "pep-484.md",
      confidence: 1,
      properties: {}
    },
    score: 0.95,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

const proposal = evidence(
  "proposal:PEP-484",
  "Proposal",
  "Type Hints",
  {
    from: "proposal:PEP-484",
    to: "feature:typing",
    type: "INTRODUCES",
    confidence: 1
  }
);

const feature = evidence(
  "feature:typing",
  "Feature",
  "Typing",
  {
    from: "proposal:PEP-484",
    to: "feature:typing",
    type: "INTRODUCES",
    confidence: 1
  }
);

const concern = evidence(
  "concern:readability",
  "Concern",
  "Readability",
  {
    from: "proposal:PEP-484",
    to: "concern:readability",
    type: "ADDRESSES",
    confidence: 1
  }
);

function contextFor(
  query: string,
  items: Evidence[]
) {
  const context =
    new DefaultContextBuilder({
      maxEvidence: 20
    }).build({
      evidence: items
    });

  context.query = query;
  return context;
}

describe("grounded WHY/HOW answer synthesis", () => {

  const verifier =
    new DefaultAnswerVerifier();

  it("A: supported relational synthesis for why/how with INTRODUCES + ADDRESSES", () => {
    const query =
      "Why did PEP-484 introduce Typing, and how does that relate to readability?";

    const context =
      contextFor(query, [proposal, feature, concern]);

    const relational =
      buildRelationalGroundedAnswer(context);

    expect(relational).toMatch(/Type Hints introduced Typing/i);
    expect(relational).toMatch(/Type Hints addressed Readability/i);
    expect(relational).not.toMatch(/because|designed|beginner/i);
    expect(relational).not.toContain(INSUFFICIENT_EVIDENCE_CLAUSE);

    const serialized =
      serializeGroundedContextForLlm(context, query);

    expect(serialized).toContain('"relationships"');
    expect(serialized).toContain('"sourceLabel": "Type Hints"');
    expect(serialized).toContain('"relationship": "INTRODUCES"');
    expect(serialized).toContain('"targetLabel": "Typing"');

    const answer =
      buildPartialGroundedAnswer(context);

    expect(isGeneratedAnswerGrounded(answer, context)).toBe(true);

    const outcome =
      verifier.verify({
        result: {
          answer:
            "PEP-484 introduced Typing because beginners need static typing.",
          confidence: 0.99,
          citations: [
            {
              entityId: "proposal:PEP-484",
              source: "pep-484.md"
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.report.accepted).toBe(true);
    expect(outcome.result.answer).toMatch(/introduced Typing/i);
    expect(outcome.result.answer).toMatch(/addressed Readability/i);
    expect(outcome.result.answer).not.toMatch(/beginner/i);
    expect(outcome.result.answer).not.toContain(
      INSUFFICIENT_EVIDENCE_CLAUSE
    );
    expect(outcome.result.citations.length).toBeGreaterThan(0);
    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.confidence).toBeLessThanOrEqual(1);
  });

  it("B: supported compound synthesis into one coherent grounded answer", () => {
    const context =
      contextFor(
        "What did PEP-484 introduce, and what concern did it address?",
        [proposal, feature, concern]
      );

    const answer =
      buildPartialGroundedAnswer(context);

    expect(answer).toMatch(/Type Hints introduced Typing/i);
    expect(answer).toMatch(/Type Hints addressed Readability/i);
    expect(answer.split(".").filter(Boolean).length).toBeGreaterThanOrEqual(2);

    const outcome =
      verifier.verify({
        result: {
          answer,
          confidence: 0.8,
          citations: [
            {
              entityId: "proposal:PEP-484",
              source: "pep-484.md"
            },
            {
              entityId: "concern:readability",
              source: "pep-484.md"
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.report.accepted).toBe(true);
    expect(outcome.result.answer).toBe(answer);
  });

  it("C: partially supported causal query never invents beginner motivation", () => {
    const context =
      contextFor(
        "Why did PEP-484 introduce Typing to make code easier for beginners?",
        [proposal, feature]
      );

    const outcome =
      verifier.verify({
        result: {
          answer:
            "PEP-484 introduced Typing to make code easier for beginners.",
          confidence: 0.95,
          citations: [
            {
              entityId: "proposal:PEP-484",
              source: "pep-484.md"
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(/introduced Typing/i);
    expect(outcome.result.answer).toMatch(
      /does not establish.*beginners/i
    );
    expect(outcome.result.answer).not.toMatch(
      /introduced Typing to make code easier for beginners/i
    );
    expect(isGeneratedAnswerGrounded(outcome.result.answer, context)).toBe(
      true
    );
  });

  it("D: completely unsupported query fails closed", () => {
    const context =
      contextFor(
        "Who proposed PEP-999 in another galaxy?",
        []
      );

    const outcome =
      verifier.verify({
        result: {
          answer: "Someone in another galaxy.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toBe("");
    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.citations).toEqual([]);
  });

  it("E: simple connection query keeps grounded relational behavior", () => {
    const context =
      contextFor(
        "How is PEP-484 connected to the Typing feature?",
        [proposal, feature]
      );

    const answer =
      "Type Hints introduced Typing.";

    expect(isGeneratedAnswerGrounded(answer, context)).toBe(true);

    const outcome =
      verifier.verify({
        result: {
          answer,
          confidence: 0.7,
          citations: [
            {
              entityId: "proposal:PEP-484",
              source: "pep-484.md"
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.report.accepted).toBe(true);
    expect(outcome.result.answer).toBe(answer);
  });

  it("label-only WHAT contexts use natural identity prose", () => {
    const context =
      contextFor("What is PEP-484?", [
        evidence("proposal:PEP-484", "Proposal", "Type Hints", undefined, {
          pep: "484"
        })
      ]);

    const answer =
      buildPartialGroundedAnswer(context);

    expect(answer).toMatch(/PEP-484/i);
    expect(answer).toMatch(/Type Hints/i);
    expect(answer).toMatch(/proposal/i);
    expect(answer).not.toMatch(/Proposal:\s*Type Hints/);
    expect(answer).not.toContain(INSUFFICIENT_EVIDENCE_CLAUSE);
  });

});
