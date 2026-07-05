import {

  describe,
  expect,
  it

} from "vitest";

import {

  ComparisonStrategy

} from "../src/strategy/comparison.strategy.js";

describe(

  "Comparison Strategy",

  () => {

    it(

      "should instantiate",

      () => {

        expect(

          new ComparisonStrategy()

        ).toBeDefined();

      }

    );

  }

);

