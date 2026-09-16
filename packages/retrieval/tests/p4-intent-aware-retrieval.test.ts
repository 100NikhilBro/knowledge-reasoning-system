import { describe, expect, it, vi } from "vitest";

import { RetrievalService }
from "../src/services/retrieval.service.js";

import { SimpleRanker }
from "../src/ranking/simple-ranker.js";

import { mergeResults }
from "../src/utils/merge-results.js";

import { mergeResultsWrrf }
from "../src/utils/merge-results-wrrf.js";

import { applyRetrievalQualityGates }
from "../src/utils/quality-gates.js";

import { analyzeHybridQuery }
from "../src/utils/analyze-hybrid-query.js";

import type { RetrievalResult }
from "../src/types/retrieval-result.js";

import type { KnowledgeEntity }
from "@knowledge/shared";

function entity(
  id: string,
  type: KnowledgeEntity["type"],
  label: string,
  source = "pep-484.md"
): KnowledgeEntity {
  return {
    id,
    type,
    label,
    source,
    confidence: 1,
    properties: {}
  };
}

function result(
  id: string,
  score: number,
  source: "graph" | "vector",
  label?: string,
  doc = "pep-484.md",
  type?: KnowledgeEntity["type"]
): RetrievalResult {
  const inferredType =
    type ??
    (id.startsWith("proposal")
      ? "Proposal"
      : id.startsWith("author")
        ? "Author"
        : id.startsWith("concern")
          ? "Concern"
          : "Feature");

  return {
    entity: entity(
      id,
      inferredType,
      label ?? id,
      doc
    ),
    score,
    source
  };
}

describe("P4 intent-aware hybrid retrieval", () => {

  it("Test 1: exact PEP identifier retrieval", async () => {
    const graph = {
      retrieve: vi.fn(async () => [
        result("proposal:PEP-484", 12, "graph", "Type Hints")
      ])
    };
    const vector = {
      retrieve: vi.fn(async () => [
        result("feature:typing", 0.4, "vector", "Typing")
      ])
    };

    const service =
      new RetrievalService(graph, vector, new SimpleRanker());

    const results =
      await service.retrieve({
        query: "PEP-484",
        intent: "FACT",
        entities: ["PEP-484"],
        topK: 5,
        mode: "hybrid"
      });

    expect(results.map(item => item.entity.id)).toContain(
      "proposal:PEP-484"
    );
    expect(graph.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        topK: expect.any(Number),
        intent: "FACT"
      })
    );
  });

  it("Test 2: semantic paraphrase prefers vector channel weight", () => {
    const analysis =
      analyzeHybridQuery(
        "Python type annotation proposal",
        { intent: "FACT" }
      );

    expect(analysis.preference).toBe("vector");
  });

  it("Test 3: entity retrieval across multiple PEP documents", async () => {
    const graph = {
      retrieve: vi.fn(async () => [
        result("proposal:PEP-484", 8, "graph", "Type Hints", "pep-484.md"),
        result(
          "proposal:PEP-604",
          7,
          "graph",
          "Union operators",
          "pep-604.md"
        )
      ])
    };
    const vector = {
      retrieve: vi.fn(async () => [
        result(
          "proposal:PEP-604",
          0.88,
          "vector",
          "Union operators",
          "pep-604.md"
        )
      ])
    };

    const service =
      new RetrievalService(graph, vector, new SimpleRanker());

    const results =
      await service.retrieve({
        query: "What did PEP-604 change about unions?",
        intent: "RELATIONSHIP",
        entities: ["PEP-604"],
        topK: 5,
        mode: "hybrid"
      });

    const ids =
      results.map(item => item.entity.id);

    expect(ids).toContain("proposal:PEP-604");
    expect(
      results.find(item => item.entity.id === "proposal:PEP-604")
        ?.entity.source
    ).toBe("pep-604.md");
  });

  it("Test 4: relationship query retrieves required endpoint", async () => {
    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            result("proposal:PEP-484", 9, "graph", "Type Hints"),
            result("feature:typing", 8, "graph", "Typing")
          ])
        },
        {
          retrieve: vi.fn(async () => [
            result("feature:typing", 0.5, "vector", "Typing")
          ])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "What does PEP-484 introduce?",
        intent: "RELATIONSHIP",
        entities: ["PEP-484", "Typing"],
        relationshipRequested: ["INTRODUCES"],
        topK: 5,
        mode: "hybrid"
      });

    expect(results.map(item => item.entity.id)).toEqual(
      expect.arrayContaining([
        "proposal:PEP-484",
        "feature:typing"
      ])
    );
  });

  it("Test 5: direct query does not invent a direct edge (retrieval only)", async () => {
    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            result("feature:typing", 8, "graph", "Typing"),
            result("concern:readability", 7, "graph", "Readability")
          ]),
          expandFromSeeds: vi.fn(async () => [
            entity("proposal:PEP-484", "Proposal", "Type Hints")
          ])
        },
        {
          retrieve: vi.fn(async () => [])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "How is Typing directly related to Readability?",
        intent: "DIRECT_RELATIONSHIP",
        entities: ["Typing", "Readability"],
        topK: 8,
        mode: "hybrid"
      });

    /*
     * Retrieval may surface endpoints; it must not attach a fabricated
     * DIRECT relationship type in provenance.
     */
    for (const item of results) {
      expect(item.metadata?.relationshipType).not.toBe("DIRECT");
      expect(item.metadata?.fabricatedDirectEdge).toBeUndefined();
    }

    expect(results.map(item => item.entity.id)).toEqual(
      expect.arrayContaining([
        "feature:typing",
        "concern:readability"
      ])
    );
  });

  it("Test 6: connected/bridge query expands from seeds with bounds", async () => {
    const expandFromSeeds =
      vi.fn(async (
        seeds: KnowledgeEntity[],
        options?: { maxNeighborsPerNode?: number; maxTotal?: number }
      ) => {
        expect(options?.maxNeighborsPerNode).toBeLessThanOrEqual(5);
        expect(options?.maxTotal).toBeLessThanOrEqual(20);
        expect(seeds.length).toBeGreaterThan(0);

        return [
          entity("proposal:PEP-484", "Proposal", "Type Hints")
        ];
      });

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            result("feature:typing", 8, "graph", "Typing"),
            result("concern:readability", 7, "graph", "Readability")
          ]),
          expandFromSeeds
        },
        {
          retrieve: vi.fn(async () => [])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query:
          "How are Typing and Readability connected through PEP-484?",
        intent: "BRIDGE_RELATIONSHIP",
        entities: ["Typing", "Readability", "PEP-484"],
        topK: 10,
        mode: "hybrid"
      });

    expect(expandFromSeeds).toHaveBeenCalledOnce();
    expect(
      results.some(item =>
        item.entity.id === "proposal:PEP-484" ||
        item.metadata?.expanded === true
      )
    ).toBe(true);
  });

  it("Test 7: implication query retrieves claim-relevant evidence", async () => {
    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            result("feature:typing", 8, "graph", "Typing"),
            result(
              "concern:runtime-performance",
              6,
              "graph",
              "Runtime Performance"
            )
          ])
        },
        {
          retrieve: vi.fn(async () => [
            result("feature:typing", 0.7, "vector", "Typing")
          ])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query:
          "Can we conclude that Typing improves runtime performance?",
        intent: "IMPLICATION",
        entities: ["Typing", "Runtime Performance"],
        claims: [{
          subject: "Typing",
          predicate: "IMPROVES",
          object: "Runtime Performance"
        }],
        topK: 5,
        mode: "hybrid"
      });

    expect(results.map(item => item.entity.id)).toEqual(
      expect.arrayContaining([
        "feature:typing",
        "concern:runtime-performance"
      ])
    );
  });

  it("Test 8: compound query covers required clause entities", async () => {
    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            result("author:guido", 9, "graph", "Guido van Rossum"),
            result("feature:typing", 8, "graph", "Typing"),
            result("concern:readability", 7, "graph", "Readability")
          ])
        },
        {
          retrieve: vi.fn(async () => [])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query:
          "Who proposed PEP-484, what did it introduce, and what concern did it address?",
        intent: "COMPOUND",
        entities: [
          "PEP-484",
          "Guido van Rossum",
          "Typing",
          "Readability"
        ],
        topK: 10,
        mode: "hybrid"
      });

    const ids =
      results.map(item => item.entity.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "author:guido",
        "feature:typing",
        "concern:readability"
      ])
    );
  });

  it("Test 9: OUT_OF_CORPUS does not force weak evidence", async () => {
    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            result("proposal:PEP-484", 2, "graph", "Type Hints")
          ])
        },
        {
          retrieve: vi.fn(async () => [
            result("proposal:PEP-484", 0.2, "vector", "Type Hints")
          ])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "What is the capital of France?",
        intent: "OUT_OF_CORPUS",
        topK: 5,
        mode: "hybrid"
      });

    expect(results).toEqual([]);
  });

  it("Test 10: single-channel failure remains safe", async () => {
    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            result("proposal:PEP-484", 5, "graph", "Type Hints")
          ])
        },
        {
          retrieve: vi.fn(async () => {
            throw new Error("qdrant down");
          })
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "PEP-484",
        intent: "FACT",
        entities: ["PEP-484"],
        mode: "hybrid"
      });

    expect(results).toHaveLength(1);
    expect(results[0].metadata?.channelsSucceeded).toEqual(["graph"]);
    expect(results[0].metadata?.channelsAttempted).toEqual([
      "graph",
      "vector"
    ]);
  });

  it("Test 11: repeated hybrid retrieval is deterministic", async () => {
    const graphPayload = [
      result("proposal:PEP-484", 6, "graph", "Type Hints"),
      result("feature:typing", 5, "graph", "Typing")
    ];
    const vectorPayload = [
      result("proposal:PEP-484", 0.7, "vector", "Type Hints")
    ];

    const service =
      new RetrievalService(
        { retrieve: vi.fn(async () => graphPayload) },
        { retrieve: vi.fn(async () => vectorPayload) },
        new SimpleRanker()
      );

    const query = {
      query: "What does PEP-484 introduce?",
      intent: "RELATIONSHIP" as const,
      entities: ["PEP-484", "Typing"],
      topK: 5,
      mode: "hybrid" as const
    };

    const first =
      await service.retrieve(query);
    const second =
      await service.retrieve(query);

    expect(first.map(item => item.entity.id)).toEqual(
      second.map(item => item.entity.id)
    );
    expect(first.map(item => item.score)).toEqual(
      second.map(item => item.score)
    );
  });

  it("Test 12: weighted fusion vs WRRF both keep dual-hit entity", () => {
    const graph = [
      result("proposal:PEP-484", 9, "graph", "Type Hints"),
      result("feature:typing", 4, "graph", "Typing")
    ];
    const vector = [
      result("proposal:PEP-484", 0.95, "vector", "Type Hints"),
      result("concern:readability", 0.4, "vector", "Readability")
    ];

    const weighted =
      mergeResults(graph, vector, "What is PEP-484?", {
        intent: "FACT"
      });

    const wrrf =
      mergeResultsWrrf(graph, vector, "What is PEP-484?", {
        intent: "FACT"
      });

    expect(weighted.map(item => item.entity.id)).toContain(
      "proposal:PEP-484"
    );
    expect(wrrf.map(item => item.entity.id)).toContain(
      "proposal:PEP-484"
    );

    const weightedProposal =
      weighted.find(item => item.entity.id === "proposal:PEP-484");
    const wrrfProposal =
      wrrf.find(item => item.entity.id === "proposal:PEP-484");

    expect(weightedProposal?.metadata?.sources).toEqual([
      "graph",
      "vector"
    ]);
    expect(wrrfProposal?.metadata?.sources).toEqual([
      "graph",
      "vector"
    ]);
    expect(wrrfProposal?.metadata?.fusion).toBe("wrrf");

    /*
     * Measured on this fixture: weighted fusion places the dual-hit first;
     * WRRF also ranks it first. Keep weighted as default (no regression).
     */
    expect(weighted[0].entity.id).toBe("proposal:PEP-484");
    expect(wrrf[0].entity.id).toBe("proposal:PEP-484");
  });

  it("Test 13: quality gates reject incompatible weak candidates", () => {
    const gated =
      applyRetrievalQualityGates(
        [
          result("proposal:PEP-484", 0.9, "graph", "Type Hints"),
          result(
            "feature:quantum",
            0.05,
            "vector",
            "Quantum Computing",
            "unrelated.md"
          )
        ],
        {
          query: "What does PEP-484 introduce?",
          intent: "RELATIONSHIP",
          entities: ["PEP-484", "Typing"],
          topK: 5
        }
      );

    expect(gated.map(item => item.entity.id)).toContain(
      "proposal:PEP-484"
    );
    expect(gated.map(item => item.entity.id)).not.toContain(
      "feature:quantum"
    );
  });

  it("Test 14: provenance records channel origin after fusion", async () => {
    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            result("proposal:PEP-484", 8, "graph", "Type Hints")
          ])
        },
        {
          retrieve: vi.fn(async () => [
            result("proposal:PEP-484", 0.8, "vector", "Type Hints")
          ])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "PEP-484",
        intent: "FACT",
        entities: ["PEP-484"],
        mode: "hybrid"
      });

    const hit =
      results.find(item => item.entity.id === "proposal:PEP-484");

    expect(hit?.metadata?.sources).toEqual(["graph", "vector"]);
    expect(hit?.metadata?.channelsSucceeded).toEqual([
      "graph",
      "vector"
    ]);
    expect(hit?.metadata?.fusion).toBe("weighted");
  });

  it("Test 15: graph expansion respects depth/branching bounds", async () => {
    const expandFromSeeds =
      vi.fn(async (
        _seeds: KnowledgeEntity[],
        options?: { maxNeighborsPerNode?: number; maxTotal?: number }
      ) => {
        expect(options?.maxNeighborsPerNode).toBe(4);
        expect(options?.maxTotal).toBe(12);

        return Array.from({ length: 20 }, (_, index) =>
          entity(
            `feature:extra-${index}`,
            "Feature",
            `Extra ${index}`
          )
        );
      });

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            result("feature:typing", 8, "graph", "Typing")
          ]),
          expandFromSeeds
        },
        { retrieve: vi.fn(async () => []) },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "How is Typing connected to Readability through PEP-484?",
        intent: "CONNECTED_RELATIONSHIP",
        entities: ["Typing", "Readability", "PEP-484"],
        topK: 5,
        mode: "hybrid"
      });

    expect(expandFromSeeds).toHaveBeenCalledOnce();
    /*
     * Final topK still bounds evidence delivered to callers.
     */
    expect(results.length).toBeLessThanOrEqual(5);
  });

});
