import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildTraversalPlan

} from "../src/utils/build-traversal-plan.js";

describe(

  "Traversal Plan",

  () => {

    it(

      "builds strategy and depth",

      () => {

        const plan =

          buildTraversalPlan(

            "why compare react and vue"

          );

        expect(

          plan.strategy

        ).toBe(

          "bfs"

        );

        expect(

          plan.depth.depth

        ).toBe(

          1

        );

      }

    );

  }

);