import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildFinalScore

} from "../src/utils/build-final-score.js";

describe(

  "Build Final Score",

  () => {

    it(

      "recalculates score",

      () => {

        const result =

          buildFinalScore({

            entity: {

              id: "1",

              type: "Proposal",

              label: "PEP",

              source: "pep.md",

              confidence: 1,

              properties: {}

            },

            score: 0.5,

            source: "graph"

          });

        expect(

          result.score

        ).toBeGreaterThan(

          0.5

        );

      }

    );

  }

);