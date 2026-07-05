import {

  describe,

  expect,

  it

} from "vitest";

import {

  buildPropagatedConfidence

} from "../src/utils/build-propagated-confidence.js";

describe(

  "Build Propagated Confidence",

  () => {

    it(

      "creates propagated confidence",

      () => {

        const result =

          buildPropagatedConfidence(

            2

          );

        expect(

          result.depth

        ).toBe(2);

        expect(

          result.confidence

        ).toBeCloseTo(

          0.81

        );

      }

    );

  }

);