import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import type {
  Evidence,
  EvidenceSet,
  KnowledgeEntity
} from "@knowledge/shared";

import {
  GraphTraversalService
} from "@knowledge/graph";

import {
  detectFocusRelationships
} from "../src/utils/detect-focus-relationships.js";

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
  verifyEvidence
} from "../src/utils/verify-evidence.js";

import {
  DEFAULT_VERIFICATION_RULES
} from "../src/utils/default-verification-rules.js";

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

describe("detectFocusRelationships", () => {
  it("detects PROPOSED_BY for who-proposed queries", () => {
    expect(
      detectFocusRelationships("Who proposed PEP-484?")
    ).toEqual(["PROPOSED_BY"]);
  });

  it("detects ADDRESSES for concern queries", () => {
    expect(
      detectFocusRelationships(
        "What concern is addressed by PEP-484?"
      )
    ).toEqual(["ADDRESSES"]);
  });

  it("leaves lookup queries unfocused", () => {
    expect(
      detectFocusRelationships("What is PEP-484?")
    ).toBeUndefined();
  });

  it("collects every focused relationship for compound queries", () => {
    expect(
      detectFocusRelationships(
        "Who proposed PEP-484, what feature did it introduce, what concern did it address, and what decision resulted from it?"
      )
    ).toEqual([
      "PROPOSED_BY",
      "ADDRESSES",
      "INTRODUCES",
      "RESULTS_IN"
    ]);
  });

  it("includes IMPLEMENTED_IN when a Python version implementation is asked", () => {
    expect(
      detectFocusRelationships(
        "What decision resulted from PEP-484 and which Python version implemented it?"
      )
    ).toEqual([
      "RESULTS_IN",
      "IMPLEMENTED_IN"
    ]);
  });
});

describe("who-proposed relationship focus", () => {
  it("keeps Author in default verification allowlist", () => {
    expect(
      DEFAULT_VERIFICATION_RULES.allowedEntityTypes
    ).toContain("Author");

    const verified = verifyEvidence([
      evidenceOf(author, 0.9)
    ]);

    expect(verified.valid).toHaveLength(1);
    expect(verified.valid[0]?.entity.id).toBe(
      "author:guido-van-rossum"
    );
  });

  it("expands PROPOSED_BY and drops unrelated Feature/Concern", async () => {
    const graph = {
      findNeighbors: vi.fn(async () => [
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
        }
      ])
    } as unknown as GraphTraversalService;

    const strategy = new SingleHopStrategy();

    const collected: EvidenceSet = {
      evidence: [
        evidenceOf(proposal, 0.95),
        evidenceOf(feature, 0.9),
        evidenceOf(concern, 0.85),
        evidenceOf(author, 0.8)
      ]
    };

    const expanded = await strategy.execute(
      graph,
      {
        strategy: "single-hop",
        traversal: "dfs",
        maxDepth: 1,
        focusRelationships: ["PROPOSED_BY"]
      },
      collected
    );

    const ids = expanded.evidence.map(
      item => item.entity.id
    );

    expect(ids).toEqual([
      "proposal:PEP-484",
      "author:guido-van-rossum"
    ]);

    const authorEvidence = expanded.evidence.find(
      item => item.entity.id === "author:guido-van-rossum"
    );

    expect(authorEvidence?.relationship?.type).toBe(
      "PROPOSED_BY"
    );
    expect(authorEvidence?.relationship?.from).toBe(
      "proposal:PEP-484"
    );
    expect(authorEvidence?.relationship?.to).toBe(
      "author:guido-van-rossum"
    );

    expect(
      expanded.evidence.some(
        item => item.entity.type === "Feature"
      )
    ).toBe(false);

    expect(
      expanded.evidence.some(
        item => item.entity.type === "Concern"
      )
    ).toBe(false);
  });

  it("preserves ADDRESSES focus for concern queries", async () => {
    const graph = {
      findNeighbors: vi.fn(async () => [
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
            to: "author:guido-van-rossum",
            type: "PROPOSED_BY",
            confidence: 1
          },
          neighbor: author
        }
      ])
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
        evidence: [
          evidenceOf(proposal, 0.95),
          evidenceOf(author, 0.9),
          evidenceOf(concern, 0.85)
        ]
      }
    );

    expect(
      expanded.evidence.map(item => item.entity.id)
    ).toEqual([
      "proposal:PEP-484",
      "concern:readability"
    ]);
  });

  it("passes through unfocused lookup evidence unchanged", async () => {
    const collected: EvidenceSet = {
      evidence: [
        evidenceOf(proposal, 0.95),
        evidenceOf(feature, 0.9)
      ]
    };

    const graph = {
      findNeighbors: vi.fn()
    } as unknown as GraphTraversalService;

    const expanded = await new SingleHopStrategy().execute(
      graph,
      {
        strategy: "single-hop",
        traversal: "dfs",
        maxDepth: 1
      },
      collected
    );

    expect(expanded).toEqual(collected);
    expect(graph.findNeighbors).not.toHaveBeenCalled();
  });

  it("plans who-proposed as single-hop with PROPOSED_BY focus", async () => {
    const plan = await new DefaultReasoningPlanner().plan({
      query: "Who proposed PEP-484?"
    });

    expect(plan.strategy).toBe("single-hop");
    expect(plan.focusRelationships).toEqual([
      "PROPOSED_BY"
    ]);
  });

  it("keeps Author through synthesis after focus expansion", async () => {
    const synthesizer = new DefaultEvidenceSynthesizer();

    const synthesized = await synthesizer.synthesize({
      evidence: [
        evidenceOf(proposal, 0.95),
        {
          entity: author,
          score: 0.95,
          source: "graph",
          relationship: {
            from: "proposal:PEP-484",
            to: "author:guido-van-rossum",
            type: "PROPOSED_BY",
            confidence: 1
          }
        }
      ]
    });

    expect(
      synthesized.evidence.map(item => item.entity.id)
    ).toContain("author:guido-van-rossum");

    expect(
      synthesized.evidence.find(
        item => item.entity.id === "author:guido-van-rossum"
      )?.relationship?.type
    ).toBe("PROPOSED_BY");
  });
});
