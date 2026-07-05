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

traversal: "bfs",

maxDepth: 3

});

        expect(

          strategy

        ).toBeDefined();

      }

    );

  }

);


it(

  "creates comparison strategy",

  () => {

    const strategy =

      ReasoningStrategyFactory.create({

        strategy: "comparison",

        traversal: "bfs",

        maxDepth: 1

      });

    expect(

      strategy

    ).toBeDefined();

  }

);