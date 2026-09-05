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
  BFSTraversal
} from "../src/traversal/bfs-traversal.js";

import {
  MultiHopStrategy,
  traversalHitsToEvidence
} from "../src/strategy/multi-hop.strategy.js";

import {
  filterCompatibleEvidence
} from "../src/utils/query-evidence-compatibility.js";

import {
  computeGroundedAnswerConfidence
} from "../src/utils/compute-grounded-confidence.js";

import {
  DefaultContextBuilder
} from "../src/services/context-builder.service.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

import {
  DefaultAnswerGenerator
} from "../src/services/answer-generator.service.js";

function entity(
  id: string,
  type: string,
  label: string
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source: "test.md",
    confidence: 1,
    properties: {}
  };
}

function rel(
  from: string,
  to: string,
  type: string
): KnowledgeRelationship {
  return {
    from,
    to,
    type,
    confidence: 1
  };
}

function evidenceOf(
  e: KnowledgeEntity,
  score = 0.95
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

/**
 * In-memory graph:
 *   Proposal --INTRODUCES--> Feature --ADDRESSES--> Concern
 *   Proposal --PROPOSED_BY--> Author
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
          neighbor: feature,
          relationship: rel(
            proposal.id,
            feature.id,
            "INTRODUCES"
          )
        },
        {
          neighbor: author,
          relationship: rel(
            proposal.id,
            author.id,
            "PROPOSED_BY"
          )
        }
      ]
    ],
    [
      feature.id,
      [
        {
          neighbor: concern,
          relationship: rel(
            feature.id,
            concern.id,
            "ADDRESSES"
          )
        },
        {
          neighbor: proposal,
          relationship: rel(
            proposal.id,
            feature.id,
            "INTRODUCES"
          )
        }
      ]
    ],
    [
      concern.id,
      [
        {
          neighbor: feature,
          relationship: rel(
            feature.id,
            concern.id,
            "ADDRESSES"
          )
        }
      ]
    ],
    [
      author.id,
      [
        {
          neighbor: proposal,
          relationship: rel(
            proposal.id,
            author.id,
            "PROPOSED_BY"
          )
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

describe("relationship-aware multi-hop graph reasoning", () => {

  it("A: single-hop preserves real relationship to neighbor", async () => {
    const bfs =
      new BFSTraversal();
    const graph =
      createGraph();

    const hits =
      await bfs.traverse(
        graph as never,
        { evidence: [evidenceOf(proposal)] },
        1
      );

    const featureHit =
      hits.find(hit => hit.entity.id === feature.id);

    expect(featureHit).toBeDefined();
    expect(featureHit?.relationship).toEqual(
      rel(proposal.id, feature.id, "INTRODUCES")
    );
    expect(featureHit?.relationship?.type).not.toBe("RELATED");
    expect(featureHit?.path.relationships).toHaveLength(1);
    expect(featureHit?.path.relationships[0]?.type).toBe(
      "INTRODUCES"
    );
  });

  it("B/C/D: two-hop traversal preserves distinct directed edges", async () => {
    const bfs =
      new BFSTraversal();
    const graph =
      createGraph();

    const hits =
      await bfs.traverse(
        graph as never,
        { evidence: [evidenceOf(proposal)] },
        2
      );

    const featureHit =
      hits.find(hit => hit.entity.id === feature.id);
    const concernHit =
      hits.find(hit => hit.entity.id === concern.id);

    expect(featureHit?.relationship).toMatchObject({
      from: proposal.id,
      to: feature.id,
      type: "INTRODUCES"
    });

    expect(concernHit?.relationship).toMatchObject({
      from: feature.id,
      to: concern.id,
      type: "ADDRESSES"
    });

    expect(concernHit?.path.relationships.map(r => r.type))
      .toEqual(["INTRODUCES", "ADDRESSES"]);

    expect(concernHit?.path.nodes.map(n => n.id)).toEqual([
      proposal.id,
      feature.id,
      concern.id
    ]);

    expect(
      hits.some(
        hit => hit.relationship?.type === "RELATED"
      )
    ).toBe(false);
  });

  it("E/F: MultiHopStrategy uses real edges, not synthetic RELATED", async () => {
    const strategy =
      new MultiHopStrategy();
    const graph =
      createGraph();

    const expanded =
      await strategy.execute(
        graph as never,
        {
          strategy: "multi-hop",
          traversal: "bfs",
          maxDepth: 2
        },
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
    expect(byId.get(author.id)?.relationship?.type)
      .toBe("PROPOSED_BY");

    expect(
      expanded.evidence.some(
        item => item.relationship?.type === "RELATED"
      )
    ).toBe(false);

    expect(byId.get(feature.id)?.relationship?.from)
      .toBe(proposal.id);
    expect(byId.get(feature.id)?.relationship?.to)
      .toBe(feature.id);
  });

  it("preserves real relationships when endpoints were co-seeded", async () => {
    const graph = createGraph();

    const expanded =
      await new MultiHopStrategy().execute(
        graph as never,
        {
          strategy: "multi-hop",
          traversal: "bfs",
          maxDepth: 2
        },
        {
          evidence: [
            evidenceOf(proposal),
            evidenceOf(feature),
            evidenceOf(concern),
            evidenceOf(author)
          ]
        }
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
    expect(byId.get(author.id)?.relationship?.type)
      .toBe("PROPOSED_BY");
    expect(
      expanded.evidence.some(
        item => item.relationship?.type === "RELATED"
      )
    ).toBe(false);
  });

  it("G: expanded neighbors still respect Prompt 1 compatibility", () => {
    const hits = [
      {
        entity: proposal,
        depth: 0,
        path: {
          nodes: [proposal],
          relationships: [],
          length: 0
        }
      },
      {
        entity: feature,
        depth: 1,
        relationship: rel(
          proposal.id,
          feature.id,
          "INTRODUCES"
        ),
        path: {
          nodes: [proposal, feature],
          relationships: [
            rel(proposal.id, feature.id, "INTRODUCES")
          ],
          length: 1
        }
      },
      {
        entity: concern,
        depth: 2,
        relationship: rel(
          feature.id,
          concern.id,
          "ADDRESSES"
        ),
        path: {
          nodes: [proposal, feature, concern],
          relationships: [
            rel(proposal.id, feature.id, "INTRODUCES"),
            rel(feature.id, concern.id, "ADDRESSES")
          ],
          length: 2
        }
      }
    ];

    const evidence =
      traversalHitsToEvidence(
        hits,
        [evidenceOf(proposal)]
      );

    const compatible =
      filterCompatibleEvidence(
        "What is PEP-484?",
        evidence
      );

    expect(compatible.map(item => item.entity.id).sort())
      .toEqual(
        [proposal.id, feature.id, concern.id].sort()
      );

    const rejected =
      filterCompatibleEvidence(
        "What is PEP-8?",
        evidence
      );

    expect(rejected).toEqual([]);
  });

  it("H: public confidence stays in [0,1] after multi-hop expansion", async () => {
    const strategy =
      new MultiHopStrategy();
    const graph =
      createGraph();

    const expanded =
      await strategy.execute(
        graph as never,
        {
          strategy: "multi-hop",
          traversal: "bfs",
          maxDepth: 2
        },
        {
          evidence: [
            evidenceOf(proposal, 6.25)
          ]
        }
      );

    const confidence =
      computeGroundedAnswerConfidence(expanded);

    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
    expect(confidence).not.toBe(6.25);

    const context =
      new DefaultContextBuilder().build(expanded);
    context.query = "How do PEP-484 and related entities connect?";

    const generated =
      await new DefaultAnswerGenerator().generate(context);

    const verified =
      new DefaultAnswerVerifier().verify({
        result: generated,
        context
      });

    expect(verified.result.confidence).toBeGreaterThanOrEqual(0);
    expect(verified.result.confidence).toBeLessThanOrEqual(1);
  });

});
