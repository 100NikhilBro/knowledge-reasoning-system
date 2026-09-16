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
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  verifyAnswerAgainstIntent
} from "../src/utils/answer-intent-verification.js";

function evidence(
  id: string,
  type: string,
  label: string,
  relationship?: Evidence["relationship"],
  properties: Record<string, unknown> = {}
): Evidence {
  return {
    entity: {
      id,
      type,
      label,
      source: "pep-484.md",
      confidence: 1,
      properties
    },
    score: 0.9,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

const introduces = {
  from: "proposal:PEP-484",
  to: "feature:typing",
  type: "INTRODUCES",
  confidence: 1
} as const;

const addresses = {
  from: "proposal:PEP-484",
  to: "concern:readability",
  type: "ADDRESSES",
  confidence: 1
} as const;

const proposedBy = {
  from: "proposal:PEP-484",
  to: "author:guido-van-rossum",
  type: "PROPOSED_BY",
  confidence: 1
} as const;

const hubEvidence = [
  evidence("proposal:PEP-484", "Proposal", "Type Hints", introduces, { pep: "484" }),
  evidence("feature:typing", "Feature", "Typing", introduces),
  evidence("concern:readability", "Concern", "Readability", addresses),
  evidence("proposal:PEP-484", "Proposal", "Type Hints", addresses, { pep: "484" })
];

const compoundEvidence = [
  ...hubEvidence,
  evidence("author:guido-van-rossum", "Author", "Guido van Rossum", proposedBy),
  evidence("proposal:PEP-484", "Proposal", "Type Hints", proposedBy, { pep: "484" })
];

const directTypingAddresses = [
  evidence("feature:typing", "Feature", "Typing", {
    from: "feature:typing",
    to: "concern:readability",
    type: "ADDRESSES",
    confidence: 1
  }),
  evidence("concern:readability", "Concern", "Readability", {
    from: "feature:typing",
    to: "concern:readability",
    type: "ADDRESSES",
    confidence: 1
  })
];

function contextFor(
  query: string,
  items: Evidence[]
) {
  const context =
    new DefaultContextBuilder({ maxEvidence: 20 }).build({
      evidence: items
    });
  context.query = query;
  context.understanding = understandQuery(query);
  return context;
}

describe("answer intent verification (P3)", () => {

  const verifier =
    new DefaultAnswerVerifier();

  it("Test 1 — correct grounded answer is SUPPORTED", () => {

    const query =
      "Can we conclude that PEP-484 introduced Typing?";

    const context =
      contextFor(query, hubEvidence);

    const outcome =
      verifier.verify({
        result: {
          answer: "The evidence establishes that Type Hints introduced Typing.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.answer).toMatch(/introduced/i);
    expect(
      outcome.result.trace.steps.some(step =>
        /Verification:.*SUPPORTED/i.test(step.description)
      )
    ).toBe(true);

  });

  it("Test 2 — true but irrelevant answer is rejected", () => {

    const query =
      "Can we conclude that Typing improves runtime performance?";

    const context =
      contextFor(query, hubEvidence);

    const outcome =
      verifier.verify({
        result: {
          answer: "PEP-484 introduced Typing.",
          confidence: 0.95,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toMatch(/does not establish/i);
    expect(outcome.result.answer).not.toBe(
      "PEP-484 introduced Typing."
    );

  });

  it("Test 3 — stronger-than-evidence causal claim is bounded", () => {

    const query =
      "Why did PEP-484 introduce Typing to improve runtime performance?";

    const context =
      contextFor(query, hubEvidence);

    const outcome =
      verifier.verify({
        result: {
          answer:
            "PEP-484 introduced Typing to improve runtime performance.",
          confidence: 0.99,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(/introduced/i);
    expect(outcome.result.answer).toMatch(/does not establish/i);
    expect(outcome.result.answer).not.toMatch(
      /introduced Typing to improve runtime performance\./i
    );

  });

  it("Test 4 — direct relationship mismatch from path", () => {

    const query =
      "How is Typing directly related to Readability?";

    const context =
      contextFor(query, hubEvidence);

    const outcome =
      verifier.verify({
        result: {
          answer:
            "Typing and Readability are both related to PEP-484.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toMatch(
      /does not establish|not establish/i
    );

  });

  it("Test 5 — connected through bridge is SUPPORTED", () => {

    const query =
      "How are Typing and Readability connected through PEP-484?";

    const context =
      contextFor(query, hubEvidence);

    const outcome =
      verifier.verify({
        result: {
          answer:
            "Type Hints introduced Typing. Type Hints addressed Readability.",
          confidence: 0.85,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.answer).toMatch(/Typing/i);
    expect(outcome.result.answer).toMatch(/Readability/i);

  });

  it("Test 6 — compound completeness is partial when one clause missing", () => {

    const query =
      "Who proposed PEP-484, what did it introduce, and what concern did it address?";

    const context =
      contextFor(query, compoundEvidence);

    const check =
      verifyAnswerAgainstIntent(
        "Guido van Rossum.",
        context
      );

    expect(check.semantics.status).toBe("PARTIALLY_SUPPORTED");
    expect(check.matchesIntent).toBe(false);

    const outcome =
      verifier.verify({
        result: {
          answer: "Guido van Rossum.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).not.toBe("Guido van Rossum.");
    expect(outcome.result.answer.toLowerCase()).toMatch(
      /introduced|addressed|proposed/
    );

  });

  it("Test 7 — partial causal query remains partial", () => {

    const query =
      "Why did PEP-484 introduce Typing to improve runtime performance?";

    const context =
      contextFor(query, [
        evidence("proposal:PEP-484", "Proposal", "Type Hints", introduces, { pep: "484" }),
        evidence("feature:typing", "Feature", "Typing", introduces)
      ]);

    const outcome =
      verifier.verify({
        result: {
          answer: "Type Hints introduced Typing.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(/introduced Typing/i);
    expect(outcome.result.answer).toMatch(/does not establish/i);

  });

  it("Test 8 — generator cannot override NOT_SUPPORTED", () => {

    const query =
      "Can we conclude that Typing improves runtime performance?";

    const context =
      contextFor(query, hubEvidence);

    const outcome =
      verifier.verify({
        result: {
          answer:
            "Yes. Typing improves runtime performance in production systems.",
          confidence: 1,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toMatch(/does not establish/i);
    expect(outcome.result.answer).not.toMatch(
      /production systems/i
    );

  });

  it("Test 9 — missing evidence fails closed", () => {

    const query =
      "What relationship does PEP-484 have with quantum computing?";

    const context =
      contextFor(query, hubEvidence);

    const outcome =
      verifier.verify({
        result: {
          answer: "PEP-484 enables quantum computing via Typing.",
          confidence: 0.8,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(
      /does not establish|not establish|insufficient|available evidence/i
    );
    expect(outcome.result.answer).not.toMatch(
      /enables quantum computing/i
    );

  });

  it("Test 10 — P1 implication and verifier agree without upgrade", () => {

    const query =
      "Does PEP-484 imply that Typing improves runtime performance?";

    const context =
      contextFor(query, hubEvidence);

    const intentCheck =
      verifyAnswerAgainstIntent(
        "Yes, Typing improves runtime performance.",
        context
      );

    expect(intentCheck.semantics.implicationSupport)
      .toBe("NOT_SUPPORTED");

    expect(intentCheck.semantics.status)
      .toBe("NOT_SUPPORTED");

    const outcome =
      verifier.verify({
        result: {
          answer: "Yes, Typing improves runtime performance.",
          confidence: 1,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);

  });

  it("Test 11 — user intent mismatch for bridge question", () => {

    const query =
      "How are Typing and Readability connected through PEP-484?";

    const context =
      contextFor(query, hubEvidence);

    const check =
      verifyAnswerAgainstIntent(
        "PEP-484 introduced Typing.",
        context
      );

    expect(check.matchesIntent).toBe(false);

    const outcome =
      verifier.verify({
        result: {
          answer: "PEP-484 introduced Typing.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).not.toBe(
      "PEP-484 introduced Typing."
    );
    expect(outcome.result.answer).toMatch(/Readability/i);

  });

  it("Test 12 — compound intent mismatch yields partial/incomplete handling", () => {

    const query =
      "Who proposed PEP-484 and what did it introduce?";

    const context =
      contextFor(query, compoundEvidence);

    const outcome =
      verifier.verify({
        result: {
          answer: "Guido van Rossum proposed PEP-484.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(
      outcome.result.trace.steps.some(step =>
        /Verification:/i.test(step.description)
      )
    ).toBe(true);

    expect(outcome.result.answer.toLowerCase()).toMatch(
      /introduc|address|propos/
    );

  });

  it("multi-document evidence still rejects direct Typing↔Readability claim", () => {

    const multiDoc = [
      ...hubEvidence,
      evidence(
        "proposal:PEP-526",
        "Proposal",
        "Syntax for Variable Annotations",
        {
          from: "proposal:PEP-526",
          to: "feature:typing",
          type: "INTRODUCES",
          confidence: 1
        },
        { pep: "526" }
      )
    ];

    const query =
      "Is it correct to say that Typing is directly related to Readability?";

    const context =
      contextFor(query, multiDoc);

    const outcome =
      verifier.verify({
        result: {
          answer: "Typing is directly related to Readability.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);

  });

  it("direct positive edge remains supported", () => {

    const query =
      "How is Typing directly related to Readability?";

    const context =
      contextFor(query, directTypingAddresses);

    const outcome =
      verifier.verify({
        result: {
          answer: "Typing addressed Readability.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.answer).toMatch(/Typing addressed Readability/i);

  });

});
