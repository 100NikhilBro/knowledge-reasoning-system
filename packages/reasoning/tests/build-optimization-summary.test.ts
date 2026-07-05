import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildOptimizationSummary

} from "../src/utils/build-optimization-summary.js";

describe(

  "Optimization Summary",

  () => {

    it(

      "builds optimization statistics",

      () => {

        const result =

          buildOptimizationSummary(

            {

              hops: [

                1,

                2,

                3,

                4

              ]

            },

            {

              optimized: [

                1,

                2

              ]

            }

          );

        expect(

          result

        ).toEqual(

          {

            originalHopCount: 4,

            optimizedHopCount: 2,

            removedHopCount: 2

          }

        );

      }

    );

  }

);