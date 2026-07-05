import {

  describe,

  expect,

  it

} from "vitest";

import {

  createQueryCache

} from "../src/utils/create-query-cache.js";

import {

  cacheQuery

} from "../src/utils/cache-query.js";

import {

  getCachedQuery

} from "../src/utils/get-cached-query.js";

import {

  hasCachedQuery

} from "../src/utils/has-cached-query.js";

import {

  clearQueryCache

} from "../src/utils/clear-query-cache.js";

describe(

  "Query Cache",

  () => {

    it(

      "stores and retrieves cached values",

      () => {

        const cache =

          createQueryCache();

        cacheQuery(

          cache,

          "graph",

          42

        );

        expect(

          hasCachedQuery(

            cache,

            "graph"

          )

        ).toBe(

          true

        );

        expect(

          getCachedQuery(

            cache,

            "graph"

          )

        ).toBe(

          42

        );

        clearQueryCache(

          cache

        );

        expect(

          hasCachedQuery(

            cache,

            "graph"

          )

        ).toBe(

          false

        );

      }

    );

  }

);