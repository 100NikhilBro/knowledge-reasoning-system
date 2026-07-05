import {

  describe,
  expect,
  it

} from "vitest";

import {

  compareEvidence

} from "../src/utils/compare-evidence.js";

describe(

  "Compare Evidence",

  () => {

    it(

      "should find common entities",

      () => {

        const entity = {

          id: "A",

          type: "Proposal",

          label: "A",

          source: "test",

          confidence: 1,

          properties: {}

        };

        const result =

          compareEvidence(

            {

              evidence: [

                {

                  entity,

                  score: 1,

                  source: "graph"

                }

              ]

            },

            {

              evidence: [

                {

                  entity,

                  score: 0.8,

                  source: "graph"

                }

              ]

            }

          );

        expect(

          result.common

        ).toHaveLength(1);

        expect(

          result.onlyLeft

        ).toHaveLength(0);

        expect(

          result.onlyRight

        ).toHaveLength(0);

      }

    );

  }

);