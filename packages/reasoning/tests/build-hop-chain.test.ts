import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildHopChain

} from "../src/utils/build-hop-chain.js";

describe(

  "Hop Chain",

  () => {

    it(

      "builds only valid hops",

      () => {

        const chain =

          buildHopChain(

            5,

            0.9

          );

        expect(

          chain.hops

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