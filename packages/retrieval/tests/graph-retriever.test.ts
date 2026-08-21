import {
  describe,
  expect,
  it
} from "vitest";

import {
  Neo4jGraphRetriever
} from "../src/graph/graph.retriever.js";


describe(
  "Neo4jGraphRetriever",
  () => {

    it(
      "finds proposal by graph id",
      async () => {

        const retriever =
          new Neo4jGraphRetriever();

        const result =
          await retriever.findNode(
            "What is PEP-484?"
          );

        console.log(
          "DIRECT NODE RESULT:",
          result
        );

        expect(
          result
        ).not.toBeNull();

        expect(
          result?.id
        ).toBe(
          "proposal:PEP-484"
        );

        expect(
          result?.label
        ).toBe(
          "Type Hints"
        );

      }
    );


    it(
      "retrieves a proposal from a query",
      async () => {

        const retriever =
          new Neo4jGraphRetriever();

        const results =
          await retriever.retrieve({

            query:
              "What is PEP-484?",

            topK:
              5

          });

        console.log(
          "RETRIEVAL RESULTS:",
          results
        );

        expect(
          results.length
        ).toBeGreaterThan(0);

      }
    );

  }
);