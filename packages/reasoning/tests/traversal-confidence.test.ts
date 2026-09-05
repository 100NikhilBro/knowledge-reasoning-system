import {

  describe,
  expect,
  it,
  vi

} from "vitest";

import {

  BFSTraversal

} from "../src/traversal/bfs-traversal.js";

import {

  GraphTraversalService

} from "@knowledge/graph";

describe(

  "Traversal Confidence",

  () => {

    it(

      "assigns propagated confidence",

      async () => {

        const graph =

          new GraphTraversalService();

        vi.spyOn(

          graph,

          "findNeighbors"

        ).mockResolvedValue([]);

        const bfs =

          new BFSTraversal();

        const result =

          await bfs.traverse(

            graph,

            {

              evidence: [

                {

                  entity: {

                    id: "1",

                    type: "Proposal",

                    label: "PEP",

                    source: "pep.md",

                    confidence: 1,

                    properties: {}

                  },

                  score: 1,

                  source: "graph"

                }

              ]

            },

            2

          );

        expect(

          result[0].entity.confidence

        ).toBeCloseTo(

          1

        );

        expect(

          result[0].depth

        ).toBe(0);

      }

    );

  }

);