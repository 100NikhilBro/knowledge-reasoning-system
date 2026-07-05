import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildOptimizationPipeline

} from "../src/utils/build-optimization-pipeline.js";

describe(

  "Optimization Pipeline",

  () => {

    it(

      "builds optimization pipeline",

      () => {

        const result =

          buildOptimizationPipeline(

            {

              hops: [

                1,

                2,

                3,

                4

              ]

            },

            2

          );

        expect(

          result.optimization.optimized

        ).toEqual(

          [

            1,

            2

          ]

        );

        expect(

          result.summary.removedHopCount

        ).toBe(

          2

        );

      }

    );

  }

);