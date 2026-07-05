import {

  describe,
  expect,
  it

} from "vitest";

import {

  ReasoningStrategyFactory

} from "../src/strategy/reasoning-strategy-factory.js";

describe(

  "Strategy Factory",

  () => {

    it(

      "creates multi-hop strategy",

      () => {

        const strategy =

          ReasoningStrategyFactory.create({

    strategy: "multi-hop",

    maxDepth: 3

});

        expect(

          strategy

        ).toBeDefined();

      }

    );

  }

);