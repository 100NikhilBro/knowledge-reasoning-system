import {

  describe,
  expect,
  it

} from "vitest";

import {

  prepareTraversal

} from "../src/utils/prepare-traversal.js";

describe(

  "Prepare Traversal",

  () => {

    it(

      "prepares traversal configuration",

      () => {

        const prepared =

          prepareTraversal(

            "compare react and vue"

          );

        expect(

          prepared.plan.strategy

        ).toBe(

          "bfs"

        );

        expect(

          prepared.plan.depth.depth

        ).toBe(

          1

        );

        expect(

          prepared.expand

        ).toBe(

          true

        );

      }

    );

  }

);