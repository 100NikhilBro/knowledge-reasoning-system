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
  detectLogicalConclusionQuery,
  evaluateLogicalImplication,
  extractLogicalClaims
} from "../src/utils/logical-implication.js";

import {
  buildImplicationGroundedAnswer
} from "../src/utils/build-partial-grounded-answer.js";

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

const pep526Introduces = {
  from: "proposal:PEP-526",
  to: "feature:typing",
  type: "INTRODUCES",
  confidence: 1
} as const;

function contextFor(
  query: string,
  items: Evidence[]
) {
  const context =
    new DefaultContextBuilder({ maxEvidence: 20 }).build({
      evidence: items
    });
  context.query = query;
  return context;
}

const hubEvidence = [
  evidence(
    "proposal:PEP-484",
    "Proposal",
    "Type Hints",
    introduces,
    { pep: "484" }
  ),
  evidence(
    "feature:typing",
    "Feature",
    "Typing",
    introduces
  ),
  evidence(
    "concern:readability",
    "Concern",
    "Readability",
    addresses
  ),
  evidence(
    "proposal:PEP-484",
    "Proposal",
    "Type Hints",
    addresses,
    { pep: "484" }
  )
];

const multiDocEvidence = [
  ...hubEvidence,
  evidence(
    "proposal:PEP-526",
    "Proposal",
    "Syntax for Variable Annotations",
    pep526Introduces,
    { pep: "526" }
  ),
  evidence(
    "feature:typing",
    "Feature",
    "Typing",
    pep526Introduces
  )
];

describe("logical implication checker", () => {

  const verifier =
    new DefaultAnswerVerifier();

  it("detects conclusion language without hijacking factual introduce asks", () => {

    expect(
      detectLogicalConclusionQuery(
        "Can we conclude that PEP-484 introduced Typing?"
      )
    ).toBe(true);

    expect(
      detectLogicalConclusionQuery(
        "Does PEP-484 imply that Typing improves runtime performance?"
      )
    ).toBe(true);

    expect(
      detectLogicalConclusionQuery(
        "What did PEP-484 introduce?"
      )
    ).toBe(false);

    expect(
      detectLogicalConclusionQuery(
        "How are Typing and Readability connected through PEP-484?"
      )
    ).toBe(false);

  });

  it("Test 1 — supported direct claim", () => {

    const query =
      "Can we conclude that PEP-484 introduced Typing?";

    const context =
      contextFor(query, hubEvidence);

    const decision =
      evaluateLogicalImplication(query, context);

    expect(decision.support).toBe("SUPPORTED");
    expect(decision.established).toContain("INTRODUCES");

    const outcome =
      verifier.verify({
        result: {
          answer: "Invented world knowledge",
          confidence: 0.99,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(/establish/i);
    expect(outcome.result.answer).toMatch(/introduced/i);
    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(
      outcome.result.trace.steps.some(step =>
        /Logical conclusion check: SUPPORTED/i.test(
          step.description
        )
      )
    ).toBe(true);

  });

  it("Test 2 — unsupported direct relationship via shared hub", () => {

    const query =
      "Is it correct to say that Typing is directly related to Readability?";

    const context =
      contextFor(query, hubEvidence);

    const decision =
      evaluateLogicalImplication(query, context);

    expect(decision.support).toBe("NOT_SUPPORTED");
    expect(decision.missing).toContain("DIRECT");

    const outcome =
      verifier.verify({
        result: {
          answer: "Yes, Typing is directly related to Readability.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toMatch(
      /does not establish/i
    );
    expect(outcome.result.answer).not.toMatch(
      /yes,/i
    );
    expect(
      outcome.result.trace.steps.some(step =>
        /Logical conclusion check: NOT_SUPPORTED/i.test(
          step.description
        )
      )
    ).toBe(true);

  });

  it("Test 3 — partial causal claim", () => {

    const query =
      "Can we conclude that PEP-484 introduced Typing to improve runtime performance?";

    const context =
      contextFor(query, hubEvidence);

    const decision =
      evaluateLogicalImplication(query, context);

    expect(decision.support).toBe("PARTIALLY_SUPPORTED");
    expect(decision.established).toContain("INTRODUCES");
    expect(decision.missing).toContain("IMPROVES");

    const answer =
      buildImplicationGroundedAnswer(context);

    expect(answer).toMatch(/introduced/i);
    expect(answer).toMatch(/does not establish/i);
    expect(answer).toMatch(/runtime performance/i);

    const outcome =
      verifier.verify({
        result: {
          answer:
            "PEP-484 introduced Typing to improve runtime performance.",
          confidence: 0.95,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(/does not establish/i);
    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.confidence).toBeLessThan(1);

  });

  it("Test 4 — unsupported inference from path", () => {

    const query =
      "Does this imply that PEP-484 is directly related to Readability?";

    const pathOnly = [
      evidence(
        "proposal:PEP-484",
        "Proposal",
        "Type Hints",
        introduces,
        { pep: "484" }
      ),
      evidence(
        "feature:typing",
        "Feature",
        "Typing",
        introduces
      ),
      evidence(
        "feature:typing",
        "Feature",
        "Typing",
        {
          from: "feature:typing",
          to: "concern:readability",
          type: "ADDRESSES",
          confidence: 1
        }
      ),
      evidence(
        "concern:readability",
        "Concern",
        "Readability",
        {
          from: "feature:typing",
          to: "concern:readability",
          type: "ADDRESSES",
          confidence: 1
        }
      )
    ];

    /*
     * Path PEP-484 → Typing → Readability still has no direct
     * PEP-484 ↔ Readability edge in this fixture variant... wait,
     * Test 4 wants A→B→C does not imply A directly related to C.
     * Use Typing → Readability path with claim Typing related to
     * something else, or claim PEP-484 directly related to Readability
     * without ADDRESSES from proposal.
     */
    const context =
      contextFor(query, [
        evidence(
          "proposal:PEP-484",
          "Proposal",
          "Type Hints",
          introduces,
          { pep: "484" }
        ),
        evidence(
          "feature:typing",
          "Feature",
          "Typing",
          introduces
        ),
        evidence(
          "feature:typing",
          "Feature",
          "Typing",
          {
            from: "feature:typing",
            to: "concern:readability",
            type: "ADDRESSES",
            confidence: 1
          }
        ),
        evidence(
          "concern:readability",
          "Concern",
          "Readability",
          {
            from: "feature:typing",
            to: "concern:readability",
            type: "ADDRESSES",
            confidence: 1
          }
        )
      ]);

    const decision =
      evaluateLogicalImplication(query, context);

    expect(decision.support).toBe("NOT_SUPPORTED");

  });

  it("Test 5 — explicit supported bridge remains appropriate", () => {

    const query =
      "How are Typing and Readability connected through PEP-484?";

    expect(detectLogicalConclusionQuery(query)).toBe(false);

    const context =
      contextFor(query, hubEvidence);

    const decision =
      evaluateLogicalImplication(query, context);

    expect(decision.support).toBe("NOT_APPLICABLE");

    const outcome =
      verifier.verify({
        result: {
          answer:
            "Type Hints (Proposal) introduced Typing. Type Hints (Proposal) addressed Readability.",
          confidence: 0.8,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.answer).not.toMatch(
      /Logical conclusion check/i
    );

  });

  it("Test 6 — missing evidence fails closed", () => {

    const query =
      "Can we conclude that PEP-484 improves quantum computing?";

    const context =
      contextFor(query, hubEvidence);

    const decision =
      evaluateLogicalImplication(query, context);

    expect(decision.support).toBe("NOT_SUPPORTED");
    expect(decision.missing).toContain("IMPROVES");

    const outcome =
      verifier.verify({
        result: {
          answer: "Yes, because quantum computing needs types.",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toMatch(
      /does not establish/i
    );
    expect(outcome.result.answer).not.toMatch(
      /quantum computing needs/i
    );

  });

  it("Test 7 — compound logical conclusion is partially supported", () => {

    const query =
      "Can we conclude that PEP-484 introduced Typing and that Typing improves runtime performance?";

    const claims =
      extractLogicalClaims(query);

    expect(
      claims.some(claim => claim.predicate === "INTRODUCES")
    ).toBe(true);

    expect(
      claims.some(claim => claim.predicate === "IMPROVES")
    ).toBe(true);

    const context =
      contextFor(query, hubEvidence);

    const decision =
      evaluateLogicalImplication(query, context);

    expect(decision.support).toBe("PARTIALLY_SUPPORTED");

  });

  it("multi-document corpus still blocks unsupported Typing↔Readability conclusions", () => {

    const query =
      "Is it correct to say that Typing is related to Readability?";

    const context =
      contextFor(query, multiDocEvidence);

    const decision =
      evaluateLogicalImplication(query, context);

    expect(decision.support).toBe("NOT_SUPPORTED");

    const outcome =
      verifier.verify({
        result: {
          answer: "Typing is related to Readability via shared PEPs.",
          confidence: 0.88,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toMatch(
      /does not establish/i
    );

  });

  it("does not upgrade NOT_SUPPORTED via generator world knowledge", () => {

    const query =
      "Does PEP-484 imply that Typing improves runtime performance?";

    const context =
      contextFor(query, hubEvidence);

    const outcome =
      verifier.verify({
        result: {
          answer:
            "Yes. Typing improves runtime performance because typed code runs faster.",
          confidence: 1,
          citations: hubEvidence.map(item => ({
            entityId: item.entity.id,
            source: item.entity.source
          })),
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toMatch(
      /does not establish/i
    );
    expect(outcome.result.answer).not.toMatch(
      /runs faster/i
    );

  });

});
