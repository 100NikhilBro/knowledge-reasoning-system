import {

  describe,
  expect,
  it

} from "vitest";

import {

  propagateConfidence

} from "../src/utils/propagate-confidence.js";

describe(

  "Confidence Propagation",

  () => {

    it(

      "propagates confidence",

      () => {

        expect(

          propagateConfidence(

            0

          )

        ).toBeCloseTo(

          1

        );

        expect(

          propagateConfidence(

            1

          )

        ).toBeCloseTo(

          0.9

        );

        expect(

          propagateConfidence(

            2

          )

        ).toBeCloseTo(

          0.81

        );

      }

    );

  }

);