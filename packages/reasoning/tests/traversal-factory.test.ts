import {

  describe,
  expect,
  it

} from "vitest";

import {

  TraversalFactory

} from "../src/traversal/traversal-factory.js";

describe(

  "Traversal Factory",

  () => {

    it(

      "should create bfs",

      () => {

        expect(

          TraversalFactory.create(

            "bfs"

          )

        ).toBeDefined();

      }

    );

    it(

      "should create dfs",

      () => {

        expect(

          TraversalFactory.create(

            "dfs"

          )

        ).toBeDefined();

      }

    );

  }

);