import { describe, expect, it } from "vitest";

import { mergeResults }
from "../src/utils/merge-results.js";

describe("mergeResults", () => {

  it("should merge unique entities", () => {

    const results = mergeResults(

      [

        {
          entity: {
            id: "proposal:PEP-484",
            type: "Proposal",
            label: "Type Hints",
            source: "pep",
            confidence: 1,
            properties: {}
          },
          score: 6,
          source: "graph"
        }

      ],

      [

        {
          entity: {
            id: "author:guido-van-rossum",
            type: "Author",
            label: "Guido van Rossum",
            source: "pep",
            confidence: 1,
            properties: {}
          },
          score: 4,
          source: "vector"
        }

      ]

    );

    expect(results).toHaveLength(2);

  });

  it("should keep highest score for duplicates", () => {

    const results = mergeResults(

      [

        {
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
        }

      ],

      [

        {
          entity: {
            id: "proposal:PEP-484",
            type: "Proposal",
            label: "Type Hints",
            source: "pep",
            confidence: 1,
            properties: {}
          },
          score: 9,
          source: "vector"
        }

      ]

    );

    expect(results).toHaveLength(1);

    expect(results[0].score).toBe(9);

  });

});