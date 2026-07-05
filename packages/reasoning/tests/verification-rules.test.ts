import {

  describe,
  expect,
  it

} from "vitest";

import {

  verifyEvidence

} from "../src/utils/verify-evidence.js";

describe(

  "Verification Rules",

  () => {

    it(

      "rejects low confidence evidence",

      () => {

        const result =

          verifyEvidence([

            {

              entity: {

                id: "1",

                type: "Proposal",

                label: "PEP",

                source: "pep.md",

                confidence: 0.2,

                properties: {}

              },

              score: 1,

              source: "graph"

            }

          ]);

        expect(

          result.valid

        ).toHaveLength(0);

      }

    );

  }

);