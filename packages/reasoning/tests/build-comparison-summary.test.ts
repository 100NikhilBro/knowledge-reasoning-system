import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildComparisonSummary

} from "../src/utils/build-comparison-summary.js";

describe(

  "Comparison Summary",

  () => {

    it(

      "builds labels",

      () => {

        const result =

          buildComparisonSummary({

            common: [

              {

                entity: {

                  id: "1",

                  label: "PEP-484",

                  type: "Proposal",

                  source: "",

                  confidence: 1,

                  properties: {}

                },

                score: 1,

                source: "graph"

              }

            ],

            onlyLeft: [],

            onlyRight: []

          });

        expect(

          result.common

        ).toEqual([

          "PEP-484"

        ]);

      }

    );

  }

);