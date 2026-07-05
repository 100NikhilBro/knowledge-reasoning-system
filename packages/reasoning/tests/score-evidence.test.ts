import {

  describe,
  expect,
  it

} from "vitest";

import {

  scoreEvidence

} from "../src/utils/score-evidence.js";

describe(

  "Score Evidence",

  () => {

    it(

      "should return weighted score",

      () => {

        const result =

          scoreEvidence({

            entity: {

              id: "1",

              type: "Proposal",

              label: "A",

              source: "doc",

              confidence: 1,

              properties: {}

            },

            score: 1,

            source: "graph"

          });

        expect(

          result

        ).toBeCloseTo(

          1

        );

      }

    );

  }

);