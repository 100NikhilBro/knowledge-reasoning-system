import { describe, expect, it } from "vitest";

import { SimpleRanker }
from "../src/ranking/simple-ranker.js";

describe("SimpleRanker", () => {

  it("ranks by retrieval score then entity prior deterministically", async () => {

    const ranker =
      new SimpleRanker();

    const ranked =
      await ranker.rank(
        { query: "q", topK: 10 },
        [
          {
            entity: {
              id: "feature:b",
              type: "Feature",
              label: "B",
              source: "x",
              confidence: 1,
              properties: {}
            },
            score: 3,
            source: "graph"
          },
          {
            entity: {
              id: "feature:a",
              type: "Feature",
              label: "A",
              source: "x",
              confidence: 1,
              properties: {}
            },
            score: 3,
            source: "graph"
          },
          {
            entity: {
              id: "proposal:PEP-484",
              type: "Proposal",
              label: "Type Hints",
              source: "x",
              confidence: 1,
              properties: {}
            },
            score: 5,
            source: "vector"
          }
        ]
      );

    expect(
      ranked.map(item => item.entity.id)
    ).toEqual([
      "proposal:PEP-484",
      "feature:a",
      "feature:b"
    ]);

  });

  it("applies topK", async () => {

    const ranker =
      new SimpleRanker();

    const ranked =
      await ranker.rank(
        { query: "q", topK: 1 },
        [
          {
            entity: {
              id: "a",
              type: "Proposal",
              label: "A",
              source: "x",
              confidence: 1,
              properties: {}
            },
            score: 2,
            source: "graph"
          },
          {
            entity: {
              id: "b",
              type: "Feature",
              label: "B",
              source: "x",
              confidence: 1,
              properties: {}
            },
            score: 1,
            source: "vector"
          }
        ]
      );

    expect(ranked).toHaveLength(1);
    expect(ranked[0].entity.id).toBe("a");

  });

});
