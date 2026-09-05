import { describe, expect, it, vi } from "vitest";

import type { RetrievalResult } from "../src/types/retrieval-result.js";

import { RetrievalService }
from "../src/services/retrieval.service.js";

import { SimpleRanker }
from "../src/ranking/simple-ranker.js";

import { RetrievalError }
from "../src/errors/retrieval-error.js";

function entityResult(
  id: string,
  score: number,
  source: "graph" | "vector",
  label?: string
): RetrievalResult {

  return {
    entity: {
      id,
      type: id.startsWith("proposal")
        ? "Proposal"
        : id.startsWith("author")
          ? "Author"
          : "Feature",
      label: label ?? id,
      source: "pep-484.md",
      confidence: 1,
      properties: id.includes("PEP-484")
        ? { pep: "484" }
        : {}
    },
    score,
    source
  };

}

describe("RetrievalService hybrid retrieval", () => {

  it("A: graph-dominant relationship query keeps graph evidence", async () => {

    const graph = {
      retrieve: vi.fn(async () => [
        entityResult("proposal:PEP-484", 6, "graph", "Type Hints"),
        entityResult("author:guido", 5, "graph", "Guido van Rossum")
      ])
    };

    const vector = {
      retrieve: vi.fn(async () => [
        entityResult("proposal:PEP-484", 0.2, "vector", "Type Hints")
      ])
    };

    const service =
      new RetrievalService(graph, vector, new SimpleRanker());

    const results =
      await service.retrieve({
        query: "Who proposed PEP-484?",
        topK: 5,
        mode: "hybrid"
      });

    expect(graph.retrieve).toHaveBeenCalledOnce();
    expect(results.some(item => item.source === "graph" ||
      (Array.isArray(item.metadata?.sources) &&
        item.metadata.sources.includes("graph")))).toBe(true);
    expect(results.map(item => item.entity.id)).toContain(
      "proposal:PEP-484"
    );

  });

  it("B: vector-dominant conceptual query keeps vector evidence", async () => {

    const graph = {
      retrieve: vi.fn(async () => [])
    };

    const vector = {
      retrieve: vi.fn(async () => [
        entityResult("feature:typing", 0.91, "vector", "Typing")
      ])
    };

    const service =
      new RetrievalService(graph, vector, new SimpleRanker());

    const results =
      await service.retrieve({
        query: "Explain the idea of typing annotations",
        mode: "hybrid"
      });

    expect(vector.retrieve).toHaveBeenCalledOnce();
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("vector");
    expect(results[0].entity.id).toBe("feature:typing");

  });

  it("C: genuine hybrid query preserves dual provenance without duplicates", async () => {

    const graph = {
      retrieve: vi.fn(async () => [
        entityResult("proposal:PEP-484", 6, "graph", "Type Hints"),
        entityResult("feature:typing", 4, "graph", "Typing")
      ])
    };

    const vector = {
      retrieve: vi.fn(async () => [
        entityResult("proposal:PEP-484", 0.8, "vector", "Type Hints"),
        entityResult("concern:readability", 0.55, "vector", "Readability")
      ])
    };

    const service =
      new RetrievalService(graph, vector, new SimpleRanker());

    const results =
      await service.retrieve({
        query: "What is PEP-484 and how does typing improve readability?",
        topK: 10,
        mode: "hybrid"
      });

    expect(graph.retrieve).toHaveBeenCalledOnce();
    expect(vector.retrieve).toHaveBeenCalledOnce();

    const proposal =
      results.find(item => item.entity.id === "proposal:PEP-484");

    expect(proposal).toBeDefined();
    expect(proposal?.metadata?.sources).toEqual([
      "graph",
      "vector"
    ]);
    expect(
      results.filter(item => item.entity.id === "proposal:PEP-484")
    ).toHaveLength(1);
    expect(results.map(item => item.entity.id)).toEqual(
      expect.arrayContaining([
        "proposal:PEP-484",
        "feature:typing",
        "concern:readability"
      ])
    );
    expect(proposal?.score).toBeLessThanOrEqual(1);

  });

  it("F: duplicate entity keeps graph payload and both sources", async () => {

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            entityResult("proposal:PEP-484", 5, "graph", "Type Hints")
          ])
        },
        {
          retrieve: vi.fn(async () => [
            {
              ...entityResult(
                "proposal:PEP-484",
                0.7,
                "vector",
                "Wrong Label"
              )
            }
          ])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "PEP-484",
        mode: "hybrid"
      });

    expect(results).toHaveLength(1);
    expect(results[0].entity.label).toBe("Type Hints");
    expect(results[0].metadata?.sources).toEqual([
      "graph",
      "vector"
    ]);

  });

  it("G: empty retrieval returns empty", async () => {

    const service =
      new RetrievalService(
        { retrieve: vi.fn(async () => []) },
        { retrieve: vi.fn(async () => []) },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "unsupported quantum photosynthesis",
        mode: "hybrid"
      });

    expect(results).toEqual([]);

  });

  it("H: fused ranking scores stay unit-bounded", async () => {

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            entityResult("proposal:PEP-484", 15, "graph", "Type Hints")
          ])
        },
        {
          retrieve: vi.fn(async () => [
            entityResult("proposal:PEP-484", 0.99, "vector", "Type Hints")
          ])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "What is PEP-484?",
        mode: "hybrid"
      });

    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].score).toBeLessThanOrEqual(1);
    expect(results[0].score).not.toBe(15.99);

  });

  it("merges graph and vector results", async () => {

    const graph = {
      retrieve: vi.fn(async () => [
        entityResult("proposal:PEP-484", 6, "graph"),
        entityResult("feature:typing", 4, "graph")
      ])
    };

    const vector = {
      retrieve: vi.fn(async () => [
        entityResult("proposal:PEP-484", 0.8, "vector"),
        entityResult("author:guido", 0.5, "vector")
      ])
    };

    const service =
      new RetrievalService(
        graph,
        vector,
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "type hints",
        topK: 10,
        mode: "hybrid"
      });

    expect(graph.retrieve).toHaveBeenCalledOnce();
    expect(vector.retrieve).toHaveBeenCalledOnce();

    const ids =
      results.map(result => result.entity.id);

    expect(ids).toContain("proposal:PEP-484");
    expect(ids).toContain("feature:typing");
    expect(ids).toContain("author:guido");

    const proposal =
      results.find(
        result => result.entity.id === "proposal:PEP-484"
      );

    expect(proposal?.score).toBeLessThanOrEqual(1);
    expect(proposal?.metadata?.sources).toEqual([
      "graph",
      "vector"
    ]);

  });

  it("deduplicates duplicate entities across sources", async () => {

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            entityResult("proposal:PEP-484", 5, "graph")
          ])
        },
        {
          retrieve: vi.fn(async () => [
            entityResult("proposal:PEP-484", 0.7, "vector")
          ])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "PEP-484",
        mode: "hybrid"
      });

    expect(results).toHaveLength(1);
    expect(results[0].entity.id).toBe("proposal:PEP-484");

  });

  it("produces deterministic combined ranking", async () => {

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            entityResult("feature:b", 3, "graph"),
            entityResult("feature:a", 3, "graph")
          ])
        },
        {
          retrieve: vi.fn(async () => [])
        },
        new SimpleRanker()
      );

    const first =
      await service.retrieve({
        query: "features",
        mode: "hybrid"
      });

    const second =
      await service.retrieve({
        query: "features",
        mode: "hybrid"
      });

    expect(first.map(item => item.entity.id))
      .toEqual(second.map(item => item.entity.id));

    expect(first.map(item => item.entity.id))
      .toEqual(["feature:a", "feature:b"]);

  });

  it("respects topK after fusion and ranking", async () => {

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            entityResult("proposal:PEP-484", 9, "graph"),
            entityResult("feature:typing", 4, "graph"),
            entityResult("concern:readability", 2, "graph")
          ])
        },
        {
          retrieve: vi.fn(async () => [
            entityResult("author:guido", 0.3, "vector")
          ])
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "typing",
        topK: 2,
        mode: "hybrid"
      });

    expect(results).toHaveLength(2);
    expect(results[0].score)
      .toBeGreaterThanOrEqual(results[1].score);

  });

  it("supports graph-only retrieval", async () => {

    const graph = {
      retrieve: vi.fn(async () => [
        entityResult("proposal:PEP-484", 6, "graph")
      ])
    };

    const vector = {
      retrieve: vi.fn(async () => [
        entityResult("author:guido", 0.9, "vector")
      ])
    };

    const service =
      new RetrievalService(
        graph,
        vector,
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "PEP-484",
        mode: "graph"
      });

    expect(vector.retrieve).not.toHaveBeenCalled();
    expect(graph.retrieve).toHaveBeenCalledOnce();
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("graph");

  });

  it("supports vector-only retrieval", async () => {

    const graph = {
      retrieve: vi.fn(async () => [
        entityResult("proposal:PEP-484", 6, "graph")
      ])
    };

    const vector = {
      retrieve: vi.fn(async () => [
        entityResult("feature:typing", 0.88, "vector")
      ])
    };

    const service =
      new RetrievalService(
        graph,
        vector,
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "typing",
        mode: "vector"
      });

    expect(graph.retrieve).not.toHaveBeenCalled();
    expect(vector.retrieve).toHaveBeenCalledOnce();
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("vector");

  });

  it("allows injected mocked dependencies", async () => {

    const ranker = {
      rank: vi.fn(async (_query, results) => results)
    };

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            entityResult("proposal:PEP-484", 1, "graph")
          ])
        },
        {
          retrieve: vi.fn(async () => [])
        },
        ranker
      );

    await service.retrieve({
      query: "x",
      mode: "hybrid"
    });

    expect(ranker.rank).toHaveBeenCalledOnce();

  });

  it("degrades to graph when vector fails in hybrid mode", async () => {

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            entityResult("proposal:PEP-484", 1, "graph", "Type Hints")
          ])
        },
        {
          retrieve: vi.fn(async () => {
            throw new Error("embedding failed");
          })
        },
        new SimpleRanker()
      );

    const results =
      await service.retrieve({
        query: "What is PEP-484?",
        mode: "hybrid"
      });

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("graph");

  });

  it("fails only when both hybrid sources error", async () => {

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => {
            throw new Error("neo4j down");
          })
        },
        {
          retrieve: vi.fn(async () => {
            throw new Error("embedding failed");
          })
        },
        new SimpleRanker()
      );

    await expect(
      service.retrieve({
        query: "type hints",
        mode: "hybrid"
      })
    ).rejects.toMatchObject({
      code: "RETRIEVAL_FAILED"
    });

    await expect(
      service.retrieve({
        query: "type hints",
        mode: "hybrid"
      })
    ).rejects.toBeInstanceOf(RetrievalError);

  });

});
