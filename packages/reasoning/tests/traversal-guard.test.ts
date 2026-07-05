import {

  describe,
  expect,
  it

} from "vitest";

import {

  TraversalGuard

} from "../src/utils/traversal-guard.js";

describe(

  "Traversal Guard",

  () => {

    it(

      "should track visited nodes",

      () => {

        const guard =

          new TraversalGuard();

        guard.add("A");

        guard.add("B");

        expect(

          guard.has("A")

        ).toBe(true);

        expect(

          guard.has("C")

        ).toBe(false);

        expect(

          guard.size()

        ).toBe(2);

      }

    );

  }

);