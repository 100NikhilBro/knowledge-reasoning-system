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
  SingleHopStrategy
} from "../src/strategy/single-hop.strategy.js";

import {
  buildPartialGroundedAnswer,
  RELATIONSHIP_NOT_ESTABLISHED_CLAUSE
} from "../src/utils/build-partial-grounded-answer.js";

import {
  classifyRelationalSupport
} from "../src/utils/classify-relational-support.js";

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

const typing = evidence(
  "feature:typing",
  "Feature",
  "Typing"
);

const readability = evidence(
  "concern:readability",
  "Concern",
  "Readability"
);

const proposalIntroduces = evidence(
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

const featureIntroduces = evidence(
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

describe("semantic evidence states", () => {

  const verifier =
    new DefaultAnswerVerifier();

  it("A: no information fails closed", () => {
    const context =
      contextFor("Who proposed PEP-999 in another galaxy?", []);

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
    expect(outcome.result.citations).toEqual([]);
    expect(outcome.result.trace.steps).toEqual([]);
  });

  it("B: entities exist but requested relationship is missing", async () => {
    const query =
      "What is the relationship between Typing and Readability?";

    const expanded =
      await new SingleHopStrategy().execute(
        {
          findNeighbors: async () => []
        } as never,
        {
          strategy: "single-hop",
          traversal: "dfs",
          maxDepth: 1,
          requireRelationshipBetween: {
            left: "Typing",
            right: "Readability"
          }
        },
        {
          evidence: [typing, readability]
        }
      );

    expect(
      expanded.evidence.map(item => item.entity.id).sort()
    ).toEqual([
      "concern:readability",
      "feature:typing"
    ]);
    expect(
      expanded.evidence.every(item => !item.relationship)
    ).toBe(true);

    const context =
      contextFor(query, expanded.evidence);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("relationship_missing");

    const outcome =
      verifier.verify({
        result: {
          answer: "Typing ADDRESSES Readability.",
          confidence: 0.99,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toContain("Typing (Feature)");
    expect(outcome.result.answer).toContain("Readability (Concern)");
    expect(outcome.result.answer).toContain(
      RELATIONSHIP_NOT_ESTABLISHED_CLAUSE
    );
    expect(outcome.result.answer).not.toMatch(/ADDRESSES/);
    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.citations.length).toBe(2);
    expect(
      outcome.result.trace.steps.some(step =>
        step.evidence.some(item => item.relationship)
      )
    ).toBe(false);
  });

  it("C: partial support returns established facts and bounds the rest", () => {
    const query =
      "What did PEP-484 introduce, and what concern did it address?";

    const context =
      contextFor(query, [
        proposalIntroduces,
        featureIntroduces
      ]);

    expect(
      classifyRelationalSupport(query, context)
    ).toMatchObject({
      kind: "partial",
      established: ["INTRODUCES"],
      missing: expect.arrayContaining(["ADDRESSES"])
    });

    const answer =
      buildPartialGroundedAnswer(context);

    expect(answer).toMatch(/Type Hints introduced Typing/i);
    expect(answer).toMatch(/does not establish/i);
    expect(answer).toMatch(/ADDRESSES/i);
    expect(answer).not.toMatch(/addressed Readability/i);

    const outcome =
      verifier.verify({
        result: {
          answer: "Type Hints introduced Typing and addressed Readability.",
          confidence: 0.95,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toMatch(/introduced Typing/i);
    expect(outcome.result.answer).toMatch(/does not establish/i);
    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.confidence).toBeLessThanOrEqual(1);
  });

  it("C2: supported fact plus unsupported causal remainder is bounded", () => {
    const query =
      "Why did PEP-484 introduce Typing to improve performance?";

    const context =
      contextFor(query, [
        proposalIntroduces,
        featureIntroduces
      ]);

    const outcome =
      verifier.verify({
        result: {
          answer: "Type Hints introduced Typing.",
          confidence: 0.9,
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
      /does not establish.*improve performance/i
    );
    expect(outcome.result.answer).not.toMatch(
      /because performance|makes code faster/i
    );
  });

  it("D: full support remains successful", () => {
    const query =
      "How is PEP-484 connected to the Typing feature?";

    const context =
      contextFor(query, [
        proposalIntroduces,
        featureIntroduces
      ]);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("full");

    const outcome =
      verifier.verify({
        result: {
          answer: "Type Hints introduced Typing.",
          confidence: 0.8,
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
    expect(outcome.result.answer).toBe(
      "Type Hints introduced Typing."
    );
    expect(outcome.result.confidence).toBeGreaterThan(0);
  });

  it("J: unmapped contradict relation is not satisfied by other edges", () => {
    const query =
      "How does PEP-484 contradict Typing?";

    const context =
      contextFor(query, [
        proposalIntroduces,
        featureIntroduces
      ]);

    expect(
      classifyRelationalSupport(query, context).kind
    ).toBe("relationship_missing");

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

    expect(outcome.result.answer).toContain(
      RELATIONSHIP_NOT_ESTABLISHED_CLAUSE
    );
    expect(outcome.result.answer).not.toMatch(/introduced Typing/i);
    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.citations.length).toBeGreaterThan(0);
    expect(
      outcome.result.trace.steps.every(step =>
        step.evidence.every(item => !item.relationship)
      )
    ).toBe(true);
  });

  it("K: supported introduce claim bounds unsupported award claim", () => {
    const query =
      "What did PEP-484 introduce, and what award did it win?";

    const context =
      contextFor(query, [
        proposalIntroduces,
        featureIntroduces
      ]);

    const outcome =
      verifier.verify({
        result: {
          answer: "Type Hints introduced Typing.",
          confidence: 0.9,
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
      /does not establish.*award/i
    );
    expect(outcome.result.confidence).toBeGreaterThan(0);
    expect(outcome.result.confidence).toBeLessThan(1);
  });

  it("E: wrong topic still fails closed with empty evidence", () => {
    const context =
      contextFor("What is PEP-8?", []);

    const outcome =
      verifier.verify({
        result: {
          answer: "",
          confidence: 0,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toBe("");
    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.citations).toEqual([]);
  });

  it("F: focused miss keeps seeds instead of wiping them", async () => {
    const expanded =
      await new SingleHopStrategy().execute(
        {
          findNeighbors: async () => []
        } as never,
        {
          strategy: "single-hop",
          traversal: "dfs",
          maxDepth: 1,
          focusRelationships: ["ADDRESSES"]
        },
        {
          evidence: [typing, readability]
        }
      );

    expect(expanded.evidence).toHaveLength(2);
    expect(
      expanded.evidence.every(item => !item.relationship)
    ).toBe(true);
  });

});
