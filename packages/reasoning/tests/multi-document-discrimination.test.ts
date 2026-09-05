import {
  describe,
  expect,
  it
} from "vitest";

import type {
  Evidence,
  KnowledgeEntity
} from "@knowledge/shared";

import {
  filterCompatibleEvidence
} from "../src/utils/query-evidence-compatibility.js";

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
  classifyRelationalSupport
} from "../src/utils/classify-relational-support.js";

import {
  RELATIONSHIP_NOT_ESTABLISHED_CLAUSE
} from "../src/utils/build-partial-grounded-answer.js";

/**
 * Isolated multi-document fixture (test-only).
 *
 * Document A (alpha-protocol.md): Alpha Protocol / Module X / Latency
 * Document B (beta-handbook.md): Beta Handbook / Module Y / Throughput
 *
 * Overlapping vocabulary ("module", "protocol") but distinct topic codes
 * and relationship structure — never production corpus data.
 */
function entity(
  id: string,
  type: string,
  label: string,
  source: string,
  properties: Record<string, unknown> = {}
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

function evidenceOf(
  e: KnowledgeEntity,
  score = 0.9,
  relationship?: Evidence["relationship"]
): Evidence {
  return {
    entity: e,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

const alphaProposal = entity(
  "proposal:ALPHA-1",
  "Proposal",
  "Alpha Protocol",
  "alpha-protocol.md",
  { protocol: "ALPHA-1" }
);

const alphaModule = entity(
  "feature:module-x",
  "Feature",
  "Module X",
  "alpha-protocol.md",
  { name: "Module X" }
);

const alphaConcern = entity(
  "concern:latency",
  "Concern",
  "Latency",
  "alpha-protocol.md",
  { name: "Latency" }
);

const betaProposal = entity(
  "proposal:BETA-7",
  "Proposal",
  "Beta Handbook",
  "beta-handbook.md",
  { handbook: "BETA-7" }
);

const betaModule = entity(
  "feature:module-y",
  "Feature",
  "Module Y",
  "beta-handbook.md",
  { name: "Module Y" }
);

const betaConcern = entity(
  "concern:throughput",
  "Concern",
  "Throughput",
  "beta-handbook.md",
  { name: "Throughput" }
);

const corpus: Evidence[] = [
  evidenceOf(alphaProposal, 0.95, {
    from: "proposal:ALPHA-1",
    to: "feature:module-x",
    type: "INTRODUCES",
    confidence: 1
  }),
  evidenceOf(alphaModule, 0.9, {
    from: "proposal:ALPHA-1",
    to: "feature:module-x",
    type: "INTRODUCES",
    confidence: 1
  }),
  evidenceOf(alphaConcern, 0.85, {
    from: "proposal:ALPHA-1",
    to: "concern:latency",
    type: "ADDRESSES",
    confidence: 1
  }),
  evidenceOf(betaProposal, 0.95, {
    from: "proposal:BETA-7",
    to: "feature:module-y",
    type: "INTRODUCES",
    confidence: 1
  }),
  evidenceOf(betaModule, 0.9, {
    from: "proposal:BETA-7",
    to: "feature:module-y",
    type: "INTRODUCES",
    confidence: 1
  }),
  evidenceOf(betaConcern, 0.85, {
    from: "proposal:BETA-7",
    to: "concern:throughput",
    type: "ADDRESSES",
    confidence: 1
  })
];

describe("multi-document discrimination (isolated fixture)", () => {

  const verifier =
    new DefaultAnswerVerifier();

  const builder =
    new DefaultContextBuilder({ maxEvidence: 20 });

  it("selects Document A evidence for ALPHA-1 queries", () => {
    const kept =
      filterCompatibleEvidence(
        "What did ALPHA-1 introduce?",
        corpus
      );

    const ids =
      kept.map(item => item.entity.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "proposal:ALPHA-1",
        "feature:module-x"
      ])
    );
    expect(ids).not.toContain("proposal:BETA-7");
    expect(ids).not.toContain("feature:module-y");
    expect(
      kept.every(item => item.entity.source === "alpha-protocol.md")
    ).toBe(true);
  });

  it("selects Document B evidence for BETA-7 queries", () => {
    const kept =
      filterCompatibleEvidence(
        "What concern did BETA-7 address?",
        corpus
      );

    const ids =
      kept.map(item => item.entity.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "proposal:BETA-7",
        "concern:throughput"
      ])
    );
    expect(ids).not.toContain("proposal:ALPHA-1");
    expect(ids).not.toContain("concern:latency");
  });

  it("rejects overlapping vocabulary from the wrong document", () => {
    const kept =
      filterCompatibleEvidence(
        "What module did ALPHA-1 introduce?",
        corpus
      );

    expect(
      kept.some(item => item.entity.id === "feature:module-y")
    ).toBe(false);
    expect(
      kept.some(item => item.entity.label === "Module X")
    ).toBe(true);
  });

  it("fails closed for unknown topic codes", () => {
    const kept =
      filterCompatibleEvidence(
        "What is GAMMA-99?",
        corpus
      );

    expect(kept).toEqual([]);

    const context =
      builder.build({ evidence: kept });
    context.query = "What is GAMMA-99?";

    const outcome =
      verifier.verify({
        result: {
          answer: "GAMMA-99 is a module protocol.",
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

  it("does not fabricate cross-document relationships", async () => {
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
            left: "Module X",
            right: "Throughput"
          }
        },
        {
          evidence: filterCompatibleEvidence(
            "What is the relationship between Module X and Throughput?",
            [
              evidenceOf(alphaModule),
              evidenceOf(betaConcern)
            ]
          )
        }
      );

    /*
     * Compatibility may already empty mixed wrong-topic seeds;
     * either way no fabricated Module X --*--> Throughput edge.
     */
    expect(
      expanded.evidence.every(item => !item.relationship)
    ).toBe(true);

    const context =
      builder.build({ evidence: expanded.evidence });
    context.query =
      "What is the relationship between Module X and Throughput?";

    if (context.evidence.length === 0) {
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
      expect(outcome.result.confidence).toBe(0);
      return;
    }

    expect(
      classifyRelationalSupport(context.query, context).kind
    ).toBe("relationship_missing");

    const outcome =
      verifier.verify({
        result: {
          answer: "Module X ADDRESSES Throughput.",
          confidence: 0.99,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toContain(
      RELATIONSHIP_NOT_ESTABLISHED_CLAUSE
    );
    expect(outcome.result.answer).not.toMatch(/ADDRESSES/);
    expect(outcome.result.confidence).toBe(0);
  });

  it("keeps Document A relationship chain intact for compound ALPHA queries", () => {
    const kept =
      filterCompatibleEvidence(
        "What did ALPHA-1 introduce and what concern did it address?",
        corpus
      );

    const types =
      kept
        .map(item => item.relationship?.type)
        .filter(Boolean);

    expect(types).toEqual(
      expect.arrayContaining(["INTRODUCES", "ADDRESSES"])
    );
    expect(
      kept.every(item => item.entity.source === "alpha-protocol.md")
    ).toBe(true);

    const context =
      builder.build({ evidence: kept });
    context.query =
      "What did ALPHA-1 introduce and what concern did it address?";

    expect(
      classifyRelationalSupport(context.query, context).kind
    ).toBe("full");
  });

});
