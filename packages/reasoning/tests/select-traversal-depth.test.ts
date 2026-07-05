import {

  describe,
  expect,
  it

} from "vitest";

import {

  selectTraversalDepth

} from "../src/utils/select-traversal-depth.js";

describe(

  "Traversal Depth Selector",

  () => {

    it(

      "uses shallow depth for compare",

      () => {

        expect(

          selectTraversalDepth(

            "compare react and vue"

          ).depth

        ).toBe(

          1

        );

      }

    );

    it(

      "uses deep traversal for why",

      () => {

        expect(

          selectTraversalDepth(

            "why does node use libuv"

          ).depth

        ).toBe(

          4

        );

      }

    );

    it(

      "uses relationship depth",

      () => {

        expect(

          selectTraversalDepth(

            "relationship between tcp and ip"

          ).depth

        ).toBe(

          5

        );

      }

    );

    it(

      "uses default depth",

      () => {

        expect(

          selectTraversalDepth(

            "react"

          ).depth

        ).toBe(

          2

        );

      }

    );

  }

);