import {

  describe,
  expect,
  it

} from "vitest";

import {

  scoreHop

} from "../src/utils/score-hop.js";

describe(

  "Hop Score",

  () => {

    it(

      "reduces score as depth grows",

      () => {

        expect(

          scoreHop(

            1,

            0.8

          ).score

        ).toBe(

          0.8

        );

        expect(

          scoreHop(

            2,

            0.8

          ).score

        ).toBe(

          0.4

        );

      }

    );

  }

);