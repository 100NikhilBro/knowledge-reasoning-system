import {

  describe,
  expect,
  it

} from "vitest";

import {

  TraversalLimiter

} from "../src/utils/traversal-limiter.js";

describe(

  "Traversal Limiter",

  () => {

    it(

      "should stop after node limit",

      () => {

        const limiter =

          new TraversalLimiter({

            maxDepth: 5,

            maxNodes: 3

          });

        expect(

          limiter.canContinue(

            1,

            2

          )

        ).toBe(true);

        expect(

          limiter.canContinue(

            1,

            3

          )

        ).toBe(false);

      }

    );

  }

);