import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  Evidence,
  KnowledgeEntity
} from "@knowledge/shared";

import {
  GraphTraversalService
} from "@knowledge/graph";

import {
  detectRelationshipBetweenQuery,
  entityMatchesPhrase
} from "../src/utils/detect-relationship-between-query.js";

import {
  SingleHopStrategy
} from "../src/strategy/single-hop.strategy.js";

import {
  DefaultReasoningPlanner
} from "../src/services/reasoning-planner.service.js";

import {
  DefaultEvidenceSynthesizer
} from "../src/services/evidence-synthesizer.service.js";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

function entity(
  id: string,
  type: string,
  label: string
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source: "pep-484.md",
    confidence: 1,
    properties: {}
  };
}

function evidenceOf(
  e: KnowledgeEntity,
  score: number
): Evidence {
  return {
    entity: e,
    score,
    source: "graph"
  };
}

const proposal = entity(
  "proposal:PEP-484",
  "Proposal",
  "Type Hints"
);

const author = entity(
  "author:guido-van-rossum",
  "Author",
  "Guido van Rossum"
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

const decision = entity(
  "decision:accepted",
  "Decision",
  "Accepted"
);

const pepNeighbors = [
  {
    relationship: {
      from: "proposal:PEP-484",
      to: "author:guido-van-rossum",
      type: "PROPOSED_BY",
      confidence: 1
    },
    neighbor: author
  },
  {
    relationship: {
      from: "proposal:PEP-484",
      to: "feature:typing",
      type: "INTRODUCES",
      confidence: 1
    },
    neighbor: feature
  },
  {
    relationship: {
      from: "proposal:PEP-484",
      to: "concern:readability",
      type: "ADDRESSES",
      confidence: 1
    },
    neighbor: concern
  },
  {
    relationship: {
      from: "proposal:PEP-484",
      to: "decision:accepted",
      type: "RESULTS_IN",
      confidence: 1
    },
    neighbor: decision
  }
];

describe("detectRelationshipBetweenQuery", () => {
  it("parses relationship-between endpoints", () => {
    expect(
      detectRelationshipBetweenQuery(
        "What is the relationship between PEP-484 and quantum computing?"
      )
    ).toEqual({
      left: "PEP-484",
      right: "quantum computing"
    });
  });

  it("does not treat focused who-proposed as relationship-between", () => {
    expect(
      detectRelationshipBetweenQuery("Who proposed PEP-484?")
    ).toBeUndefined();
  });

  it("matches entities only from grounded fields", () => {
    expect(entityMatchesPhrase(proposal, "PEP-484")).toBe(true);
    expect(
      entityMatchesPhrase(proposal, "quantum computing")
    ).toBe(false);
  });
});

describe("unsupported relationship-between fail-closed", () => {
  it("plans relationship-between as single-hop with pair requirement", async () => {
    const plan = await new DefaultReasoningPlanner().plan({
      query:
        "What is the relationship between PEP-484 and quantum computing?"
    });

    expect(plan.strategy).toBe("single-hop");
    expect(plan.requireRelationshipBetween).toEqual({
      left: "PEP-484",
      right: "quantum computing"
    });
    expect(plan.focusRelationships).toBeUndefined();
  });

  it("returns endpoint entities without inventing an edge when the pair is ungrounded", async () => {
    const graph = {
      findNeighbors: vi.fn(async () => pepNeighbors)
    } as unknown as GraphTraversalService;

    const expanded = await new SingleHopStrategy().execute(
      graph,
      {
        strategy: "single-hop",
        traversal: "dfs",
        maxDepth: 1,
        requireRelationshipBetween: {
          left: "PEP-484",
          right: "quantum computing"
        }
      },
      {
        evidence: [
          evidenceOf(proposal, 0.95),
          evidenceOf(feature, 0.9),
          evidenceOf(author, 0.85),
          evidenceOf(concern, 0.8),
          evidenceOf(decision, 0.75)
        ]
      }
    );

    expect(
      expanded.evidence.map(item => item.entity.id)
    ).toEqual(["proposal:PEP-484"]);
    expect(
      expanded.evidence.every(item => !item.relationship)
    ).toBe(true);
  });

  it("does not substitute unrelated PEP neighbors as the answer", async () => {
    const synthesizer = new DefaultEvidenceSynthesizer();
    const contextBuilder = new DefaultContextBuilder();
    const generator = new DefaultAnswerGenerator();
    const verifier = new DefaultAnswerVerifier();

    const synthesized = await synthesizer.synthesize({
      evidence: []
    });

    const context = contextBuilder.build(synthesized);
    const generated = await generator.generate(context);
    const verified = verifier.verify({
      result: generated,
      context
    });

    expect(verified.result).toMatchObject({
      answer: "",
      confidence: 0,
      citations: [],
      trace: { steps: [] }
    });

    expect(
      verified.result.answer
    ).not.toMatch(/Type Hints|Typing|Guido|Readability|Accepted/i);
  });

  it("grounds a real relationship-between when both sides exist", async () => {
    const graph = {
      findNeighbors: vi.fn(async () => pepNeighbors)
    } as unknown as GraphTraversalService;

    const expanded = await new SingleHopStrategy().execute(
      graph,
      {
        strategy: "single-hop",
        traversal: "dfs",
        maxDepth: 1,
        requireRelationshipBetween: {
          left: "PEP-484",
          right: "typing"
        }
      },
      {
        evidence: [evidenceOf(proposal, 0.95)]
      }
    );

    const ids = expanded.evidence.map(item => item.entity.id).sort();

    expect(ids).toEqual([
      "feature:typing",
      "proposal:PEP-484"
    ]);

    expect(
      expanded.evidence.every(
        item => item.relationship?.type === "INTRODUCES"
      )
    ).toBe(true);
  });

  it("keeps who-proposed Author evidence", async () => {
    const graph = {
      findNeighbors: vi.fn(async () => pepNeighbors)
    } as unknown as GraphTraversalService;

    const expanded = await new SingleHopStrategy().execute(
      graph,
      {
        strategy: "single-hop",
        traversal: "dfs",
        maxDepth: 1,
        focusRelationships: ["PROPOSED_BY"]
      },
      {
        evidence: [
          evidenceOf(proposal, 0.95),
          evidenceOf(feature, 0.9)
        ]
      }
    );

    expect(
      expanded.evidence.map(item => item.entity.id)
    ).toEqual([
      "proposal:PEP-484",
      "author:guido-van-rossum"
    ]);
  });

  it("keeps concern ADDRESSES evidence", async () => {
    const graph = {
      findNeighbors: vi.fn(async () => pepNeighbors)
    } as unknown as GraphTraversalService;

    const expanded = await new SingleHopStrategy().execute(
      graph,
      {
        strategy: "single-hop",
        traversal: "dfs",
        maxDepth: 1,
        focusRelationships: ["ADDRESSES"]
      },
      {
        evidence: [evidenceOf(proposal, 0.95)]
      }
    );

    expect(
      expanded.evidence.map(item => item.entity.id)
    ).toEqual([
      "proposal:PEP-484",
      "concern:readability"
    ]);
  });

  it("keeps decision RESULTS_IN evidence", async () => {
    const graph = {
      findNeighbors: vi.fn(async () => pepNeighbors)
    } as unknown as GraphTraversalService;

    const plan = await new DefaultReasoningPlanner().plan({
      query: "What decision resulted from PEP-484?"
    });

    expect(plan.focusRelationships).toEqual(["RESULTS_IN"]);

    const expanded = await new SingleHopStrategy().execute(
      graph,
      plan,
      {
        evidence: [evidenceOf(proposal, 0.95)]
      }
    );

    expect(
      expanded.evidence.map(item => item.entity.id)
    ).toEqual([
      "proposal:PEP-484",
      "decision:accepted"
    ]);
  });

  it("passes unfocused lookup evidence through unchanged", async () => {
    const collected = {
      evidence: [
        evidenceOf(proposal, 0.95),
        evidenceOf(feature, 0.9)
      ]
    };

    const expanded = await new SingleHopStrategy().execute(
      {
        findNeighbors: vi.fn()
      } as unknown as GraphTraversalService,
      {
        strategy: "single-hop",
        traversal: "dfs",
        maxDepth: 1
      },
      collected
    );

    expect(expanded).toEqual(collected);
  });
});
