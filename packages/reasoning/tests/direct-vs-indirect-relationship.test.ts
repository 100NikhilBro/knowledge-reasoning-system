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
  DefaultReasoningPlanner
} from "../src/services/reasoning-planner.service.js";

import {
  detectRelationshipBetweenQuery
} from "../src/utils/detect-relationship-between-query.js";

import {
  classifyRelationalSupport,
  contextHasConnectingEdge,
  contextHasSharedHubBridge
} from "../src/utils/classify-relational-support.js";

import {
  RELATIONSHIP_NOT_ESTABLISHED_CLAUSE
} from "../src/utils/build-partial-grounded-answer.js";

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

const directTypingAddresses = {
  from: "feature:typing",
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

const hubEvidence = [
  evidence("proposal:PEP-484", "Proposal", "Type Hints", introduces),
  evidence("feature:typing", "Feature", "Typing", introduces),
  evidence("concern:readability", "Concern", "Readability", addresses),
  evidence("proposal:PEP-484", "Proposal", "Type Hints", addresses)
];

describe("direct vs indirect relationship semantics", () => {

  const verifier =
    new DefaultAnswerVerifier();

  const planner =
    new DefaultReasoningPlanner();

  it("detects direct / connected / bridge modes", () => {
    expect(
      detectRelationshipBetweenQuery(
        "How is Typing directly related to Readability?"
      )
    ).toEqual({
      left: "Typing",
      right: "Readability",
      mode: "direct"
    });

    expect(
      detectRelationshipBetweenQuery(
        "How are Typing and Readability connected?"
      )
    ).toEqual({
      left: "Typing",
      right: "Readability",
      mode: "connected"
    });

    expect(
      detectRelationshipBetweenQuery(
        "How are Typing and Readability connected through PEP-484?"
      )
    ).toEqual({
      left: "Typing",
      right: "Readability",
      mode: "bridge",
      bridge: "PEP-484"
    });
  });

  it("A: direct relationship present succeeds", async () => {
    const query =
      "How is Typing directly related to Readability?";

    const plan =
      await planner.plan({ query });

    expect(plan.strategy).toBe("single-hop");
    expect(plan.requireRelationshipBetween).toEqual({
      left: "Typing",
      right: "Readability"
    });

    const context =
      contextFor(query, [
        evidence("feature:typing", "Feature", "Typing", directTypingAddresses),
        evidence(
          "concern:readability",
          "Concern",
          "Readability",
          directTypingAddresses
        )
      ]);

    expect(
      contextHasConnectingEdge(context, "Typing", "Readability")
    ).toBe(true);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("full");

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

  it("B: direct relationship absent is not established", async () => {
    const query =
      "How is Typing directly related to Readability?";

    const context =
      contextFor(query, hubEvidence);

    expect(
      contextHasConnectingEdge(context, "Typing", "Readability")
    ).toBe(false);

    expect(
      contextHasSharedHubBridge(context, "Typing", "Readability")
    ).toBe(true);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("relationship_missing");

    const outcome =
      verifier.verify({
        result: {
          answer: "Typing is related to Readability via PEP-484.",
          confidence: 0.95,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toContain(
      RELATIONSHIP_NOT_ESTABLISHED_CLAUSE
    );
    expect(outcome.result.answer).not.toMatch(
      /Typing addressed Readability|directly related/i
    );
    expect(
      outcome.result.trace.steps.every(step =>
        step.evidence.every(item => !item.relationship)
      )
    ).toBe(true);
  });

  it("C: indirect connection may use shared-hub bridge", () => {
    const query =
      "How are Typing and Readability connected?";

    const context =
      contextFor(query, hubEvidence);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("full");
  });

  it("D: explicit bridge through PEP-484 is supported", async () => {
    const query =
      "How are Typing and Readability connected through PEP-484?";

    const plan =
      await planner.plan({ query });

    expect(plan.strategy).toBe("multi-hop");
    expect(plan.requireRelationshipBetween).toBeUndefined();

    const context =
      contextFor(query, hubEvidence);

    expect(
      contextHasSharedHubBridge(
        context,
        "Typing",
        "Readability",
        "PEP-484"
      )
    ).toBe(true);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("full");
  });

  it("plans direct asks as single-hop with pair requirement", async () => {
    const plan =
      await planner.plan({
        query: "How is Typing directly related to Readability?"
      });

    expect(plan.strategy).toBe("single-hop");
    expect(plan.maxDepth).toBe(1);
    expect(plan.requireRelationshipBetween).toEqual({
      left: "Typing",
      right: "Readability"
    });
  });

});
