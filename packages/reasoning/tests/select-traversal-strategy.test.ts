import {

  describe,
  expect,
  it

} from "vitest";

import {

  selectTraversalStrategy

} from "../src/utils/select-traversal-strategy.js";

describe(

  "Traversal Strategy Selector",

  () => {

    it(

      "uses bfs for compare queries",

      () => {

        expect(

          selectTraversalStrategy(

            "compare react and vue"

          )

        ).toBe(

          "bfs"

        );

      }

    );

    it(

      "uses dfs for reasoning queries",

      () => {

        expect(

          selectTraversalStrategy(

            "why does react fiber work"

          )

        ).toBe(

          "dfs"

        );

      }

    );

  }

);