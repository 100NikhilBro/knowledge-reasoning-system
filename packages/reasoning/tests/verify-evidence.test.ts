import {

  describe,
  expect,
  it

} from "vitest";

import {

  verifyEvidence

} from "../src/utils/verify-evidence.js";

describe(

  "Verify Evidence",

  () => {

    it(

      "filters invalid evidence",

      () => {

        const result =

          verifyEvidence([

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

            },

            {

              entity: {

                id: "",

                type: "Proposal",

                label: "Broken",

                source: "",

                confidence: 1,

                properties: {}

              },

              score: 1,

              source: "graph"

            }

          ]);

        expect(

          result.valid

        ).toHaveLength(1);

        expect(

          result.rejected

        ).toHaveLength(1);

      }

    );

  }

);