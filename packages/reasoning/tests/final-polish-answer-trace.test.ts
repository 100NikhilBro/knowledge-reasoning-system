import {
  describe,
  expect,
  it
} from "vitest";

import type {
  Evidence
} from "@knowledge/shared";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  buildIdentityGroundedAnswer,
  buildPartialGroundedAnswer,
  buildRelationalGroundedAnswer,
  RELATIONSHIP_NOT_ESTABLISHED_CLAUSE
} from "../src/utils/build-partial-grounded-answer.js";

import {
  buildTrace
} from "../src/utils/trace-builder.js";

import {
  relationshipAttributionIsGrounded
} from "../src/utils/relationship-attribution.js";

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

describe("final polish: answer format, attribution, trace", () => {

  const verifier =
    new DefaultAnswerVerifier();

  it("A: WHAT uses natural prose instead of key-value fallback", () => {
    const query =
      "What is PEP-484?";

    const context =
      contextFor(query, [
        evidence("proposal:PEP-484", "Proposal", "Type Hints", undefined, {
          pep: "484"
        }),
        evidence("feature:typing", "Feature", "Typing"),
        evidence("concern:readability", "Concern", "Readability"),
        evidence("author:guido-van-rossum", "Author", "Guido van Rossum")
      ]);

    const answer =
      buildPartialGroundedAnswer(context);

    expect(answer).not.toMatch(/Proposal:\s*Type Hints/i);
    expect(answer).toMatch(/PEP-484/i);
    expect(answer).toMatch(/Type Hints/i);
    expect(answer.toLowerCase()).toMatch(/proposal/);
    expect(answer).not.toContain("\nFeature:");
  });

  it("A2: WHAT with relationships weaves attested edges in prose", () => {
    const context =
      contextFor("What is PEP-484?", [
        evidence(
          "proposal:PEP-484",
          "Proposal",
          "Type Hints",
          introduces,
          { pep: "484" }
        ),
        evidence("feature:typing", "Feature", "Typing", introduces),
        evidence(
          "concern:readability",
          "Concern",
          "Readability",
          addresses
        )
      ]);

    const answer =
      buildIdentityGroundedAnswer(context);

    expect(answer).toMatch(/PEP-484/i);
    expect(answer).toMatch(/introduced Typing/i);
    expect(answer).toMatch(/addressed Readability/i);
    expect(answer).not.toMatch(/Proposal:\s/);
  });

  it("B: RELATIONAL synthesis stays natural and edge-backed", () => {
    const context =
      contextFor("How is PEP-484 connected to Typing?", [
        evidence("proposal:PEP-484", "Proposal", "Type Hints", introduces),
        evidence("feature:typing", "Feature", "Typing", introduces)
      ]);

    const answer =
      buildRelationalGroundedAnswer(context);

    expect(answer).toBe("Type Hints introduced Typing.");
  });

  it("C: relationship attribution follows actual edge direction", () => {
    const context =
      contextFor(
        "How does PEP-484 relate to Typing and Readability?",
        [
          evidence("proposal:PEP-484", "Proposal", "Type Hints", introduces),
          evidence("feature:typing", "Feature", "Typing", introduces),
          evidence(
            "concern:readability",
            "Concern",
            "Readability",
            addresses
          )
        ]
      );

    expect(
      relationshipAttributionIsGrounded(
        "Type Hints introduced Typing and addressed Readability.",
        context
      )
    ).toBe(true);

    expect(
      relationshipAttributionIsGrounded(
        "Typing addressed Readability.",
        context
      )
    ).toBe(false);

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

    expect(outcome.result.answer).toMatch(/Type Hints addressed Readability/i);
    expect(outcome.result.answer).not.toMatch(/^Typing addressed/i);
  });

  it("D: co-seeded endpoints do not duplicate relationship path steps", () => {
    const trace =
      buildTrace({
        evidence: [
          evidence("proposal:PEP-484", "Proposal", "Type Hints", introduces),
          evidence("feature:typing", "Feature", "Typing", introduces)
        ]
      });

    const introducesSteps =
      trace.steps.filter(step =>
        step.description.includes("INTRODUCES")
      );

    expect(introducesSteps).toHaveLength(1);
    expect(introducesSteps[0]?.description).toContain(
      "proposal:PEP-484 → feature:typing"
    );
    expect(introducesSteps[0]?.description).toMatch(/Type Hints/);
    expect(introducesSteps[0]?.description).not.toMatch(
      /Typing via INTRODUCES \(feature:typing/
    );
  });

  it("E: partial / not-established semantics remain intact", () => {
    const missing =
      contextFor(
        "What is the relationship between Typing and Readability?",
        [
          evidence("feature:typing", "Feature", "Typing"),
          evidence("concern:readability", "Concern", "Readability")
        ]
      );

    const missingAnswer =
      buildPartialGroundedAnswer(missing);

    expect(missingAnswer).toContain(RELATIONSHIP_NOT_ESTABLISHED_CLAUSE);
    expect(missingAnswer).not.toMatch(/ADDRESSES|addressed/i);

    const partial =
      contextFor(
        "What did PEP-484 introduce, and what concern did it address?",
        [
          evidence("proposal:PEP-484", "Proposal", "Type Hints", introduces),
          evidence("feature:typing", "Feature", "Typing", introduces)
        ]
      );

    const partialAnswer =
      buildPartialGroundedAnswer(partial);

    expect(partialAnswer).toMatch(/introduced Typing/i);
    expect(partialAnswer).toMatch(/does not establish/i);
  });

  it("F: unsupported / empty evidence still fails closed", () => {
    const context =
      contextFor("What is the quantum entanglement protocol?", []);

    const outcome =
      verifier.verify({
        result: {
          answer: "Invented answer",
          confidence: 0.9,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toBe("");
    expect(outcome.result.confidence).toBe(0);
  });

});
