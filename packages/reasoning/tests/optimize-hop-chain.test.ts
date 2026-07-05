import {

  describe,
  expect,
  it

} from "vitest";

import {

  optimizeHopChain

} from "../src/utils/optimize-hop-chain.js";

describe(

  "Optimize Hop Chain",

  () => {

    it(

      "limits hop count",

      () => {

        const result =

          optimizeHopChain(

            {

              hops: [

                1,

                2,

                3,

                4,

                5

              ]

            },

            3

          );

        expect(

          result.optimized

        ).toEqual(

          [

            1,

            2,

            3

          ]

        );

      }

    );

  }

);