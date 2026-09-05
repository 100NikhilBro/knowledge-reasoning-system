import { describe, expect, it } from "vitest";

import { mergeResults }
from "../src/utils/merge-results.js";

import { analyzeHybridQuery }
from "../src/utils/analyze-hybrid-query.js";

import type { RetrievalResult }
from "../src/types/retrieval-result.js";

const proposalGraph: RetrievalResult = {
  entity: {
    id: "proposal:PEP-484",
    type: "Proposal",
    label: "Type Hints",
    source: "pep",
    confidence: 1,
    properties: {}
  },
  score: 5,
  source: "graph"
};

const proposalVector: RetrievalResult = {
  entity: {
    id: "proposal:PEP-484",
    type: "Proposal",
    label: "Type Hints",
    source: "pep",
    confidence: 1,
    properties: {}
  },
  score: 0.9,
  source: "vector",
  metadata: { section: "abstract" }
};

const authorVector: RetrievalResult = {
  entity: {
    id: "author:guido-van-rossum",
    type: "Author",
    label: "Guido van Rossum",
    source: "pep",
    confidence: 1,
    properties: {}
  },
  score: 0.4,
  source: "vector"
};

describe("analyzeHybridQuery", () => {

  it("prefers graph for relationship-oriented questions", () => {
    expect(
      analyzeHybridQuery("Who proposed PEP-484?").preference
    ).toBe("graph");
  });

  it("prefers vector for conceptual paraphrases without topic codes", () => {
    expect(
      analyzeHybridQuery("Explain the idea of type hints").preference
    ).toBe("vector");
  });

  it("balances entity lookup + semantics", () => {
    expect(
      analyzeHybridQuery("What is PEP-484?").preference
    ).toBe("balanced");
  });

});

describe("mergeResults", () => {

  it("should merge unique entities", () => {

    const results = mergeResults(
      [proposalGraph],
      [authorVector],
      "type hints"
    );

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(
      results.map(item => item.entity.id)
    ).toEqual(
      expect.arrayContaining([
        "proposal:PEP-484",
        "author:guido-van-rossum"
      ])
    );

  });

  it("should deduplicate entities and preserve dual provenance without raw score sum", () => {

    const results = mergeResults(
      [proposalGraph],
      [proposalVector],
      "What is PEP-484?"
    );

    expect(results).toHaveLength(1);
    expect(results[0].score).toBeLessThanOrEqual(1);
    expect(results[0].score).not.toBe(5.9);
    expect(results[0].metadata).toMatchObject({
      sources: ["graph", "vector"],
      graphScore: 5,
      vectorScore: 0.9,
      section: "abstract"
    });

  });

  it("should keep graph entity payload when both channels hit", () => {

    const results = mergeResults(
      [proposalGraph],
      [{
        ...proposalVector,
        entity: {
          ...proposalVector.entity,
          label: "Different Label From Vector"
        }
      }],
      "PEP-484"
    );

    expect(results[0].entity.label).toBe("Type Hints");
    expect(results[0].metadata?.sources).toEqual([
      "graph",
      "vector"
    ]);

  });

  it("should keep graph as primary source on normalized score ties", () => {

    const results = mergeResults(
      [{ ...proposalGraph, score: 1 }],
      [{ ...proposalVector, score: 1 }],
      "PEP-484"
    );

    expect(results[0].source).toBe("graph");
    expect(results[0].score).toBeLessThanOrEqual(1);

  });

  it("must not treat raw graph magnitude as fused ranking score", () => {

    const results = mergeResults(
      [{ ...proposalGraph, score: 15 }],
      [{ ...authorVector, score: 0.95 }],
      "Explain readability and type hints"
    );

    for (const result of results) {
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.score).not.toBe(15);
    }

  });

});
