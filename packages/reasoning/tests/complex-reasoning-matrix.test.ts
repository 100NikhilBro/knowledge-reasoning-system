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

import {
  detectFocusRelationships,
  detectMultiHopPathQuery,
  queryRequiresRelationalEvidence
} from "../src/utils/detect-focus-relationships.js";

import {
  DefaultReasoningPlanner
} from "../src/services/reasoning-planner.service.js";

import {
  SingleHopStrategy
} from "../src/strategy/single-hop.strategy.js";

import {
  MultiHopStrategy
} from "../src/strategy/multi-hop.strategy.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

import {
  computeGroundedAnswerConfidence
} from "../src/utils/compute-grounded-confidence.js";

import {
  causalClaimsAreGrounded,
  relationalQueryIsSupported
} from "../src/utils/relational-claim-grounding.js";

import {
  filterCompatibleEvidence
} from "../src/utils/query-evidence-compatibility.js";

function entity(
  id: string,
  type: string,
  label: string
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source: "corpus.md",
    confidence: 1,
    properties: id.includes("484")
      ? { pep: "484" }
      : {}
  };
}

function rel(
  from: string,
  to: string,
  type: string
): KnowledgeRelationship {
  return { from, to, type, confidence: 1 };
}

function evidenceOf(
  e: KnowledgeEntity,
  score = 0.95,
  relationship?: KnowledgeRelationship
): Evidence {
  return {
    entity: e,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

const proposal = entity(
  "proposal:PEP-484",
  "Proposal",
  "Type Hints"
);
const feature = entity(
  "feature:typing",
  "Feature",
  "Typing"
);
const concern = entity(
  "concern:readability",
  "Concern",
  "Readability"
);
const author = entity(
  "author:guido-van-rossum",
  "Author",
  "Guido van Rossum"
);
const decision = entity(
  "decision:accepted",
  "Decision",
  "Accepted"
);

/**
 * Graph:
 *   Proposal --PROPOSED_BY--> Author
 *   Proposal --INTRODUCES--> Feature
 *   Feature --ADDRESSES--> Concern
 *   Proposal --RESULTS_IN--> Decision
 */
function createGraph() {
  const adjacency = new Map<string, Array<{
    neighbor: KnowledgeEntity;
    relationship: KnowledgeRelationship;
  }>>([
    [
      proposal.id,
      [
        {
          neighbor: author,
          relationship: rel(proposal.id, author.id, "PROPOSED_BY")
        },
        {
          neighbor: feature,
          relationship: rel(proposal.id, feature.id, "INTRODUCES")
        },
        {
          neighbor: decision,
          relationship: rel(proposal.id, decision.id, "RESULTS_IN")
        }
      ]
    ],
    [
      feature.id,
      [
        {
          neighbor: concern,
          relationship: rel(feature.id, concern.id, "ADDRESSES")
        },
        {
          neighbor: proposal,
          relationship: rel(proposal.id, feature.id, "INTRODUCES")
        }
      ]
    ],
    [
      concern.id,
      [
        {
          neighbor: feature,
          relationship: rel(feature.id, concern.id, "ADDRESSES")
        }
      ]
    ],
    [
      author.id,
      [
        {
          neighbor: proposal,
          relationship: rel(proposal.id, author.id, "PROPOSED_BY")
        }
      ]
    ],
    [
      decision.id,
      [
        {
          neighbor: proposal,
          relationship: rel(proposal.id, decision.id, "RESULTS_IN")
        }
      ]
    ]
  ]);

  return {
    findNeighbors: vi.fn(
      async (_type: string, id: string) =>
        adjacency.get(id) ?? []
    )
  };
}

describe("complex reasoning matrix", () => {

  const planner =
    new DefaultReasoningPlanner();
  const verifier =
    new DefaultAnswerVerifier();
  const builder =
    new DefaultContextBuilder();

  it("A: direct WHAT stays single-hop without forced relationships", async () => {
    const plan =
      await planner.plan({
        query: "What is PEP-484?"
      });

    expect(plan.strategy).toBe("single-hop");
    expect(plan.focusRelationships).toBeUndefined();
  });

  it("B: WHO + relationship uses PROPOSED_BY focus", async () => {
    const plan =
      await planner.plan({
        query: "Who proposed PEP-484?"
      });

    expect(plan.strategy).toBe("single-hop");
    expect(plan.focusRelationships).toEqual([
      "PROPOSED_BY"
    ]);

    const expanded =
      await new SingleHopStrategy().execute(
        createGraph() as never,
        plan,
        { evidence: [evidenceOf(proposal)] }
      );

    expect(
      expanded.evidence.some(
        item =>
          item.entity.id === author.id &&
          item.relationship?.type === "PROPOSED_BY"
      )
    ).toBe(true);
  });

  it("C: HOW address query focuses ADDRESSES and expands evidence", async () => {
    expect(
      detectFocusRelationships(
        "How did PEP-484 address the problem of expressing type information?"
      )
    ).toContain("ADDRESSES");

    const plan =
      await planner.plan({
        query:
          "How did PEP-484 address the problem of expressing type information?"
      });

    expect(plan.strategy).toBe("single-hop");
    expect(plan.focusRelationships).toContain(
      "ADDRESSES"
    );
  });

  it("D: WHY query plans explanation with relational focuses", async () => {
    const plan =
      await planner.plan({
        query: "Why was PEP-484 proposed?"
      });

    expect(plan.strategy).toBe("explanation");
    expect(plan.focusRelationships).toEqual(
      expect.arrayContaining([
        "ADDRESSES",
        "INTRODUCES"
      ])
    );

    const expanded =
      await new SingleHopStrategy().execute(
        createGraph() as never,
        plan,
        { evidence: [evidenceOf(proposal)] }
      );

    /*
     * Second-pass focused expansion reaches Concern via Feature.
     */
    expect(
      expanded.evidence.map(item => item.entity.id)
    ).toEqual(
      expect.arrayContaining([
        proposal.id,
        feature.id,
        concern.id
      ])
    );

    expect(
      expanded.evidence.some(
        item => item.relationship?.type === "ADDRESSES"
      )
    ).toBe(true);
  });

  it("E: two-hop path query uses multi-hop and preserves edge chain", async () => {
    const query =
      "How is PEP-484 connected to readability through type hints?";

    expect(detectMultiHopPathQuery(query)).toBe(true);

    const plan =
      await planner.plan({ query });

    expect(plan.strategy).toBe("multi-hop");
    expect(plan.maxDepth).toBe(2);

    const expanded =
      await new MultiHopStrategy().execute(
        createGraph() as never,
        plan,
        { evidence: [evidenceOf(proposal)] }
      );

    const byId =
      new Map(
        expanded.evidence.map(item => [
          item.entity.id,
          item
        ])
      );

    expect(byId.get(feature.id)?.relationship?.type)
      .toBe("INTRODUCES");
    expect(byId.get(concern.id)?.relationship?.type)
      .toBe("ADDRESSES");
    expect(byId.get(concern.id)?.relationship?.from)
      .toBe(feature.id);
    expect(
      expanded.evidence.some(
        item => item.relationship?.type === "RELATED"
      )
    ).toBe(false);
  });

  it("E2: co-seeded multi-hop endpoints still receive real relationships", async () => {
    const plan =
      await planner.plan({
        query:
          "How is PEP-484 connected to readability through type hints?"
      });

    const expanded =
      await new MultiHopStrategy().execute(
        createGraph() as never,
        plan,
        {
          evidence: [
            evidenceOf(proposal),
            evidenceOf(feature),
            evidenceOf(concern)
          ]
        }
      );

    expect(
      expanded.evidence.some(
        item =>
          item.entity.id === feature.id &&
          item.relationship?.type === "INTRODUCES"
      )
    ).toBe(true);

    expect(
      expanded.evidence.some(
        item =>
          item.entity.id === concern.id &&
          item.relationship?.type === "ADDRESSES"
      )
    ).toBe(true);
  });

  it("F: compound query expands every focused hop type including second pass", async () => {
    const query =
      "Who proposed PEP-484, what did it introduce, what problem did it address, and what decision was ultimately made?";

    expect(detectFocusRelationships(query)).toEqual(
      expect.arrayContaining([
        "PROPOSED_BY",
        "INTRODUCES",
        "ADDRESSES",
        "RESULTS_IN"
      ])
    );

    const plan =
      await planner.plan({ query });

    expect(plan.strategy).toBe("single-hop");

    const expanded =
      await new SingleHopStrategy().execute(
        createGraph() as never,
        plan,
        { evidence: [evidenceOf(proposal)] }
      );

    const ids =
      expanded.evidence.map(item => item.entity.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        proposal.id,
        author.id,
        feature.id,
        concern.id,
        decision.id
      ])
    );

    const types =
      expanded.evidence
        .map(item => item.relationship?.type)
        .filter(Boolean);

    expect(types).toEqual(
      expect.arrayContaining([
        "PROPOSED_BY",
        "INTRODUCES",
        "ADDRESSES",
        "RESULTS_IN"
      ])
    );
  });

  it("G: causal why+outcome requires relationship-backed context", async () => {
    const withRels =
      builder.build({
        evidence: [
          evidenceOf(
            proposal,
            0.9,
            rel(proposal.id, decision.id, "RESULTS_IN")
          ),
          evidenceOf(
            decision,
            0.9,
            rel(proposal.id, decision.id, "RESULTS_IN")
          ),
          evidenceOf(
            concern,
            0.9,
            rel(feature.id, concern.id, "ADDRESSES")
          )
        ]
      });
    withRels.query = "Why was PEP-484 proposed and what decision resulted?";

    expect(
      relationalQueryIsSupported(withRels.query, withRels)
    ).toBe(true);

    const withoutRels =
      builder.build({
        evidence: [evidenceOf(proposal)]
      });
    withoutRels.query = "Why was PEP-484 proposed?";

    expect(
      relationalQueryIsSupported(
        withoutRels.query,
        withoutRels
      )
    ).toBe(false);

    const rejected =
      verifier.verify({
        result: {
          answer: "Because quantum computing needed types.",
          confidence: 0.99,
          citations: [],
          trace: { steps: [] }
        },
        context: withoutRels
      });

    expect(rejected.result.answer).toMatch(/Type Hints \(Proposal\)|Proposal/i);
    expect(rejected.result.answer).toMatch(
      /does not establish the requested relationship/i
    );
    expect(rejected.result.answer).not.toMatch(/quantum/i);
    expect(rejected.result.confidence).toBe(0);
  });

  it("H: comparison strategy remains available", async () => {
    const plan =
      await planner.plan({
        query: "Compare Type Hints and Typing"
      });

    expect(plan.strategy).toBe("comparison");
  });

  it("I: unsupported complex question fails closed without inventing parts", async () => {
    const context =
      builder.build({
        evidence: filterCompatibleEvidence(
          "Who proposed PEP-999, what quantum feature did it introduce, and which galaxy accepted it?",
          [
            evidenceOf(proposal),
            evidenceOf(author, 0.9, rel(proposal.id, author.id, "PROPOSED_BY"))
          ]
        )
      });

    expect(context.evidence).toHaveLength(0);

    const outcome =
      verifier.verify({
        result: {
          answer: "Someone proposed PEP-999 in another galaxy.",
          confidence: 0.95,
          citations: [],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.answer).toBe("");
    expect(outcome.result.confidence).toBe(0);
  });

  it("J: wrong-topic complex query cannot borrow PEP-484 evidence", () => {
    const kept =
      filterCompatibleEvidence(
        "Who proposed PEP-8, what readability feature did it introduce, and why was it accepted?",
        [
          evidenceOf(proposal),
          evidenceOf(author, 0.9, rel(proposal.id, author.id, "PROPOSED_BY")),
          evidenceOf(feature, 0.9, rel(proposal.id, feature.id, "INTRODUCES"))
        ]
      );

    expect(kept).toEqual([]);
  });

  it("K: hybrid provenance can coexist with real graph relationships", () => {
    const evidence: Evidence[] = [
      {
        ...evidenceOf(proposal, 0.9),
        metadata: {
          sources: ["graph", "vector"],
          graphScore: 6,
          vectorScore: 0.8
        }
      },
      evidenceOf(
        feature,
        0.9,
        rel(proposal.id, feature.id, "INTRODUCES")
      )
    ];

    const kept =
      filterCompatibleEvidence(
        "What is PEP-484 and what did it introduce?",
        evidence
      );

    expect(kept[0]?.metadata?.sources).toEqual([
      "graph",
      "vector"
    ]);
    expect(
      kept.some(
        item => item.relationship?.type === "INTRODUCES"
      )
    ).toBe(true);
  });

  it("L: verification rejects unsupported causal claims without relationships", () => {
    const context =
      builder.build({
        evidence: [evidenceOf(proposal)]
      });
    context.query = "Why was PEP-484 proposed?";

    expect(
      causalClaimsAreGrounded(
        "PEP-484 was proposed because quantum networking required types.",
        context
      )
    ).toBe(false);

    const outcome =
      verifier.verify({
        result: {
          answer:
            "PEP-484 was proposed because quantum networking required types.",
          confidence: 0.99,
          citations: [
            {
              entityId: proposal.id,
              source: proposal.source
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.result.confidence).toBe(0);
    expect(outcome.result.answer).toMatch(/Type Hints \(Proposal\)|Proposal/i);
    expect(outcome.result.answer).toMatch(
      /does not establish the requested relationship/i
    );
    expect(outcome.result.answer).not.toMatch(/quantum networking/i);
  });

  it("grounded how/why answers keep confidence in [0,1]", async () => {
    const plan =
      await planner.plan({
        query: "Why was PEP-484 proposed?"
      });

    const expanded =
      await new SingleHopStrategy().execute(
        createGraph() as never,
        plan,
        { evidence: [evidenceOf(proposal, 6.25)] }
      );

    const context =
      builder.build(expanded);
    context.query = "Why was PEP-484 proposed?";

    const generated =
      await new DefaultAnswerGenerator().generate(context);

    const verified =
      verifier.verify({
        result: generated,
        context
      });

    expect(verified.report.accepted).toBe(true);
    expect(verified.result.confidence).toBeGreaterThan(0);
    expect(verified.result.confidence).toBeLessThanOrEqual(1);
    expect(verified.result.confidence).toBe(
      computeGroundedAnswerConfidence({
        evidence: context.evidence
      })
    );
    expect(
      verified.result.trace.steps.some(step =>
        /via (INTRODUCES|ADDRESSES)/.test(step.description)
      )
    ).toBe(true);
  });

  it("queryRequiresRelationalEvidence covers how/why/focus forms", () => {
    expect(
      queryRequiresRelationalEvidence("Why was PEP-484 proposed?")
    ).toBe(true);
    expect(
      queryRequiresRelationalEvidence("How did PEP-484 address readability?")
    ).toBe(true);
    expect(
      queryRequiresRelationalEvidence("What is PEP-484?")
    ).toBe(false);
  });

});
