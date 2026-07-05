import {

  describe,
  expect,
  it

} from "vitest";

import {

  buildReasoningTrace

} from "../src/utils/build-reasoning-trace.js";

describe(

  "Reasoning Trace",

  () => {

    it(

      "builds structured trace",

      () => {

        const trace =

          buildReasoningTrace(

            "What is PEP 484?",

            [

              "Python",

              "PEP-484"

            ],

            4,

            1,

            0.92

          );

        expect(

          trace.query

        ).toBe(

          "What is PEP 484?"

        );

        expect(

          trace.traversal

        ).toHaveLength(

          2

        );

        expect(

          trace.evidenceCount

        ).toBe(

          4

        );

        expect(

          trace.conflicts

        ).toBe(

          1

        );

        expect(

          trace.confidence

        ).toBe(

          0.92

        );

      }

    );

  }

);