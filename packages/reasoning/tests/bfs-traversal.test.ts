import {

  describe,
  expect,
  it,
  vi

} from "vitest";

import {

  BFSTraversal

} from "../src/traversal/bfs-traversal.js";

describe(

  "BFS Traversal",

  () => {

    it(

      "should return starting node when graph has no neighbors",

      async () => {

        const traversal =

          new BFSTraversal();

        const graph = {

          findNeighbors:

            vi.fn()

              .mockResolvedValue([])

        };

        const result =

          await traversal.traverse(

            graph as any,

            {

              evidence: [

                {

                  entity: {

                    id: "A",

                    type: "Proposal",

                    label: "A",

                    source: "test",

                    confidence: 1,

                    properties: {}

                  },

                  score: 1,

                  source: "graph"

                }

              ]

            },

            3

          );

        expect(

          result

        ).toHaveLength(1);

        expect(

          result[0].entity.id

        ).toBe("A");

        expect(

          result[0].depth

        ).toBe(0);

        expect(

          result[0].relationship

        ).toBeUndefined();

      }

    );

  }

);