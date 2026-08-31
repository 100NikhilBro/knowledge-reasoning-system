import { describe, expect, it } from "vitest";

import { mergeResults }
from "../src/utils/merge-results.js";

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

describe("mergeResults", () => {

  it("should merge unique entities", () => {

    const results = mergeResults(
      [proposalGraph],
      [authorVector]
    );

    expect(results).toHaveLength(2);

  });

  it("should deduplicate entities and fuse graph + vector scores", () => {

    const results = mergeResults(
      [proposalGraph],
      [proposalVector]
    );

    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(5.9);
    expect(results[0].metadata).toMatchObject({
      sources: ["graph", "vector"],
      graphScore: 5,
      vectorScore: 0.9,
      section: "abstract"
    });

  });

  it("should keep graph as primary source on score ties", () => {

    const results = mergeResults(
      [{ ...proposalGraph, score: 1 }],
      [{ ...proposalVector, score: 1 }]
    );

    expect(results[0].source).toBe("graph");
    expect(results[0].score).toBe(2);

  });

});
