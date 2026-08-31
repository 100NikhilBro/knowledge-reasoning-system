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
  source: "graph" | "vector"
): RetrievalResult {

  return {
    entity: {
      id,
      type: id.startsWith("proposal")
        ? "Proposal"
        : "Feature",
      label: id,
      source: "pep-484.md",
      confidence: 1,
      properties: {}
    },
    score,
    source
  };

}

describe("RetrievalService hybrid retrieval", () => {

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

    expect(proposal?.score).toBe(6.8);
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

  it("fails explicitly when a hybrid source errors", async () => {

    const service =
      new RetrievalService(
        {
          retrieve: vi.fn(async () => [
            entityResult("proposal:PEP-484", 1, "graph")
          ])
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
      code: "VECTOR_RETRIEVAL_FAILED",
      message: "embedding failed"
    });

    await expect(
      service.retrieve({
        query: "type hints",
        mode: "hybrid"
      })
    ).rejects.toBeInstanceOf(RetrievalError);

  });

});
