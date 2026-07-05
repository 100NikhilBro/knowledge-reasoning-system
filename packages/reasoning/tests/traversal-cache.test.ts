import {

  describe,

  expect,

  it

} from "vitest";

import {

  createTraversalCache

} from "../src/utils/create-traversal-cache.js";

import {

  cacheTraversal

} from "../src/utils/cache-traversal.js";

import {

  getCachedTraversal

} from "../src/utils/get-cached-traversal.js";

import {

  hasCachedTraversal

} from "../src/utils/has-cached-traversal.js";

import {

  clearTraversalCache

} from "../src/utils/clear-traversal-cache.js";

describe(

  "Traversal Cache",

  () => {

    it(

      "stores traversal paths",

      () => {

        const cache =

          createTraversalCache();

        cacheTraversal(

          cache,

          "node-1",

          [

            "A",

            "B",

            "C"

          ]

        );

        expect(

          hasCachedTraversal(

            cache,

            "node-1"

          )

        ).toBe(

          true

        );

        expect(

          getCachedTraversal(

            cache,

            "node-1"

          )

        ).toEqual(

          [

            "A",

            "B",

            "C"

          ]

        );

        clearTraversalCache(

          cache

        );

        expect(

          hasCachedTraversal(

            cache,

            "node-1"

          )

        ).toBe(

          false

        );

      }

    );

  }

);