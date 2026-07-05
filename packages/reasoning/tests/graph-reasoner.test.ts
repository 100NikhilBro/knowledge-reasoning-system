import {

  describe,
  expect,
  it,
  vi

} from "vitest";

import {

  DefaultGraphReasoner

} from "../src/services/graph-reasoner.service.js";

describe(

  "Graph Reasoner",

  () => {

    it(

      "should keep existing evidence",

      async () => {

        const service =

          new DefaultGraphReasoner();

        vi.spyOn(

          service["graph"],

          "findNeighbors"

        ).mockResolvedValue([]);

        const result =

          await service.reason(

           {
  strategy: "multi-hop",

  maxDepth: 3
},

            {

              evidence: [

                {

                  entity: {

                    id: "proposal:PEP-484",

                    type: "Proposal",

                    label: "Type Hints",

                    source: "pep.md",

                    confidence: 1,

                    properties: {}

                  },

                  score: 1,

                  source: "graph"

                }

              ]

            }

          );

        expect(

          result.evidence.length

        ).toBe(1);

      }

    );

  }

);