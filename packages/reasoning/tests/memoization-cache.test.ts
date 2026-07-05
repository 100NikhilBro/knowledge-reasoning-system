import {

  describe,

  expect,

  it

} from "vitest";

import {

  createMemoizationCache

} from "../src/utils/create-memoization-cache.js";

import {

  memoize

} from "../src/utils/memoize.js";

import {

  clearMemoizationCache

} from "../src/utils/clear-memoization-cache.js";

describe(

  "Memoization",

  () => {

    it(

      "reuses computed values",

      () => {

        const cache =

          createMemoizationCache();

        let count = 0;

        const compute = () => {

          count++;

          return 100;

        };

        expect(

          memoize(

            cache,

            "value",

            compute

          )

        ).toBe(

          100

        );

        expect(

          memoize(

            cache,

            "value",

            compute

          )

        ).toBe(

          100

        );

        expect(

          count

        ).toBe(

          1

        );

        clearMemoizationCache(

          cache

        );

      }

    );

  }

);